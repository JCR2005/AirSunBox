import type { Queryable } from '../types/index.js'

export interface DeviceRow {
  id: string
  org_id: string
  space_id: string | null
  token: string | null
  label: string | null
  name: string
  lat: number | null
  lng: number | null
  description: string | null
  icon: string | null
  tags: unknown
  status: string | null
  last_seen: Date | null
  serial: string | null
  public_map?: boolean
  display_variables?: unknown
  org_type?: string | null
  space_name?: string | null
  variable_count?: number
}

export async function findByToken(db: Queryable, token: string): Promise<{ id: string }[]> {
  const { rows } = await db.query<{ id: string }>(
    'SELECT id FROM devices WHERE token = $1',
    [token]
  )
  return rows
}

export async function findOrgScope(db: Queryable, deviceId: string): Promise<{ org_id: string | null; space_id: string | null; org_type: string | null }[]> {
  const { rows } = await db.query<{ org_id: string | null; space_id: string | null; org_type: string | null }>(
    `SELECT d.org_id, d.space_id, o.type AS org_type
     FROM devices d
     LEFT JOIN organizations o ON o.id = d.org_id
     WHERE d.id = $1`,
    [deviceId]
  )
  return rows
}

export async function listByOrg(db: Queryable, orgId: string) {
  const { rows } = await db.query(
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
    [orgId]
  )
  return rows
}

export async function create(db: Queryable, params: {
  orgId: string
  label?: string | null
  name: string
  lat?: number | null
  lng?: number | null
  description?: string | null
  icon?: string | null
  tags: string
  spaceId?: string | null
}) {
  const { rows: [device] } = await db.query<DeviceRow>(
    `INSERT INTO devices (org_id, label, name, lat, lng, description, icon, tags, space_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [params.orgId, params.label ?? null, params.name, params.lat ?? null, params.lng ?? null, params.description ?? null, params.icon || 'map-pin', params.tags, params.spaceId ?? null]
  )
  return device
}

export async function setToken(db: Queryable, deviceId: string, token: string): Promise<void> {
  await db.query('UPDATE devices SET token = $1 WHERE id = $2', [token, deviceId])
}

export async function findByIdAndOrg(db: Queryable, id: string, orgId: string): Promise<DeviceRow[]> {
  const { rows } = await db.query<DeviceRow>(
    `SELECT d.*,
            o.type AS org_type,
            CASE WHEN d.last_seen > NOW() - INTERVAL '5 minutes'
                 THEN 'online' ELSE 'offline' END as status
     FROM devices d
     LEFT JOIN organizations o ON o.id = d.org_id
     WHERE d.id = $1 AND d.org_id = $2`,
    [id, orgId]
  )
  return rows
}

export async function findCurrentForUpdate(db: Queryable, id: string, orgId: string): Promise<{ space_id: string | null; org_type: string | null }[]> {
  const { rows } = await db.query<{ space_id: string | null; org_type: string | null }>(
    `SELECT d.space_id, o.type AS org_type
     FROM devices d
     LEFT JOIN organizations o ON o.id = d.org_id
     WHERE d.id = $1 AND d.org_id = $2`,
    [id, orgId]
  )
  return rows
}

export async function update(db: Queryable, params: {
  id: string
  orgId: string
  spaceIdValue: string | null
  spaceIdEnviado: boolean
  displayVarsEnviado: boolean
  publicMapEnviado: boolean
  publicMap: boolean
  fields: {
    name?: string | null
    label?: string | null
    lat?: number | null
    lng?: number | null
    status?: string | null
    description?: string | null
    icon?: string | null
    tags?: string | null
    displayVariables?: string | null
    serial?: string | null
  }
}) {
  const { fields, id, orgId, spaceIdValue, spaceIdEnviado, displayVarsEnviado, publicMapEnviado, publicMap } = params
  const { rows } = await db.query<DeviceRow>(
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
    [fields.name, fields.label, fields.lat, fields.lng, fields.status, fields.description, fields.icon, fields.tags, id, orgId, spaceIdValue, spaceIdEnviado, fields.displayVariables, displayVarsEnviado, publicMapEnviado, publicMap === true, fields.serial]
  )
  return rows
}

export async function remove(db: Queryable, id: string, orgId: string): Promise<number> {
  const result = await db.query(
    'DELETE FROM devices WHERE id = $1 AND org_id = $2',
    [id, orgId]
  )
  return result.rowCount ?? 0
}

export async function setStatus(db: Queryable, id: string, status: string): Promise<void> {
  await db.query('UPDATE devices SET status = $1 WHERE id = $2', [status, id])
}

export async function updateLastSeen(db: Queryable, id: string, now: Date): Promise<void> {
  await db.query('UPDATE devices SET last_seen = $1 WHERE id = $2', [now, id])
}

export async function listVariablesCatalog(db: Queryable) {
  const { rows } = await db.query(
    `SELECT label, name, unit, icon, description, data_type
     FROM variable_catalog
     WHERE space_id IS NULL
     ORDER BY name ASC`
  )
  return rows
}

export async function getDeviceVariables(db: Queryable, deviceId: string, orgId: string) {
  const { rows } = await db.query(
    `SELECT vc.label, vc.name, vc.unit, vc.icon, vc.description, dv.created_at
     FROM device_variables dv
     JOIN variable_catalog vc ON vc.label = dv.variable_label
     JOIN devices d ON d.id = dv.device_id
     WHERE dv.device_id = $1 AND d.org_id = $2
     ORDER BY vc.name`,
    [deviceId, orgId]
  )
  return rows
}

export async function getDeviceLastValues(db: Queryable, deviceId: string, orgId: string) {
  const { rows } = await db.query(
    `SELECT vc.label, vc.name, vc.unit, vc.icon
     FROM device_variables dv
     JOIN variable_catalog vc ON vc.label = dv.variable_label
     JOIN devices d ON d.id = dv.device_id
     WHERE dv.device_id = $1 AND d.org_id = $2`,
    [deviceId, orgId]
  )
  return rows
}

export async function deviceBelongsToOrg(db: Queryable, deviceId: string, orgId: string): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    'SELECT id FROM devices WHERE id = $1 AND org_id = $2',
    [deviceId, orgId]
  )
  return rows.length > 0
}

export async function publicMapDevices(db: Queryable) {
  const { rows } = await db.query<DeviceRow>(
    `SELECT d.id, d.name, d.lat, d.lng, d.description,
            CASE WHEN d.last_seen > NOW() - INTERVAL '10 minutes'
                 THEN 'online' ELSE 'offline' END as status
     FROM devices d
     LEFT JOIN spaces s ON s.id = d.space_id
     LEFT JOIN organizations o ON o.id = d.org_id
     WHERE d.lat IS NOT NULL AND d.lng IS NOT NULL
       AND (
         (COALESCE(o.type, 'A') = 'A' AND (d.space_id IS NULL OR s.type = 'aire'))
         OR
         (COALESCE(o.type, 'A') = 'B' AND d.public_map = TRUE
          AND d.space_id IS NOT NULL AND s.type = 'aire' AND s.hidden = FALSE)
       )
     ORDER BY d.name ASC`
  )
  return rows
}