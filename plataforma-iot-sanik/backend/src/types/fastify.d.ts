import type { FastifyRequest, FastifyReply } from 'fastify'
import type { Pool } from 'pg'
import type { MqttClient } from 'mqtt'
import type { JwtPayload, RealtimeService, RedisLike } from './index.js'
import type { AlertQueue } from '../services/alertQueue.js'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool
    redis: RedisLike
    realtime: RealtimeService
    mqtt: MqttClient
    alertQueue: AlertQueue
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>
  }
}