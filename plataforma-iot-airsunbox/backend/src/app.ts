import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import Fastify from 'fastify'
import crypto from 'node:crypto'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import websocket from '@fastify/websocket'
import rateLimit from '@fastify/rate-limit'
import { Redis } from 'ioredis'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { registry, registerDefaultMetrics, getMetrics } from './services/metrics.js'
import 'dotenv/config'
import type { JwtPayload } from './types/index.js'
import * as devicesRepo from './repositories/devices.js'
import { isInternalRole } from './services/authService.js'
import { isSessionRevoked, isTokenLoggedOut, SESSION_REVOKED } from './services/sessionRevocation.js'
import { bearerToken } from './lib/bearer.js'

import dbPlugin from './plugins/db.js'
import redisPlugin from './plugins/redis.js'
import mqttPlugin from './plugins/mqtt.js'
import realtimePlugin from './plugins/realtime.js'
import alertQueuePlugin from './plugins/queue.js'
import ingestQueuePlugin from './plugins/ingestQueue.js'

import authRoutes from './routes/auth.js'
import devicesRoutes from './routes/devices.js'
import variablesRoutes from './routes/variables.js'
import dotsRoutes from './routes/dots.js'
import alertsRoutes from './routes/alerts.js'
import organizationsRoutes from './routes/organizations.js'
import spacesRoutes from './routes/spaces.js'
import paymentsRoutes from './routes/payments.js'
import requestsRoutes from './routes/requests.js'
import incidentsRoutes from './routes/incidents.js'
import reportsRoutes from './routes/reports.js'
import publicRoutes from './routes/publicRoutes.js'

// Detrás de nginx, req.ip sería siempre la IP del proxy y el rate limit
// trataría a todos los usuarios como uno. Solo se confía en X-Forwarded-For
// cuando la conexión viene de la red interna de Docker o de esta máquina; un
// cliente externo que pegue directo al :3000 no puede falsear su IP.
const TRUST_PROXY = process.env.TRUST_PROXY || '127.0.0.1,::1,172.16.0.0/12'
const app: FastifyInstance = Fastify({ logger: true, trustProxy: TRUST_PROXY })

// ── Plugins globales ──────────────────────────
// Orígenes permitidos: los fijos más CORS_ORIGINS (lista separada por comas)
// para agregar dominios del despliegue sin tocar código.
const CORS_ORIGINS = new Set([
  'https://18.223.121.208',
  'http://18.223.121.208',
  'https://voluble-creponne-e6c74f.netlify.app',
  'http://localhost',
  'http://localhost:5173',
  ...(process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)
])

await app.register(cors, {
  // Un origen no permitido no recibe cabeceras CORS (el navegador lo bloquea);
  // pasar un Error aquí convertía la petición en un 500.
  origin: (origin, cb) => cb(null, !origin || CORS_ORIGINS.has(origin)),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'ngrok-skip-browser-warning',
    'bypass-tunnel-reminder'
  ],
  credentials: true
})

// En producción el secreto es obligatorio (backend/.env o SSM). Fuera de
// producción, si falta, se genera uno aleatorio al arrancar: no hay ningún
// secreto escrito en el código y las sesiones de desarrollo vencen al reiniciar.
const jwtSecret = process.env.JWT_SECRET?.trim() || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET no está definido (backend/.env o SSM)')
  }
  app.log.warn('⚠️  JWT_SECRET no definido: se usa uno aleatorio para esta ejecución')
  return crypto.randomBytes(32).toString('hex')
})()

// Vida de la sesión, formato de `ms` ("24h", "7d"). El token temporal de OTP
// fija su propio expiresIn (10m).
const JWT_TTL = process.env.JWT_EXPIRES_IN || '24h'

await app.register(jwt, {
  secret: jwtSecret,
  sign: { expiresIn: JWT_TTL }
})

// Solo vale como sesión un token con caducidad y sin OTP pendiente. Los
// emitidos antes de introducir expiresIn no traen "exp" y nunca caducarían.
// Un token otp_pending solo sirve para /api/auth/otp/verify; aceptarlo aquí
// permitiría saltarse el 2FA.
function isSessionToken(payload: JwtPayload): boolean {
  return !payload.otp_pending && typeof payload.exp === 'number'
}

app.decorate('authenticate', async function (req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch (err) {
    return reply.code(401).send({ error: 'No autorizado' })
  }
  if (!isSessionToken(req.user)) {
    return reply.code(401).send({ error: 'No autorizado' })
  }
  if (await isSessionRevoked(app, req.user)) {
    return reply.code(401).send(SESSION_REVOKED)
  }
  if (await isTokenLoggedOut(app, bearerToken(req))) {
    return reply.code(401).send({ error: 'No autorizado' })
  }
})

await app.register(websocket)

// ── Servicios ──────────────────────────────────
await app.register(dbPlugin)
await app.register(redisPlugin)
await app.register(ingestQueuePlugin)

// Límite estricto (10/min por IP) solo donde se pueden probar contraseñas o
// códigos, o disparar correos. Las lecturas con sesión (/auth/me, estado del
// 2FA) van con el límite general: con 10/min, navegar el perfil daba 429.
const BRUTE_FORCE_PATHS = [
  '/api/auth/login', '/api/auth/register', '/api/auth/otp/verify',
  '/api/auth/forgot-password', '/api/auth/reset-password',
  '/api/auth/2fa/send-code', '/api/auth/2fa/enable', '/api/auth/2fa/disable'
]
const isBruteForceTarget = (path: string) => BRUTE_FORCE_PATHS.some(p => path.startsWith(p))

