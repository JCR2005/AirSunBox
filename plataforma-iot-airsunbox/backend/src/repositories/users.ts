import type { Queryable } from '../types/index.js'
import type { Role } from '../types/index.js'

export interface LoginUserRow {
  id: string
  email: string
  password_hash: string
  role: Role
  name: string | null
  status: string
  org_id: string | null
  org_name: string | null
  org_slug: string | null
  plan: string | null
  org_status: string | null
  org_type: string | null
  org_category: string | null
  org_b_category: string | null
  org_payment_exempt: boolean | null
  org_account_type: string | null
  two_fa_enabled: boolean
}

export interface MeUserRow {
  id: string
  email: string
  role: Role
  name: string | null
  phone: string | null
  org_id: string | null
  org_name: string | null
  slug: string | null
  plan: string | null
  location: string | null
  created_at: Date
  two_fa_enabled: boolean
}

export interface ForgotPasswordRow {
  id: string
  status: string
  org_id: string | null
  org_status: string | null
  org_slug: string | null
}

export interface ResetTokenRow {
  id: string
  status: string
  reset_token_hash: string | null
  reset_token_expires_at: Date | null
  org_status: string | null
  org_slug: string | null
}

export interface OtpUserRow {
  name: string | null
  id: string
  email: string
  status: string
  two_fa_enabled: boolean
  otp_code_hash: string | null
  otp_expires_at: Date | null
  backup_codes: string[] | null
  otp_failed_attempts: number | null
  otp_locked_until: Date | null
}

export interface ClientUserRow {
  id: string
  email: string
  org_id: string | null
}

export interface IdRow {
  id: string
}

export async function findByEmail(db: Queryable, email: string): Promise<LoginUserRow[]> {
  const { rows } = await db.query<LoginUserRow>(
    `SELECT u.id, u.email, u.password_hash, u.role, u.name, u.status,
            u.org_id, u.two_fa_enabled, o.name as org_name, o.slug as org_slug, o.plan, o.status as org_status,
            o.type as org_type, o.category as org_category, o.b_category as org_b_category,
            o.payment_exempt as org_payment_exempt, o.account_type as org_account_type
     FROM users u
     LEFT JOIN organizations o ON o.id = u.org_id
     WHERE u.email = $1`,
    [email]
  )
  return rows
}

export async function findMe(db: Queryable, userId: string): Promise<MeUserRow[]> {
  const { rows } = await db.query<MeUserRow>(
    `SELECT u.id, u.email, u.role, u.name, u.phone, u.created_at, u.two_fa_enabled,
            o.id as org_id, o.name as org_name, o.slug, o.plan, o.location
     FROM users u
     LEFT JOIN organizations o ON o.id = u.org_id
     WHERE u.id = $1`,
    [userId]
  )
  return rows
}

// Datos que cada usuario puede editar de su propia cuenta (RF05)
export async function updateProfile(db: Queryable, userId: string, name: string, phone: string | null): Promise<void> {
  await db.query('UPDATE users SET name = $1, phone = $2 WHERE id = $3', [name, phone, userId])
}

export async function existsByEmail(db: Queryable, email: string): Promise<boolean> {
  const { rows } = await db.query<IdRow>('SELECT id FROM users WHERE email = $1', [email])
  return rows.length > 0
}

export async function createUser(
  db: Queryable,
  params: { orgId: string | null; email: string; passwordHash: string; role: Role; name?: string | null; phone?: string | null }
): Promise<{ id: string; email: string; role: Role; name: string | null } | undefined> {
  const { rows: [user] } = await db.query<{ id: string; email: string; role: Role; name: string | null }>(
    `INSERT INTO users (org_id, email, password_hash, role, name, phone)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, role, name`,
    [params.orgId, params.email, params.passwordHash, params.role, params.name ?? null, params.phone ?? null]
  )
  return user
}

export async function createClientUser(
  db: Queryable,
  params: { email: string; passwordHash: string; orgId: string; status?: string }
): Promise<void> {
  await db.query(
    `INSERT INTO users (email, password_hash, role, org_id, status)
     VALUES ($1, $2, 'client', $3, $4)`,
    [params.email, params.passwordHash, params.orgId, params.status || 'active']
  )
}

export async function findPasswordAndRoleById(db: Queryable, userId: string): Promise<{ password_hash: string; role: Role }[]> {
  const { rows } = await db.query<{ password_hash: string; role: Role }>(
    'SELECT password_hash, role FROM users WHERE id = $1',
    [userId]
  )
  return rows
}

export async function listTeam(db: Queryable) {
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.role, u.name, u.status, u.created_at
     FROM users u
     LEFT JOIN organizations o ON o.id = u.org_id
     WHERE (o.slug = 'airsunbox-internal' OR u.org_id IS NULL)
     ORDER BY u.created_at ASC`
  )
  return rows
}

export async function updateUserStatusAndRole(
  db: Queryable,
  userId: string,
  status?: string | null,
  role?: string | null
): Promise<{ id: string; email: string; role: Role; status: string } | undefined> {
  const updates: string[] = []
  const values: Array<string | null> = []
  let i = 1

  if (status) { updates.push(`status = $${i++}`); values.push(status) }
  if (role) { updates.push(`role = $${i++}`); values.push(role) }

  values.push(userId)

  const { rows: [user] } = await db.query<{ id: string; email: string; role: Role; status: string }>(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, email, role, status`,
    values
  )
  return user
}

