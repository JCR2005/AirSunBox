import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import * as reportsRepo from '../repositories/reports.js'
import { calculateRespiratoryRisk } from '../services/reportCalculationsService.js'
import { buildSpaceReport } from '../services/spaceReportService.js'
import * as spacesRepo from '../repositories/spaces.js'
import { isInternalRole } from '../services/authService.js'

export default async function reportsRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<TypeBoxTypeProvider>()
  api.addHook('onRequest', app.authenticate)

  const timeQuerySchema = {
    querystring: Type.Object({
      orgId: Type.Optional(Type.String()),
      start: Type.Optional(Type.String()),
      end: Type.Optional(Type.String())
    })
  }

  // ── 1. ESTADÍSTICAS GLOBALES PARA DASHBOARD ──
  api.get('/stats', async () => {
    return reportsRepo.globalStats(app.db)
  })

  // ── 2. DATOS PARA MAPA DE CALOR (ISLAS DE CALOR) ──
  api.get('/heatmap', { schema: timeQuerySchema }, async (req) => {
    let { orgId, start, end } = req.query

    if (req.user.role === 'client') {
      orgId = req.user.orgId
    }

    return reportsRepo.heatmap(app.db, orgId, start, end)
  })

  // ── Reporte de un espacio (organizaciones independientes) ──
  // Usa las variables y niveles que el espacio definió. Rango por defecto: 7 días.
  const MAX_DAYS = 366
  api.get('/space/:spaceId', {
    schema: {
      params: Type.Object({ spaceId: Type.String({ pattern: '^[0-9a-fA-F-]{36}$' }) }),
      querystring: Type.Object({
        start: Type.Optional(Type.String()),
        end: Type.Optional(Type.String()),
        deviceId: Type.Optional(Type.String({ pattern: '^[0-9a-fA-F-]{36}$' }))
      })
    }
  }, async (req, reply) => {
    const { spaceId } = req.params
    if (!isInternalRole(req.user.role)) {
      const owned = await spacesRepo.findOwnerSpace(app.db, spaceId, req.user.orgId)
      if (!owned.length) return reply.code(404).send({ error: 'Espacio no encontrado' })
    }
    const end = req.query.end ? new Date(req.query.end) : new Date()
    const start = req.query.start ? new Date(req.query.start) : new Date(end.getTime() - 7 * 86400000)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end)
      return reply.code(400).send({ error: 'Rango de fechas inválido' })
    if (end.getTime() - start.getTime() > MAX_DAYS * 86400000)
      return reply.code(400).send({ error: `El rango no puede superar ${MAX_DAYS} días` })

    const report = await buildSpaceReport(app.db, spaceId, start, end, req.query.deviceId)
    if (!report) return reply.code(404).send({ error: 'Espacio o estación no encontrados' })
    return report
  })

  // ── 3. REPORTE DE RIESGO RESPIRATORIO ──
  api.get('/respiratory-risk', { schema: timeQuerySchema }, async (req) => {
    let { orgId, start, end } = req.query

    if (req.user.role === 'client') {
      orgId = req.user.orgId
    }

    const rows = await reportsRepo.respiratoryData(app.db, orgId, start, end)

    const devices: Record<string, { id: string; name: string; variables: Record<string, { avg: number; max: number }> }> = {}
    for (const row of rows) {
      if (!devices[row.id]) {
        devices[row.id] = { id: row.id, name: row.name, variables: {} }
      }
      devices[row.id].variables[row.variable] = {
        avg: parseFloat(row.avg_value),
        max: parseFloat(row.max_value)
      }
    }

    return calculateRespiratoryRisk(devices)
  })
}