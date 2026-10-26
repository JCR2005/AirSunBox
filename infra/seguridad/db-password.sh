#!/usr/bin/env bash
# Contraseña de la base de producción sin AWS (antes de tener SSM).
#
#   ./db-password.sh preparar   Copia la contraseña actual al backend/.env del
#                               servidor. Sin corte. Hacerlo ANTES de llevar a
#                               main la versión sin contraseña en el compose.
#   ./db-password.sh rotar      DESPUÉS de ese despliegue: contraseña nueva en
#                               Postgres y en backend/.env, y recrea el backend.
#                               Corte de unos segundos; si el backend no queda
#                               sano, vuelve a la anterior.
#
# Todo pasa dentro del servidor: la contraseña no sale de él ni se muestra.
# Cuando haya acceso a AWS, 1-secretos-a-ssm.sh la mueve a SSM.
set -euo pipefail
H=airsunbox-ec2
APP=/home/ubuntu/apps/airsunbox/plataforma-iot-airsunbox

case "${1:-}" in
preparar)
  ssh "$H" "sudo APP=$APP bash -s" <<'EOF'
set -euo pipefail
cd "$APP/backend"
if grep -q '^DB_PASSWORD=' .env; then
  echo "   backend/.env ya tiene DB_PASSWORD; no se cambia nada"
else
  v=$(docker exec iot_backend printenv DB_PASSWORD)
  [ -n "$v" ] || { echo "   el backend no tiene DB_PASSWORD" >&2; exit 1; }
  printf '\n# Contraseña de la base (fuera del repositorio)\nDB_PASSWORD=%s\n' "$v" >> .env
  echo "   DB_PASSWORD copiada a backend/.env"
fi
chmod 600 .env
echo "   permisos de backend/.env: $(stat -c %a .env)"
EOF
  echo "✓ Preparado. Ya se puede llevar a main la versión sin contraseña en el compose."
  ;;

rotar)
  ssh "$H" "sudo APP=$APP bash -s" <<'EOF'
set -euo pipefail
cd "$APP"
if grep -q 'DB_PASSWORD: iot_password' docker-compose.yml; then
  echo "   El servidor todavía tiene la versión con la contraseña en el compose; primero hay que desplegar la nueva." >&2
  exit 1
fi
grep -q '^DB_PASSWORD=' backend/.env || { echo "   Falta DB_PASSWORD en backend/.env (correr 'preparar')." >&2; exit 1; }

old=$(sed -n 's/^DB_PASSWORD=//p' backend/.env | tail -1)
new=$(openssl rand -hex 24)

aplicar() {   # $1 = contraseña
  printf "ALTER USER iot_user WITH PASSWORD '%s';\n" "$1" \
    | docker exec -i iot_db psql -U iot_user -d iot_platform -v ON_ERROR_STOP=1 -q
  { grep -v '^DB_PASSWORD=' backend/.env; printf 'DB_PASSWORD=%s\n' "$1"; } > backend/.env.tmp
  chmod 600 backend/.env.tmp && mv backend/.env.tmp backend/.env
  docker compose -p airsunbox -f docker-compose.yml up -d --no-deps --force-recreate backend >/dev/null 2>&1
}
sano() {
  for _ in $(seq 1 60); do
    [ "$(docker inspect -f '{{.State.Health.Status}}' iot_backend 2>/dev/null)" = healthy ] && return 0
    sleep 3
  done
  return 1
}

aplicar "$new"
if sano; then
  echo "   contraseña de la base cambiada; backend sano ✓"
else
  echo "   el backend no quedó sano: volviendo a la contraseña anterior…" >&2
  aplicar "$old"
  sano && echo "   restaurada; backend sano" >&2
  exit 1
fi
EOF
  echo "   web: $(curl -s -o /dev/null -w '%{http_code}' -m 10 https://18.223.121.208/)"
  echo "✓ La base ya no usa la contraseña que estaba publicada en el repositorio."
  ;;

*)
  echo "Uso: $0 preparar | rotar" >&2
  exit 1
  ;;
esac
