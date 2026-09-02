import { calculateRespiratoryRisk } from '../utils/reportCalculations.js'

export default async function reportsRoutes(app) {
  app.addHook('onRequest', app.authenticate)

  // ── 1. ESTADÍSTICAS GLOBALES PARA DASHBOARD ──
  app.get('/stats', async (req) => {
    const { rows: [stats] } = await app.db.query(`
      SELECT 
        (SELECT COUNT(*) FROM organizations WHERE slug != 'sanik-internal') as total_clients,
        (SELECT COUNT(*) FROM devices) as total_devices,
        (SELECT COUNT(*) FROM devices WHERE last_seen > NOW() - INTERVAL '5 minutes') as active_devices,
        (SELECT COUNT(*) FROM requests WHERE status = 'pending') as pending_requests
    `)
    return stats
  })

  // ── 2. DATOS PARA MAPA DE CALOR (ISLAS DE CALOR) ──
  app.get('/heatmap', async (req) => {
    let { orgId, start, end } = req.query
    
    // Si es cliente, forzar su orgId
    if (req.user.role === 'client') {
      orgId = req.user.orgId
    }

    let query = `
      SELECT 
        d.id, d.name, d.lat, d.lng, 
        AVG(CASE WHEN dot.variable IN ('temperatura', 'temperature') THEN dot.value END) as avg_temp,
        AVG(CASE WHEN dot.variable IN ('humedad', 'humidity') THEN dot.value END) as avg_hum,
        MAX(CASE WHEN dot.variable IN ('temperatura', 'temperature') THEN dot.value END) as max_temp,
        MIN(CASE WHEN dot.variable IN ('temperatura', 'temperature') THEN dot.value END) as min_temp
      FROM devices d
      JOIN dots dot ON dot.device_id = d.id
      WHERE dot.variable IN ('temperatura', 'temperature', 'humedad', 'humidity')
    `
    const params = []
    let i = 1

    if (orgId) {
      query += ` AND d.org_id = $${i++}`
      params.push(orgId)
    }
    if (start) {
      query += ` AND dot.time >= $${i++}`
      params.push(start)
    }
    if (end) {
      query += ` AND dot.time <= $${i++}`
      params.push(end)
    }

    query += ` GROUP BY d.id, d.name, d.lat, d.lng`

    const { rows } = await app.db.query(query, params)
    return rows
  })

  // ── 3. REPORTE DE RIESGO RESPIRATORIO ──
  app.get('/respiratory-risk', async (req) => {
    let { orgId, start, end } = req.query

    // Si es cliente, forzar su orgId
    if (req.user.role === 'client') {
      orgId = req.user.orgId
    }

    const targetVars = ['pm25', 'pm10', 'so2', 'nox', 'o3', 'temperatura', 'temperature', 'humedad', 'humidity']

    let query = `
      SELECT 
        d.id, d.name, dot.variable,
        AVG(dot.value) as avg_value,
        MAX(dot.value) as max_value,
        COUNT(*) as samples
      FROM devices d
      JOIN dots dot ON dot.device_id = d.id
      WHERE dot.variable = ANY($1)
    `
    const params = [targetVars]
    let i = 2

    if (orgId) {
      query += ` AND d.org_id = $${i++}`
      params.push(orgId)
    }
    if (start) {
      query += ` AND dot.time >= $${i++}`
      params.push(start)
    }
    if (end) {
      query += ` AND dot.time <= $${i++}`
      params.push(end)
    }

    query += ` GROUP BY d.id, d.name, dot.variable`

    const { rows } = await app.db.query(query, params)

    // Agrupar por dispositivo
    const devices = {}
    rows.forEach(row => {
      if (!devices[row.id]) {
        devices[row.id] = { id: row.id, name: row.name, variables: {} }
      }
      devices[row.id].variables[row.variable] = {
        avg: parseFloat(row.avg_value),
        max: parseFloat(row.max_value)
      }
    })

    return calculateRespiratoryRisk(devices)
  })
}

