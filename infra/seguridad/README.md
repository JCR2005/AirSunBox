# Seguridad de producción: secretos y cifrado en reposo

Scripts para dejar producción sin secretos en texto plano y con el disco
cifrado. Se corren **desde la máquina del responsable**, en orden, con:

- AWS CLI v2 con sesión iniciada en la cuenta `009644552142` (`aws login`, o
  `aws configure` con una clave de acceso).
- El alias ssh `airsunbox-ec2`.

Ningún script muestra secretos: los valores viajan por tuberías y archivos
temporales privados (`mktemp`, permisos 700) que se borran al terminar.

## Cómo quedan los secretos

| Secreto | Dónde vive | Quién lo lee |
|---|---|---|
| `JWT_SECRET`, `DB_PASSWORD`, `SMTP_PASS` | AWS SSM Parameter Store, `/airsunbox/prod/*`, tipo **SecureString** (cifrado con KMS) | El backend al arrancar ([`lib/secrets.ts`](../../plataforma-iot-airsunbox/backend/src/lib/secrets.ts)), con el rol IAM del EC2 |
| Configuración no secreta (`FRONTEND_URL`, `SMTP_USER`, `SSM_SECRETS_PATH`…) | `backend/.env` del servidor (permisos 600, fuera de git) | docker compose |

- No hay claves de AWS en el servidor: el SDK usa el rol de la instancia (IMDSv2).
- El rol solo puede **leer** `/airsunbox/prod/*` (política inline `airsunbox-leer-secretos`).
- En desarrollo y CI no se consulta AWS (`SSM_SECRETS_PATH` vacío) y se usan las variables de entorno.
- Si SSM no responde y falta algún secreto, el backend no arranca (no corre con valores vacíos).

## Pasos

| # | Script | Cuándo | Corte |
|---|---|---|---|
| 1 | `1-secretos-a-ssm.sh` | Antes de pasar a `main` la versión que lee de SSM | Ninguno |
| 2 | `2-rotar-db-y-limpiar.sh` | Después de ese despliegue | Segundos (reinicio del backend) |
| 3 | `3-cifrar-disco.sh` | En un horario sin uso | 10–25 min |

1. **Secretos a SSM:** permiso de lectura para el rol del EC2, copia
   `JWT_SECRET` y `SMTP_PASS` del `.env` del servidor y la contraseña actual
   de la base a SSM, comprueba la lectura desde un contenedor del EC2 y agrega
   `SSM_SECRETS_PATH` al `.env`.
2. **Rotación y limpieza:** la contraseña de la base estuvo publicada en el
   repositorio, así que se genera una nueva, se guarda en
   SSM, se aplica en Postgres y se reinicia el backend (con vuelta atrás
   automática si no queda sano). Después borra los secretos del `.env` del
   servidor y ofrece borrar las copias `.env.bak*`.
3. **Disco cifrado:** activa el cifrado EBS por defecto de la región, detiene
   Docker, toma un snapshot y reemplaza el disco raíz con *Replace root volume*.
   La instancia **se reinicia sin detenerse**, así que conserva la IP pública
   (no es Elastic IP; detenerla la cambiaría y rompería el certificado y el
   deploy). El disco viejo y el snapshot quedan para volver atrás.

## Sin acceso a AWS todavía: `db-password.sh`

Mientras no se pueda usar SSM, la contraseña de la base igual se cambia
(la anterior estuvo publicada en el repositorio):

1. `./db-password.sh preparar`: copia la contraseña actual al `backend/.env`
   del servidor (sin corte). Antes de llevar a `main` la versión sin la
   contraseña en el compose.
2. Despliegue de esa versión.
3. `./db-password.sh rotar`: contraseña nueva en Postgres y en `backend/.env`
   (permisos 600) y recrea el backend; vuelve atrás solo si no queda sano.

Después, `1-secretos-a-ssm.sh` la lleva a SSM igual que el resto.

## Después del paso 3 (Terraform)

`root_block_device.encrypted` cambia a `true` y el volumen raíz tiene otro ID.
Hay que actualizar `terraform/generated_instance.tf` (`encrypted = true`) y
el `ebs_volume_id` de las variables **antes del próximo `terraform apply`**:
con `encrypted = false`, Terraform intentaría reemplazar la instancia.

## Cifrado en tránsito

- Web y API: HTTPS (Let's Encrypt, TLS 1.2/1.3), HTTP redirige a HTTPS, HSTS y
  cabeceras de seguridad en nginx (`frontend/security-headers.conf`).
- Renovación del certificado: certbot (snap) cada 12 h; el hook
  `/etc/letsencrypt/renewal-hooks/deploy/recargar-nginx.sh` recarga nginx.
- Base de datos, Redis y panel de EMQX solo escuchan en la red interna o en
  127.0.0.1; el security group solo abre 80, 443 y 22 (restringido por IP).
