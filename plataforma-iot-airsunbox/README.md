# Plataforma IoT AirSunBox: instalación y desarrollo

Código de la plataforma: backend, frontend, base de datos y broker MQTT. La
descripción del proyecto está en el [README principal](../README.md).

## Requisitos

- Docker y Docker Compose
- Node.js 20 (para el servidor de desarrollo del frontend)
- Git

## Levantar el entorno local

### 1. Configuración

En el repositorio no hay secretos: el backend los lee del entorno y no arranca
si faltan `DB_PASSWORD` o `JWT_SECRET`.

```bash
cp backend/.env.example backend/.env
```

Completá en `backend/.env`:

- `DB_PASSWORD`: una contraseña cualquiera para la base local;
- `JWT_SECRET`: una cadena aleatoria larga (`openssl rand -hex 32`);
- `SMTP_*`: opcional; sin SMTP no salen los correos de 2FA, recuperación de
  contraseña ni alertas.

Compose usa la misma contraseña al crear la base:

```bash
echo "DB_PASSWORD=<la misma de backend/.env>" > .env
```

Para que el servidor de Vite llegue al backend, publicá el puerto 3000 solo en
tu máquina con un `docker-compose.override.yml` (está en `.gitignore`):

```yaml
services:
  backend:
    ports:
      - "127.0.0.1:3000:3000"
```

### 2. Servicios

```bash
docker compose up -d timescaledb redis emqx backend
```

La primera vez, Postgres ejecuta `database/initdb/00-schema.sh`, que aplica
todas las migraciones en orden.

| Servicio | Dirección local |
|---|---|
| Backend (API) | http://localhost:3000 |
| Documentación de la API (Swagger) | http://localhost:3000/docs |
| TimescaleDB | `localhost:5434` (usuario `iot_user`, base `iot_platform`) |
| Redis | `localhost:6379` |
| MQTT | `mqtt://localhost:1883` |
| Panel de EMQX | http://localhost:18083 |

Los puertos de la base, Redis y el panel de EMQX solo escuchan en
`127.0.0.1`.

### 3. Primer superadministrador

```bash
docker compose exec backend node dist/scripts/createSuperadmin.js admin@ejemplo.com
```

Sin `SUPERADMIN_PASSWORD` en `backend/.env`, el script genera una contraseña
aleatoria y la muestra una sola vez.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Abrí http://localhost:5173. Vite envía `/api` y `/ws` al backend en
`localhost:3000`.

## Enviar lecturas de prueba

Cada estación tiene un token. Se ve en el detalle de la estación (pestaña
**Conectar ESP32**), donde también está el sketch para ESP32/ESP8266.

Por HTTP:

```bash
curl -X POST http://localhost:3000/api/dots/<TOKEN> \
  -H 'Content-Type: application/json' \
  -d '{"temperatura": 21.4, "humedad": 64, "pm2.5": 18.2}'
```

Por MQTT, en el tema `/v1/devices/<TOKEN>/data` con el mismo JSON.

Las claves del JSON son las variables de la estación. En los espacios de
organizaciones independientes se usa la **clave de estación** de cada
variable.

## Estructura

```
plataforma-iot-airsunbox/
├── docker-compose.yml        # TimescaleDB, Redis, EMQX, backend y nginx
├── backend/                  # API: Node.js 20 + Fastify 4 + TypeScript
│   ├── src/
│   │   ├── routes/           # Endpoints por dominio (auth, devices, dots, alerts…)
│   │   ├── services/         # Lógica: AQI, ingesta, alertas, reportes, 2FA…
│   │   ├── repositories/     # Consultas SQL
│   │   ├── plugins/          # Base de datos, Redis, MQTT, WebSocket, autenticación
│   │   ├── lib/              # Correo, secretos (AWS SSM), estado de estaciones
│   │   └── scripts/          # Tareas de administración (primer superadmin)
│   └── tests/smoke.mjs       # Pruebas de humo que corre el CI
├── frontend/                 # React 18 + Vite + Tailwind + Zustand
│   ├── src/pages/            # Pantallas de cliente, admin y públicas
│   ├── src/components/       # Componentes (estación, mapas, reportes…)
│   ├── src/utils/exportUtils.js  # Reportes PDF (jsPDF) y Excel (SheetJS)
│   └── nginx.conf            # HTTPS, cabeceras de seguridad y proxy a la API
├── database/                 # Migraciones SQL idempotentes (init, v2 … v24)
│   └── initdb/00-schema.sh   # Aplica las migraciones en orden
├── tools/simulate-station.mjs  # Generador de series realistas para pruebas
└── whatsapp-bot/             # Prototipo de bot de WhatsApp
```

## Comandos útiles

```bash
docker compose logs -f backend      # logs del backend
docker compose restart backend      # reiniciar un servicio
docker compose down                 # apagar todo
docker compose down -v              # apagar y borrar los datos

cd backend && npm run typecheck     # verificación de tipos (también en el CI)
cd backend && npm test              # pruebas de humo contra un backend en marcha
```

## Migraciones

Cada cambio de esquema es un archivo `database/vNN-descripcion.sql`,
idempotente, agregado al final de `database/initdb/00-schema.sh`. El CI las
aplica todas sobre una base vacía en cada PR. En una base existente se aplican
con `psql` (ver el [Runbook](../docs/runbook.md), sección 4).

## Producción

El despliegue en AWS (EC2, secretos en SSM, HTTPS, despliegue continuo) está
documentado en el [Manual técnico](../docs/manual-tecnico.md), el
[Runbook](../docs/runbook.md) y [`infra/seguridad`](../infra/seguridad/README.md).
