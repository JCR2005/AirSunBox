# Configuración y funciones compartidas por los scripts de seguridad.
# Se carga con `source`; no se ejecuta solo.

REGION=us-east-2
ACCOUNT_ID=009644552142
INSTANCE_ID=i-07a637df8369c3f6c
SSM_PATH=/airsunbox/prod
SECRETS=(JWT_SECRET DB_PASSWORD SMTP_PASS)
H=airsunbox-ec2
APP=/home/ubuntu/apps/airsunbox/plataforma-iot-airsunbox
COMPOSE="sudo docker compose -p airsunbox -f docker-compose.yml"

export AWS_REGION=$REGION AWS_PAGER=""

# Carpeta privada para archivos temporales con secretos; se borra al salir
TMP=$(mktemp -d)
chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT

verificar_cuenta() {
  local account
  account=$(aws sts get-caller-identity --query Account --output text) || {
    echo "No hay sesión de AWS. Corré 'aws login' (o 'aws configure') y volvé a intentar." >&2
    exit 1
  }
  [ "$account" = "$ACCOUNT_ID" ] || { echo "Cuenta de AWS inesperada: $account" >&2; exit 1; }
  echo "   cuenta $account, región $REGION"
}

# guardar_secreto NOMBRE  (el valor llega por stdin; nunca por argumentos ni pantalla)
guardar_secreto() {
  local name=$1 file="$TMP/param.json"
  python3 -c '
import json, sys
value = sys.stdin.read()
if not value:
    sys.exit("valor vacío")
json.dump({"Name": sys.argv[1], "Type": "SecureString", "Overwrite": True, "Value": value}, open(sys.argv[2], "w"))
' "$SSM_PATH/$name" "$file" || { echo "   $name: sin valor, no se guardó" >&2; return 1; }
  aws ssm put-parameter --cli-input-json "file://$file" --query Version --output text >/dev/null
  rm -f "$file"
  echo "   $SSM_PATH/$name guardado (SecureString)"
}

# Valor de una clave en el backend/.env del servidor, sin comillas ni \r
valor_env_servidor() {
  ssh -n "$H" "sudo sed -n 's/^$1=//p' $APP/backend/.env | tail -1" | python3 -c '
import sys
v = sys.stdin.read().rstrip("\r\n")
if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"\x27":
    v = v[1:-1]
sys.stdout.write(v)
'
}

esperar_backend_sano() {
  local s=""
  for _ in $(seq 1 60); do
    s=$(ssh -n "$H" "sudo docker inspect -f '{{.State.Health.Status}}' iot_backend" 2>/dev/null || true)
    [ "$s" = healthy ] && return 0
    sleep 3
  done
  echo "   el backend no quedó sano (estado: ${s:-desconocido})" >&2
  return 1
}
