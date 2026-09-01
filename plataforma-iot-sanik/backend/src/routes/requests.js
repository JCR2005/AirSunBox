const SANIK_ROLES = ['superadmin', 'admin', 'worker']

export default async function requestsRoutes(app) {
  app.addHook('onRequest', app.authenticate)

  // ── Listar solicitudes ─────────────────────────
  app.get('/', async (req) => {
    // Sanik ve todas, cliente ve las suyas
    const isInternal = SANIK_ROLES.includes(req.user.role)
    const { rows } = await app.db.query(
      `SELECT r.*, o.name as org_name
       FROM requests r
       JOIN organizations o ON o.id = r.org_id
       ${isInternal ? '' : 'WHERE r.org_id = $1'}
       ORDER BY r.created_at DESC`,
      isInternal ? [] : [req.user.orgId]
    )
    return rows
  })

  // ── Crear solicitud (cliente) ──────────────────
  app.post('/', async (req, reply) => {
    const { deviceName, location, quantity, note, paymentPhoto } = req.body
    const { rows: [request] } = await app.db.query(
      `INSERT INTO requests (org_id, device_name, location, quantity, note, payment_photo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.orgId, deviceName, location, quantity || 1, note, paymentPhoto]
    )
    return reply.code(201).send(request)
  })

  // ── Actualizar estado (Sanik) ──────────────────
  app.patch('/:id', async (req, reply) => {
    if (!SANIK_ROLES.includes(req.user.role))
      return reply.code(403).send({ error: 'Sin permisos' })

    const { status } = req.body
    const { rows: [request] } = await app.db.query(
      `UPDATE requests SET status = $1, reviewed_by = $2
       WHERE id = $3 RETURNING *`,
      [status, req.user.userId, req.params.id]
    )
    return request
  })
}
