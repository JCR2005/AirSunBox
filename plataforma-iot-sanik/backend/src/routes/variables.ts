import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import * as variablesRepo from '../repositories/variables.js'
import * as spacesRepo from '../repositories/spaces.js'
import { isSanikRole } from '../services/authService.js'

export default async function variablesRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<TypeBoxTypeProvider>()
  api.addHook('onRequest', app.authenticate)

  async function getOwnerSpace(spaceId: string, orgId: string) {
    const rows = await spacesRepo.findOwnerSpace(app.db, spaceId, orgId)
    return rows[0]
  }

  // ── 1. LISTAR CATÁLOGO DE VARIABLES ─────────────────────
  api.get('/catalog', {
    schema: {
      querystring: Type.Object({
        spaceId: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const spaceId = req.query.spaceId

    if (spaceId) {
      const space = await getOwnerSpace(spaceId, req.user.orgId)
      if (!space) return reply.code(404).send({ error: 'Espacio no encontrado' })
      return variablesRepo.listGlobalOrSpace(app.db, spaceId)
    }

    return variablesRepo.listGlobal(app.db)
  })

  // ── 2. CREAR VARIABLE EN EL CATÁLOGO ──────────────────
  api.post('/catalog', {
    schema: {
      body: Type.Object({
        name: Type.Optional(Type.String()),
        label: Type.Optional(Type.String()),
        unit: Type.Optional(Type.String()),
        icon: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        data_type: Type.Optional(Type.String()),
        space_id: Type.Optional(Type.String()),
        spaceId: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const body = req.body || {}
    const { name, label, unit, icon, description, data_type } = body
    const spaceId = body.space_id || body.spaceId || null

    let cleanLabel = label
    if (!cleanLabel) {
      cleanLabel = String(name || '').toLowerCase().trim().replace(/\s+/g, '_')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    }
    cleanLabel = cleanLabel.toLowerCase().trim().replace(/\s+/g, '_')

    let space = null
    if (spaceId) {
      space = await getOwnerSpace(spaceId, req.user.orgId)
      if (!space) return reply.code(404).send({ error: 'El espacio no existe o no pertenece a tu organización' })
    } else if (!isSanikRole(req.user.role)) {
      return reply.code(403).send({ error: 'Solo puedes crear variables privadas de tu espacio. Para una global necesitas permisos de administración.' })
    }

    if (!name || !unit) {
      return reply.code(400).send({ error: 'Faltan campos obligatorios (nombre o unidad).' })
    }

    try {
      const row = await variablesRepo.create(app.db, {
        label: cleanLabel,
        name: String(name).trim(),
        unit: String(unit).trim(),
        icon,
        description,
        dataType: data_type,
        spaceId
      })
      return reply.code(201).send(row)
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        return reply.code(400).send({ error: `El identificador "${cleanLabel}" ya está en uso en el catálogo. Elegí otro nombre.` })
      }
      app.log.error(err)
      return reply.code(500).send({ error: 'Error interno al guardar la variable.' })
    }
  })

  // ── 2.5 ACTUALIZAR VARIABLE DEL CATÁLOGO ──
  api.put('/catalog/:label', {
    schema: {
      params: Type.Object({ label: Type.String() }),
      body: Type.Object({
        name: Type.Optional(Type.String()),
        unit: Type.Optional(Type.String()),
        icon: Type.Optional(Type.String()),
        description: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const vcRows = await variablesRepo.findByLabel(app.db, String(req.params.label).toLowerCase().trim())
    const vc = vcRows[0]
    if (!vc) return reply.code(404).send({ error: 'Variable no encontrada.' })

    if (vc.space_id) {
      const space = await getOwnerSpace(vc.space_id, req.user.orgId)
      if (!space) {
        return reply.code(403).send({ error: 'No puedes editar una variable que no pertenece a tu organización.' })
      }
    } else if (!isSanikRole(req.user.role)) {
      return reply.code(403).send({ error: 'Solo administradores pueden editar variables globales.' })
    }

    const updated = await variablesRepo.update(app.db, vc.label, {
      name: req.body.name != null ? String(req.body.name) : null,
      unit: req.body.unit != null ? String(req.body.unit) : null,
      icon: req.body.icon,
      description: req.body.description !== undefined ? req.body.description : undefined
    })

    return updated || vc
  })

  // ── 3. ELIMINAR VARIABLE DEL CATÁLOGO ─────────────────
  api.delete('/catalog/:label', {
    schema: {
      params: Type.Object({ label: Type.String() })
    }
  }, async (req, reply) => {
    const vcRows = await variablesRepo.findByLabel(app.db, req.params.label)
    const vc = vcRows[0]
    if (!vc) return reply.code(404).send({ error: 'Variable no encontrada.' })

    if (vc.space_id) {
      const space = await getOwnerSpace(vc.space_id, req.user.orgId)
      if (!space) {
        return reply.code(403).send({ error: 'No puedes eliminar una variable que no pertenece a tu organización.' })
      }
    } else if (!isSanikRole(req.user.role)) {
      return reply.code(403).send({ error: 'Solo administradores pueden eliminar variables globales.' })
    }

    const rowCount = await variablesRepo.remove(app.db, req.params.label)
    if (rowCount === 0) {
      return reply.code(404).send({ error: 'Variable no encontrada.' })
    }

    return { message: 'Variable eliminada correctamente.' }
  })

  // ── 4. OBTENER RANGOS DE CALIDAD DE AIRE POR VARIABLE ──
  api.get('/ranges/:label', {
    schema: {
      params: Type.Object({ label: Type.String() })
    }
  }, async (req) => {
    const cleanLabel = req.params.label.toLowerCase().trim()
    // Las bandas viven en air_quality_ranges; variable_catalog no tiene esas columnas
    const { rows } = await app.db.query(
      `SELECT min_value, max_value, category, score
       FROM air_quality_ranges
       WHERE variable_label = $1
       ORDER BY min_value`,
      [cleanLabel]
    )
    return rows
  })
}