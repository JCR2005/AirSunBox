import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
import * as usersRepo from '../repositories/users.js'
import * as orgsRepo from '../repositories/organizations.js'
import type { Role } from '../types/index.js'
import type { Mailer } from '../lib/mailer.js'
import { createMailer } from '../lib/mailer.js'
import { generateOtp, createOtp, sendOtp, verifyOtp, generateBackupCodes, hashBackupCodes } from './otpService.js'
import { markPasswordChanged } from './sessionRevocation.js'

export const INTERNAL_ROLES = ['superadmin', 'admin', 'worker'] as const

export function isInternalRole(role: string): boolean {
  return (INTERNAL_ROLES as readonly string[]).includes(role)
}

export function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'superadmin'
}

export function isValidRole(role: string): role is Role {
  return isInternalRole(role) || role === 'client'
}

export interface LoginOrg {
  id: string | null
  name: string | null
  slug: string | null
  plan: string | null
  type: string | null
  category: string | null
  bCategory: string | null
  accountType: string | null
  paymentExempt: boolean | null
}

export interface AuthResult {
  ok: boolean
  status?: number
  error?: string
  token?: string
  redirect?: string
  user?: { id: string; email: string; role: Role; name: string | null }
  org?: LoginOrg
  requiresOtp?: boolean
  tempToken?: string
  message?: string
}

export async function login(app: FastifyInstance, email: string, password: string): Promise<AuthResult> {
  const rows = await usersRepo.findByEmail(app.db, email)

  if (!rows.length)
    return { ok: false, status: 401, error: 'Correo o contraseña incorrectos' }

  const user = rows[0]

  if (user.status === 'suspended')
    return { ok: false, status: 403, error: 'Tu cuenta está suspendida. Contactá a AirSunBox.' }

  if (user.org_status === 'suspended' && !isInternalRole(user.role))
    return { ok: false, status: 403, error: 'Tu organización está suspendida. Contactá a AirSunBox.' }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid)
    return { ok: false, status: 401, error: 'Correo o contraseña incorrectos' }

  // Check if OTP is required
  const orgRows = await orgsRepo.findById(app.db, user.org_id || '')
  const org = orgRows[0]
  const requiresOtp = user.two_fa_enabled
    || (org?.two_fa_policy === 'required_all')
    || (org?.two_fa_policy === 'required_admins' && isInternalRole(user.role))

  if (requiresOtp) {
    const code = generateOtp()
    await createOtp(app, user.id, code)
    await sendOtp(app, user.email, code)

    const tempToken = app.jwt.sign({
      userId: user.id,
      orgId: user.org_id as string,
      role: user.role,
      otp_pending: true
    }, { expiresIn: '10m' })

    return {
      ok: true,
      requiresOtp: true,
      tempToken,
      message: 'Código enviado a tu email'
    }
  }

  const token = app.jwt.sign({
    userId: user.id,
    orgId: user.org_id as string,
    role: user.role
  })

  const redirect = isInternalRole(user.role)
    ? '/admin'
    : (user.org_type === 'B' ? '/espacios' : '/dispositivos')

  return {
    ok: true,
    token,
    redirect,
    user: { id: user.id, email: user.email, role: user.role, name: user.name },
    org: {
      id: user.org_id,
      name: user.org_name,
      slug: user.org_slug,
      plan: user.plan,
      type: user.org_type,
      category: user.org_category,
      bCategory: user.org_b_category,
      accountType: user.org_account_type,
      paymentExempt: user.org_payment_exempt
    }
  }
}

export interface RegisterResult {
  ok: boolean
  status?: number
  error?: string
  token?: string
  redirect?: string
  user?: { id: string; email: string; role: Role; name: string | null }
  org?: LoginOrg
}

