import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import websocket from '@fastify/websocket'
import rateLimit from '@fastify/rate-limit'
import { Redis } from 'ioredis'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { registry, registerDefaultMetrics, getMetrics } from './services/metrics.js'
import 'dotenv/config'

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

const app: FastifyInstance = Fastify({ logger: true })

// ── Plugins globales ──────────────────────────
await app.register(cors, {
  origin: (origin, cb) => {
    const allowed = [
      'https://voluble-creponne-e6c74f.netlify.app',
      'http://localhost',
      'http://localhost:5173'
    ]
    if (!origin || allowed.includes(origin)) {
      cb(null, true)
    } else {
      cb(new Error('Not allowed by CORS'), false)
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'ngrok-skip-browser-warning',
    'bypass-tunnel-reminder'
  ],
  credentials: true
})

await app.register(jwt, {
  secret: process.env.JWT_SECRET || 'sanik_secret_key'
})

// Decorador de autenticación
app.decorate('authenticate', async function (req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch (err) {
    reply.code(401).send({ error: 'No autorizado' })
  }
})

await app.register(websocket)

// ── Servicios ──────────────────────────────────
await app.register(dbPlugin)
await app.register(redisPlugin)
await app.register(ingestQueuePlugin)

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
    if (path.startsWith('/api/auth/')) return 10
    if (path.startsWith('/api/dots/')) return 200
    if (path.startsWith('/ws')) return 5
    return 200
  },
  timeWindow: '1 minute',
  keyGenerator: (req) => {
    const path = req.routeOptions?.url || req.url
    const prefix = path.startsWith('/api/auth/') ? 'auth' :
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
    info: { title: 'Sanik API', version: '2.0', description: 'API REST de la plataforma Sanik' },
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
app.get('/ws', { websocket: true }, (socket) => {
  app.log.info('Cliente WebSocket conectado')

  socket.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString()) as { type?: string; deviceId?: string }

      if (data.type === 'subscribe' && data.deviceId) {
        app.realtime.subscribe(data.deviceId, socket)
      } else if (data.type === 'unsubscribe' && data.deviceId) {
        app.realtime.unsubscribe(data.deviceId, socket)
      }
    } catch (err) {
      app.log.error(`Mensaje WebSocket inválido: ${(err as Error).message}`)
    }
  })

  socket.on('close', () => {
    app.realtime.unsubscribeAll(socket)
  })

  socket.on('error', () => {
    app.realtime.unsubscribeAll(socket)
  })
})

// ── Healthcheck ────────────────────────────────
app.get('/health', () => ({ status: 'ok', service: 'sanik-backend', version: '2.0' }))

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