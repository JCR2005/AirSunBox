import type { Queryable } from '../types/index.js'

export interface CatalogVariableRow {
  label: string
  name: string
  unit: string
  icon: string | null
  description: string | null
  data_type: string | null
  space_id: string | null
}

export interface FullVariableRow extends CatalogVariableRow {
  id: string
}

export async function listGlobal(db: Queryable): Promise<CatalogVariableRow[]> {
  const { rows } = await db.query<CatalogVariableRow>(
    `SELECT label, name, unit, icon, description, data_type, space_id
     FROM variable_catalog
     WHERE space_id IS NULL
     ORDER BY name ASC`
  )
  return rows
}

export async function listGlobalOrSpace(db: Queryable, spaceId: string): Promise<CatalogVariableRow[]> {
  const { rows } = await db.query<CatalogVariableRow>(
    `SELECT label, name, unit, icon, description, data_type, space_id
     FROM variable_catalog
     WHERE space_id IS NULL OR space_id = $1
     ORDER BY space_id NULLS FIRST, name ASC`,
    [spaceId]
  )
  return rows
}

export async function findByLabel(db: Queryable, label: string): Promise<FullVariableRow[]> {
  const { rows } = await db.query<FullVariableRow>(
    'SELECT * FROM variable_catalog WHERE label = $1',
    [label]
  )
  return rows
}

export async function existsByLabel(db: Queryable, label: string): Promise<boolean> {
  const { rows } = await db.query<{ label: string }>(
    'SELECT label FROM variable_catalog WHERE label = $1',
    [label]
  )
  return rows.length > 0
}

export async function labelsForSpace(db: Queryable, spaceId: string): Promise<{ label: string }[]> {
  const { rows } = await db.query<{ label: string }>(
    'SELECT label FROM variable_catalog WHERE space_id = $1',
    [spaceId]
  )
  return rows
}

export async function create(db: Queryable, params: {
  label: string
  name: string
  unit: string
  icon?: string | null
  description?: string | null
  dataType?: string | null
  spaceId?: string | null
}): Promise<FullVariableRow | undefined> {
  const { rows } = await db.query<FullVariableRow>(
    `INSERT INTO variable_catalog (label, name, unit, icon, description, data_type, space_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [params.label, params.name, params.unit, params.icon || 'Activity', params.description ?? null, params.dataType || 'number', params.spaceId || null]
  )
  return rows[0]
}

export async function update(db: Queryable, label: string, fields: {
  name?: string | null
  unit?: string | null
  icon?: unknown
  description?: string | null
}): Promise<FullVariableRow | undefined> {
  const set: string[] = []
  const params: unknown[] = []
  if (fields.name !== undefined && fields.name !== null) { params.push(String(fields.name).trim()); set.push(`name = $${params.length}`) }
  if (fields.unit !== undefined && fields.unit !== null) { params.push(String(fields.unit).trim()); set.push(`unit = $${params.length}`) }
  if (fields.icon !== undefined) { params.push(fields.icon); set.push(`icon = $${params.length}`) }
  if (fields.description !== undefined) { params.push(fields.description?.trim() ?? null); set.push(`description = $${params.length}`) }

  if (set.length === 0) return undefined

  params.push(label)
  const { rows: [updated] } = await db.query<FullVariableRow>(
    `UPDATE variable_catalog SET ${set.join(', ')} WHERE label = $${params.length} RETURNING *`,
    params
  )
  return updated
}

export async function remove(db: Queryable, label: string): Promise<number> {
  const result = await db.query(
    'DELETE FROM variable_catalog WHERE label = $1',
    [label]
  )
  return result.rowCount ?? 0
}