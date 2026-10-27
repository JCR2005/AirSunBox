import type { Queryable } from '../types/index.js'

// LEFT JOIN: una incidencia general (sin estación) tiene device_id NULL.
const SELECT = `
  SELECT i.*, d.name as device_name, o.name as org_name
  FROM incidents i
  LEFT JOIN devices d ON d.id = i.device_id
  JOIN organizations o ON o.id = i.org_id`

export async function list(db: Queryable, isInternal: boolean, orgId?: string) {
  const { rows } = await db.query(
    `${SELECT}
     ${isInternal ? '' : 'WHERE i.org_id = $1'}
     ORDER BY (i.status = 'resolved'), i.created_at DESC`,
    isInternal ? [] : [orgId]
  )
  return rows
}

export async function findById(db: Queryable, id: string) {
  const { rows: [incident] } = await db.query(`${SELECT} WHERE i.id = $1`, [id])
  return incident ?? null
}

export async function deviceBelongsToOrg(db: Queryable, deviceId: string, orgId: string) {
  const { rowCount } = await db.query(
    'SELECT 1 FROM devices WHERE id = $1 AND org_id = $2',
    [deviceId, orgId]
  )
  return (rowCount ?? 0) > 0
}

export async function create(db: Queryable, params: { deviceId: string | null; orgId: string; reason: string }) {
  const { rows: [incident] } = await db.query(
    `INSERT INTO incidents (device_id, org_id, reason)
     VALUES ($1, $2, $3) RETURNING id`,
    [params.deviceId, params.orgId, params.reason]
  )
  if (params.deviceId) {
    await db.query("UPDATE devices SET status = 'review' WHERE id = $1", [params.deviceId])
  }
  return findById(db, incident.id)
}

export async function markInReview(db: Queryable, id: string) {
  const { rowCount } = await db.query(
    "UPDATE incidents SET status = 'in_review' WHERE id = $1 AND status = 'open'",
    [id]
  )
  return (rowCount ?? 0) > 0
}

/**
 * Cierra la incidencia y, si era de una estación que quedó en revisión por
 * ella, la devuelve a activa. Devuelve false si ya estaba resuelta.
 */
export async function resolve(db: Queryable, id: string, notes: string | null) {
  const { rows: [incident] } = await db.query(
    `UPDATE incidents SET status = 'resolved', resolved_at = NOW(), notes = $1
     WHERE id = $2 AND status <> 'resolved' RETURNING device_id`,
    [notes, id]
  )
  if (!incident) return false
  if (incident.device_id) {
    await db.query(
      `UPDATE devices SET status = 'active'
       WHERE id = $1 AND status = 'review'
         AND NOT EXISTS (SELECT 1 FROM incidents
                         WHERE device_id = $1 AND status <> 'resolved')`,
      [incident.device_id]
    )
  }
  return true
}
