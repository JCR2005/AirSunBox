import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import * as spacesRepo from '../repositories/spaces.js'
import { getSpaceConfig, computeAqi, seedAirTemplate } from '../services/aqiService.js'

export default async function spacesRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<TypeBoxTypeProvider>()
  api.addHook('onRequest', app.authenticate)

  async function getOwnerSpace(id: string, orgId: string) {
    const rows = await spacesRepo.findOwnerSpace(app.db, id, orgId)
    return rows[0]
  }

  // ── LISTAR ESPACIOS DEL ORG DEL USUARIO ─────────────
  api.get('/', async (_req) => {
    return spacesRepo.listByOrg(app.db, _req.user.orgId)
  })

  // ── CREAR ESPACIO ─────────────────────────────────
  api.post('/', {
    schema: {
      body: Type.Object({
        name: Type.Optional(Type.String()),
        slug: Type.Optional(Type.String()),
        type: Type.Optional(Type.String()),
        icon: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        color: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const { name, slug, type, icon, description, color } = req.body
    if (!name || !slug) {
      return reply.code(400).send({ error: 'Faltan campos obligatorios (name, slug)' })
    }

    const client = await app.db.connect()
    try {
      await client.query('BEGIN')
      const iconByType: Record<string, string> = { aire: 'aire', agua: 'agua', suelo: 'suelo', ruido: 'ruido' }
      const finalIcon = icon || iconByType[type || ''] || 'otro'
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
      if ((err as { code?: string }).code === '23505')
        return reply.code(400).send({ error: 'Ya existe un espacio con ese identificador' })
      app.log.error(err)
      return reply.code(500).send({ error: 'Error al crear el espacio' })
    } finally {
      client.release()
    }
  })

  // ── DETALLE DE ESPACIO ────────────────────────────
  api.get('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (req, reply) => {
    const space = await getOwnerSpace(req.params.id, req.user.orgId)
    if (!space) return reply.code(404).send({ error: 'Espacio no encontrado' })
    return space
  })

  // ── ACTUALIZAR ESPACIO ──
  api.put('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        slug: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        type: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        icon: Type.Optional(Type.String()),
        color: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const space = await getOwnerSpace(req.params.id, req.user.orgId)
    if (!space) return reply.code(404).send({ error: 'Espacio no encontrado' })

    const { name, slug, description, type, icon, color } = req.body || {}
    const set: string[] = []
    const params: Array<string | number> = []
    if (name !== undefined && name !== null) { params.push(name.trim()); set.push(`name = $${params.length}`) }
    if (slug !== undefined && slug !== null) { params.push(slug.trim().toLowerCase().replace(/\s+/g, '_')); set.push(`slug = $${params.length}`) }
    if (description !== undefined && description !== null) { params.push(description.trim()); set.push(`description = $${params.length}`) }
    if (type !== undefined && type !== null && String(type).trim() !== '') { params.push(String(type).trim()); set.push(`type = $${params.length}`) }
    if (icon !== undefined) { params.push(icon); set.push(`icon = $${params.length}`) }
    if (color !== undefined && /^#[0-9A-Fa-f]{6}$/.test(color)) { params.push(color); set.push(`color = $${params.length}`) }
    if (set.length === 0) return space

    params.push(space.id)
    return spacesRepo.update(app.db, space.id, set.join(', '), params)
  })

  // ── DISPOSITIVOS DEL ESPACIO ──────────────────────
  api.get('/:id/devices', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (req, reply) => {
    const space = await getOwnerSpace(req.params.id, req.user.orgId)
    if (!space) return reply.code(404).send({ error: 'Espacio no encontrado' })
    return spacesRepo.listDevices(app.db, space.id)
  })

  // ── CONFIG AQI COMPLETA DEL ESPACIO ───────────────
  api.get('/:id/aqi', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (req, reply) => {
    const space = await getOwnerSpace(req.params.id, req.user.orgId)
    if (!space) return reply.code(404).send({ error: 'Espacio no encontrado' })

    const config = await getSpaceConfig(app.db, space.id)
    return { ...space, aqiConfig: config }
  })

  // ── GUARDAR CONFIG AQI DEL ESPACIO ────────────────
  api.put('/:id/aqi', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        categories: Type.Optional(Type.Array(Type.Object({
          name: Type.Optional(Type.String()),
          color: Type.Optional(Type.String()),
          score_lo: Type.Optional(Type.Number()),
          score_hi: Type.Optional(Type.Number()),
          phrases: Type.Optional(Type.Array(Type.String()))
        }))),
        variables: Type.Optional(Type.Array(Type.Object({
          variable_label: Type.String()
        }))),
        ranges: Type.Optional(Type.Array(Type.Object({
          variable_label: Type.String(),
          cat_order: Type.Number(),
          min_value: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
          max_value: Type.Optional(Type.Union([Type.Number(), Type.Null()]))
        })))
      })
    }
  }, async (req, reply) => {
    const space = await getOwnerSpace(req.params.id, req.user.orgId)
    if (!space) return reply.code(404).send({ error: 'Espacio no encontrado' })

    const { categories = [], variables = [], ranges = [] } = req.body || {}

    if (!Array.isArray(categories) || !Array.isArray(variables) || !Array.isArray(ranges)) {
      return reply.code(400).send({ error: 'categories, variables y ranges deben ser arrays' })
    }

    const byVar: Record<string, Array<{ cat_order: number; max: number | null }>> = {}
    for (const r of ranges) {
      const catOrder = Number(r.cat_order)
      if (byVar[r.variable_label]) byVar[r.variable_label].push({ cat_order: catOrder, max: r.max_value == null ? null : Number(r.max_value) })
      else byVar[r.variable_label] = [{ cat_order: catOrder, max: r.max_value == null ? null : Number(r.max_value) }]
    }
    const totalCats = categories.length
    for (const [label, list] of Object.entries(byVar)) {
      list.sort((a, b) => a.cat_order - b.cat_order)
      let prevMax: number | null = null
      let prevSet = false
      for (const { cat_order, max } of list) {
        if (cat_order === totalCats) continue
        if (max == null || Number.isNaN(max)) {
          return reply.code(400).send({ error: `La variable "${label}" necesita un límite (max) en la categoría ${cat_order}` })
        }
        if (prevSet && prevMax !== null && max <= prevMax) {
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

    const config = await getSpaceConfig(app.db, space.id)
    return { ...space, aqiConfig: config }
  })

  // ── CALCULAR AQI DE UN ESPACIO (diagnóstico) ──────
  api.post('/:id/aqi/calculate', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Optional(Type.Object({
        values: Type.Optional(Type.Record(Type.String(), Type.Number()))
      }))
    }
  }, async (req, reply) => {
    const space = await getOwnerSpace(req.params.id, req.user.orgId)
    if (!space) return reply.code(404).send({ error: 'Espacio no encontrado' })

    const config = await getSpaceConfig(app.db, space.id)
    const values = (req.body as { values?: Record<string, number> } | undefined)?.values || {}
    return computeAqi(values, config)
  })

  // ── ELIMINAR ESPACIO ──────────────────────────────
  api.delete('/:id', {
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (req, reply) => {
    const rowCount = await spacesRepo.remove(app.db, req.params.id, req.user.orgId)
    if (rowCount === 0) return reply.code(404).send({ error: 'Espacio no encontrado' })
    return { message: 'Espacio eliminado' }
  })
}