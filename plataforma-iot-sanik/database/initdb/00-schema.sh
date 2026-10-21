#!/bin/sh
# Inicializa una base NUEVA aplicando el esquema base y todas las migraciones
# en orden. Postgres solo ejecuta /docker-entrypoint-initdb.d cuando el
# volumen está vacío, así que nunca toca una base existente.
#
# Para agregar una migración: crear database/vNN-*.sql (idempotente) y
# sumarla al final de la lista.
set -eu
DIR=/sanik-db

for f in \
  init.sql \
  database-v2.sql \
  aqi.sql \
  migrate-full.sql \
  v6-spaces-icon.sql \
  v7-spaces-icon-backfill.sql \
  v8-space-variables.sql \
  v9-password-recovery.sql \
  v10-device-display-variables.sql \
  v11-alerts-engine.sql \
  v12-alerts-telegram.sql \
  v13-space-accent-color.sql \
  v14-public-map-and-phrases.sql \
  v15-otp-2fa.sql \
  v16-no2-to-h2s.sql \
  v17-h2s-to-ugm3.sql \
  v18-2fa-flag-and-no-plain-passwords.sql \
  v19-dots-compression.sql \
  v20-align-with-production.sql
do
  echo "→ $f"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -q -f "$DIR/$f"
done
