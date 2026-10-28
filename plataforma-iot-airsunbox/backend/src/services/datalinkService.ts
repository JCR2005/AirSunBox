import type { FastifyInstance } from 'fastify'
import { getDeviceVariableScope, resolveVariable } from './deviceScopeService.js'
import { ensureDeviceVariable, insert as insertDot, insertBatch } from '../repositories/dots.js'
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

  const batchRows: Array<{ time: Date; deviceId: string; variable: string; value: number }> = []

  for (const [rawVariable, rawValue] of Object.entries(payload)) {
    if (opts.strictNumbers && typeof rawValue !== 'number') {
      ignored++
      continue
    }

    const sent = opts.lowercaseVariables === false
      ? String(rawVariable)
      : String(rawVariable).toLowerCase()
    const value = Number(rawValue)
    if (Number.isNaN(value)) {
      ignored++
      continue
    }

    // En un espacio, la estación envía el nombre de la variable en el espacio
    // (temperatura) y se guarda con la clave interna del catálogo.
    const variable = resolveVariable(scope, sent)
    if (!variable) {
      app.log.warn(`Variable "${sent}" no pertenece al espacio — ignorada (device ${deviceId})`)
      ignored++
      continue
    }

    await ensureDeviceVariable(app.db, deviceId, variable)
    batchRows.push({ time: now, deviceId, variable, value })
    saved++
  }

  if (batchRows.length > 0) {
    await insertBatch(app.db, batchRows)

    for (const row of batchRows) {
      await app.redis.set(
        `last:${row.deviceId}:${row.variable}`,
        JSON.stringify({ value: row.value, time: now }),
        { EX: 86400 }
      )
      app.realtime.broadcast(row.deviceId, row.variable, row.value, now)
    }
  }

  await updateLastSeen(app.db, deviceId, now)
  await evaluateDeviceAlerts(app, deviceId)

  return { saved, ignored }
}