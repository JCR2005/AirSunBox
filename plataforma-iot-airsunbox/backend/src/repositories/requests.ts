import type { Queryable } from '../types/index.js'

export async function list(db: Queryable, isInternal: boolean, orgId?: string) {
  const { rows } = await db.query(
    `SELECT r.*, o.name as org_name
     FROM requests r
     JOIN organizations o ON o.id = r.org_id
     ${isInternal ? '' : 'WHERE r.org_id = $1'}
     ORDER BY r.created_at DESC`,
    isInternal ? [] : [orgId]
  )
  return rows
}

export async function orgType(db: Queryable, orgId: string): Promise<string | null> {
  const { rows: [org] } = await db.query<{ type: string | null }>('SELECT type FROM organizations WHERE id = $1', [orgId])
  return org?.type ?? null
}

export async function create(db: Queryable, params: {
  orgId: string
  deviceName: string
  location: string
  quantity?: number
  note?: string | null
  paymentPhoto?: string | null
}) {
  const { rows: [request] } = await db.query(
    `INSERT INTO requests (org_id, device_name, location, quantity, note, payment_photo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [params.orgId, params.deviceName, params.location, params.quantity || 1, params.note ?? null, params.paymentPhoto ?? null]
  )
  return request
}

export async function updateStatus(db: Queryable, id: string, status: string, reviewedBy: string) {
  const { rows: [request] } = await db.query(
    `UPDATE requests SET status = $1, reviewed_by = $2
     WHERE id = $3 RETURNING *`,
    [status, reviewedBy, id]
  )
  return request
}