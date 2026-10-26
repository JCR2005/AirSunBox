# Plataforma IoT — Setup

## Requisitos
- Docker Desktop instalado
- Git

## Levantar todo con un comando

```bash
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
- Password: `iot_password`
- Base: `iot_platform`

**EMQX Panel** (administración del broker MQTT)
- URL: http://localhost:18083
- Usuario: `admin`
- Password: `public`

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