export async function register(
  app: FastifyInstance,
  body: {
    orgName?: string
    email?: string
    password?: string
    confirmPassword?: string
    name?: string
    phone?: string
    location?: string
    contactName?: string
    accountType?: string
  }
): Promise<RegisterResult> {
  const { orgName, email, password, confirmPassword, name, phone, location, contactName, accountType } = body || {}

  const accType = accountType === 'individual' ? 'individual' : 'organizacion'

  if (!email || !password || !name) {
    return { ok: false, status: 400, error: 'Faltan campos obligatorios (email, password, name)' }
  }

  if (password !== confirmPassword) {
    return { ok: false, status: 400, error: 'Las contraseñas no coinciden' }
  }

  if (password.length < 6) {
    return { ok: false, status: 400, error: 'La contraseña debe tener al menos 6 caracteres' }
  }

  const orgDisplayName = accType === 'individual'
    ? `Cuenta de ${name.trim()}`
    : orgName?.trim()

  if (!orgDisplayName) {
    return { ok: false, status: 400, error: 'El nombre de la organización es obligatorio' }
  }

  const slugify = (s: string): string => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-') || 'org'
  const baseSlug = slugify(orgDisplayName)
  let cleanSlug = baseSlug
  let counter = 1
  while (true) {
    const found = await orgsRepo.findIdsBySlug(app.db, cleanSlug)
    if (!found.length) break
    cleanSlug = `${baseSlug}-${counter++}`
  }

  const dup = await usersRepo.existsByEmail(app.db, email)
  if (dup)
    return { ok: false, status: 400, error: 'Ese correo ya está registrado' }

  const hash = await bcrypt.hash(password, 10)

  const client = await app.db.connect()
  try {
    await client.query('BEGIN')

    const org = await orgsRepo.createSelfService(client, {
      name: orgDisplayName,
      slug: cleanSlug,
      accountType: accType,
      location: location?.trim() || null,
      contactName: contactName?.trim() || name
    })

    const user = await usersRepo.createUser(client, {
      orgId: org.id,
      email,
      passwordHash: hash,
      role: 'client',
      name: name.trim(),
      phone: phone?.trim() || null
    })

    await client.query('COMMIT')

    if (!user) throw new Error('No se pudo crear el usuario')

    const token = app.jwt.sign({ userId: user.id, orgId: org.id, role: user.role })

    return {
      ok: true,
      token,
      redirect: '/espacios',
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
      org: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: null,
        type: org.type,
        category: org.category,
        bCategory: org.b_category,
        accountType: org.account_type,
        paymentExempt: org.payment_exempt ?? null
      }
    }
  } catch (err) {
    await client.query('ROLLBACK')
    app.log.error(err)
    return { ok: false, status: 500, error: 'Error al registrar la organización' }
  } finally {
    client.release()
  }
}

// El token tiene 256 bits aleatorios: un SHA-256 basta (no hace falta bcrypt)
// y permite buscarlo directo en vez de comparar contra todos los vigentes.
function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function requestPasswordReset(app: FastifyInstance, rawEmail: string, mailer: Mailer): Promise<{ ok: boolean; status?: number; error?: string; message?: string }> {
  const email = (rawEmail || '').trim().toLowerCase()
  if (!email)
    return { ok: false, status: 400, error: 'El email es obligatorio' }

  const rows = await usersRepo.findForgotPasswordUser(app.db, email)
  const user = rows[0]
  const generic = 'Si el correo está registrado, vas a recibir un enlace para restablecer tu contraseña.'

  if (!user)
    return { ok: true, message: generic }

  if (user.status === 'suspended')
    return { ok: true, message: generic }

  if (user.org_slug !== 'airsunbox-internal' && user.org_status === 'suspended')
    return { ok: true, message: generic }

  const token = crypto.randomBytes(32).toString('hex')
  await usersRepo.setResetToken(app.db, user.id, hashResetToken(token))

  try {
    await mailer.sendPasswordReset(email, token)
  } catch (err) {
    app.log.error(`No se pudo enviar el email de recuperación a ${email}: ${(err as Error)?.message}`)
  }

  return { ok: true, message: generic }
}

export async function resetPassword(
  app: FastifyInstance,
  token: string | undefined,
  password: string | undefined
): Promise<{ ok: boolean; status?: number; error?: string; message?: string }> {
  if (!token || !password)
    return { ok: false, status: 400, error: 'Faltan el token y la nueva contraseña' }

  if (password.length < 8)
    return { ok: false, status: 400, error: 'La contraseña debe tener al menos 8 caracteres' }

  const [match] = await usersRepo.findValidResetToken(app.db, hashResetToken(token))

  if (!match)
    return { ok: false, status: 400, error: 'El enlace es inválido o ya expiró. Volvé a pedir la recuperación.' }

  if (match.status === 'suspended')
    return { ok: false, status: 403, error: 'Tu cuenta está suspendida. Contactá a AirSunBox.' }

  if (match.org_slug !== 'airsunbox-internal' && match.org_status === 'suspended')
    return { ok: false, status: 403, error: 'Tu organización está suspendida. Contactá a AirSunBox.' }

  const hash = await bcrypt.hash(password, 10)
  await usersRepo.clearResetTokenAndSetPassword(app.db, match.id, hash)
  // Cierra la sesión en todos los dispositivos
  await markPasswordChanged(app, match.id)

  return { ok: true, message: 'Contraseña actualizada. Ya podés iniciar sesión.' }
}