export async function findForgotPasswordUser(db: Queryable, email: string): Promise<ForgotPasswordRow[]> {
  const { rows } = await db.query<ForgotPasswordRow>(
    `SELECT u.id, u.status, u.org_id,
            o.status as org_status, o.slug as org_slug
     FROM users u
     LEFT JOIN organizations o ON o.id = u.org_id
     WHERE u.email = $1`,
    [email]
  )
  return rows
}

export async function setResetToken(db: Queryable, userId: string, tokenHash: string): Promise<void> {
  await db.query(
    `UPDATE users
     SET reset_token_hash = $1, reset_token_expires_at = NOW() + INTERVAL '10 minutes'
     WHERE id = $2`,
    [tokenHash, userId]
  )
}

export async function findValidResetToken(db: Queryable, tokenHash: string): Promise<ResetTokenRow[]> {
  const { rows } = await db.query<ResetTokenRow>(
    `SELECT u.id, u.status, u.reset_token_hash, u.reset_token_expires_at,
            o.status as org_status, o.slug as org_slug
     FROM users u
     LEFT JOIN organizations o ON o.id = u.org_id
     WHERE u.reset_token_hash = $1
       AND u.reset_token_expires_at > NOW()`,
    [tokenHash]
  )
  return rows
}

// Consume el token en el mismo UPDATE que cambia la contraseña: si dos pedidos
// usan el mismo enlace a la vez, solo el primero lo encuentra vigente.
export async function clearResetTokenAndSetPassword(
  db: Queryable,
  userId: string,
  tokenHash: string,
  passwordHash: string
): Promise<boolean> {
  const result = await db.query(
    `UPDATE users
     SET password_hash = $1, reset_token_hash = NULL, reset_token_expires_at = NULL
     WHERE id = $2 AND reset_token_hash = $3 AND reset_token_expires_at > NOW()`,
    [passwordHash, userId, tokenHash]
  )
  return (result.rowCount ?? 0) > 0
}

export async function findClientUserByOrg(db: Queryable, orgId: string, fields: 'credentials' | 'reset' = 'reset'): Promise<ClientUserRow[]> {
  const select = fields === 'credentials'
    ? 'email'
    : 'id, email, org_id'
  const { rows } = await db.query<ClientUserRow>(
    `SELECT ${select} FROM users WHERE org_id = $1 AND role = 'client' LIMIT 1`,
    [orgId]
  )
  return rows
}

export async function resetClientPassword(
  db: Queryable,
  userId: string,
  passwordHash: string
): Promise<void> {
  await db.query(
    // También anula un enlace de recuperación pendiente
    `UPDATE users
     SET password_hash = $1, temp_password = NULL, status = 'active',
         reset_token_hash = NULL, reset_token_expires_at = NULL
     WHERE id = $2`,
    [passwordHash, userId]
  )
}

export async function setClientEmail(db: Queryable, orgId: string, email: string): Promise<number> {
  const result = await db.query(
    "UPDATE users SET email = $1 WHERE org_id = $2 AND role = 'client'",
    [email, orgId]
  )
  return result.rowCount ?? 0
}

export async function findById(db: Queryable, userId: string): Promise<OtpUserRow[]> {
  const { rows } = await db.query<OtpUserRow>(
    `SELECT id, email, name, status, two_fa_enabled, otp_code_hash, otp_expires_at, backup_codes, otp_failed_attempts, otp_locked_until FROM users WHERE id = $1`,
    [userId]
  )
  return rows
}

export async function setOtp(db: Queryable, userId: string, codeHash: string, expiresAt: Date): Promise<void> {
  await db.query(
    `UPDATE users SET otp_code_hash = $1, otp_expires_at = $2 WHERE id = $3`,
    [codeHash, expiresAt, userId]
  )
}

export async function clearOtp(db: Queryable, userId: string): Promise<void> {
  await db.query(
    `UPDATE users SET otp_code_hash = NULL, otp_expires_at = NULL WHERE id = $1`,
    [userId]
  )
}

export async function setTwoFactorEnabled(db: Queryable, userId: string, enabled: boolean): Promise<void> {
  await db.query(
    `UPDATE users SET two_fa_enabled = $1 WHERE id = $2`,
    [enabled, userId]
  )
}

export async function setBackupCodes(db: Queryable, userId: string, codesHash: string[]): Promise<void> {
  await db.query(
    `UPDATE users SET backup_codes = $1 WHERE id = $2`,
    [codesHash, userId]
  )
}

export async function clearBackupCodes(db: Queryable, userId: string): Promise<void> {
  await db.query(
    `UPDATE users SET backup_codes = NULL WHERE id = $1`,
    [userId]
  )
}

export async function consumeBackupCode(db: Queryable, userId: string, remainingCodes: string[]): Promise<void> {
  await db.query(
    `UPDATE users SET backup_codes = $1 WHERE id = $2`,
    [remainingCodes, userId]
  )
}

export async function incrementOtpFailedAttempts(db: Queryable, userId: string): Promise<number> {
  const { rows } = await db.query<{ attempts: number }>(
    `UPDATE users SET otp_failed_attempts = COALESCE(otp_failed_attempts, 0) + 1 
     WHERE id = $1 RETURNING otp_failed_attempts`,
    [userId]
  )
  return rows[0]?.attempts ?? 0
}

export async function resetOtpFailedAttempts(db: Queryable, userId: string): Promise<void> {
  await db.query(
    `UPDATE users SET otp_failed_attempts = 0, otp_locked_until = NULL WHERE id = $1`,
    [userId]
  )
}

export async function lockOtpUntil(db: Queryable, userId: string, until: Date): Promise<void> {
  await db.query(
    `UPDATE users SET otp_locked_until = $1 WHERE id = $2`,
    [until, userId]
  )
}