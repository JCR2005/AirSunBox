import type { FastifyInstance } from 'fastify'
import { getDeviceVariableScope, isLabelAllowed } from './deviceScopeService.js'
import { ensureDeviceVariable, insert as insertDot } from '../repositories/dots.js'
import { updateLastSeen } from '../repositories/devices.js'
import { evaluateDeviceAlerts } from './alertingService.js'

export interface IngestionOptions {
  strictNumbers?: boolean
  lowercaseVariables?: boolean
}

export interface IngestionStats {
  saved: number
  ignored: number
}

export async function processDevicePayload(
  app: FastifyInstance,
  deviceId: string,
  payload: Record<string, unknown>,
  opts: IngestionOptions = {}
): Promise<IngestionStats> {
  const scope = await getDeviceVariableScope(app.db, deviceId)
  const now = new Date()
  let saved = 0
  let ignored = 0

  for (const [rawVariable, rawValue] of Object.entries(payload)) {
    if (opts.strictNumbers && typeof rawValue !== 'number') {
      ignored++
      continue
    }

    const variable = opts.lowercaseVariables === false
      ? String(rawVariable)
      : String(rawVariable).toLowerCase()
    const value = Number(rawValue)
    if (Number.isNaN(value)) {
      ignored++
      continue
    }

    if (!isLabelAllowed(scope, variable)) {
      app.log.warn(`Variable "${variable}" no pertenece al espacio — ignorada (device ${deviceId})`)
      ignored++
      continue
    }

    await ensureDeviceVariable(app.db, deviceId, variable)
    await insertDot(app.db, now, deviceId, variable, value)

    await app.redis.set(
      `last:${deviceId}:${variable}`,
      JSON.stringify({ value, time: now }),
      { EX: 86400 }
    )

    app.realtime.broadcast(deviceId, variable, value, now)
    saved++
  }

  await updateLastSeen(app.db, deviceId, now)
  await evaluateDeviceAlerts(app, deviceId)

  return { saved, ignored }
}