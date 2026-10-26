import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import * as incidentsRepo from '../repositories/incidents.js'
import { isSanikRole } from '../services/authService.js'

export default async function incidentsRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<TypeBoxTypeProvider>()
  api.addHook('onRequest', app.authenticate)

  // ── Listar incidencias ─────────────────────────
  api.get('/', async (req) => {
    const isInternal = isSanikRole(req.user.role)
    return incidentsRepo.list(app.db, isInternal, req.user.orgId)
  })

  // ── Crear incidencia (cliente) ─────────────────
  api.post('/', {
    schema: {
      body: Type.Object({
        deviceId: Type.Optional(Type.String()),
        reason: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const { deviceId, reason } = req.body
    const incident = await incidentsRepo.create(app.db, {
      deviceId: deviceId ?? '',
      orgId: req.user.orgId,
      reason: reason ?? ''
    })

    await app.db.query(
      "UPDATE devices SET status = 'review' WHERE id = $1",
      [deviceId]
    )

    return reply.code(201).send(incident)
  })

  // ── Resolver incidencia (Sanik) ────────────────
  api.patch('/:id/resolve', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        notes: Type.Optional(Type.String()),
        deviceId: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    if (!isSanikRole(req.user.role))
      return reply.code(403).send({ error: 'Sin permisos' })

    const { notes, deviceId } = req.body
    const incident = await incidentsRepo.resolve(app.db, req.params.id, notes ?? null)

    if (deviceId) {
      await app.db.query(
        "UPDATE devices SET status = 'active' WHERE id = $1",
        [deviceId]
      )
    }

    return incident
  })
}