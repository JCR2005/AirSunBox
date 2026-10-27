import type { Queryable } from '../types/index.js'
import { ONLINE_WINDOW } from '../lib/deviceStatus.js'

export interface SpaceRow {
  id: string
  org_id: string
  name: string
  slug: string
  type: string | null
  icon: string | null
  color: string | null
  hidden: boolean | null
  description: string | null
  created_at: Date
  device_count?: number
}

export async function listByOrg(db: Queryable, orgId: string) {
  const { rows } = await db.query<SpaceRow>(
    `SELECT s.id, s.name, s.slug, s.type, s.icon, s.color, s.hidden, s.description, s.created_at,
            COUNT(d.id)::int as device_count
     FROM spaces s
     LEFT JOIN devices d ON d.space_id = s.id
     WHERE s.org_id = $1
     GROUP BY s.id
     ORDER BY s.created_at ASC`,
    [orgId]
  )
  return rows
}

export async function create(db: Queryable, params: {
  orgId: string
  name: string
  slug: string
  type?: string
  icon?: string
  color?: string
  description?: string
}): Promise<SpaceRow> {
  const { rows: [space] } = await db.query<SpaceRow>(
    `INSERT INTO spaces (org_id, name, slug, type, icon, color, description, hidden)
     VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
     RETURNING *`,
    [params.orgId, params.name, params.slug, params.type || 'other', params.icon || 'otro', params.color || '#67B7E8', params.description ?? null]
  )
  return space
}

export async function findOwnerSpace(db: Queryable, id: string, orgId: string): Promise<SpaceRow[]> {
  const { rows } = await db.query<SpaceRow>(
    `SELECT * FROM spaces WHERE id = $1 AND org_id = $2`,
    [id, orgId]
  )
  return rows
}

export async function update(db: Queryable, id: string, set: string, params: Array<string | number>) {
  const { rows: [updated] } = await db.query<SpaceRow>(
    `UPDATE spaces SET ${set} WHERE id = $${params.length} RETURNING *`,
    params
  )
  return updated
}

export async function listDevices(db: Queryable, spaceId: string) {
  const { rows } = await db.query(
    `SELECT d.*,
            COUNT(dv.variable_label)::int as variable_count,
            CASE WHEN d.last_seen > NOW() - INTERVAL '${ONLINE_WINDOW}'
                 THEN 'online' ELSE 'offline' END as status
     FROM devices d
     LEFT JOIN device_variables dv ON dv.device_id = d.id
     WHERE d.space_id = $1
     GROUP BY d.id
     ORDER BY d.created_at DESC`,
    [spaceId]
  )
  return rows
}

export async function remove(db: Queryable, id: string, orgId: string): Promise<number> {
  const result = await db.query(
    `DELETE FROM spaces WHERE id = $1 AND org_id = $2`,
    [id, orgId]
  )
  return result.rowCount ?? 0
}