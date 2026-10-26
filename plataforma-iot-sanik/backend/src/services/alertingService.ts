import type { FastifyInstance } from 'fastify'
import { getDeviceAqi } from './aqiService.js'
import type { AlertRow, AlertContext } from './alertDispatcher.js'

function evalCondition(alert: AlertRow, value: number): boolean {
  const v = Number(value)
  const t = Number(alert.threshold)
  if (alert.condition === '>') return v > t
  if (alert.condition === '<') return v < t
  if (alert.condition === '=') return v === t
  if (alert.condition === '>=') return v >= t
  if (alert.condition === '<=') return v <= t
  return false
}

export async function evaluateDeviceAlerts(app: FastifyInstance, deviceId: string): Promise<string[]> {
  const fired: string[] = []
  try {
    const { rows: alerts } = await app.db.query<AlertRow>(
      `SELECT a.*, d.name AS device_name, s.name AS space_name
       FROM alerts a
       JOIN devices d ON d.id = a.device_id
       LEFT JOIN spaces s ON s.id = d.space_id
       WHERE a.device_id = $1 AND a.active = true`,
      [deviceId]
    )

    if (!alerts.length) return fired

    const now = Date.now()

    const varLabels = [...new Set(alerts.filter(a => a.variable !== 'aqi').map(a => a.variable))]
    let latestValues: Record<string, number> = {}
    if (varLabels.length) {
      const { rows: dots } = await app.db.query<{ variable: string; value: string | number }>(
        `SELECT DISTINCT ON (variable) variable, value
         FROM dots
         WHERE device_id = $1 AND variable = ANY($2)
           AND time > NOW() - INTERVAL '1 hour'
         ORDER BY variable, time DESC`,
        [deviceId, varLabels]
      )
      for (const d of dots) latestValues[d.variable] = Number(d.value)
    }

    let aqiRes = null
    if (alerts.some(a => a.variable === 'aqi')) {
      aqiRes = await getDeviceAqi(app.db, deviceId)
    }

    for (const alert of alerts) {
      const isAqi = alert.variable === 'aqi'
      const value = isAqi ? aqiRes?.aqi ?? null : latestValues[alert.variable]

      if (value == null || Number.isNaN(Number(value))) continue

      const matching = evalCondition(alert, value)
      const stateKey = `alert:state:${alert.id}`
      const lastKey = `alert:last:${alert.id}`

      if (!matching) {
        await app.redis.set(stateKey, 'false', { EX: 60 * 60 })
        continue
      }

      // Las operaciones son atómicas en Redis: con varios workers ingiriendo
      // el mismo equipo a la vez, solo uno "gana" el disparo.
      //  - transición: SET ... GET devuelve el estado anterior y fija el nuevo
      //  - repetición: mientras exista alert:last (TTL = cooldown) no se repite;
      //    SET NX lo reclama solo si ya expiró
      const cooldownMs = (Number(alert.cooldown_minutes) || 0) * 60 * 1000
      const prevState = await app.redis.set(stateKey, 'true', { EX: 60 * 60, GET: true })
      let fire = prevState !== 'true'
      if (fire) {
        if (cooldownMs > 0) await app.redis.set(lastKey, String(now), { PX: cooldownMs })
      } else if (cooldownMs > 0) {
        fire = (await app.redis.set(lastKey, String(now), { PX: cooldownMs, NX: true })) === 'OK'
      }
      if (!fire) continue

      const displayValue = isAqi ? (value != null ? Math.round(Number(value)) : null) : Number(value)
      const ctx: AlertContext = {
        rawValue: Number(value),
        formattedValue: Number.isInteger(displayValue) ? String(displayValue) : String(Number(value)),
        aqi: isAqi ? Number(value) : null,
        category: isAqi ? (aqiRes?.category || null) : null,
        stationName: alert.device_name ?? null,
        spaceName: alert.space_name ?? null,
        variable: alert.variable,
        unit: '',
        time: new Date().toLocaleString('es-GT')
      }

      await app.alertQueue.enqueue(alert, ctx)
      fired.push(alert.id)
      app.log.info(`🔔 Alerta disparada ${alert.id} — device ${deviceId} (${isAqi ? 'aqi=' + value : alert.variable + '=' + value})`)
    }
  } catch (err) {
    app.log.error(`Error evaluando alertas: ${(err as Error).message}`)
  }
  return fired
}