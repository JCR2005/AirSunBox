const SANIK_ROLES = ['superadmin', 'admin', 'worker']

export default async function paymentsRoutes(app) {
  app.addHook('onRequest', app.authenticate)

  // ── Pagos de una organización ──────────────────
  app.get('/:orgId', async (req, reply) => {
    if (!SANIK_ROLES.includes(req.user.role) && req.user.orgId !== req.params.orgId)
      return reply.code(403).send({ error: 'Sin permisos' })

    const { rows } = await app.db.query(
      `SELECT p.*, u.email as created_by_email
       FROM payments p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.org_id = $1
       ORDER BY p.due_date DESC`,
      [req.params.orgId]
    )
    return rows
  })

  // ── Registrar pago ─────────────────────────────
  app.post('/', async (req, reply) => {
    if (!SANIK_ROLES.includes(req.user.role))
      return reply.code(403).send({ error: 'Sin permisos' })

    const { orgId, amount, dueDate, note } = req.body

    const { rows: [payment] } = await app.db.query(
      `INSERT INTO payments (org_id, amount, due_date, note, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [orgId, amount, dueDate, note, req.user.userId]
    )
    return reply.code(201).send(payment)
  })

  // ── Marcar pago como pagado ────────────────────
  app.patch('/:id/paid', async (req, reply) => {
    if (!SANIK_ROLES.includes(req.user.role))
      return reply.code(403).send({ error: 'Sin permisos' })

    const { note } = req.body
    const { rows: [payment] } = await app.db.query(
      `UPDATE payments SET status = 'paid', paid_at = NOW(), note = COALESCE($1, note)
       WHERE id = $2 RETURNING *`,
      [note, req.params.id]
    )

    // Actualizar paid_until en la organización
    await app.db.query(
      'UPDATE organizations SET paid_until = $1 WHERE id = $2',
      [payment.due_date, payment.org_id]
    )

    return payment
  })
}
