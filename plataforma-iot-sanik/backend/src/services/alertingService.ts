import type { FastifyInstance } from 'fastify'
import { getDeviceAqi } from './aqiService.js'
import { createMailer } from '../lib/mailer.js'
import type { Mailer } from '../lib/mailer.js'

export interface AlertRow {
  id: string
  device_id: string
  variable: string
  condition: string
  threshold: string | number
  channel: string | null
  destination: string | null
  message: string | null
  cooldown_minutes: number | string | null
  email_to: string | null
  webhook_url: string | null
  telegram_bot_token: string | null
  telegram_chat_id: string | null
  active: boolean
  device_name?: string | null
  space_name?: string | null
}

interface AlertContext {
  rawValue: number | null
  formattedValue: string
  aqi: number | null
  category: string | null
  stationName: string | null
  spaceName: string | null
  variable: string
  unit: string
  time: string
}

let _mailer: Mailer | null = null
const mailer = (app: FastifyInstance): Mailer => {
  if (!_mailer) _mailer = createMailer(app.log)
  return _mailer
}

function str(): string {
  return 'Alerta Sanik'
}

function renderMessage(template: string | null, ctx: AlertContext): string {
  const fallback =
    `ALERTA · ${ctx.stationName || 'Estación'} (${ctx.spaceName || 'sin espacio'})\n` +
    `${ctx.variable === 'aqi'
      ? `AQI ${ctx.aqi ?? '--'} · ${ctx.category || '—'}`
      : `${ctx.variable} = ${ctx.formattedValue} ${ctx.unit || ''}`}\n` +
    `${ctx.time}`

  if (!template) return fallback

  const replacers: Record<string, string> = {
    estacion: ctx.stationName || 'Estación',
    espacio: ctx.spaceName || '—',
    variable: ctx.variable === 'aqi' ? 'AQI' : (ctx.variable || 'valor'),
    valor: ctx.formattedValue,
    unit: ctx.unit || '',
    aqi: String(ctx.aqi ?? '--'),
    categoria: ctx.category || '—',
    hora: ctx.time
  }

  return String(template).replace(/\{(\w+)\}/g, (m, k) => (replacers[k] != null ? replacers[k] : m))
}

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

async function dispatch(app: FastifyInstance, alert: AlertRow, ctx: AlertContext): Promise<void> {
  const messageText = renderMessage(alert.message, ctx)
  const subject = `Alerta Sanik · ${ctx.stationName || 'Estación'}`

  const channels: string[] = []
  let emailTo = alert.email_to
  let webhookUrl = alert.webhook_url
  if (!emailTo && alert.channel === 'email') emailTo = alert.destination
  if (!webhookUrl && alert.channel === 'webhook') webhookUrl = alert.destination
  if (!emailTo && !webhookUrl && alert.channel === 'both') {
    if ((alert.destination || '').includes('@')) emailTo = alert.destination
    else webhookUrl = alert.destination
  }

  if (emailTo) channels.push('email')
  if (webhookUrl) channels.push('webhook')
  if (alert.telegram_bot_token && alert.telegram_chat_id) channels.push('telegram')
  if (alert.telegram_bot_token && alert.telegram_chat_id) channels.push('telegram')
  if (alert.telegram_bot_token && alert.telegram_chat_id) channels.push('telegram')

  if (emailTo) {
    try {
      await mailer(app).sendAlert(emailTo, subject, messageText)
    } catch (err) {
      app.log.error(`Alerta ${alert.id} — error email: ${(err as Error).message}`)
    }
  }

  if (alert.telegram_bot_token && alert.telegram_chat_id) {
    try {
      const url = `https://api.telegram.org/bot${alert.telegram_bot_token}/sendMessage`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: alert.telegram_chat_id,
          text: messageText,
          disable_web_page_preview: true
        })
      })
      const data = await res.json() as { ok?: boolean; description?: string }
      if (!data.ok) {
        throw new Error(data.description || 'Telegram rechazó el mensaje')
      }
    } catch (err) {
      app.log.error(`Alerta ${alert.id} — error Telegram: ${(err as Error).message}`)
    }
  }

  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'alert-triggered',
          alertId: alert.id,
          deviceId: alert.device_id,
          station: ctx.stationName,
          space: ctx.spaceName,
          type: alert.variable === 'aqi' ? 'aqi' : 'variable',
          variable: alert.variable === 'aqi' ? 'aqi' : alert.variable,
          condition: alert.condition,
          threshold: Number(alert.threshold),
          value: ctx.rawValue,
          aqi: ctx.aqi ?? null,
          category: ctx.category ?? null,
          message: messageText,
          triggeredAt: ctx.time
        })
      })
    } catch (err) {
      app.log.error(`Alerta ${alert.id} — error webhook: ${(err as Error).message}`)
    }
  }

  await app.db.query(
    `INSERT INTO alert_logs (alert_id, device_id, variable, value, aqi, category, channel, status, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent', $8)`,
    [alert.id, alert.device_id, alert.variable, ctx.rawValue ?? null, ctx.aqi ?? null, ctx.category ?? null, channels.join(', ') || 'none', messageText]
  )

  await app.db.query(
    'UPDATE alerts SET last_triggered_at = $1, trigger_count = trigger_count + 1 WHERE id = $2',
    [new Date(), alert.id]
  )
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
        if (app.redis) await app.redis.set(stateKey, 'false', { EX: 60 * 60 })
        continue
      }

      const [prevState, lastFiredStr] = await Promise.all([
        app.redis.get(stateKey),
        app.redis.get(lastKey)
      ])
      const lastFired = lastFiredStr ? Number(lastFiredStr) : 0
      const cooldownMs = (Number(alert.cooldown_minutes) || 0) * 60 * 1000

      const transition = prevState !== 'true'
      const expiredCooldown = cooldownMs > 0 && now - lastFired >= cooldownMs
      const repeat = prevState === 'true' && expiredCooldown

      if (!transition && !repeat) continue

      await app.redis.set(stateKey, 'true', { EX: 60 * 60 })
      await app.redis.set(lastKey, String(now), { EX: 60 * 60 })

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

      await dispatch(app, alert, ctx)
      fired.push(alert.id)
      app.log.info(`🔔 Alerta disparada ${alert.id} — device ${deviceId} (${isAqi ? 'aqi=' + value : alert.variable + '=' + value})`)
    }
  } catch (err) {
    app.log.error(`Error evaluando alertas: ${(err as Error).message}`)
  }
  return fired
}