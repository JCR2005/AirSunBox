import { Queue, Worker } from 'bullmq'
import type { FastifyInstance } from 'fastify'
import { dispatch } from './alertDispatcher.js'
import type { AlertRow, AlertContext } from './alertDispatcher.js'

const QUEUE_NAME = 'alert-dispatch'

function redisConnection() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379)
  }
}

export interface AlertQueue {
  enqueue(alert: AlertRow, ctx: AlertContext): Promise<void>
}

export async function createAlertQueue(app: FastifyInstance): Promise<AlertQueue & { close(): Promise<void> }> {
  const queue = new Queue(QUEUE_NAME, { connection: redisConnection() })

  const worker = new Worker(QUEUE_NAME, async (job) => {
    const { alert, ctx } = job.data as { alert: AlertRow; ctx: AlertContext }
    await dispatch(app, alert, ctx)
  }, {
    connection: redisConnection(),
    concurrency: 3
  })

  worker.on('failed', (job, err) => {
    app.log.error(`Alerta ${job?.data?.alert?.id} — job fallido: ${err.message}`)
  })

  return {
    async enqueue(alert: AlertRow, ctx: AlertContext) {
      await queue.add('send-alert', { alert, ctx }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000
      })
    },
    async close() {
      await worker.close()
      await queue.close()
    }
  }
}