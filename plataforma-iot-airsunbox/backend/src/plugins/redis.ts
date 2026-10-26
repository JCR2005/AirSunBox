import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { createClient } from 'redis'

async function redisPlugin(app: FastifyInstance) {
  const client = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379)
    }
  })

  client.on('error', (err) => app.log.error('Redis error:', err))

  await client.connect()
  app.log.info('✅ Conectado a Redis')

  app.decorate('redis', client)

  app.addHook('onClose', async () => {
    await client.disconnect()
  })
}

export default fp(redisPlugin)