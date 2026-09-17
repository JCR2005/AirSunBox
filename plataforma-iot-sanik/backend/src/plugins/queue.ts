import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { createAlertQueue } from '../services/alertQueue.js'

async function alertQueuePlugin(app: FastifyInstance) {
  const alertQueue = await createAlertQueue(app)
  app.decorate('alertQueue', alertQueue)

  app.addHook('onClose', async () => {
    await alertQueue.close()
  })
}

export default fp(alertQueuePlugin)