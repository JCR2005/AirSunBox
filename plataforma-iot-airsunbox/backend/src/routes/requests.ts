import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import * as requestsRepo from '../repositories/requests.js'
import { isInternalRole } from '../services/authService.js'
import { notifyTeam, orgName } from '../services/teamNotifier.js'

export default async function requestsRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<TypeBoxTypeProvider>()
  api.addHook('onRequest', app.authenticate)

  // ── Listar solicitudes ─────────────────────────
  api.get('/', async (req) => {
    const isInternal = isInternalRole(req.user.role)
    return requestsRepo.list(app.db, isInternal, req.user.orgId)
  })

  // ── Crear solicitud (cliente) ──────────────────
  api.post('/', {
    schema: {
      body: Type.Object({
        deviceName: Type.String({ minLength: 1, maxLength: 120 }),
        location: Type.String({ minLength: 1, maxLength: 200 }),
        quantity: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
        note: Type.Optional(Type.String()),
        paymentPhoto: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    // Las solicitudes las hace el cliente para su propia organización
    if (isInternalRole(req.user.role))
      return reply.code(403).send({ error: 'Las solicitudes las crea el cliente' })
    // Solo las organizaciones dependientes piden estaciones; las independientes
    // las crean ellas mismas desde sus espacios
    if (await requestsRepo.orgType(app.db, req.user.orgId) !== 'A')
      return reply.code(403).send({ error: 'Las organizaciones independientes crean sus estaciones desde sus espacios' })
    const { deviceName, location, quantity, note, paymentPhoto } = req.body
    const request = await requestsRepo.create(app.db, {
      orgId: req.user.orgId,
      deviceName: deviceName.trim(),
      location: location.trim(),
      quantity: quantity || 1,
      note: note ?? null,
      paymentPhoto: paymentPhoto ?? null
    })
    const org = await orgName(app, req.user.orgId)
    notifyTeam(app, `Nueva solicitud: ${org}`, [
      `${org} solicitó estaciones.`,
      `Estación: ${request.device_name} (cantidad: ${request.quantity})`,
      `Ubicación: ${request.location}`,
      ...(request.note ? [`Nota: ${request.note}`] : [])
    ], '/admin/solicitudes')
    return reply.code(201).send(request)
  })

  // ── Actualizar estado (AirSunBox) ──────────────────
  api.patch('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        status: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    if (!isInternalRole(req.user.role))
      return reply.code(403).send({ error: 'Sin permisos' })

    const { status } = req.body
    const request = await requestsRepo.updateStatus(app.db, req.params.id, status ?? '', req.user.userId)
    return request
  })
}