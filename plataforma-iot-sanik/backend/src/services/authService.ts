import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
import * as usersRepo from '../repositories/users.js'
import * as orgsRepo from '../repositories/organizations.js'
import type { Role } from '../types/index.js'
import type { Mailer } from '../lib/mailer.js'
import { createMailer } from '../lib/mailer.js'

export const SANIK_ROLES = ['superadmin', 'admin', 'worker'] as const

export function isSanikRole(role: string): boolean {
  return (SANIK_ROLES as readonly string[]).includes(role)
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
}

export async function login(app: FastifyInstance, email: string, password: string): Promise<AuthResult> {
  const rows = await usersRepo.findByEmail(app.db, email)

  if (!rows.length)
    return { ok: false, status: 401, error: 'Correo o contraseña incorrectos' }

  const user = rows[0]

  if (user.status === 'suspended')
    return { ok: false, status: 403, error: 'Tu cuenta está suspendida. Contactá a Sanik.' }

  if (user.org_status === 'suspended' && !isSanikRole(user.role))
    return { ok: false, status: 403, error: 'Tu organización está suspendida. Contactá a Sanik.' }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid)
    return { ok: false, status: 401, error: 'Correo o contraseña incorrectos' }

  const token = app.jwt.sign({
    userId: user.id,
    orgId: user.org_id as string,
    role: user.role
  })

  const redirect = isSanikRole(user.role)
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

  if (user.org_slug !== 'sanik-internal' && user.org_status === 'suspended')
    return { ok: true, message: generic }

  const token = crypto.randomBytes(32).toString('hex')
  const hash = await bcrypt.hash(token, 10)

  await usersRepo.setResetToken(app.db, user.id, hash)

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

  if (password.length < 6)
    return { ok: false, status: 400, error: 'La contraseña debe tener al menos 6 caracteres' }

  const rows = await usersRepo.listValidResetTokens(app.db)

  let match: (typeof rows)[number] | null = null
  for (const row of rows) {
    if (await bcrypt.compare(token, row.reset_token_hash!)) { match = row; break }
  }

  if (!match)
    return { ok: false, status: 400, error: 'El enlace es inválido o ya expiró. Volvé a pedir la recuperación.' }

  if (match.status === 'suspended')
    return { ok: false, status: 403, error: 'Tu cuenta está suspendida. Contactá a Sanik.' }

  if (match.org_slug !== 'sanik-internal' && match.org_status === 'suspended')
    return { ok: false, status: 403, error: 'Tu organización está suspendida. Contactá a Sanik.' }

  const hash = await bcrypt.hash(password, 10)
  await usersRepo.clearResetTokenAndSetPassword(app.db, match.id, hash)

  return { ok: true, message: 'Contraseña actualizada. Ya podés iniciar sesión.' }
}