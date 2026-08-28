const SANIK_ROLES = ['superadmin', 'admin', 'worker']

import { evaluateDeviceAlerts } from '../utils/alerting.js'
import { getDeviceVariableScope, isLabelAllowed } from '../utils/deviceScope.js'

export default async function dotsRoutes(app) {

  // Proteger solo las rutas GET (POST debe ser público para Postman/ESP32)
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'GET') {
      await app.authenticate(req, reply)
    }
  })

  // ── 1. PARA LA GRÁFICA: TODAS LAS FUNCIONES DE AGREGACIÓN DINÁMICAS ──────────
  app.get('/:deviceId/:variable', async (req, reply) => {
    const { deviceId } = req.params
    const variable = String(req.params.variable || '').toLowerCase()
    const { range = '24h', aggregation = 'avg' } = req.query

    const intervals = {
      '1h':  { sqlInterval: '1 hour', bucket: '1 minute' },
      '6h':  { sqlInterval: '6 hours', bucket: '5 minutes' },
      '24h': { sqlInterval: '24 hours', bucket: '15 minutes' },
      '7d':  { sqlInterval: '7 days', bucket: '2 hours' },
      '30d': { sqlInterval: '30 days', bucket: '12 hours' }
    }
    const selected = intervals[range] || intervals['24h']

    // Validación de permisos del dispositivo
    const { rows: check } = await app.db.query(
      'SELECT org_id FROM devices WHERE id = $1',
      [deviceId]
    )
    if (!check.length) return reply.code(404).send({ error: 'Dispositivo no encontrado' })
    
    if (!SANIK_ROLES.includes(req.user.role) && req.user.orgId !== check[0].org_id) {
      return reply.code(403).send({ error: 'Sin acceso' })
    }

    const aggLower = aggregation.toLowerCase()

    // CASO 1: Selección en bruto ("RAW") -> Candado para que la web no explote
    if (aggLower === 'raw') {
      const { rows } = await app.db.query(
        `SELECT time, value 
         FROM dots
         WHERE device_id = $1 AND variable = $2 
         AND time >= NOW() - $3::interval
         ORDER BY time ASC
         LIMIT 1500`, 
        [deviceId, variable, selected.sqlInterval]
      )
      return rows.map(r => ({
        time: new Date(r.time).toISOString(),
        value: Number(r.value)
      }))
    }

    // CASO 2: Selección Matemática Dinámica (Mapeo de la captura de pantalla)
    let sqlFunction = 'AVG(value)' // Por defecto si mandan cualquier cosa
    if (aggLower === 'sum') sqlFunction = 'SUM(value)'
    if (aggLower === 'min') sqlFunction = 'MIN(value)'
    if (aggLower === 'max') sqlFunction = 'MAX(value)'
    if (aggLower === 'count') sqlFunction = 'COUNT(value)'

    // CORRECCIÓN: Se cambia GROUP BY time por GROUP BY 1 para evitar conflictos de alias en Postgres/Timescale
    const { rows } = await app.db.query(
      `SELECT time_bucket($3::interval, time) AS time, 
              ROUND(${sqlFunction}::numeric, 2) AS value 
       FROM dots
       WHERE device_id = $1 AND variable = $2 
       AND time >= NOW() - $4::interval
       GROUP BY 1
       ORDER BY time ASC`,
      [deviceId, variable, selected.bucket, selected.sqlInterval]
    )

    return rows.map(r => ({
      time: new Date(r.time).toISOString(),
      value: Number(r.value)
    }))
  })

  // ── 2. PARA LA TABLA: DATOS CRUDOS TOTALMENTE PAGINADOS POR BD ──
  app.get('/:deviceId/:variable/raw', async (req, reply) => {
    const { deviceId } = req.params
    const variable = String(req.params.variable || '').toLowerCase()
    
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100)
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const offset = (page - 1) * limit

    const { rows: check } = await app.db.query(
      'SELECT org_id FROM devices WHERE id = $1',
      [deviceId]
    )
    if (!check.length) return reply.code(404).send({ error: 'Dispositivo no encontrado' })
    
    if (!SANIK_ROLES.includes(req.user.role) && req.user.orgId !== check[0].org_id) {
      return reply.code(403).send({ error: 'Sin acceso' })
    }

    const { rows: countRows } = await app.db.query(
      `SELECT COUNT(*)::int as total FROM dots WHERE device_id = $1 AND variable = $2`,
      [deviceId, variable]
    )
    const totalRecords = countRows[0]?.total || 0

    const { rows: dataRows } = await app.db.query(
      `SELECT time, value 
       FROM dots
       WHERE device_id = $1 AND variable = $2 
       ORDER BY time DESC
       LIMIT $3 OFFSET $4`,
      [deviceId, variable, limit, offset]
    )

    return {
      total: totalRecords,
      page,
      limit,
      totalPages: Math.ceil(totalRecords / limit),
      results: dataRows.map(r => ({
        time: new Date(r.time).toISOString(),
        value: Number(r.value)
      }))
    }
  })

  // ── 3. DATOS HISTÓRICOS MULTI-VARIABLE (DASHBOARD) ──────────
  app.get('/:deviceId', async (req, reply) => {
    const { deviceId } = req.params
    const { variables = '', range = '24h' } = req.query

    const varList = variables.split(',').filter(Boolean).map(v => v.toLowerCase())
    if (!varList.length) return reply.code(400).send({ error: 'Indicá al menos una variable' })

    const intervals = {
      '1h':  { sqlInterval: '1 hour', bucket: '1 minute' },
      '6h':  { sqlInterval: '6 hours', bucket: '5 minutes' },
      '24h': { sqlInterval: '24 hours', bucket: '15 minutes' },
      '7d':  { sqlInterval: '7 days', bucket: '2 hours' },
      '30d': { sqlInterval: '30 days', bucket: '12 hours' }
    }
    const selected = intervals[range] || intervals['24h']

    const { rows: check } = await app.db.query(
      'SELECT org_id FROM devices WHERE id = $1',
      [deviceId]
    )
    if (!check.length) return reply.code(404).send({ error: 'Dispositivo no encontrado' })

    if (!SANIK_ROLES.includes(req.user.role) && req.user.orgId !== check[0].org_id) {
      return reply.code(403).send({ error: 'Sin acceso' })
    }

    // CORRECCIÓN: Se cambia GROUP BY time, variable por GROUP BY 1, 2 para asegurar la agrupación por el bucket temporal seguro
    const { rows } = await app.db.query(
      `SELECT time_bucket($3::interval, time) AS time, 
              variable, 
              ROUND(AVG(value)::numeric, 2) as value
       FROM dots
       WHERE device_id = $1
         AND variable = ANY($2)
         AND time >= NOW() - $4::interval
       GROUP BY 1, 2
       ORDER BY time ASC`,
      [deviceId, varList, selected.bucket, selected.sqlInterval]
    )

    const result = {}
    for (const v of varList) result[v] = []
    
    for (const row of rows) {
      if (result[row.variable]) {
        // CORRECCIÓN: Asegurar la conversión de la fecha de Postgres a string ISO de forma consistente antes de enviarla
        result[row.variable].push({ 
          time: new Date(row.time).toISOString(), 
          value: Number(row.value) 
        })
      }
    }

    return result
  })

  // ── 4. RECIBIR DATOS DEL HARDWARE (POST) ──────────
  app.post('/:deviceToken', async (req, reply) => {
    const { deviceToken } = req.params
    const payload = req.body

    const { rows } = await app.db.query(
      'SELECT id FROM devices WHERE token = $1',
      [deviceToken]
    )
    if (!rows.length) return reply.code(404).send({ error: 'Token inválido' })

    const deviceId = rows[0].id
    const now = new Date()
    let guardados = 0

    // Alcance de variables del dispositivo (orgs tipo B: solo las de su espacio)
    const scope = await getDeviceVariableScope(app, deviceId)

    for (const [rawVariable, rawValue] of Object.entries(payload)) {
      const variable = String(rawVariable).toLowerCase()
      const value = Number(rawValue) 
      if (isNaN(value)) continue     

      if (!isLabelAllowed(scope, variable)) {
        req.log.warn(`Variable "${variable}" no pertenece al espacio — ignorada (device ${deviceId})`)
        continue
      }     

      await app.db.query(
        `INSERT INTO device_variables (device_id, variable_label)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [deviceId, variable]
      )

      await app.db.query(
        'INSERT INTO dots (time, device_id, variable, value) VALUES ($1, $2, $3, $4)',
        [now, deviceId, variable, value]
      )

      if (app.redis) {
        await app.redis.set(
          `last:${deviceId}:${variable}`,
          JSON.stringify({ value, time: now }),
          { EX: 86400 } 
        )
      }

      // Notificar a los clientes suscritos al WebSocket (tiempo real)
      app.realtime.broadcast(deviceId, variable, value, now)
      guardados++
    }

    await app.db.query(
      'UPDATE devices SET last_seen = $1 WHERE id = $2',
      [now, deviceId]
    )

    // Evaluar alertas activas de la estación
    await evaluateDeviceAlerts(app, deviceId)

    return reply.code(201).send({ message: 'Datos guardados', count: guardados })
  })
}