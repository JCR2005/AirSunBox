import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import * as requestsRepo from '../repositories/requests.js'
import { isSanikRole } from '../services/authService.js'

export default async function requestsRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<TypeBoxTypeProvider>()
  api.addHook('onRequest', app.authenticate)

  // ── Listar solicitudes ─────────────────────────
  api.get('/', async (req) => {
    const isInternal = isSanikRole(req.user.role)
    return requestsRepo.list(app.db, isInternal, req.user.orgId)
  })

  // ── Crear solicitud (cliente) ──────────────────
  api.post('/', {
    schema: {
      body: Type.Object({
        deviceName: Type.Optional(Type.String()),
        location: Type.Optional(Type.String()),
        quantity: Type.Optional(Type.Number()),
        note: Type.Optional(Type.String()),
        paymentPhoto: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const { deviceName, location, quantity, note, paymentPhoto } = req.body
    const request = await requestsRepo.create(app.db, {
      orgId: req.user.orgId,
      deviceName: deviceName ?? '',
      location: location ?? '',
      quantity: quantity || 1,
      note: note ?? null,
      paymentPhoto: paymentPhoto ?? null
    })
    return reply.code(201).send(request)
  })

  // ── Actualizar estado (Sanik) ──────────────────
  api.patch('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        status: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    if (!isSanikRole(req.user.role))
      return reply.code(403).send({ error: 'Sin permisos' })

    const { status } = req.body
    const request = await requestsRepo.updateStatus(app.db, req.params.id, status ?? '', req.user.userId)
    return request
  })
}