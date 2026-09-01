const SANIK_ROLES = ['superadmin', 'admin', 'worker']

export default async function incidentsRoutes(app) {
  app.addHook('onRequest', app.authenticate)

  // ── Listar incidencias ─────────────────────────
  app.get('/', async (req) => {
    const isInternal = SANIK_ROLES.includes(req.user.role)
    const { rows } = await app.db.query(
      `SELECT i.*, d.name as device_name, o.name as org_name
       FROM incidents i
       JOIN devices d ON d.id = i.device_id
       JOIN organizations o ON o.id = i.org_id
       ${isInternal ? '' : 'WHERE i.org_id = $1'}
       ORDER BY i.created_at DESC`,
      isInternal ? [] : [req.user.orgId]
    )
    return rows
  })

  // ── Crear incidencia (cliente) ─────────────────
  app.post('/', async (req, reply) => {
    const { deviceId, reason } = req.body
    const { rows: [incident] } = await app.db.query(
      `INSERT INTO incidents (device_id, org_id, reason)
       VALUES ($1, $2, $3) RETURNING *`,
      [deviceId, req.user.orgId, reason]
    )
    // Cambiar estado del dispositivo a 'review'
    await app.db.query(
      "UPDATE devices SET status = 'review' WHERE id = $1",
      [deviceId]
    )
    return reply.code(201).send(incident)
  })

  // ── Resolver incidencia (Sanik) ────────────────
  app.patch('/:id/resolve', async (req, reply) => {
    if (!SANIK_ROLES.includes(req.user.role))
      return reply.code(403).send({ error: 'Sin permisos' })

    const { notes, deviceId } = req.body
    const { rows: [incident] } = await app.db.query(
      `UPDATE incidents SET status = 'resolved', resolved_at = NOW(), notes = $1
       WHERE id = $2 RETURNING *`,
      [notes, req.params.id]
    )
    // Restaurar estado del dispositivo
    if (deviceId) {
      await app.db.query(
        "UPDATE devices SET status = 'active' WHERE id = $1",
        [deviceId]
      )
    }
    return incident
  })
}
