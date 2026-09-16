import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import * as alertsRepo from '../repositories/alerts.js'
import * as devicesRepo from '../repositories/devices.js'

export default async function alertsRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<TypeBoxTypeProvider>()
  api.addHook('onRequest', app.authenticate)

  // ── Listar alertas de un dispositivo ──────────
  api.get('/:deviceId', {
    schema: {
      params: Type.Object({ deviceId: Type.String() })
    }
  }, async (req, reply) => {
    const orgId = req.user.orgId
    if (!(await devicesRepo.deviceBelongsToOrg(app.db, req.params.deviceId, orgId))) {
      return reply.code(403).send({ error: 'Sin acceso' })
    }
    return alertsRepo.listByDevice(app.db, req.params.deviceId, orgId)
  })

  // ── Historial de disparos de un dispositivo ──
  api.get('/:deviceId/logs', {
    schema: {
      params: Type.Object({ deviceId: Type.String() })
    }
  }, async (req, reply) => {
    const orgId = req.user.orgId
    if (!(await devicesRepo.deviceBelongsToOrg(app.db, req.params.deviceId, orgId))) {
      return reply.code(403).send({ error: 'Sin acceso' })
    }
    return alertsRepo.listLogsByDevice(app.db, req.params.deviceId, orgId)
  })

  // ── Crear alerta ───────────────────────────────
  api.post('/', {
    schema: {
      body: Type.Object({
        deviceId: Type.String(),
        variable: Type.Optional(Type.String()),
        condition: Type.Optional(Type.String()),
        threshold: Type.Number(),
        channel: Type.Optional(Type.String()),
        destination: Type.Optional(Type.String()),
        message: Type.Optional(Type.String()),
        cooldownMinutes: Type.Optional(Type.Number()),
        emailTo: Type.Optional(Type.String()),
        webhookUrl: Type.Optional(Type.String()),
        botToken: Type.Optional(Type.String()),
        chatId: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const orgId = req.user.orgId
    const {
      deviceId, variable, condition, threshold,
      channel, destination, message,
      cooldownMinutes, emailTo, webhookUrl,
      botToken, chatId
    } = req.body

    if (!deviceId) return reply.code(400).send({ error: 'deviceId es obligatorio' })

    if (!(await devicesRepo.deviceBelongsToOrg(app.db, deviceId, orgId))) {
      return reply.code(403).send({ error: 'Sin acceso' })
    }

    const resolvedDestination =
      destination ||
      (channel === 'telegram' || botToken ? `tg@${chatId || 'chat'}` : undefined) ||
      (emailTo || webhookUrl)

    const rows = await alertsRepo.create(app.db, {
      deviceId,
      variable,
      condition,
      threshold,
      channel,
      destination: resolvedDestination ?? null,
      message,
      cooldownMinutes,
      emailTo,
      webhookUrl,
      botToken,
      chatId
    })

    return reply.code(201).send(rows[0])
  })

  // ── Activar / desactivar alerta ────────────────
  api.patch('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        active: Type.Boolean()
      })
    }
  }, async (req, reply) => {
    const rows = await alertsRepo.setActive(app.db, req.params.id, req.body.active, req.user.orgId)
    if (!rows.length) return reply.code(403).send({ error: 'Sin acceso' })
    return rows[0]
  })

  // ── Eliminar alerta ────────────────────────────
  api.delete('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() })
    }
  }, async (req, reply) => {
    const rowCount = await alertsRepo.remove(app.db, req.params.id, req.user.orgId)
    if (!rowCount) return reply.code(403).send({ error: 'Sin acceso' })
    return { message: 'Alerta eliminada' }
  })
}