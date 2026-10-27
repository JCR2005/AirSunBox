import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import * as incidentsRepo from '../repositories/incidents.js'
import { isInternalRole } from '../services/authService.js'

const UUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
const IdParams = Type.Object({ id: Type.String({ pattern: UUID }) })

export default async function incidentsRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<TypeBoxTypeProvider>()
  api.addHook('onRequest', app.authenticate)

  // ── Listar incidencias ─────────────────────────
  // El equipo AirSunBox ve todas; el cliente, solo las de su organización.
  api.get('/', async (req) => {
    const isInternal = isInternalRole(req.user.role)
    return incidentsRepo.list(app.db, isInternal, req.user.orgId)
  })

  // ── Reportar incidencia (cliente) ──────────────
  // Sin deviceId es una incidencia general de la cuenta o del servicio.
  api.post('/', {
    schema: {
      body: Type.Object({
        deviceId: Type.Optional(Type.String({ pattern: UUID })),
        reason: Type.String({ minLength: 5, maxLength: 1000 })
      })
    }
  }, async (req, reply) => {
    if (isInternalRole(req.user.role))
      return reply.code(403).send({ error: 'Las incidencias las reporta el cliente' })

    const { deviceId, reason } = req.body
    if (!reason.trim())
      return reply.code(400).send({ error: 'Describí el problema' })
    if (deviceId && !await incidentsRepo.deviceBelongsToOrg(app.db, deviceId, req.user.orgId))
      return reply.code(404).send({ error: 'Estación no encontrada' })

    const incident = await incidentsRepo.create(app.db, {
      deviceId: deviceId ?? null,
      orgId: req.user.orgId,
      reason: reason.trim()
    })
    return reply.code(201).send(incident)
  })

  // ── Tomar incidencia: pasa a revisión (AirSunBox) ─
  api.patch('/:id/review', {
    schema: { params: IdParams }
  }, async (req, reply) => {
    if (!isInternalRole(req.user.role))
      return reply.code(403).send({ error: 'Sin permisos' })

    if (!await incidentsRepo.markInReview(app.db, req.params.id)) {
      const exists = await incidentsRepo.findById(app.db, req.params.id)
      return exists
        ? reply.code(409).send({ error: 'La incidencia ya no está abierta' })
        : reply.code(404).send({ error: 'Incidencia no encontrada' })
    }
    return incidentsRepo.findById(app.db, req.params.id)
  })

  // ── Resolver incidencia (AirSunBox) ────────────────
  api.patch('/:id/resolve', {
    schema: {
      params: IdParams,
      body: Type.Object({
        notes: Type.Optional(Type.String({ maxLength: 1000 }))
      })
    }
  }, async (req, reply) => {
    if (!isInternalRole(req.user.role))
      return reply.code(403).send({ error: 'Sin permisos' })

    const notes = req.body.notes?.trim() || null
    if (!await incidentsRepo.resolve(app.db, req.params.id, notes)) {
      const exists = await incidentsRepo.findById(app.db, req.params.id)
      return exists
        ? reply.code(409).send({ error: 'La incidencia ya está resuelta' })
        : reply.code(404).send({ error: 'Incidencia no encontrada' })
    }
    return incidentsRepo.findById(app.db, req.params.id)
  })
}
