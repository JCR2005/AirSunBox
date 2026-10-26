import type { Pool, PoolClient } from 'pg'

export const INTERNAL_ROLES = ['superadmin', 'admin', 'worker'] as const

export type InternalRole = (typeof INTERNAL_ROLES)[number]
export type Role = InternalRole | 'client'

export type Queryable = Pool | PoolClient

export interface JwtPayload {
  userId: string
  orgId: string
  role: Role
  otp_pending?: boolean
  iat?: number
  exp?: number
}

export interface RedisLike {
  get(key: string): Promise<string | null>
  // GET devuelve el valor anterior; NX devuelve 'OK' solo si la clave no existía
  set(key: string, value: string, options?: { EX?: number; PX?: number; NX?: boolean; GET?: boolean }): Promise<string | null>
}

export interface RealtimeSocket {
  readyState: number
  send(data: string): void
}

export interface RealtimeService {
  subscribe(deviceId: string, socket: RealtimeSocket): Promise<void>
  unsubscribe(deviceId: string, socket: RealtimeSocket): Promise<void>
  unsubscribeAll(socket: RealtimeSocket): Promise<void>
  broadcast(deviceId: string, variable: string, value: number, time: Date): void
}