const rateLimitRedis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true
})

await rateLimitRedis.connect()

await app.register(rateLimit, {
  global: true,
  max: (req) => {
    const path = req.routeOptions?.url || req.url
    if (isBruteForceTarget(path)) return 10
    if (path.startsWith('/api/dots/')) return 200
    if (path.startsWith('/ws')) return 60
    return 200
  },
  timeWindow: '1 minute',
  keyGenerator: (req) => {
    const path = req.routeOptions?.url || req.url
    const prefix = isBruteForceTarget(path) ? 'auth' :
                   path.startsWith('/api/dots/') ? 'dots' :
                   path.startsWith('/ws') ? 'ws' : 'api'
    return `${prefix}:${req.ip}`
  },
  redis: rateLimitRedis,
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true
  },
  errorResponseBuilder: (_req, context: any) => {
    const err = new Error(`Rate limit exceeded, retry in ${context.after}`)
    ;(err as Error & { statusCode: number }).statusCode = context.statusCode
    return err
  },
  ban: 300,
  skipOnError: true
})

await app.register(mqttPlugin)
await app.register(realtimePlugin)
await app.register(alertQueuePlugin)

await app.register(swagger, {
  openapi: {
    info: { title: 'AirSunBox API', version: '2.0', description: 'API REST de la plataforma AirSunBox' },
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    security: [{ bearerAuth: [] }]
  },
  transform: (schema) => schema
})

await app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: { docExpansion: 'list', deepLinking: true },
  staticCSP: true
})

registerDefaultMetrics()

// ── Rutas ──────────────────────────────────────
await app.register(authRoutes, { prefix: '/api/auth' })
await app.register(devicesRoutes, { prefix: '/api/devices' })
await app.register(variablesRoutes, { prefix: '/api/variables' })
await app.register(dotsRoutes, { prefix: '/api/dots' })
await app.register(alertsRoutes, { prefix: '/api/alerts' })
await app.register(organizationsRoutes, { prefix: '/api/organizations' })
await app.register(spacesRoutes, { prefix: '/api/spaces' })
await app.register(paymentsRoutes, { prefix: '/api/payments' })
await app.register(requestsRoutes, { prefix: '/api/requests' })
await app.register(incidentsRoutes, { prefix: '/api/incidents' })
await app.register(reportsRoutes, { prefix: '/api/reports' })
await app.register(publicRoutes, { prefix: '/api/public' })

// ── WebSocket tiempo real ──────────────────────
// Sin sesión solo se puede seguir estaciones del mapa público. Con sesión
// (mensaje {type:'auth', token}, nunca en la URL para que no quede en logs)
// también las de la propia organización, o todas si es rol AirSunBox.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function canWatchDevice(deviceId: string, user: JwtPayload | null): Promise<boolean> {
  if (!UUID_RE.test(deviceId)) return false
  if (user) {
    if (isInternalRole(user.role)) return true
    const scopes = await devicesRepo.findOrgScope(app.db, deviceId)
    if (scopes.length && scopes[0].org_id === user.orgId) return true
  }
  return devicesRepo.isPublicMapDevice(app.db, deviceId)
}

app.get('/ws', { websocket: true }, (socket) => {
  app.log.info('Cliente WebSocket conectado')
  let user: JwtPayload | null = null

  socket.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg.toString()) as { type?: string; deviceId?: string; token?: string }

      if (data.type === 'auth' && typeof data.token === 'string') {
        try {
          const decoded = app.jwt.verify<JwtPayload>(data.token)
          user = isSessionToken(decoded)
            && !(await isSessionRevoked(app, decoded))
            && !(await isTokenLoggedOut(app, data.token))
            ? decoded : null
        } catch {
          user = null
        }
        socket.send(JSON.stringify({ type: 'auth', ok: !!user }))
      } else if (data.type === 'subscribe' && data.deviceId) {
        if (await canWatchDevice(data.deviceId, user)) {
          await app.realtime.subscribe(data.deviceId, socket)
        } else {
          socket.send(JSON.stringify({ type: 'error', deviceId: data.deviceId, error: 'Sin acceso' }))
        }
      } else if (data.type === 'unsubscribe' && data.deviceId) {
        await app.realtime.unsubscribe(data.deviceId, socket)
      }
    } catch (err) {
      app.log.error(`Mensaje WebSocket inválido: ${(err as Error).message}`)
    }
  })

  const cleanup = () => {
    app.realtime.unsubscribeAll(socket).catch((err) => {
      app.log.error(`Error limpiando suscripciones WebSocket: ${(err as Error).message}`)
    })
  }
  socket.on('close', cleanup)
  socket.on('error', cleanup)
})

// ── Healthcheck ────────────────────────────────
app.get('/health', () => ({ status: 'ok', service: 'airsunbox-backend', version: '2.0' }))

// ── Metrics (Prometheus) ───────────────────────
app.get('/metrics', async () => {
  const metrics = await getMetrics()
  return metrics
})

app.addHook('onClose', async () => {
  await rateLimitRedis.quit()
})

// ── Arrancar ───────────────────────────────────
try {
  await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
