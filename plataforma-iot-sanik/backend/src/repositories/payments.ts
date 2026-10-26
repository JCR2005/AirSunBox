import type { Queryable } from '../types/index.js'

export async function listByOrg(db: Queryable, orgId: string) {
  const { rows } = await db.query(
    `SELECT p.*, u.email as created_by_email
     FROM payments p
     LEFT JOIN users u ON u.id = p.created_by
     WHERE p.org_id = $1
     ORDER BY p.due_date DESC`,
    [orgId]
  )
  return rows
}

export async function create(db: Queryable, params: {
  orgId: string
  amount: number
  dueDate: string
  note?: string | null
  createdBy: string
}) {
  const { rows: [payment] } = await db.query(
    `INSERT INTO payments (org_id, amount, due_date, note, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [params.orgId, params.amount, params.dueDate, params.note ?? null, params.createdBy]
  )
  return payment
}

export async function markPaid(db: Queryable, id: string, note?: string | null) {
  const { rows: [payment] } = await db.query<{ id: string; org_id: string; due_date: string | Date }>(
    `UPDATE payments SET status = 'paid', paid_at = NOW(), note = COALESCE($1, note)
     WHERE id = $2 RETURNING *`,
    [note ?? null, id]
  )
  return payment
}