#!/usr/bin/env bash
# PASO 3 — Cifra el disco del EC2 (cifrado en reposo).
#
# Usa "Replace root volume" de AWS: la instancia solo se REINICIA, no se
# detiene, así que conserva la IP pública 18.223.121.208 (no es Elastic IP:
# detenerla la cambiaría y rompería el certificado, el deploy y los enlaces).
#
#   1. Activa el cifrado EBS por defecto en us-east-2 (desde ahora todo disco
#      nuevo de la cuenta en esta región nace cifrado con la clave aws/ebs).
#   2. Detiene Docker para que la foto del disco sea consistente
#      (la web queda fuera de servicio desde aquí).
#   3. Toma un snapshot del disco y espera a que termine.
#   4. Reemplaza el disco por uno nuevo creado desde ese snapshot; por el
#      cifrado por defecto, el nuevo nace cifrado. La instancia se reinicia.
#   5. Verifica disco cifrado, contenedores y web.
#
# Corte esperado: 10 a 25 minutos (lo que tarde el snapshot + el reinicio).
# Hacerlo en un horario sin uso. El disco viejo y el snapshot se CONSERVAN
# para volver atrás; se borran a mano cuando todo esté confirmado.
set -euo pipefail
source "$(dirname "$0")/comun.sh"

echo "== 0/5 Estado actual"
verificar_cuenta
root_dev=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --query 'Reservations[0].Instances[0].RootDeviceName' --output text)
vol=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query "Reservations[0].Instances[0].BlockDeviceMappings[?DeviceName=='$root_dev'].Ebs.VolumeId | [0]" --output text)
enc=$(aws ec2 describe-volumes --volume-ids "$vol" --query 'Volumes[0].Encrypted' --output text)
echo "   disco raíz $vol ($root_dev), cifrado: $enc"
[ "$enc" = "False" ] || { echo "   Ya está cifrado; no hay nada que hacer."; exit 0; }

# Permisos antes de cortar el servicio
puede() { local out; out=$("$@" --dry-run 2>&1 || true); [[ "$out" == *DryRunOperation* ]]; }
puede aws ec2 create-snapshot --volume-id "$vol" \
  || { echo "   Tu usuario de AWS no puede crear snapshots." >&2; exit 1; }
puede aws ec2 create-replace-root-volume-task --instance-id "$INSTANCE_ID" \
  || { echo "   Tu usuario de AWS no puede reemplazar el disco raíz." >&2; exit 1; }

read -r -p "   La web va a quedar fuera de servicio unos 10–25 minutos. ¿Seguir? [s/N] " r
[[ "$r" =~ ^[sS]$ ]] || { echo "   Cancelado."; exit 0; }

echo "== 1/5 Cifrado EBS por defecto en $REGION"
aws ec2 enable-ebs-encryption-by-default --query EbsEncryptionByDefault --output text | sed 's/^/   activado: /'

echo "== 2/5 Deteniendo Docker (los contenedores vuelven solos al reiniciar)"
ssh -n "$H" "sudo systemctl stop docker.socket docker && sync && echo '   Docker detenido'"

echo "== 3/5 Snapshot del disco"
snap=$(aws ec2 create-snapshot --volume-id "$vol" \
  --description "AirSunBox: disco raíz antes de cifrar ($(date -u +%F))" \
  --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Name,Value=airsunbox-raiz-antes-de-cifrar}]' \
  --query SnapshotId --output text)
echo "   $snap creado; esperando a que termine…"
until [ "$(aws ec2 describe-snapshots --snapshot-ids "$snap" --query 'Snapshots[0].State' --output text)" = completed ]; do
  printf "   %s\r" "$(aws ec2 describe-snapshots --snapshot-ids "$snap" --query 'Snapshots[0].Progress' --output text)"
  sleep 15
done
echo "   snapshot completo      "

echo "== 4/5 Reemplazando el disco raíz (reinicio, sin detener la instancia)"
task=$(aws ec2 create-replace-root-volume-task --instance-id "$INSTANCE_ID" --snapshot-id "$snap" \
  --no-delete-replaced-root-volume --query ReplaceRootVolumeTask.ReplaceRootVolumeTaskId --output text)
echo "   tarea $task"
while :; do
  st=$(aws ec2 describe-replace-root-volume-tasks --replace-root-volume-task-ids "$task" \
    --query 'ReplaceRootVolumeTasks[0].TaskState' --output text)
  case "$st" in
    succeeded) echo "   reemplazo terminado"; break ;;
    failed|failed-detached)
      echo "   El reemplazo falló ($st). AWS deja el disco original puesto." >&2
      echo "   Docker vuelve con el reinicio; si no, en el servidor: sudo systemctl start docker" >&2
      exit 1 ;;
    *) sleep 15 ;;
  esac
done

echo "== 5/5 Verificación"
new_vol=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query "Reservations[0].Instances[0].BlockDeviceMappings[?DeviceName=='$root_dev'].Ebs.VolumeId | [0]" --output text)
read -r new_enc kms < <(aws ec2 describe-volumes --volume-ids "$new_vol" --query 'Volumes[0].[Encrypted,KmsKeyId]' --output text)
echo "   disco nuevo $new_vol, cifrado: $new_enc ($kms)"
for _ in $(seq 1 40); do ssh -n -o ConnectTimeout=5 "$H" true 2>/dev/null && break; sleep 5; done
ssh -n "$H" "sudo systemctl is-active docker >/dev/null || sudo systemctl start docker"
esperar_backend_sano
ssh -n "$H" "sudo docker ps --format '   {{.Names}}\t{{.Status}}'"
echo "   web: $(curl -s -o /dev/null -w '%{http_code}' -m 10 https://18.223.121.208/)"
echo "   IP pública: $(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)"

echo
echo "✓ Disco cifrado. Para Terraform (Dany): ebs_volume_id = $new_vol y root_block_device.encrypted = true."
echo "  Respaldo para volver atrás: disco viejo $vol y snapshot $snap (borrarlos a mano cuando todo esté confirmado)."
