import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import * as reportsRepo from '../repositories/reports.js'
import { calculateRespiratoryRisk } from '../services/reportCalculationsService.js'

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