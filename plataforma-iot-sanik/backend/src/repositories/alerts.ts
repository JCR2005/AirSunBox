import type { Queryable } from '../types/index.js'

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
  created_at: Date
}

export interface AlertWithSpace extends AlertRow {
  space_name?: string | null
}

export async function listByDevice(db: Queryable, deviceId: string, orgId: string) {
  const { rows } = await db.query<AlertWithSpace>(
    `SELECT a.*, s.name AS space_name
     FROM alerts a
     LEFT JOIN devices d ON d.id = a.device_id
     LEFT JOIN spaces s ON s.id = d.space_id
     WHERE a.device_id = $1 AND d.org_id = $2
     ORDER BY a.created_at DESC`,
    [deviceId, orgId]
  )
  return rows
}

export async function listLogsByDevice(db: Queryable, deviceId: string, orgId: string) {
  const { rows } = await db.query(
    `SELECT l.*, a.variable AS alert_variable, a.condition AS alert_condition, a.threshold AS alert_threshold
     FROM alert_logs l
     JOIN devices d ON d.id = l.device_id
     LEFT JOIN alerts a ON a.id = l.alert_id
     WHERE l.device_id = $1 AND d.org_id = $2
     ORDER BY l.created_at DESC
     LIMIT 100`,
    [deviceId, orgId]
  )
  return rows
}

export async function create(db: Queryable, params: {
  deviceId: string
  variable?: string
  condition?: string
  threshold: number
  channel?: string
  destination?: string | null
  message?: string | null
  cooldownMinutes?: number
  emailTo?: string | null
  webhookUrl?: string | null
  botToken?: string | null
  chatId?: string | null
}): Promise<AlertRow[]> {
  const { rows } = await db.query<AlertRow>(
    `INSERT INTO alerts
        (device_id, variable, condition, threshold, channel, destination,
         message, cooldown_minutes, email_to, webhook_url,
         telegram_bot_token, telegram_chat_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
    [
      params.deviceId,
      params.variable || 'aqi',
      params.condition || '>',
      Number(params.threshold),
      params.channel || '',
      params.destination ?? null,
      params.message || null,
      Number(params.cooldownMinutes) || 0,
      params.emailTo || null,
      params.webhookUrl || null,
      params.botToken || null,
      params.chatId || null
    ]
  )
  return rows
}

export async function setActive(db: Queryable, id: string, active: boolean, orgId: string): Promise<AlertRow[]> {
  const { rows } = await db.query<AlertRow>(
    `UPDATE alerts a
     SET active = $1
     FROM devices d
     WHERE a.id = $2 AND a.device_id = d.id AND d.org_id = $3
     RETURNING a.*`,
    [active, id, orgId]
  )
  return rows
}

export async function remove(db: Queryable, id: string, orgId: string): Promise<number> {
  const result = await db.query(
    `DELETE FROM alerts a
     USING devices d
     WHERE a.id = $1 AND a.device_id = d.id AND d.org_id = $2`,
    [id, orgId]
  )
  return result.rowCount ?? 0
}

export async function activeByDevice(db: Queryable, deviceId: string) {
  const { rows } = await db.query<AlertWithSpace>(
    `SELECT a.*, d.name AS device_name, s.name AS space_name
     FROM alerts a
     JOIN devices d ON d.id = a.device_id
     LEFT JOIN spaces s ON s.id = d.space_id
     WHERE a.device_id = $1 AND a.active = true`,
    [deviceId]
  )
  return rows
}

export async function logTrigger(db: Queryable, params: {
  alertId: string
  deviceId: string
  variable: string
  value: number | null
  aqi: number | null
  category: string | null
  channel: string
  message: string
}): Promise<void> {
  await db.query(
    `INSERT INTO alert_logs (alert_id, device_id, variable, value, aqi, category, channel, status, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent', $8)`,
    [params.alertId, params.deviceId, params.variable, params.value, params.aqi, params.category, params.channel, params.message]
  )
}

export async function bumpTrigger(db: Queryable, alertId: string, at: Date): Promise<void> {
  await db.query(
    'UPDATE alerts SET last_triggered_at = $1, trigger_count = trigger_count + 1 WHERE id = $2',
    [at, alertId]
  )
}