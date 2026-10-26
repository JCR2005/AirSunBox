#!/usr/bin/env bash
# PASO 1 — Pasa los secretos de producción a AWS SSM Parameter Store.
#
# Se corre UNA vez desde tu máquina, ANTES de llevar a main la versión del
# backend que lee los secretos de SSM. No cambia nada de lo que está
# funcionando: el backend actual ignora SSM hasta que llegue la versión nueva.
#
#   1. Da al rol del EC2 permiso de leer SOLO /airsunbox/prod/* (política inline).
#   2. Copia JWT_SECRET y SMTP_PASS del backend/.env del servidor y la
#      contraseña actual de la base a SSM como SecureString (cifrados con KMS).
#   3. Comprueba desde un contenedor del EC2 que se pueden leer con el rol.
#   4. Agrega SSM_SECRETS_PATH al backend/.env del servidor.
#
# Ningún secreto se muestra ni pasa por argumentos de comandos.
# Requisitos: AWS CLI v2 con sesión iniciada (aws login) y el alias ssh airsunbox-ec2.
set -euo pipefail
source "$(dirname "$0")/comun.sh"

echo "== 1/4 Cuenta de AWS"
verificar_cuenta

echo "== 2/4 Permiso del EC2 para leer sus secretos"
profile_arn=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].IamInstanceProfile.Arn' --output text)
role=$(aws iam get-instance-profile --instance-profile-name "${profile_arn##*/}" \
  --query 'InstanceProfile.Roles[0].RoleName' --output text)
aws iam put-role-policy --role-name "$role" --policy-name airsunbox-leer-secretos \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Sid\": \"LeerSecretosAirSunBox\",
      \"Effect\": \"Allow\",
      \"Action\": [\"ssm:GetParameters\", \"ssm:GetParameter\"],
      \"Resource\": \"arn:aws:ssm:$REGION:$ACCOUNT_ID:parameter$SSM_PATH/*\"
    }]
  }"
echo "   rol $role: política inline airsunbox-leer-secretos (solo lectura de $SSM_PATH/*)"

echo "== 3/4 Secretos a SSM"
valor_env_servidor JWT_SECRET | guardar_secreto JWT_SECRET
valor_env_servidor SMTP_PASS  | guardar_secreto SMTP_PASS
# La contraseña de la base todavía es la de siempre; el paso 2 la cambia
ssh -n "$H" "sudo docker exec iot_backend printenv DB_PASSWORD" | tr -d '\r\n' | guardar_secreto DB_PASSWORD

echo "   comprobando lectura desde un contenedor del EC2 (rol de la instancia)…"
names=$(printf "$SSM_PATH/%s " "${SECRETS[@]}")
ok=""
for _ in $(seq 1 12); do   # los permisos de IAM tardan unos segundos en propagarse
  ok=$(ssh -n "$H" "sudo docker run --rm public.ecr.aws/aws-cli/aws-cli ssm get-parameters \
        --region $REGION --with-decryption --names $names \
        --query 'length(Parameters)' --output text 2>/dev/null" || true)
  [ "$ok" = "${#SECRETS[@]}" ] && break
  sleep 10
done
[ "$ok" = "${#SECRETS[@]}" ] || { echo "   El EC2 no pudo leer los ${#SECRETS[@]} secretos (leyó: ${ok:-0})." >&2; exit 1; }
echo "   el EC2 lee los ${#SECRETS[@]} secretos ✓"

echo "== 4/4 backend/.env del servidor apunta a SSM"
ssh -n "$H" "set -e; cd $APP/backend
  sudo grep -q '^SSM_SECRETS_PATH=' .env || printf '\n# Secretos en AWS SSM Parameter Store (ver backend/src/lib/secrets.ts)\nSSM_SECRETS_PATH=$SSM_PATH\n' | sudo tee -a .env >/dev/null
  sudo grep -q '^AWS_REGION=' .env || echo 'AWS_REGION=$REGION' | sudo tee -a .env >/dev/null
  sudo chmod 600 .env
  echo \"   \$(sudo grep -c '^SSM_SECRETS_PATH=' .env) línea SSM_SECRETS_PATH, permisos \$(sudo stat -c %a .env)\""

echo
echo "✓ Listo. Siguiente: pasar a main la versión que lee de SSM y después correr 2-rotar-db-y-limpiar.sh"
