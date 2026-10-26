import type { Queryable } from '../types/index.js'

export async function list(db: Queryable, isInternal: boolean, orgId?: string) {
  const { rows } = await db.query(
    `SELECT i.*, d.name as device_name, o.name as org_name
     FROM incidents i
     JOIN devices d ON d.id = i.device_id
     JOIN organizations o ON o.id = i.org_id
     ${isInternal ? '' : 'WHERE i.org_id = $1'}
     ORDER BY i.created_at DESC`,
    isInternal ? [] : [orgId]
  )
  return rows
}

export async function create(db: Queryable, params: { deviceId: string; orgId: string; reason: string }) {
  const { rows: [incident] } = await db.query(
    `INSERT INTO incidents (device_id, org_id, reason)
     VALUES ($1, $2, $3) RETURNING *`,
    [params.deviceId, params.orgId, params.reason]
  )
  return incident
}

export async function resolve(db: Queryable, id: string, notes?: string | null) {
  const { rows: [incident] } = await db.query(
    `UPDATE incidents SET status = 'resolved', resolved_at = NOW(), notes = $1
     WHERE id = $2 RETURNING *`,
    [notes ?? null, id]
  )
  return incident
}