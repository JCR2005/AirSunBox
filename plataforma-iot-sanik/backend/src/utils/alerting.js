import { getDeviceAqi } from './aqi.js'
import { createMailer } from '../lib/mailer.js'

// ─────────────────────────────────────────────
// SANIK — Motor de alertas 1.0
// Evalúa alertas activas de una estación cada vez que llega un dato.
// Soporta alertas por variable y por AQI (variable = 'aqi').
// De-duplicado: transición false→true, o re-notificación cada
// cooldown_minutes si la condición se mantiene.
// ─────────────────────────────────────────────

let _mailer = null
const mailer = (app) => {
  if (!_mailer) _mailer = createMailer(app.log)
  return _mailer
}

function str() {
  return 'Alerta Sanik'
}

function renderMessage(template, ctx) {
  const fallback =
    `ALERTA · ${ctx.stationName || 'Estación'} (${ctx.spaceName || 'sin espacio'})\n` +
    `${ctx.variable === 'aqi'
      ? `AQI ${ctx.aqi ?? '--'} · ${ctx.category || '—'}`
      : `${ctx.variable} = ${ctx.formattedValue} ${ctx.unit || ''}`}\n` +
    `${ctx.time}`

  if (!template) return fallback

  const replacers = {
    estacion: ctx.stationName || 'Estación',
    espacio: ctx.spaceName || '—',
    variable: ctx.variable === 'aqi' ? 'AQI' : (ctx.variable || 'valor'),
    valor: ctx.formattedValue,
    unit: ctx.unit || '',
    aqi: ctx.aqi ?? '--',
    categoria: ctx.category || '—',
    hora: ctx.time
  }

  return String(template).replace(/\{(\w+)\}/g, (m, k) => (replacers[k] != null ? replacers[k] : m))
}

function evalCondition(alert, value) {
  const v = Number(value)
  const t = Number(alert.threshold)
  if (alert.condition === '>') return v > t
  if (alert.condition === '<') return v < t
  if (alert.condition === '=') return v === t
  if (alert.condition === '>=') return v >= t
  if (alert.condition === '<=') return v <= t
  return false
}

async function dispatch(app, alert, ctx) {
  const messageText = renderMessage(alert.message, ctx)
  const subject = `Alerta Sanik · ${ctx.stationName || 'Estación'}`

  const channels = []
  // Compat con las columnas legacy channel/destination
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

  // Email
  if (emailTo) {
    try {
      await mailer(app).sendAlert(emailTo, subject, messageText)
    } catch (err) {
      app.log.error(`Alerta ${alert.id} — error email: ${err.message}`)
    }
  }

  // Telegram (bot propio de la org)
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
      const data = await res.json()
      if (!data.ok) {
        throw new Error(data.description || 'Telegram rechazó el mensaje')
      }
    } catch (err) {
      app.log.error(`Alerta ${alert.id} — error Telegram: ${err.message}`)
    }
  }

  // Webhook
  if (webhookUrl) {    try {
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
      app.log.error(`Alerta ${alert.id} — error webhook: ${err.message}`)
    }
  }

  // Registrar el disparo
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

export async function evaluateDeviceAlerts(app, deviceId) {
  const fired = []
  try {
    const { rows: alerts } = await app.db.query(
      `SELECT a.*, d.name AS device_name, s.name AS space_name
       FROM alerts a
       JOIN devices d ON d.id = a.device_id
       LEFT JOIN spaces s ON s.id = d.space_id
       WHERE a.device_id = $1 AND a.active = true`,
      [deviceId]
    )

    if (!alerts.length) return fired

    const now = Date.now()

    // Últimos valores de las variables referenciadas
    const varLabels = [...new Set(alerts.filter(a => a.variable !== 'aqi').map(a => a.variable))]
    let latestValues = {}
    if (varLabels.length) {
      const { rows: dots } = await app.db.query(
        `SELECT DISTINCT ON (variable) variable, value
         FROM dots
         WHERE device_id = $1 AND variable = ANY($2)
           AND time > NOW() - INTERVAL '1 hour'
         ORDER BY variable, time DESC`,
        [deviceId, varLabels]
      )
      for (const d of dots) latestValues[d.variable] = Number(d.value)
    }

    // AQI (una sola vez si hay alguna alerta por índice)
    let aqiRes = null
    if (alerts.some(a => a.variable === 'aqi')) {
      aqiRes = await getDeviceAqi(app, deviceId)
    }

    for (const alert of alerts) {
      const isAqi = alert.variable === 'aqi'
      const value = isAqi ? aqiRes?.aqi : latestValues[alert.variable]

      if (value == null || isNaN(Number(value))) continue

      const matching = evalCondition(alert, value)
      const stateKey = `alert:state:${alert.id}`
      const lastKey = `alert:last:${alert.id}`

      if (!matching) {
        if (app.redis) await app.redis.set(stateKey, 'false', { EX: 60 * 60 })
        continue
      }

      // De-duplicación: transición o cooldown
      const [prevState, lastFiredStr] = await Promise.all(
        app.redis
          ? [app.redis.get(stateKey), app.redis.get(lastKey)]
          : [Promise.resolve(null), Promise.resolve(null)]
      )
      const lastFired = lastFiredStr ? Number(lastFiredStr) : 0
      const cooldownMs = (Number(alert.cooldown_minutes) || 0) * 60 * 1000

      const transition = prevState !== 'true'
      const expiredCooldown = cooldownMs > 0 && now - lastFired >= cooldownMs
      const repeat = prevState === 'true' && expiredCooldown

      if (!transition && !repeat) continue

      if (app.redis) {
        await app.redis.set(stateKey, 'true', { EX: 60 * 60 })
        await app.redis.set(lastKey, String(now), { EX: 60 * 60 })
      }

      const displayValue = isAqi ? (value != null ? Math.round(Number(value)) : null) : Number(value)
      const ctx = {
        rawValue: Number(value),
        formattedValue: Number.isInteger(displayValue) ? String(displayValue) : String(Number(value)),
        aqi: isAqi ? Number(value) : null,
        category: isAqi ? (aqiRes?.category || null) : null,
        stationName: alert.device_name,
        spaceName: alert.space_name,
        variable: alert.variable,
        unit: '',
        time: new Date().toLocaleString('es-GT')
      }

      await dispatch(app, alert, ctx)
      fired.push(alert.id)
      app.log.info(`🔔 Alerta disparada ${alert.id} — device ${deviceId} (${isAqi ? 'aqi=' + value : alert.variable + '=' + value})`)
    }
  } catch (err) {
    app.log.error('Error evaluando alertas:', err.message)
  }
  return fired
}