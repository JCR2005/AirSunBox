import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { createIngestQueue, type IngestQueue } from '../services/ingestQueue.js'

async function ingestQueuePlugin(app: FastifyInstance) {
  const ingestQueue = await createIngestQueue(app)
  app.decorate('ingestQueue', ingestQueue)

  app.addHook('onClose', async () => {
    await ingestQueue.close()
  })
}

export default fp(ingestQueuePlugin)