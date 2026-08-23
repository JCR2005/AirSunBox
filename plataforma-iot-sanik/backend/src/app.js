import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import websocket from '@fastify/websocket'
import 'dotenv/config'

import dbPlugin    from './plugins/db.js'
import redisPlugin from './plugins/redis.js'
import mqttPlugin  from './plugins/mqtt.js'
import realtimePlugin from './plugins/realtime.js'

import authRoutes          from './routes/auth.js'
import devicesRoutes       from './routes/devices.js'
import variablesRoutes     from './routes/variables.js'
import dotsRoutes          from './routes/dots.js'
import alertsRoutes        from './routes/alerts.js'
import organizationsRoutes from './routes/organizations.js'
import spacesRoutes        from './routes/spaces.js'
import paymentsRoutes      from './routes/payments.js'
import requestsRoutes      from './routes/requests.js'
import incidentsRoutes     from './routes/incidents.js'
import reportsRoutes       from './routes/reports.js'
import publicRoutes        from './routes/publicRoutes.js'

const app = Fastify({ logger: true })

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
app.decorate('authenticate', async function (req, reply) {
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
await app.register(mqttPlugin)
await app.register(realtimePlugin)

// ── Rutas ──────────────────────────────────────
await app.register(authRoutes,          { prefix: '/api/auth' })
await app.register(devicesRoutes,       { prefix: '/api/devices' })
await app.register(variablesRoutes,     { prefix: '/api/variables' })
await app.register(dotsRoutes,          { prefix: '/api/dots' })
await app.register(alertsRoutes,        { prefix: '/api/alerts' })
await app.register(organizationsRoutes, { prefix: '/api/organizations' })
await app.register(spacesRoutes,        { prefix: '/api/spaces' })
await app.register(paymentsRoutes,      { prefix: '/api/payments' })
await app.register(requestsRoutes,      { prefix: '/api/requests' })
await app.register(incidentsRoutes,     { prefix: '/api/incidents' })
await app.register(reportsRoutes,       { prefix: '/api/reports' })
await app.register(publicRoutes,        { prefix: '/api/public' })

// ── WebSocket tiempo real ──────────────────────
app.get('/ws', { websocket: true }, (socket) => {
  app.log.info('Cliente WebSocket conectado')

  socket.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString())

      if (data.type === 'subscribe' && data.deviceId) {
        app.realtime.subscribe(data.deviceId, socket)
      } else if (data.type === 'unsubscribe' && data.deviceId) {
        app.realtime.unsubscribe(data.deviceId, socket)
      }
    } catch (err) {
      app.log.error('Mensaje WebSocket inválido:', err.message)
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

// ── Arrancar ───────────────────────────────────
try {
  await app.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}