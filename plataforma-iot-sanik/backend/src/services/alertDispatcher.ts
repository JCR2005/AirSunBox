import type { FastifyInstance } from 'fastify'
import { createMailer } from '../lib/mailer.js'
import { assertPublicUrl } from '../lib/safeUrl.js'
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

export interface AlertContext {
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

export async function dispatch(app: FastifyInstance, alert: AlertRow, ctx: AlertContext): Promise<void> {
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
      // Revalida al enviar (el DNS pudo cambiar) y no sigue redirecciones,
      // que podrían llevar a la red interna
      const target = await assertPublicUrl(webhookUrl)
      await fetch(target, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
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