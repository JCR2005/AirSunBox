// ────────────────────────────────────────────────
// CATÁLOGO DE VARIABLES (globales + locales por espacio)
//
//  - variable_catalog.space_id NULL   → variable GLOBAL del sistema
//    (la ve/usa toda la plataforma; solo superadmin/admin la crean).
//  - variable_catalog.space_id set    → variable PRIVADA de un espacio
//    AQI (aislada: solo la ve ESE espacio). Cualquier miembro de la
//    organización dueña del espacio puede crearla/borrarla.
//
// Los labels siguen siendo únicos (UNIQUE(label)) a nivel global, así
// que dos espacios no pueden usar el mismo label → sin colisiones en
// telemetría (dots), device_variables ni la config AQI.
// ────────────────────────────────────────────────

export default async function variablesRoutes(app) {

  // Middleware de autenticación para todas las rutas
  app.addHook('onRequest', app.authenticate)

  // ── 0. HELPERS LOCALES (no dependen de closures ajenos) ──
  async function getOwnerSpace(id, orgId) {
    const { rows: [space] } = await app.db.query(
      `SELECT * FROM spaces WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    )
    return space
  }

  // ── 1. LISTAR CATÁLOGO DE VARIABLES ─────────────────────
  // GET /variables/catalog
  //   GET /variables/catalog?spaceId=<uuid> → globales + las de ESE espacio
  app.get('/catalog', async (req, reply) => {
    const { spaceId } = req.query

    // Si piden filtradas por espacio, validar pertenencia y devolver mezcla
    if (spaceId) {
      const space = await getOwnerSpace(spaceId, req.user.orgId)
      if (!space) return reply.code(404).send({ error: 'Espacio no encontrado' })

      const { rows } = await app.db.query(
        `SELECT label, name, unit, icon, description, data_type, space_id
         FROM variable_catalog
         WHERE space_id IS NULL OR space_id = $1
         ORDER BY space_id NULLS FIRST, name ASC`,
        [spaceId]
      )
      return rows
    }

    // Sin filtro → solo variables globales (panel admin / asignación por defecto)
    const { rows } = await app.db.query(
      `SELECT label, name, unit, icon, description, data_type, space_id
       FROM variable_catalog
       WHERE space_id IS NULL
       ORDER BY name ASC`
    )
    return rows
  })

  // ── 2. CREAR VARIABLE EN EL CATÁLOGO ──────────────────
  // POST /variables/catalog
  //   body { name, label?, unit, icon?, description?, data_type?, space_id? }
  //   - Con space_id (o spaceId) → variable privada del espacio (cualquier miembro de la org).
  //   - Sin space_id → variable global (solo superadmin/admin).
  app.post('/catalog', async (req, reply) => {
    const { name, label, unit, icon, description, data_type } = req.body || {}
    const spaceId = req.body?.space_id || req.body?.spaceId || null

    let cleanLabel = label
    if (!cleanLabel) {
      cleanLabel = name.toLowerCase().trim().replace(/\s+/g, '_')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    }
    cleanLabel = cleanLabel.toLowerCase().trim().replace(/\s+/g, '_')

    // ── Validación de permisos ──
    let space = null
    if (spaceId) {
      // Variable privada del espacio: puede crearla cualquier miembro de la org
      space = await getOwnerSpace(spaceId, req.user.orgId)
      if (!space) return reply.code(404).send({ error: 'El espacio no existe o no pertenece a tu organización' })
    } else if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      // Variable global: solo roles con administración
      return reply.code(403).send({ error: 'Solo puedes crear variables privadas de tu espacio. Para una global necesitas permisos de administración.' })
    }

    if (!name || !unit) {
      return reply.code(400).send({ error: 'Faltan campos obligatorios (nombre o unidad).' })
    }

    try {
      const { rows } = await app.db.query(
        `INSERT INTO variable_catalog (label, name, unit, icon, description, data_type, space_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [cleanLabel, name.trim(), unit.trim(), icon || 'Activity', description?.trim(), data_type || 'number', spaceId || null]
      )
      return reply.code(201).send(rows[0])
    } catch (err) {
      if (err.code === '23505') { // Violación de llave única en Postgres
        return reply.code(400).send({ error: `El identificador "${cleanLabel}" ya está en uso en el catálogo. Elegí otro nombre.` })
      }
      app.log.error(err)
      return reply.code(500).send({ error: 'Error interno al guardar la variable.' })
    }
  })

  // ── 2.5 ACTUALIZAR VARIABLE DEL CATÁLOGO (nombre/unidad/ícono) ──
  // PUT /variables/catalog/:label
  //   - El label queda inmutable (es el identificador técnico).
  //   - Variable local (space_id set) → la org dueña del espacio.
  //   - Variable global (space_id NULL) → solo superadmin/admin.
  app.put('/catalog/:label', async (req, reply) => {
    const { rows: [vc] } = await app.db.query(
      `SELECT * FROM variable_catalog WHERE label = $1`,
      [String(req.params.label).toLowerCase().trim()]
    )
    if (!vc) return reply.code(404).send({ error: 'Variable no encontrada.' })

    if (vc.space_id) {
      // Variable privada de un espacio: debe ser miembro de la org dueña
      const space = await getOwnerSpace(vc.space_id, req.user.orgId)
      if (!space) {
        return reply.code(403).send({ error: 'No puedes editar una variable que no pertenece a tu organización.' })
      }
    } else if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      // Variable global: solo roles con administración
      return reply.code(403).send({ error: 'Solo administradores pueden editar variables globales.' })
    }

    const { name, unit, icon, description } = req.body || {}
    const set = []
    const params = []
    if (name !== undefined && name !== null) { params.push(String(name).trim()); set.push(`name = $${params.length}`) }
    if (unit !== undefined && unit !== null) { params.push(String(unit).trim()); set.push(`unit = $${params.length}`) }
    if (icon !== undefined) { params.push(icon); set.push(`icon = $${params.length}`) }
    if (description !== undefined) { params.push(description?.trim()); set.push(`description = $${params.length}`) }

    if (set.length === 0) return vc

    params.push(vc.label)
    try {
      const { rows: [updated] } = await app.db.query(
        `UPDATE variable_catalog SET ${set.join(', ')} WHERE label = $${params.length} RETURNING *`,
        params
      )
      return updated
    } catch (err) {
      app.log.error(err)
      return reply.code(500).send({ error: 'Error interno al actualizar la variable.' })
    }
  })

  // ── 3. ELIMINAR VARIABLE DEL CATÁLOGO ─────────────────
  // DELETE /variables/catalog/:label
  //   - Variable global → solo superadmin/admin (como antes).
  //   - Variable de un espacio → cualquier miembro de la org dueña de ESE espacio.
  app.delete('/catalog/:label', async (req, reply) => {
    const { rows: [vc] } = await app.db.query(
      `SELECT space_id FROM variable_catalog WHERE label = $1`,
      [req.params.label]
    )
    if (!vc) return reply.code(404).send({ error: 'Variable no encontrada.' })

    if (vc.space_id) {
      // Pertenece a un espacio: debe ser miembro de la org dueña de ESE espacio
      const space = await getOwnerSpace(vc.space_id, req.user.orgId)
      if (!space) {
        return reply.code(403).send({ error: 'No puedes eliminar una variable que no pertenece a tu organización.' })
      }
    } else if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Solo administradores pueden eliminar variables globales.' })
    }

    const { rowCount } = await app.db.query(
      `DELETE FROM variable_catalog WHERE label = $1`,
      [req.params.label]
    )

    if (rowCount === 0) {
      return reply.code(404).send({ error: 'Variable no encontrada.' })
    }

    return { message: 'Variable eliminada correctamente.' }
  })

  // ── 4. OBTENER RANGOS DE CALIDAD DE AIRE POR VARIABLE ──
  app.get('/ranges/:label', async (req, reply) => {
    const cleanLabel = req.params.label.toLowerCase().trim()
    const { rows } = await app.db.query(
      `SELECT min_value, max_value, category
       FROM variable_catalog
       WHERE label = $1`,
      []
    )
    return rows
  })
}
