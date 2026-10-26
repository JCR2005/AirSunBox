import type { Queryable } from '../types/index.js'

export interface OrganizationRow {
  id: string
  name: string
  slug: string
  location: string | null
  plan: string | null
  status: string | null
  paid_until: Date | null
  nit: string | null
  contact_name: string | null
  notes: string | null
  phone: string | null
  type: string | null
  category: string | null
  b_category: string | null
  payment_exempt: boolean | null
  account_type: string | null
  email?: string | null
  device_count?: number
  active_devices?: number
  space_count?: number
  two_fa_policy?: string | null
}

export interface OrganizationListRow extends OrganizationRow {
  email: string | null
  device_count: number
  active_devices: number
  space_count: number
}

export interface OrganizationInsert {
  name: string
  slug: string
  location?: string | null
  plan?: string | null
  nit?: string | null
  contactName?: string | null
  notes?: string | null
  phone?: string | null
  type: string
  category: string
  bCategory: string
  accountType: string
  isSelfService?: boolean
}

export async function listAllForInternal(db: Queryable): Promise<OrganizationListRow[]> {
  const { rows } = await db.query<OrganizationListRow>(`
    SELECT
      o.id, o.name, o.slug, o.location, o.plan, o.status, o.paid_until,
      o.nit, o.contact_name, o.notes, o.phone,
      o.type, o.category, o.b_category, o.payment_exempt, o.account_type,
      MAX(u.email) as email,
      COUNT(DISTINCT d.id)::int as device_count,
      COUNT(DISTINCT CASE WHEN d.status = 'active' THEN d.id END)::int as active_devices,
      COUNT(DISTINCT s.id)::int as space_count
    FROM organizations o
    LEFT JOIN users u ON u.org_id = o.id AND u.role = 'client'
    LEFT JOIN devices d ON d.org_id = o.id
    LEFT JOIN spaces s ON s.org_id = o.id
    WHERE o.slug != 'airsunbox-internal'
    GROUP BY o.id
    ORDER BY o.name ASC
  `)
  return rows
}

export async function findByIdWithEmail(db: Queryable, id: string): Promise<OrganizationRow[]> {
  const { rows } = await db.query<OrganizationRow>(`
    SELECT o.*, u.email
    FROM organizations o
    LEFT JOIN users u ON u.org_id = o.id AND u.role = 'client'
    WHERE o.id = $1
    LIMIT 1
  `, [id])
  return rows
}

export async function findById(db: Queryable, id: string): Promise<OrganizationRow[]> {
  const { rows } = await db.query<OrganizationRow>(
    `SELECT * FROM organizations WHERE id = $1`,
    [id]
  )
  return rows
}

export async function findIdsBySlug(db: Queryable, slug: string): Promise<{ id: string }[]> {
  const { rows } = await db.query<{ id: string }>(
    'SELECT id FROM organizations WHERE slug = $1',
    [slug]
  )
  return rows
}

export async function create(db: Queryable, o: OrganizationInsert): Promise<OrganizationRow> {
  const { rows: [org] } = await db.query<OrganizationRow>(`
    INSERT INTO organizations (name, slug, location, plan, status, nit, contact_name, notes, phone, type, category, b_category, account_type, is_self_service)
    VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
  `, [o.name, o.slug, o.location || null, o.plan || 'free', o.nit || null, o.contactName || null, o.notes || null, o.phone || null, o.type, o.category, o.bCategory, o.accountType, o.isSelfService || false])
  return org
}

export async function createSelfService(
  db: Queryable,
  o: {
    name: string
    slug: string
    accountType: string
    location?: string | null
    contactName?: string | null
  }
) {
  const { rows: [org] } = await db.query<OrganizationRow>(
    `INSERT INTO organizations (name, slug, type, is_self_service, category, b_category, account_type, location, contact_name)
     VALUES ($1, $2, 'B', TRUE, 'independiente', 'estandar', $3, $4, $5)
     RETURNING id, name, slug, type, category, b_category, account_type, payment_exempt`,
    [o.name, o.slug, o.accountType, o.location || null, o.contactName || null]
  )
  return org
}

export async function update(
  db: Queryable,
  id: string,
  fields: {
    name?: string | null
    location?: string | null
    plan?: string | null
    status?: string | null
    paidUntil?: string | null
    nit?: string | null
    contactName?: string | null
    notes?: string | null
    phone?: string | null
    category?: string | null
    bCategory?: string | null
    paymentExempt?: boolean | null
    accountType?: string | null
  }
): Promise<OrganizationRow | undefined> {
  const result = await db.query<OrganizationRow>(`
    UPDATE organizations SET
      name           = COALESCE($1, name),
      location       = COALESCE($2, location),
      plan           = COALESCE($3, plan),
      status         = COALESCE($4, status),
      paid_until     = COALESCE($5, paid_until),
      nit            = COALESCE($6, nit),
      contact_name   = COALESCE($7, contact_name),
      notes          = COALESCE($8, notes),
      phone          = COALESCE($9, phone),
      category       = COALESCE($10, category),
      b_category     = COALESCE($11, b_category),
      payment_exempt = COALESCE($12, payment_exempt),
      account_type   = COALESCE($13, account_type)
    WHERE id = $14
    RETURNING *
  `, [fields.name, fields.location, fields.plan, fields.status, fields.paidUntil, fields.nit, fields.contactName, fields.notes, fields.phone, fields.category, fields.bCategory, fields.paymentExempt, fields.accountType, id])
  return result.rows[0]
}

export async function setStatus(db: Queryable, id: string, status: string) {
  const { rows: [org] } = await db.query<{ id: string; name: string; status: string | null }>(
    'UPDATE organizations SET status = $1 WHERE id = $2 RETURNING id, name, status',
    [status, id]
  )
  return org
}

export async function updatePaidUntil(db: Queryable, orgId: string, dueDate: string | Date) {
  await db.query(
    'UPDATE organizations SET paid_until = $1 WHERE id = $2',
    [dueDate, orgId]
  )
}