# Plataforma IoT — Setup

## Requisitos
- Docker Desktop instalado
- Git

## Levantar todo con un comando

Primero los secretos (ningún secreto está en el repositorio):

```bash
cp backend/.env.example backend/.env    # completar DB_PASSWORD, JWT_SECRET y SMTP_*
echo "DB_PASSWORD=<la misma>" > .env    # la usa compose al crear la base
docker-compose up -d
```

Eso levanta los 5 servicios:

| Servicio      | URL / Puerto                        |
|---------------|-------------------------------------|
| Frontend      | http://localhost                    |
| Backend API   | http://localhost:3000               |
| MQTT          | mqtt://localhost:1883               |
| EMQX Panel    | http://localhost:18083              |
| TimescaleDB   | localhost:5432                      |
| Redis         | localhost:6379                      |

## Credenciales por defecto

**Base de datos**
- Usuario: `iot_user`
- Password: la que definas en `DB_PASSWORD` (ver *Secretos* más abajo)
- Base: `iot_platform`

**EMQX Panel** (administración del broker MQTT)
- URL: http://localhost:18083
- Usuario y contraseña: los de fábrica de EMQX; cambiarlos al primer ingreso.
  El panel solo escucha en 127.0.0.1.

## Secretos

- En el repositorio no hay secretos: el código los lee del entorno y no tiene
  valores por defecto (sin `DB_PASSWORD` o `JWT_SECRET` el backend no arranca).
- **Producción:** `JWT_SECRET`, `DB_PASSWORD` y `SMTP_PASS` están cifrados en
  AWS SSM Parameter Store (`/airsunbox/prod/*`) y el backend los lee al
  arrancar con el rol del EC2. Procedimiento y scripts en
  [`infra/seguridad`](../infra/seguridad/README.md).
- **Desarrollo:** `backend/.env` (en `.gitignore`), a partir de `backend/.env.example`.

## Estructura del proyecto

```
plataforma-iot/
├── docker-compose.yml      ← levanta todo
├── database/
│   └── init.sql            ← tablas de la base de datos
├── backend/                ← Node.js + Fastify (Prog. 1)
└── frontend/               ← React + Vite (Prog. 2)
```

## Comandos útiles

```bash
# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs solo del backend
docker-compose logs -f backend

# Reiniciar un servicio
docker-compose restart backend

# Apagar todo
docker-compose down

# Apagar todo y borrar datos
docker-compose down -v
```

## Configuración del ESP32

El ESP32 manda datos a:
```
MQTT broker: mqtt://TU_IP:1883
Topic:       /v1/devices/{DEVICE_TOKEN}/data
Payload:     {"temperatura": 25.4, "humedad": 60}
```

## Deploy en Railway

1. Subir el repo a GitHub
2. Crear proyecto en railway.app
3. Agregar cada servicio desde el repo
4. Las variables de entorno ya están en docker-compose.yml

## Caso de uso: creación de espacio

**Actor:** administrador de la plataforma
**Disparador:** el admin quiere registrar un espacio físico nuevo (ej. "Sala de
servidores") para luego asociarle estaciones IoT.

### Flujo principal
1. En "Mis espacios", pulsa **+ Nuevo espacio**.
2. Escribe el **nombre** (ej. "Sala de servidores GmbH").
3. El **slug se genera automáticamente** al escribir (sin tildes ni símbolos →
   `sala-de-servidores-gmbh`); el campo slug no se edita a mano.
4. Elige la **categoría** (Aire · Tierra · Agua · Otro).
5. Si elige **Otro**, escribe el tipo libre y **selecciona un icono de la
   galería** (catálogo con scroll oculto y flechita nav) — ej. `servidor`.
6. Guardar → se crea el espacio (HTTP 201) y aparece en la grilla con su
   nombre, slug **y el icono elegido** en la tarjeta.

### Reglas
- El slug se deriva del **nombre** con `generateLabel` (a nivel de módulo):
  minúsculas, sin acentos, espacios→guiones, sin guiones al inicio/fin.
- La tarjeta del listado muestra el **icono seleccionado en la galería**
  (mapa `nombre→componente lucide` reutilizado por modal y tarjetas), con
  fallback a `Layers` si el espacio no trae icono.

### Caso de éxito
"Creé 'Sala de servidores' → slug `sala-de-servidores`, icono **servidor** →
la tarjeta lo muestra al instante. Verificado en vivo: HTTP 200 · bundle sin
ReferenceError (hash distinto al bundle roto)."

### Postcondiciones
- Persistido en backend (`spaces`), visible en la grilla del listado.
- Puede editarse (lápiz) y abrirse para agregar estaciones.