export async function verifyOtpLogin(
  app: FastifyInstance,
  tempToken: string,
  code: string
): Promise<AuthResult> {
  // El pase temporal vale 10 minutos desde el login (o el último reenvío).
  // Se valida aparte para no confundir un pase vencido con otros errores.
  let decoded: { userId: string; orgId: string; role: Role; otp_pending: boolean }
  try {
    decoded = app.jwt.verify<{ userId: string; orgId: string; role: Role; otp_pending: boolean }>(tempToken)
  } catch {
    return { ok: false, status: 401, error: 'La verificación venció. Pedí un código nuevo con "Reenviar código".' }
  }
  try {
    if (!decoded.otp_pending) {
      return { ok: false, status: 400, error: 'Token inválido' }
    }

    const result = await verifyOtp(app, decoded.userId, code)
    if (!result.valid) {
      return { ok: false, status: 401, error: 'Código inválido o expirado' }
    }

    // La cuenta pudo suspenderse entre la contraseña y el código
    const [current] = await usersRepo.findById(app.db, decoded.userId)
    if (!current || current.status === 'suspended') {
      return { ok: false, status: 403, error: 'Tu cuenta está suspendida. Contactá a AirSunBox.' }
    }

    const token = app.jwt.sign({
      userId: decoded.userId,
      orgId: decoded.orgId,
      role: decoded.role
    })

    const orgRows = await orgsRepo.findById(app.db, decoded.orgId)
    const org = orgRows[0]

    const redirect = isInternalRole(decoded.role)
      ? '/admin'
      : (org?.type === 'B' ? '/espacios' : '/dispositivos')

    return {
      ok: true,
      token,
      redirect,
      user: { id: decoded.userId, email: '', role: decoded.role, name: null },
      org: org ? {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        type: org.type,
        category: org.category,
        bCategory: org.b_category,
        accountType: org.account_type,
        paymentExempt: org.payment_exempt
      } : undefined
    }
  } catch (err) {
    app.log.error(`Error verificando el código 2FA: ${(err as Error)?.message}`)
    return { ok: false, status: 500, error: 'No se pudo verificar el código. Intentá de nuevo.' }
  }
}

// Manda un código al email del usuario para confirmar que activa o
// desactiva el 2FA. El código de login se genera aparte, en login().
export async function sendTwoFactorCode(
  app: FastifyInstance,
  userId: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const [user] = await usersRepo.findById(app.db, userId)
  if (!user) return { ok: false, status: 404, error: 'Usuario no encontrado' }
  if (user.otp_locked_until && new Date() < user.otp_locked_until) {
    return { ok: false, status: 429, error: 'Demasiados intentos fallidos. Probá de nuevo más tarde.' }
  }

  const code = generateOtp()
  await createOtp(app, userId, code)
  try {
    await sendOtp(app, user.email, code)
  } catch (err) {
    app.log.error(`No se pudo enviar el código 2FA a ${user.email}: ${(err as Error)?.message}`)
    return { ok: false, status: 502, error: 'No se pudo enviar el código por email' }
  }
  return { ok: true }
}

export async function enableTwoFactor(
  app: FastifyInstance,
  userId: string,
  code: string
): Promise<{ ok: boolean; status?: number; error?: string; backupCodes?: string[] }> {
  const [user] = await usersRepo.findById(app.db, userId)
  if (!user) return { ok: false, status: 404, error: 'Usuario no encontrado' }
  if (user.two_fa_enabled) return { ok: false, status: 400, error: 'El 2FA ya está activado' }

  // verifyOtp cuenta los intentos fallidos y bloquea tras varios
  const result = await verifyOtp(app, userId, code)
  if (!result.valid || result.usedBackup) {
    return { ok: false, status: 401, error: 'Código inválido o expirado' }
  }

  const plainCodes = generateBackupCodes()
  await usersRepo.setBackupCodes(app.db, userId, await hashBackupCodes(plainCodes))
  await usersRepo.setTwoFactorEnabled(app.db, userId, true)

  return { ok: true, backupCodes: plainCodes }
}

export async function disableTwoFactor(
  app: FastifyInstance,
  userId: string,
  code: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const [user] = await usersRepo.findById(app.db, userId)
  if (!user) return { ok: false, status: 404, error: 'Usuario no encontrado' }
  if (!user.two_fa_enabled) return { ok: false, status: 400, error: 'El 2FA no está activado' }

  // Vale el código enviado por email o un código de respaldo
  const result = await verifyOtp(app, userId, code)
  if (!result.valid) {
    return { ok: false, status: 401, error: 'Código inválido o expirado' }
  }

  await usersRepo.clearOtp(app.db, userId)
  await usersRepo.clearBackupCodes(app.db, userId)
  await usersRepo.setTwoFactorEnabled(app.db, userId, false)

  return { ok: true }
}
