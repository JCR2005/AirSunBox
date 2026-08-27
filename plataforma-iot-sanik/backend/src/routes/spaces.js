import { getSpaceConfig, computeAqi, seedAirTemplate } from '../utils/aqi.js'

export default async function spacesRoutes(app) {
  app.addHook('onRequest', app.authenticate)

  // ── LISTAR ESPACIOS DEL ORG DEL USUARIO ─────────────
  app.get('/', async (req) => {
    const { rows } = await app.db.query(
      `SELECT s.id, s.name, s.slug, s.type, s.icon, s.color, s.hidden, s.description, s.created_at,
              COUNT(d.id)::int as device_count
       FROM spaces s
       LEFT JOIN devices d ON d.space_id = s.id
       WHERE s.org_id = $1
       GROUP BY s.id
       ORDER BY s.created_at ASC`,
      [req.user.orgId]
    )
    return rows
  })

  // ── CREAR ESPACIO ─────────────────────────────────
  app.post('/', async (req, reply) => {
    const { name, slug, type, icon, description, color } = req.body
    if (!name || !slug) {
      return reply.code(400).send({ error: 'Faltan campos obligatorios (name, slug)' })
    }

    const client = await app.db.connect()
    try {
      await client.query('BEGIN')
      const iconByType = { aire: 'aire', agua: 'agua', suelo: 'suelo', ruido: 'ruido' }
      const finalIcon = icon || iconByType[type] || 'otro'
      const finalColor = /^#[0-9A-Fa-f]{6}$/.test(color || '') ? color : '#67B7E8'
      const { rows: [space] } = await client.query(
        `INSERT INTO spaces (org_id, name, slug, type, icon, color, description, hidden)
         VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
         RETURNING *`,
        [req.user.orgId, name.trim(), slug.trim().toLowerCase().replace(/\s+/g, '_'), type || 'other', finalIcon, finalColor, description?.trim()]
      )
      if (space.type === 'aire')
        await seedAirTemplate(client, space.id)
      await client.query('COMMIT')
      return reply.code(201).send(space)
    } catch (err) {
      await client.query('ROLLBACK')
      if (err.code === '23505')
        return reply.code(400).send({ error: 'Ya existe un espacio con ese identificador' })
      app.log.error(err)
      return reply.code(500).send({ error: 'Error al crear el espacio' })
    } finally {
      client.release()
    }
  })

  // ── VERIFICAR PERTENENCIA ─────────────────────────
  async function getOwnerSpace(id, orgId) {
    const { rows: [s] } = await app.db.query(
      `SELECT * FROM spaces WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    )
    return s
  }

  // ── DETALLE DE ESPACIO ────────────────────────────
  app.get('/:id', async (req, reply) => {
    const space = await getOwnerSpace(req.params.id, req.user.orgId)
    if (!space) return reply.code(404).send({ error: 'Espacio no encontrado' })
    return space
  })

  // ── ACTUALIZAR ESPACIO (nombre, slug, descripción, tipo, icono, color) ──
  app.put('/:id', async (req, reply) => {
    const space = await getOwnerSpace(req.params.id, req.user.orgId)
    if (!space) return reply.code(404).send({ error: 'Espacio no encontrado' })

    const { name, slug, description, type, icon, color } = req.body || {}
    const set = []
    const params = []
    if (name !== undefined) { params.push(name.trim()); set.push(`name = $${params.length}`) }
    if (slug !== undefined) { params.push(slug.trim().toLowerCase().replace(/\s+/g, '_')); set.push(`slug = $${params.length}`) }
    if (description !== undefined) { params.push(description.trim()); set.push(`description = $${params.length}`) }
    if (type !== undefined && String(type).trim() !== '') { params.push(String(type).trim()); set.push(`type = $${params.length}`) }
    if (icon !== undefined) { params.push(icon); set.push(`icon = $${params.length}`) }
    if (color !== undefined && /^#[0-9A-Fa-f]{6}$/.test(color)) { params.push(color); set.push(`color = $${params.length}`) }
    if (set.length === 0) return space

    params.push(space.id)
    const { rows: [updated] } = await app.db.query(
      `UPDATE spaces SET ${set.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    )
    return updated
  })

  // ── DISPOSITIVOS DEL ESPACIO ──────────────────────
  app.get('/:id/devices', async (req, reply) => {
    const space = await getOwnerSpace(req.params.id, req.user.orgId)
    if (!space) return reply.code(404).send({ error: 'Espacio no encontrado' })

    const { rows } = await app.db.query(
      `SELECT d.*,
              COUNT(dv.variable_label)::int as variable_count,
              CASE WHEN d.last_seen > NOW() - INTERVAL '5 minutes'
                   THEN 'online' ELSE 'offline' END as status
       FROM devices d
       LEFT JOIN device_variables dv ON dv.device_id = d.id
       WHERE d.space_id = $1
       GROUP BY d.id
       ORDER BY d.created_at DESC`,
      [space.id]
    )
    return rows
  })

  // ── CONFIG AQI COMPLETA DEL ESPACIO ───────────────
  app.get('/:id/aqi', async (req, reply) => {
    const space = await getOwnerSpace(req.params.id, req.user.orgId)
    if (!space) return reply.code(404).send({ error: 'Espacio no encontrado' })

    const config = await getSpaceConfig(app, space.id)
    return { ...space, aqiConfig: config }
  })

  // ── GUARDAR CONFIG AQI DEL ESPACIO ────────────────
  // body: {
  //   categories: [{ name, color, score_lo, score_hi, phrases?: string[] }],
  //   variables: [{ variable_label }],            // en orden de prioridad
  //   ranges:    [{ variable_label, cat_order, min_value, max_value }]
  // }
  app.put('/:id/aqi', async (req, reply) => {
    const space = await getOwnerSpace(req.params.id, req.user.orgId)
    if (!space) return reply.code(404).send({ error: 'Espacio no encontrado' })

    const { categories = [], variables = [], ranges = [] } = req.body || {}

    if (!Array.isArray(categories) || !Array.isArray(variables) || !Array.isArray(ranges)) {
      return reply.code(400).send({ error: 'categories, variables y ranges deben ser arrays' })
    }

    // Validar límites: por variable, el max debe existir y ser estrictamente creciente entre categorías
    const byVar = {}
    for (const r of ranges) {
      const catOrder = Number(r.cat_order)
      if (byVar[r.variable_label]) byVar[r.variable_label].push({ cat_order: catOrder, max: r.max_value == null ? null : Number(r.max_value) })
      else byVar[r.variable_label] = [{ cat_order: catOrder, max: r.max_value == null ? null : Number(r.max_value) }]
    }
    const totalCats = categories.length
    for (const [label, list] of Object.entries(byVar)) {
      list.sort((a, b) => a.cat_order - b.cat_order)
      let prevMax = null
      let prevSet = false
      for (const { cat_order, max } of list) {
        if (cat_order === totalCats) continue // el último nivel queda abierto
        if (max == null || Number.isNaN(max)) {
          return reply.code(400).send({ error: `La variable "${label}" necesita un límite (max) en la categoría ${cat_order}` })
        }
        if (prevSet && max <= prevMax) {
          return reply.code(400).send({ error: `La variable "${label}" tiene límites repetidos o no crecientes entre categorías` })
        }
        prevMax = max
        prevSet = true
      }
    }

    const client = await app.db.connect()
    try {
      await client.query('BEGIN')

      await client.query('DELETE FROM space_variable_ranges WHERE space_id = $1', [space.id])
      await client.query('DELETE FROM space_aqi_variables WHERE space_id = $1', [space.id])
      await client.query('DELETE FROM space_aqi_categories WHERE space_id = $1', [space.id])

      for (let i = 0; i < categories.length; i++) {
        const c = categories[i]
        const phrases = Array.isArray(c.phrases)
          ? c.phrases
              .map(p => String(p).trim())
              .filter(p => p.length > 0)
              .slice(0, 12)
          : []
        await client.query(
          `INSERT INTO space_aqi_categories (space_id, name, color, cat_order, score_lo, score_hi, phrases)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [space.id, c.name, c.color || '#10B981', i + 1, Number(c.score_lo ?? 0), Number(c.score_hi ?? 100), phrases.length ? phrases : '{}']
        )
      }

      for (let i = 0; i < variables.length; i++) {
        await client.query(
          `INSERT INTO space_aqi_variables (space_id, variable_label, priority)
           VALUES ($1, $2, $3)
           ON CONFLICT (space_id, variable_label) DO NOTHING`,
          [space.id, variables[i].variable_label, i + 1]
        )
      }

      for (const r of ranges) {
        await client.query(
          `INSERT INTO space_variable_ranges (space_id, variable_label, cat_order, min_value, max_value)
           VALUES ($1, $2, $3, $4, $5)`,
          [space.id, r.variable_label, r.cat_order, Number(r.min_value), r.max_value == null ? null : Number(r.max_value)]
        )
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      app.log.error(err)
      return reply.code(500).send({ error: 'Error al guardar la configuración' })
    } finally {
      client.release()
    }

    const config = await getSpaceConfig(app, space.id)
    return { ...space, aqiConfig: config }
  })

  // ── CALCULAR AQI DE UN ESPACIO (diagnóstico) ──────
  app.post('/:id/aqi/calculate', async (req, reply) => {
    const space = await getOwnerSpace(req.params.id, req.user.orgId)
    if (!space) return reply.code(404).send({ error: 'Espacio no encontrado' })

    const config = await getSpaceConfig(app, space.id)
    const values = req.body?.values || {}
    return computeAqi(values, config)
  })

  // ── ELIMINAR ESPACIO ──────────────────────────────
  app.delete('/:id', async (req, reply) => {
    const { rowCount } = await app.db.query(
      `DELETE FROM spaces WHERE id = $1 AND org_id = $2`,
      [req.params.id, req.user.orgId]
    )
    if (rowCount === 0) return reply.code(404).send({ error: 'Espacio no encontrado' })
    return { message: 'Espacio eliminado' }
  })
}
