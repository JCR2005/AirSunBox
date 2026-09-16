import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import * as devicesRepo from '../repositories/devices.js'
import * as dotsRepo from '../repositories/dots.js'
import { processDevicePayload } from '../services/datalinkService.js'
import { isSanikRole } from '../services/authService.js'

export default async function dotsRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<TypeBoxTypeProvider>()

  api.addHook('onRequest', async (req, reply) => {
    if (req.method === 'GET') {
      await app.authenticate(req, reply)
    }
  })

  async function canAccessDevice(deviceId: string, userIdRole: string, userOrgId: string): Promise<boolean | null> {
    const scopes = await devicesRepo.findOrgScope(app.db, deviceId)
    if (!scopes.length) return null
    if (!isSanikRole(userIdRole) && scopes[0].org_id !== userOrgId) return false
    return true
  }

  // ── 1. SERIES AGREGADAS (gráficas) ─────────────
  api.get('/:deviceId/:variable', {
    schema: {
      params: Type.Object({
        deviceId: Type.String(),
        variable: Type.String()
      }),
      querystring: Type.Object({
        range: Type.Optional(Type.String()),
        aggregation: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const { deviceId } = req.params
    const variable = String(req.params.variable || '').toLowerCase()
    const { range, aggregation = 'avg' } = req.query

    const allowed = await canAccessDevice(deviceId, req.user.role, req.user.orgId)
    if (allowed === null) return reply.code(404).send({ error: 'Dispositivo no encontrado' })
    if (allowed === false) return reply.code(403).send({ error: 'Sin acceso' })

    const selected = dotsRepo.resolveInterval(range)
    const aggLower = aggregation.toLowerCase()

    if (aggLower === 'raw') {
      return dotsRepo.seriesRaw(app.db, deviceId, variable, selected.sqlInterval)
    }

    let sqlFunction = 'AVG(value)'
    if (aggLower === 'sum') sqlFunction = 'SUM(value)'
    if (aggLower === 'min') sqlFunction = 'MIN(value)'
    if (aggLower === 'max') sqlFunction = 'MAX(value)'
    if (aggLower === 'count') sqlFunction = 'COUNT(value)'

    return dotsRepo.seriesAggregated(app.db, deviceId, variable, sqlFunction, selected.bucket, selected.sqlInterval)
  })

  // ── 2. DATOS CRUDOS PAGINADOS ──
  api.get('/:deviceId/:variable/raw', {
    schema: {
      params: Type.Object({
        deviceId: Type.String(),
        variable: Type.String()
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.String()),
        page: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const { deviceId } = req.params
    const variable = String(req.params.variable || '').toLowerCase()

    const limit = Math.min(parseInt(req.query.limit ?? '10', 10) || 10, 100)
    const page = Math.max(parseInt(req.query.page ?? '1', 10) || 1, 1)
    const offset = (page - 1) * limit

    const allowed = await canAccessDevice(deviceId, req.user.role, req.user.orgId)
    if (allowed === null) return reply.code(404).send({ error: 'Dispositivo no encontrado' })
    if (allowed === false) return reply.code(403).send({ error: 'Sin acceso' })

    const total = await dotsRepo.countForDeviceVariable(app.db, deviceId, variable)
    const results = await dotsRepo.pageRaw(app.db, deviceId, variable, limit, offset)

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      results
    }
  })

  // ── 3. HISTÓRICO MULTI-VARIABLE (DASHBOARD) ──
  api.get('/:deviceId', {
    schema: {
      params: Type.Object({ deviceId: Type.String() }),
      querystring: Type.Object({
        variables: Type.Optional(Type.String()),
        range: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const { deviceId } = req.params
    const { variables = '', range = '24h' } = req.query

    const varList = variables.split(',').filter(Boolean).map(v => v.toLowerCase())
    if (!varList.length) return reply.code(400).send({ error: 'Indicá al menos una variable' })

    const allowed = await canAccessDevice(deviceId, req.user.role, req.user.orgId)
    if (allowed === null) return reply.code(404).send({ error: 'Dispositivo no encontrado' })
    if (allowed === false) return reply.code(403).send({ error: 'Sin acceso' })

    const selected = dotsRepo.resolveInterval(range)
    const rows = await dotsRepo.seriesMultiVar(app.db, deviceId, varList, selected.bucket, selected.sqlInterval)

    const result: Record<string, Array<{ time: string; value: number }>> = {}
    for (const v of varList) result[v] = []

    for (const row of rows) {
      if (result[row.variable]) {
        result[row.variable].push({
          time: new Date(row.time).toISOString(),
          value: Number(row.value)
        })
      }
    }

    return result
  })

  // ── 4. RECIBIR DATOS DEL HARDWARE (POST) ──
  api.post('/:deviceToken', {
    schema: {
      params: Type.Object({ deviceToken: Type.String() }),
      body: Type.Record(Type.String(), Type.Union([Type.Number(), Type.String()]))
    }
  }, async (req, reply) => {
    const rows = await devicesRepo.findByToken(app.db, req.params.deviceToken)
    if (!rows.length) return reply.code(404).send({ error: 'Token inválido' })

    const deviceId = rows[0].id

    const { saved } = await processDevicePayload(app, deviceId, req.body as Record<string, unknown>, {
      lowercaseVariables: true
    })

    return reply.code(201).send({ message: 'Datos guardados', count: saved })
  })
}