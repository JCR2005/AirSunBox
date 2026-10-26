#!/usr/bin/env bash
# PASO 2 — Cambia la contraseña de la base y saca los secretos del servidor.
#
# Se corre DESPUÉS de que esté desplegada la versión del backend que lee los
# secretos de SSM (el paso 1 ya tiene que estar hecho).
#
#   1. Comprueba que el backend en producción ya carga los secretos de SSM.
#   2. Genera una contraseña nueva para la base (la vieja estaba publicada en
#      el repositorio), la guarda en SSM, la aplica en Postgres y reinicia el
#      backend. Si el backend no queda sano, vuelve a la contraseña anterior.
#   3. Borra JWT_SECRET, SMTP_PASS y DB_PASSWORD del backend/.env del servidor
#      y recrea el backend para probar que arranca solo con SSM.
#   4. Lista las copias .env.bak* (tienen secretos en texto plano) y pregunta
#      si borrarlas.
#
# Corte esperado: unos segundos mientras se reinicia el backend.
set -euo pipefail
source "$(dirname "$0")/comun.sh"

echo "== 1/4 El backend lee de SSM"
verificar_cuenta
loaded=$(ssh -n "$H" "sudo docker logs iot_backend 2>&1 | grep 'Secretos cargados desde SSM' | tail -1" || true)
for s in "${SECRETS[@]}"; do
  [[ "$loaded" == *"$s"* ]] || { echo "   El backend todavía no carga $s de SSM. ¿Ya se desplegó la versión nueva?" >&2; exit 1; }
done
echo "   ${loaded#*: }"

echo "== 2/4 Contraseña nueva para la base"
old="$TMP/old"; new="$TMP/new"
aws ssm get-parameter --name "$SSM_PATH/DB_PASSWORD" --with-decryption --query Parameter.Value --output text | tr -d '\n' > "$old"
openssl rand -hex 24 | tr -d '\n' > "$new"

aplicar_password() {  # archivo con la contraseña
  guardar_secreto DB_PASSWORD < "$1"
  { printf "ALTER USER iot_user WITH PASSWORD '"; cat "$1"; printf "';\n"; } \
    | ssh "$H" "sudo docker exec -i iot_db psql -U iot_user -d iot_platform -v ON_ERROR_STOP=1 -q"
  ssh -n "$H" "sudo docker restart iot_backend >/dev/null"
}

aplicar_password "$new"
if esperar_backend_sano; then
  echo "   contraseña de la base cambiada; backend sano ✓"
else
  echo "   volviendo a la contraseña anterior…" >&2
  aplicar_password "$old"
  esperar_backend_sano && echo "   restaurada; backend sano. No se siguió con la limpieza." >&2
  exit 1
fi

echo "== 3/4 Secretos fuera del backend/.env del servidor"
ssh -n "$H" "set -e; cd $APP
  sudo sed -i -E '/^(JWT_SECRET|SMTP_PASS|DB_PASSWORD)=/d' backend/.env
  $COMPOSE up -d --no-deps --force-recreate backend 2>&1 | tail -1 | sed 's/^/   /'"
esperar_backend_sano
restantes=$(ssh -n "$H" "sudo grep -cE '^(JWT_SECRET|SMTP_PASS|DB_PASSWORD)=' $APP/backend/.env || true")
echo "   secretos que quedan en backend/.env: $restantes; el backend arrancó solo con SSM ✓"

echo "== 4/4 Copias viejas del .env"
copias=$(ssh -n "$H" "sudo find $APP -maxdepth 2 \\( -name '.env.bak*' -o -name '.env.*.bak' \\) | sort" || true)
if [ -z "$copias" ]; then
  echo "   no hay copias"
else
  echo "$copias" | sed 's/^/   /'
  read -r -p "   Estas copias tienen secretos en texto plano. ¿Borrarlas? [s/N] " r
  if [[ "$r" =~ ^[sS]$ ]]; then
    echo "$copias" | ssh "$H" "xargs -r sudo shred -u" && echo "   borradas"
  else
    echo "   se dejaron (recomendado borrarlas cuando confirmes que todo anda)"
  fi
fi

echo
echo "✓ Listo. La base tiene contraseña nueva y los secretos solo están en SSM."
