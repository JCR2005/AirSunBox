import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import * as devicesRepo from '../repositories/devices.js'
import * as spacesRepo from '../repositories/spaces.js'
import * as variablesRepo from '../repositories/variables.js'
import * as dotsRepo from '../repositories/dots.js'
import { getDeviceAqi } from '../services/aqiService.js'
import { isInternalRole } from '../services/authService.js'

export default async function devicesRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<TypeBoxTypeProvider>()
  api.addHook('onRequest', app.authenticate)

  const targetOrgId = (req: { user: { role: string; orgId: string }; query: { orgId?: string } }): string =>
    (isInternalRole(req.user.role) && req.query.orgId) ? req.query.orgId : req.user.orgId

  // ── Catálogo global de variables para el Modal ──
  api.get('/catalog', async (_req) => {
    return devicesRepo.listVariablesCatalog(app.db)
  })

  // ── Listar dispositivos de la organización ─────
  api.get('/', {
    schema: {
      querystring: Type.Object({
        orgId: Type.Optional(Type.String())
      })
    }
  }, async (req) => {
    const orgId = targetOrgId(req)
    return devicesRepo.listByOrg(app.db, orgId)
  })

  // ── Crear dispositivo ──────────────────────────
  api.post('/', {
    schema: {
      body: Type.Object({
        label: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        name: Type.String(),
        lat: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
        lng: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
        orgId: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        icon: Type.Optional(Type.String()),
        tags: Type.Optional(Type.Array(Type.String())),
        selectedVariables: Type.Optional(Type.Array(Type.String())),
        spaceId: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const { label, name, lat, lng, orgId, description, icon, tags, selectedVariables, spaceId } = req.body

    const tOrgId = (isInternalRole(req.user.role) && orgId) ? orgId : req.user.orgId

    try {
      let spaceIdValue: string | null = null
      if (spaceId) {
        const space = await spacesRepo.findOwnerSpace(app.db, spaceId, tOrgId)
        if (!space.length) {
          return reply.code(400).send({ error: 'El espacio no existe o no pertenece a esta organización' })
        }
        spaceIdValue = spaceId
      }

      if (spaceIdValue && Array.isArray(selectedVariables) && selectedVariables.length) {
        const spaceVars = await variablesRepo.labelsForSpace(app.db, spaceIdValue)
        const allowed = new Set(spaceVars.map(r => r.label))
        const bad = selectedVariables.filter(l => !allowed.has(l))
        if (bad.length) {
          return reply.code(400).send({ error: `Las variables ${bad.join(', ')} no pertenecen a este espacio` })
        }
      }

      const device = await devicesRepo.create(app.db, {
        orgId: tOrgId,
        label,
        name,
        lat,
        lng,
        description,
        icon,
        tags: tags ? JSON.stringify(tags) : '[]',
        spaceId: spaceIdValue
      })

      const token = crypto.randomBytes(24).toString('hex')
      await devicesRepo.setToken(app.db, device.id, token)
      device.token = token

      if (Array.isArray(selectedVariables)) {
        await dotsRepo.registerDeviceVariables(app.db, device.id, selectedVariables)
      }

      return device
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        return reply.code(400).send({ error: 'Ya existe una estación con este nombre o identificador (Label) en esta organización.' })
      }
      req.log.error(err)
      return reply.code(500).send({ error: 'Error interno al crear el dispositivo.' })
    }
  })

  // ── Obtener un dispositivo ─────────────────────
  api.get('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      querystring: Type.Object({ orgId: Type.Optional(Type.String()) })
    }
  }, async (req, reply) => {
    const rows = await devicesRepo.findByIdAndOrg(app.db, req.params.id, targetOrgId(req))
    if (!rows.length) return reply.code(404).send({ error: 'Dispositivo no encontrado' })
    return rows[0]
  })

  // ── Actualizar dispositivo ─────────────────────
  api.put('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      querystring: Type.Object({ orgId: Type.Optional(Type.String()) }),
      body: Type.Object({
        name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        label: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        lat: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
        lng: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
        status: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        icon: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        tags: Type.Optional(Type.Array(Type.String())),
        selectedVariables: Type.Optional(Type.Array(Type.String())),
        spaceId: Type.Optional(Type.String()),
        displayVariables: Type.Optional(Type.Array(Type.String())),
        publicMap: Type.Optional(Type.Boolean()),
        serial: Type.Optional(Type.Union([Type.String(), Type.Null()]))
      })
    }
  }, async (req, reply) => {
    const tOrgId = targetOrgId(req)
    const { name, label, lat, lng, status, description, icon, tags, selectedVariables, spaceId, displayVariables, publicMap, serial } = req.body

    const spaceIdEnviado = Object.prototype.hasOwnProperty.call(req.body, 'spaceId')
    const displayVarsEnviado = Object.prototype.hasOwnProperty.call(req.body, 'displayVariables')
    const publicMapEnviado = Object.prototype.hasOwnProperty.call(req.body, 'publicMap')

    const spaceIdValue = spaceIdEnviado ? (spaceId ?? null) : null
    if (spaceIdValue) {
      const space = await spacesRepo.findOwnerSpace(app.db, spaceIdValue, tOrgId)
      if (!space.length) {
        return reply.code(400).send({ error: 'El espacio no existe o no pertenece a esta organización' })
      }
    }

    const currentRows = await devicesRepo.findCurrentForUpdate(app.db, req.params.id, tOrgId)
    const current = currentRows[0]
    if (!current) return reply.code(404).send({ error: 'Dispositivo no encontrado' })
    const effectiveSpaceId = spaceIdValue || current.space_id
    if (current.org_type === 'B' && effectiveSpaceId && Array.isArray(selectedVariables) && selectedVariables.length) {
      const spaceVars = await variablesRepo.labelsForSpace(app.db, effectiveSpaceId)
      const allowed = new Set(spaceVars.map(r => r.label))
      const bad = selectedVariables.filter(l => !allowed.has(l))
      if (bad.length) {
        return reply.code(400).send({ error: `Las variables ${bad.join(', ')} no pertenecen a este espacio` })
      }
    }

    if (publicMapEnviado && publicMap === true) {
      const { rows: [vsp] } = await app.db.query<{ type: string | null; hidden: boolean | null; org_type: string | null }>(
        `SELECT s.type, s.hidden, o.type AS org_type
         FROM spaces s JOIN organizations o ON o.id = s.org_id
         WHERE s.id = $1`,
        [effectiveSpaceId]
      )
      const canPublic = !!vsp && vsp.org_type === 'B' && vsp.type === 'aire' && !vsp.hidden
      if (!canPublic) {
        return reply.code(400).send({ error: 'Solo estaciones de un espacio de aire pueden aparecer en el mapa público' })
      }
    }

    const rows = await devicesRepo.update(app.db, {
      id: req.params.id,
      orgId: tOrgId,
      spaceIdValue,
      spaceIdEnviado,
      displayVarsEnviado,
      publicMapEnviado,
      publicMap: publicMap === true,
      fields: {
        name: name ?? null,
        label: label ?? null,
        lat: lat ?? null,
        lng: lng ?? null,
        status: status ?? null,
        description: description ?? null,
        icon: icon ?? null,
        tags: Array.isArray(tags) ? JSON.stringify(tags) : null,
        displayVariables: Array.isArray(displayVariables) ? JSON.stringify(displayVariables) : null,
        serial: serial ?? null
      }
    })

    if (!rows.length) return reply.code(404).send({ error: 'Dispositivo no encontrado' })

    if (Array.isArray(selectedVariables)) {
      await dotsRepo.replaceDeviceVariables(app.db, req.params.id, selectedVariables)
    }

    return rows[0]
  })

  // ── Eliminar dispositivo ───────────────────────
  api.delete('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      querystring: Type.Object({ orgId: Type.Optional(Type.String()) })
    }
  }, async (req, reply) => {
    const rowCount = await devicesRepo.remove(app.db, req.params.id, targetOrgId(req))
    if (!rowCount) return reply.code(404).send({ error: 'Dispositivo no encontrado' })
    return { message: 'Dispositivo eliminado' }
  })

  // ── Variables del dispositivo ──────────────────
  api.get('/:id/variables', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      querystring: Type.Object({ orgId: Type.Optional(Type.String()) })
    }
  }, async (req) => {
    return devicesRepo.getDeviceVariables(app.db, req.params.id, targetOrgId(req))
  })

  api.get('/:id/last-values', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      querystring: Type.Object({ orgId: Type.Optional(Type.String()) })
    }
  }, async (req) => {
    const variables = await devicesRepo.getDeviceLastValues(app.db, req.params.id, targetOrgId(req))

    for (const v of variables) {
      const redisData = await app.redis.get(`last:${req.params.id}:${v.label}`)
      if (redisData) {
        const parsed = JSON.parse(redisData) as { value: unknown }
        v.last_value = parsed.value
      } else {
        v.last_value = null
      }
    }

    return variables
  })

  api.get('/:id/aqi', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      querystring: Type.Object({ orgId: Type.Optional(Type.String()) })
    }
  }, async (req, reply) => {
    const rows = await devicesRepo.findByIdAndOrg(app.db, req.params.id, targetOrgId(req))
    if (!rows.length) {
      return reply.code(403).send({ error: 'Sin acceso' })
    }

    const res = await getDeviceAqi(app.db, req.params.id)

    return {
      aqi: res?.aqi ?? null,
      category: res?.category ?? 'Sin datos',
      dominantPollutant: res?.dominant?.label ?? null,
      dominantValue: res?.dominant?.value ?? null,
      variables: res?.variables ?? {},
      categories: res?.categories ?? [],
      metadata: res?.metadata ?? null,
      spaceId: res?.spaceId ?? null
    }
  })
}