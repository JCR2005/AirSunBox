import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import * as devicesRepo from '../repositories/devices.js'
import * as reportsRepo from '../repositories/reports.js'
import { calculateRespiratoryRisk } from '../services/reportCalculationsService.js'
import { analyzeEnvironmentalImpact } from '../services/environmentalAnalysisService.js'

const AQI_VARS = ['co', 'co2', 'nh3', 'nox', 'h2s', 'o3', 'so2', 'pm25', 'pm10']
const CLIMA_VARS = ['temperatura', 'temperature', 'humedad', 'humidity', 'co2', 'co']
const ALL_VARS = [...new Set([...AQI_VARS, ...CLIMA_VARS])]

function aqiCategory(aqi: number): string {
  let category = 'Excelente'
  if (aqi <= 20) category = 'Excelente'
  else if (aqi <= 40) category = 'Buena'
  else if (aqi <= 60) category = 'Precaución'
  else if (aqi <= 80) category = 'Mala'
  else category = 'Peligrosa'
  return category
}

export default async function publicRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<TypeBoxTypeProvider>()

  // ── 1. LISTAR TODOS LOS DISPOSITIVOS PÚBLICOS CON COORDENADAS ──
  api.get('/devices', async (_req) => {
    return devicesRepo.publicMapDevices(app.db)
  })

  // ── 2. AQI Y MÉTRICAS EN TIEMPO REAL DE UN DISPOSITIVO ──
  api.get('/devices/:id/aqi', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (req, reply) => {
    try {
      const { rows: latestDots } = await app.db.query<{ variable: string; value: string | number; time: Date | string }>(
        `SELECT DISTINCT ON (variable) variable, value, time
         FROM dots
         WHERE device_id = $1::uuid AND variable = ANY($2) AND time > NOW() - INTERVAL '1 minute'
         ORDER BY variable, time DESC`,
        [req.params.id, ALL_VARS]
      )

      if (!latestDots.length) {
        return { aqi: null, category: 'Sin datos', variables: {} }
      }

      const variableScores: Record<string, { value: number; time: Date | string; score?: number; category?: string }> = {}
      let totalScore = 0
      let totalWeight = 0
      let hasAqiData = false

      for (const dot of latestDots) {
        variableScores[dot.variable] = { value: Number(dot.value), time: dot.time }

        if (AQI_VARS.includes(dot.variable)) {
          const { rows: [range] } = await app.db.query<{ score: string | number; category: string; weight: string | number }>(
            `SELECT score, category, weight
             FROM air_quality_ranges
             WHERE variable_label = $1 AND min_value <= $2 AND (max_value IS NULL OR max_value > $2)
             LIMIT 1`,
            [dot.variable, dot.value]
          )
          if (range) {
            variableScores[dot.variable].score = Number(range.score)
            variableScores[dot.variable].category = range.category
            totalScore += Number(range.score) * Number(range.weight)
            totalWeight += Number(range.weight)
            hasAqiData = true
          }
        }
      }

      if (!hasAqiData) return { aqi: null, category: 'Sin datos', variables: variableScores }

      const weightedAQI = totalWeight > 0 ? totalScore / totalWeight : 0
      const scoredValues = Object.values(variableScores)
        .map(v => v.score)
        .filter((score): score is number => score !== undefined)
      const maxScore = scoredValues.length > 0 ? Math.max(...scoredValues) : 0
      let aqi = Math.round(weightedAQI * 0.7 + maxScore * 0.3)
      aqi = Math.max(0, Math.min(100, aqi))

      return { aqi, category: aqiCategory(aqi), variables: variableScores }

    } catch (err) {
      app.log.error(err)
      return reply.code(500).send({ error: 'Error al calcular el AQI público.' })
    }
  })

  const timesQuerySchema = {
    querystring: Type.Object({
      start: Type.Optional(Type.String()),
      end: Type.Optional(Type.String())
    })
  }

  // ── 3. REPORTES GLOBALES PÚBLICOS ──

  // Estadísticas globales
  api.get('/reports/stats', async () => {
    return reportsRepo.globalStats(app.db)
  })

  // Heatmap global
  api.get('/reports/heatmap', { schema: timesQuerySchema }, async (req) => {
    return reportsRepo.heatmapGlobal(app.db, req.query.start, req.query.end)
  })

  // Riesgo respiratorio global
  api.get('/reports/respiratory-risk', { schema: timesQuerySchema }, async (req) => {
    const rows = await reportsRepo.respiratoryDataGlobal(app.db, req.query.start, req.query.end)
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

  // Reporte de contaminación ambiental global
  api.get('/reports/environmental', { schema: timesQuerySchema }, async (req) => {
    const rows = await reportsRepo.environmentalData(app.db, req.query.start, req.query.end)
    const devices: Record<string, { id: string; name: string; lat: number | null; lng: number | null; variables: Record<string, { avg: number }> }> = {}
    for (const row of rows) {
      if (!devices[row.id]) {
        devices[row.id] = { id: row.id, name: row.name, lat: row.lat, lng: row.lng, variables: {} }
      }
      devices[row.id].variables[row.variable] = {
        avg: parseFloat(row.avg_value)
      }
    }
    return analyzeEnvironmentalImpact(devices)
  })

  // ── 4. RESUMEN COMPLETO DE UNA ZONA ──
  api.get('/zones/aqi', {
    schema: {
      querystring: Type.Object({ ids: Type.Optional(Type.String()) })
    }
  }, async (req, reply) => {
    const rawIds = req.query.ids
    if (!rawIds) {
      return reply.code(400).send({ error: 'Parámetro "ids" requerido. Ejemplo: ?ids=1,2,5' })
    }

    const deviceIds = rawIds
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)

    if (!deviceIds.length) {
      return reply.code(400).send({ error: 'No se recibieron IDs válidos.' })
    }

    const pickVar = (map: Record<string, string | number | Date>, ...keys: string[]) => {
      for (const k of keys) {
        if (map[k] !== undefined) return Number(map[k])
      }
      return null
    }

    interface DeviceZoneResult {
      id: string
      aqi: number | null
      category: string
      hasData: boolean
      temp: number | null
      hum: number | null
      co2: number | null
      co: number | null
    }

    try {
      const deviceResults: DeviceZoneResult[] = await Promise.all(
        deviceIds.map(async (deviceId): Promise<DeviceZoneResult> => {
          try {
            const { rows: latestDots } = await app.db.query<{ variable: string; value: string | number; time: Date | string }>(
              `SELECT DISTINCT ON (variable) variable, value, time
               FROM dots
               WHERE device_id = $1::uuid AND variable = ANY($2) AND time > NOW() - INTERVAL '1 hour'
               ORDER BY variable, time DESC`,
              [deviceId, ALL_VARS]
            )

            if (!latestDots.length) {
              return { id: deviceId, aqi: null, category: 'Sin datos', hasData: false, temp: null, hum: null, co2: null, co: null }
            }

            const varMap: Record<string, string | number | Date> = {}
            latestDots.forEach(d => { varMap[d.variable] = d.value })

            let totalScore = 0
            let totalWeight = 0
            let hasAqiData = false
            const scores: number[] = []

            for (const dot of latestDots) {
              if (!AQI_VARS.includes(dot.variable)) continue
              const { rows: [range] } = await app.db.query<{ score: string | number; category: string; weight: string | number }>(
                `SELECT score, category, weight
                 FROM air_quality_ranges
                 WHERE variable_label = $1 AND min_value <= $2 AND (max_value IS NULL OR max_value > $2)
                 LIMIT 1`,
                [dot.variable, dot.value]
              )
              if (range) {
                totalScore += Number(range.score) * Number(range.weight)
                totalWeight += Number(range.weight)
                scores.push(Number(range.score))
                hasAqiData = true
              }
            }

            const temp = pickVar(varMap, 'temperatura', 'temperature')
            const hum = pickVar(varMap, 'humedad', 'humidity')
            const co2 = pickVar(varMap, 'co2')
            const co = pickVar(varMap, 'co')

            if (!hasAqiData) {
              return { id: deviceId, aqi: null, category: 'Sin datos', hasData: false, temp, hum, co2, co }
            }

            const weightedAQI = totalWeight > 0 ? totalScore / totalWeight : 0
            const maxScore = scores.length > 0 ? Math.max(...scores) : 0
            let aqi = Math.round(weightedAQI * 0.7 + maxScore * 0.3)
            aqi = Math.max(0, Math.min(100, aqi))

            return { id: deviceId, aqi, category: aqiCategory(aqi), hasData: true, temp, hum, co2, co }

          } catch (_) {
            return { id: deviceId, aqi: null, category: 'Sin datos', hasData: false, temp: null, hum: null, co2: null, co: null }
          }
        })
      )

      const withAqi = deviceResults.filter(d => d.hasData && d.aqi !== null)
      const onlineCount = withAqi.length

      const avg = (arr: DeviceZoneResult[], key: 'temp' | 'hum' | 'co2' | 'co') => {
        const vals = arr.map(d => d[key]).filter((v): v is number => v !== null && v !== undefined)
        return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null
      }

      const allWithClima = deviceResults.filter(d => d.temp !== null || d.hum !== null || d.co2 !== null || d.co !== null)

      const clima = {
        temp_promedio: avg(allWithClima, 'temp'),
        hum_promedio: avg(allWithClima, 'hum'),
        co2_promedio: avg(allWithClima, 'co2'),
        co_promedio: avg(allWithClima, 'co')
      }

      if (!onlineCount) {
        return {
          aqi_promedio: null,
          aqi_max: null,
          category: 'Sin datos',
          clima,
          online_count: 0,
          total_count: deviceIds.length,
          devices: deviceResults
        }
      }

      const aqiValues = withAqi.map(d => d.aqi as number)
      const aqiPromedio = Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length)
      const aqiMax = Math.max(...aqiValues)

      return {
        aqi_promedio: aqiPromedio,
        aqi_max: aqiMax,
        category: aqiCategory(aqiPromedio),
        clima,
        online_count: onlineCount,
        total_count: deviceIds.length,
        devices: deviceResults
      }

    } catch (err) {
      app.log.error(err)
      return reply.code(500).send({ error: 'Error al calcular el resumen de la zona.' })
    }
  })
}