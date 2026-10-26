import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import * as paymentsRepo from '../repositories/payments.js'
import * as orgsRepo from '../repositories/organizations.js'
import { isSanikRole } from '../services/authService.js'

export default async function paymentsRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<TypeBoxTypeProvider>()
  api.addHook('onRequest', app.authenticate)

  // ── Pagos de una organización ──────────────────
  api.get('/:orgId', {
    schema: { params: Type.Object({ orgId: Type.String() }) }
  }, async (req, reply) => {
    if (!isSanikRole(req.user.role) && req.user.orgId !== req.params.orgId)
      return reply.code(403).send({ error: 'Sin permisos' })
    return paymentsRepo.listByOrg(app.db, req.params.orgId)
  })

  // ── Registrar pago ─────────────────────────────
  api.post('/', {
    schema: {
      body: Type.Object({
        orgId: Type.String(),
        amount: Type.Number(),
        dueDate: Type.String(),
        note: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    if (!isSanikRole(req.user.role))
      return reply.code(403).send({ error: 'Sin permisos' })

    const { orgId, amount, dueDate, note } = req.body
    const payment = await paymentsRepo.create(app.db, {
      orgId,
      amount,
      dueDate,
      note: note ?? null,
      createdBy: req.user.userId
    })
    return reply.code(201).send(payment)
  })

  // ── Marcar pago como pagado ────────────────────
  api.patch('/:id/paid', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        note: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    if (!isSanikRole(req.user.role))
      return reply.code(403).send({ error: 'Sin permisos' })

    const { note } = req.body
    const payment = await paymentsRepo.markPaid(app.db, req.params.id, note ?? null)

    await orgsRepo.updatePaidUntil(app.db, payment.org_id, payment.due_date as string)

    return payment
  })
}