import type { FastifyInstance } from 'fastify'
import { assertPublicUrl } from '../lib/safeUrl.js'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import * as alertsRepo from '../repositories/alerts.js'
import * as devicesRepo from '../repositories/devices.js'
import { dispatch, type AlertRow } from '../services/alertDispatcher.js'

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
    if (condition && !['>', '<', '=', '>=', '<='].includes(condition))
      return reply.code(400).send({ error: 'Condición inválida' })
    if (!Number.isFinite(threshold)) return reply.code(400).send({ error: 'El umbral debe ser un número' })
    if (emailTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo))
      return reply.code(400).send({ error: 'El correo de destino no es válido' })
    if ((botToken && !chatId) || (!botToken && chatId))
      return reply.code(400).send({ error: 'Para Telegram hacen falta el token del bot y el chat' })
    if (!emailTo && !webhookUrl && !botToken && !destination)
      return reply.code(400).send({ error: 'Elegí al menos un canal de aviso con su destino' })

    if (!(await devicesRepo.deviceBelongsToOrg(app.db, deviceId, orgId))) {
      return reply.code(403).send({ error: 'Sin acceso' })
    }

    // El webhook puede venir en webhookUrl o, con channel webhook/both, en destination
    const webhookCandidates = [webhookUrl,
      (channel === 'webhook' || channel === 'both') && destination && !destination.includes('@') ? destination : undefined]
    for (const candidate of webhookCandidates) {
      if (!candidate) continue
      try {
        await assertPublicUrl(candidate)
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message })
      }
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

  // ── Enviar una prueba por los canales de la alerta ──
  // No registra el disparo ni suma al contador. Una prueba cada 30 s por alerta.
  api.post('/:id/test', {
    schema: { params: Type.Object({ id: Type.String({ pattern: '^[0-9a-fA-F-]{36}$' }) }) }
  }, async (req, reply) => {
    const { rows: [alert] } = await app.db.query<AlertRow>(
      `SELECT a.*, d.name AS device_name, s.name AS space_name,
              vc.name AS variable_name, vc.unit AS variable_unit
       FROM alerts a
       JOIN devices d ON d.id = a.device_id
       LEFT JOIN spaces s ON s.id = d.space_id
       LEFT JOIN variable_catalog vc ON vc.label = a.variable
       WHERE a.id = $1 AND d.org_id = $2`,
      [req.params.id, req.user.orgId]
    )
    if (!alert) return reply.code(404).send({ error: 'Alerta no encontrada' })

    const gate = await app.redis.set(`alert:test:${alert.id}`, '1', { EX: 30, NX: true })
    if (gate !== 'OK') return reply.code(429).send({ error: 'Esperá unos segundos antes de enviar otra prueba' })

    const isAqi = alert.variable === 'aqi'
    const value = Number(alert.threshold)
    const results = await dispatch(app, alert, {
      rawValue: value,
      formattedValue: String(value),
      aqi: isAqi ? value : null,
      category: isAqi ? 'Prueba' : null,
      stationName: alert.device_name ?? null,
      spaceName: alert.space_name ?? null,
      variable: isAqi ? 'aqi' : (alert.variable_name || alert.variable),
      unit: isAqi ? '' : (alert.variable_unit || ''),
      time: new Date().toLocaleString('es-GT')
    }, { test: true })
    if (!results.length) return reply.code(400).send({ error: 'La alerta no tiene canales configurados' })
    return { results }
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