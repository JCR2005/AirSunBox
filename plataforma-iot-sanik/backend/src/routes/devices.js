import crypto from 'crypto'
import { getDeviceAqi } from '../utils/aqi.js'
const SANIK_ROLES = ['superadmin', 'admin', 'worker']

export default async function devicesRoutes(app) {

  // Middleware de autenticación para todas las rutas
  app.addHook('onRequest', app.authenticate)

  // ── NUEVA RUTA: Obtener el catálogo (global) de variables para el Modal ──
  // Solo las GLOBALES: las privadas de un espacio no se asignan a estaciones
  // ajenas (aislamiento), así que no deben aparecer aquí.
  app.get('/catalog', async (req) => {
    const { rows } = await app.db.query(
      `SELECT label, name, unit, icon, description, data_type 
       FROM variable_catalog 
       WHERE space_id IS NULL
       ORDER BY name ASC`
    )
    return rows
  })

  // ── Listar dispositivos de la organización ─────
  app.get('/', async (req) => {
    const targetOrgId = (SANIK_ROLES.includes(req.user.role) && req.query.orgId)
      ? req.query.orgId
      : req.user.orgId
    const { rows } = await app.db.query(
      `SELECT d.*,
              s.name AS space_name,
              COUNT(dv.variable_label) as variable_count,
              CASE WHEN d.last_seen > NOW() - INTERVAL '5 minutes'
                   THEN 'online' ELSE 'offline' END as status
       FROM devices d
       LEFT JOIN spaces s ON s.id = d.space_id
       LEFT JOIN device_variables dv ON dv.device_id = d.id
       WHERE d.org_id = $1
       GROUP BY d.id, s.name
       ORDER BY d.created_at DESC`,
      [targetOrgId]
    )
    return rows
  })

  // ── Crear dispositivo ──────────────────────────
  app.post('/', async (req, reply) => {
    const { label, name, lat, lng, orgId, description, icon, tags, selectedVariables, spaceId } = req.body
    
    const targetOrgId = (SANIK_ROLES.includes(req.user.role) && orgId)
      ? orgId
      : req.user.orgId

    try {
      // Validar que el espacio (si viene) pertenezca a la organización objetivo
      let spaceIdValue = null
      if (spaceId) {
        const { rows } = await app.db.query(
          'SELECT id FROM spaces WHERE id = $1 AND org_id = $2',
          [spaceId, targetOrgId]
        )
        if (!rows.length) {
          return reply.code(400).send({ error: 'El espacio no existe o no pertenece a esta organización' })
        }
        spaceIdValue = spaceId
      }

      // Solo variables PRIVADAS del espacio (aislamiento orgs tipo B)
      if (spaceIdValue && Array.isArray(selectedVariables) && selectedVariables.length) {
        const { rows: spaceVars } = await app.db.query(
          'SELECT label FROM variable_catalog WHERE space_id = $1',
          [spaceIdValue]
        )
        const allowed = new Set(spaceVars.map(r => r.label))
        const bad = selectedVariables.filter(l => !allowed.has(l))
        if (bad.length) {
          return reply.code(400).send({ error: `Las variables ${bad.join(', ')} no pertenecen a este espacio` })
        }
      }

      const { rows: [device] } = await app.db.query(
        `INSERT INTO devices (org_id, label, name, lat, lng, description, icon, tags, space_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          targetOrgId, 
          label, 
          name, 
          lat, 
          lng, 
          description || null, 
          icon || 'map-pin',           
          tags ? JSON.stringify(tags) : '[]',
          spaceIdValue
        ]
      )

      const token = crypto.randomBytes(24).toString('hex')
      await app.db.query('UPDATE devices SET token = $1 WHERE id = $2', [token, device.id])
      device.token = token

      // Guardamos únicamente las relaciones elegidas por el cliente
      if (Array.isArray(selectedVariables)) {
        for (const labelKey of selectedVariables) {
          await app.db.query(
            `INSERT INTO device_variables (device_id, variable_label)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [device.id, labelKey]
          )
        }
      }

      return device

    } catch (err) {
      if (err.code === '23505') {
        return reply.code(400).send({ error: 'Ya existe una estación con este nombre o identificador (Label) en esta organización.' })
      }
      req.log.error(err)
      return reply.code(500).send({ error: 'Error interno al crear el dispositivo.' })
    }
  })

  // ── Obtener un dispositivo ─────────────────────
  app.get('/:id', async (req, reply) => {
    const targetOrgId = (SANIK_ROLES.includes(req.user.role) && req.query.orgId)
      ? req.query.orgId
      : req.user.orgId
    const { rows } = await app.db.query(
      `SELECT d.*,
              o.type AS org_type,
              CASE WHEN d.last_seen > NOW() - INTERVAL '5 minutes'
                   THEN 'online' ELSE 'offline' END as status
       FROM devices d
       LEFT JOIN organizations o ON o.id = d.org_id
       WHERE d.id = $1 AND d.org_id = $2`,
      [req.params.id, targetOrgId]
    )

    if (!rows.length) return reply.code(404).send({ error: 'Dispositivo no encontrado' })
    return rows[0]
  })

  // ── Actualizar dispositivo ─────────────────────
  app.put('/:id', async (req, reply) => {
    const targetOrgId = (SANIK_ROLES.includes(req.user.role) && req.query.orgId)
      ? req.query.orgId
      : req.user.orgId
    
    const { name, label, lat, lng, status, description, icon, tags, selectedVariables, spaceId, displayVariables, publicMap, serial } = req.body
    const spaceIdEnviado = Object.prototype.hasOwnProperty.call(req.body, 'spaceId')
    const displayVarsEnviado = Object.prototype.hasOwnProperty.call(req.body, 'displayVariables')
    const publicMapEnviado = Object.prototype.hasOwnProperty.call(req.body, 'publicMap')

    // Validar el espacio objetivo (si lo envían) dentro de la misma organización
    const spaceIdValue = spaceIdEnviado ? spaceId : null
    if (spaceIdValue) {
      const { rows } = await app.db.query(
        'SELECT id FROM spaces WHERE id = $1 AND org_id = $2',
        [spaceIdValue, targetOrgId]
      )
      if (!rows.length) {
        return reply.code(400).send({ error: 'El espacio no existe o no pertenece a esta organización' })
      }
    }

    // Solo variables PRIVADAS del espacio (aislamiento orgs tipo B:
    // el dispositivo sigue en su espacio aunque no envíen spaceId)
    const { rows: [current] } = await app.db.query(
      `SELECT d.space_id, o.type AS org_type
       FROM devices d
       LEFT JOIN organizations o ON o.id = d.org_id
       WHERE d.id = $1 AND d.org_id = $2`,
      [req.params.id, targetOrgId]
    )
    if (!current) return reply.code(404).send({ error: 'Dispositivo no encontrado' })
    const effectiveSpaceId = spaceIdValue || current.space_id
    if (current.org_type === 'B' && effectiveSpaceId && Array.isArray(selectedVariables) && selectedVariables.length) {
      const { rows: spaceVars } = await app.db.query(
        'SELECT label FROM variable_catalog WHERE space_id = $1',
        [effectiveSpaceId]
      )
      const allowed = new Set(spaceVars.map(r => r.label))
      const bad = selectedVariables.filter(l => !allowed.has(l))
      if (bad.length) {
        return reply.code(400).send({ error: `Las variables ${bad.join(', ')} no pertenecen a este espacio` })
      }
    }

    // public_map solo puede activarse en estaciones de un espacio de aire (no oculto) de una org independiente
    if (publicMapEnviado && publicMap === true) {
      const { rows: [vsp] } = effectiveSpaceId
        ? await app.db.query(
            `SELECT s.type, s.hidden, o.type AS org_type
             FROM spaces s JOIN organizations o ON o.id = s.org_id
             WHERE s.id = $1`,
            [effectiveSpaceId]
          )
        : { rows: [] }
      const canPublic = !!vsp && vsp.org_type === 'B' && vsp.type === 'aire' && !vsp.hidden
      if (!canPublic) {
        return reply.code(400).send({ error: 'Solo estaciones de un espacio de aire pueden aparecer en el mapa público' })
      }
    }

    const { rows } = await app.db.query(
      `UPDATE devices SET
         name = COALESCE($1, name),
         label = COALESCE($2, label),
         lat = COALESCE($3, lat),
         lng = COALESCE($4, lng),
         status = COALESCE($5, status),
         description = COALESCE($6, description),
         icon = COALESCE($7, icon),
         tags = COALESCE($8, tags),
         space_id = CASE WHEN $12 THEN $11 ELSE space_id END,
         display_variables = CASE WHEN $14 THEN $13::jsonb ELSE display_variables END,
         public_map = CASE WHEN $15 THEN $16 ELSE public_map END,
         serial = COALESCE($17, serial)
       WHERE id = $9 AND org_id = $10
       RETURNING *`,
      [name, label, lat, lng, status, description, icon, tags ? JSON.stringify(tags) : null, req.params.id, targetOrgId, spaceIdValue, spaceIdEnviado, Array.isArray(displayVariables) ? JSON.stringify(displayVariables) : null, displayVarsEnviado, publicMapEnviado, publicMap === true, serial]
    )

    if (!rows.length) return reply.code(404).send({ error: 'Dispositivo no encontrado' })

    // Sincronización inteligente de variables
    if (Array.isArray(selectedVariables)) {
      await app.db.query(
        `DELETE FROM device_variables WHERE device_id = $1 AND NOT (variable_label = ANY($2))`,
        [req.params.id, selectedVariables]
      )

      for (const labelKey of selectedVariables) {
        await app.db.query(
          `INSERT INTO device_variables (device_id, variable_label)
           VALUES ($1, $2)
           ON CONFLICT (device_id, variable_label) DO NOTHING`, 
          [req.params.id, labelKey]
        )
      }
    }

    return rows[0]
  })

  // ── Eliminar dispositivo ───────────────────────
  app.delete('/:id', async (req, reply) => {
    const targetOrgId = (SANIK_ROLES.includes(req.user.role) && req.query.orgId)
      ? req.query.orgId
      : req.user.orgId
    const { rowCount } = await app.db.query(
      'DELETE FROM devices WHERE id = $1 AND org_id = $2',
      [req.params.id, targetOrgId]
    )

    if (!rowCount) return reply.code(404).send({ error: 'Dispositivo no encontrado' })
    return { message: 'Dispositivo eliminado' }
  })

  // ── Variables del dispositivo (Trayendo metadatos desde el catálogo maestro) ──
  app.get('/:id/variables', async (req) => {
    const targetOrgId = (SANIK_ROLES.includes(req.user.role) && req.query.orgId)
      ? req.query.orgId
      : req.user.orgId
    const { rows } = await app.db.query(
      `SELECT vc.label, vc.name, vc.unit, vc.icon, vc.description, dv.created_at
       FROM device_variables dv
       JOIN variable_catalog vc ON vc.label = dv.variable_label
       JOIN devices d ON d.id = dv.device_id
       WHERE dv.device_id = $1 AND d.org_id = $2
       ORDER BY vc.name`,
      [req.params.id, targetOrgId]
    )
    return rows
  })

 app.get('/:id/last-values', async (req) => {
    const targetOrgId = (SANIK_ROLES.includes(req.user.role) && req.query.orgId)
      ? req.query.orgId
      : req.user.orgId

    const { rows: variables } = await app.db.query(
      `SELECT vc.label, vc.name, vc.unit, vc.icon
       FROM device_variables dv
       JOIN variable_catalog vc ON vc.label = dv.variable_label
       JOIN devices d ON d.id = dv.device_id
       WHERE dv.device_id = $1 AND d.org_id = $2`,
      [req.params.id, targetOrgId]
    )

    // ¡LA MAGIA FALTANTE! Buscar el valor real en Redis para cada variable
    for (const v of variables) {
      if (app.redis) {
        const redisData = await app.redis.get(`last:${req.params.id}:${v.label}`)
        if (redisData) {
          const parsed = JSON.parse(redisData)
          v.last_value = parsed.value
        } else {
          v.last_value = null
        }
      }
    }

    return variables
  })

  
app.get('/:id/aqi', async (req, reply) => {
  const targetOrgId =
    (SANIK_ROLES.includes(req.user.role) && req.query.orgId)
      ? req.query.orgId
      : req.user.orgId

  const { rows: [device] } = await app.db.query(
    'SELECT id FROM devices WHERE id = $1 AND org_id = $2',
    [req.params.id, targetOrgId]
  )

  if (!device) {
    return reply.code(403).send({ error: 'Sin acceso' })
  }

  const res = await getDeviceAqi(app, req.params.id)

  return {
    aqi: res.aqi,
    category: res.category,
    dominantPollutant: res.dominant?.label ?? null,
    dominantValue: res.dominant?.value ?? null,
    variables: res.variables,
    categories: res.categories ?? [],
    metadata: res.metadata,
    spaceId: res.spaceId ?? null
  }
})
}