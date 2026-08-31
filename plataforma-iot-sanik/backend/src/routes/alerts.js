export default async function alertsRoutes(app) {

  app.addHook('onRequest', app.authenticate)

  const canAccessDevice = async (deviceId, orgId) => {
    const { rows } = await app.db.query(
      'SELECT id FROM devices WHERE id = $1 AND org_id = $2',
      [deviceId, orgId]
    )
    return rows.length > 0
  }

  // ── Listar alertas de un dispositivo ──────────
  app.get('/:deviceId', async (req, reply) => {
    const orgId = req.user.orgId
    if (!(await canAccessDevice(req.params.deviceId, orgId))) {
      return reply.code(403).send({ error: 'Sin acceso' })
    }

    const { rows } = await app.db.query(
      `SELECT a.*, s.name AS space_name
       FROM alerts a
       LEFT JOIN devices d ON d.id = a.device_id
       LEFT JOIN spaces s ON s.id = d.space_id
       WHERE a.device_id = $1 AND d.org_id = $2
       ORDER BY a.created_at DESC`,
      [req.params.deviceId, orgId]
    )
    return rows
  })

  // ── Historial de disparos de un dispositivo ──
  app.get('/:deviceId/logs', async (req, reply) => {
    const orgId = req.user.orgId
    if (!(await canAccessDevice(req.params.deviceId, orgId))) {
      return reply.code(403).send({ error: 'Sin acceso' })
    }

    const { rows } = await app.db.query(
      `SELECT l.*, a.variable AS alert_variable, a.condition AS alert_condition, a.threshold AS alert_threshold
       FROM alert_logs l
       JOIN devices d ON d.id = l.device_id
       LEFT JOIN alerts a ON a.id = l.alert_id
       WHERE l.device_id = $1 AND d.org_id = $2
       ORDER BY l.created_at DESC
       LIMIT 100`,
      [req.params.deviceId, orgId]
    )
    return rows
  })

  // ── Crear alerta ───────────────────────────────
  app.post('/', async (req, reply) => {
    const orgId = req.user.orgId
    const {
      deviceId, variable, condition, threshold,
      channel, destination, message,
      cooldownMinutes, emailTo, webhookUrl,
      botToken, chatId
    } = req.body

    if (!deviceId) return reply.code(400).send({ error: 'deviceId es obligatorio' })

    if (!(await canAccessDevice(deviceId, orgId))) {
      return reply.code(403).send({ error: 'Sin acceso' })
    }

    const resolvedDestination =
      destination ||
      (channel === 'telegram' || botToken ? `tg@${chatId || 'chat'}` : null) ||
      (emailTo || webhookUrl)

    const { rows: [alert] } = await app.db.query(
      `INSERT INTO alerts
          (device_id, variable, condition, threshold, channel, destination,
           message, cooldown_minutes, email_to, webhook_url,
           telegram_bot_token, telegram_chat_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
      [
        deviceId,
        variable || 'aqi',
        condition || '>',
        Number(threshold),
        channel || '',
        resolvedDestination,
          message || null,
          Number(cooldownMinutes) || 0,
          emailTo || null,
          webhookUrl || null,
          botToken || null,
          chatId || null
        ]
      )
    return reply.code(201).send(alert)
  })

  // ── Activar / desactivar alerta ────────────────
  app.patch('/:id', async (req, reply) => {
    const { active } = req.body
    const { rows: [alert] } = await app.db.query(
      `UPDATE alerts a
       SET active = $1
       FROM devices d
       WHERE a.id = $2 AND a.device_id = d.id AND d.org_id = $3
       RETURNING a.*`,
      [active, req.params.id, req.user.orgId]
    )
    if (!alert) return reply.code(403).send({ error: 'Sin acceso' })
    return alert
  })

  // ── Eliminar alerta ────────────────────────────
  app.delete('/:id', async (req, reply) => {
    const { rowCount } = await app.db.query(
      `DELETE FROM alerts a
       USING devices d
       WHERE a.id = $1 AND a.device_id = d.id AND d.org_id = $2`,
      [req.params.id, req.user.orgId]
    )
    if (!rowCount) return reply.code(403).send({ error: 'Sin acceso' })
    return { message: 'Alerta eliminada' }
  })
}