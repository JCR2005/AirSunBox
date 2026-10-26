import { Queue, Worker, Job } from 'bullmq'
import type { FastifyInstance } from 'fastify'
import { processDevicePayload } from './datalinkService.js'

const INGEST_QUEUE_NAME = 'ingest-dots'

function redisConnection() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379)
  }
}

export interface IngestJobData {
  deviceId: string
  payload: Record<string, unknown>
  options: {
    strictNumbers?: boolean
    lowercaseVariables?: boolean
  }
}

export interface IngestQueue {
  enqueue(data: IngestJobData): Promise<void>
  enqueueBatch(jobs: IngestJobData[]): Promise<void>
  close(): Promise<void>
}

export async function createIngestQueue(app: FastifyInstance): Promise<IngestQueue> {
  const queue = new Queue(INGEST_QUEUE_NAME, {
    connection: redisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 500,
      removeOnFail: 2000
    }
  })

  const worker = new Worker(INGEST_QUEUE_NAME, async (job: Job<IngestJobData>) => {
    const { deviceId, payload, options } = job.data
    // processDevicePayload ya evalúa las alertas del dispositivo
    await processDevicePayload(app, deviceId, payload, options)
  }, {
    connection: redisConnection(),
    concurrency: Number(process.env.INGEST_WORKER_CONCURRENCY || 4),
    limiter: { max: 100, duration: 1000 }
  })

  worker.on('failed', (job, err) => {
    app.log.error(`Ingest job ${job?.id} falló: ${err.message} — device: ${job?.data?.deviceId}`)
  })

  worker.on('stalled', (jobId) => {
    app.log.warn(`Ingest job ${jobId} stalled, reintentando...`)
  })

  return {
    async enqueue(data: IngestJobData) {
      await queue.add('ingest', data)
    },
    async enqueueBatch(jobs: IngestJobData[]) {
      await queue.addBulk(jobs.map(d => ({ name: 'ingest', data: d })))
    },
    async close() {
      await worker.close()
      await queue.close()
    }
  }
}