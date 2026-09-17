import type { Pool, PoolClient } from 'pg'

export const SANIK_ROLES = ['superadmin', 'admin', 'worker'] as const

export type SanikRole = (typeof SANIK_ROLES)[number]
export type Role = SanikRole | 'client'

export type Queryable = Pool | PoolClient

export interface JwtPayload {
  userId: string
  orgId: string
  role: Role
  otp_pending?: boolean
}

export interface RedisLike {
  get(key: string): Promise<string | null>
  set(key: string, value: string, options?: { EX?: number }): Promise<unknown>
}

export interface RealtimeSocket {
  readyState: number
  send(data: string): void
}

export interface RealtimeService {
  subscribe(deviceId: string, socket: RealtimeSocket): void
  unsubscribe(deviceId: string, socket: RealtimeSocket): void
  unsubscribeAll(socket: RealtimeSocket): void
  broadcast(deviceId: string, variable: string, value: number, time: Date): void
}