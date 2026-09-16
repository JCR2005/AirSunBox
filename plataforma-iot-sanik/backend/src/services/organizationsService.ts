import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import * as usersRepo from '../repositories/users.js'
import * as orgsRepo from '../repositories/organizations.js'
import * as spacesRepo from '../repositories/spaces.js'
import { seedAirTemplate } from './aqiService.js'
import { isSanikRole } from './authService.js'

export async function isSanikTeam(app: FastifyInstance, userId: string | undefined): Promise<boolean> {
  if (!userId) return false
  const { rows: [u] } = await app.db.query<{ role: string; slug: string | null }>(
    `SELECT u.role, o.slug FROM users u LEFT JOIN organizations o ON o.id = u.org_id WHERE u.id = $1`,
    [userId]
  )
  return !!u && isSanikRole(u.role) && (u.slug === 'sanik-internal' || u.slug === null)
}

export interface OrgResult {
  ok: boolean
  status?: number
  error?: string
  org?: unknown
}

export async function createOrganization(app: FastifyInstance, body: Record<string, unknown>): Promise<OrgResult> {
  const name = body.name || body.organizationName || body.orgName
  const email = body.email || body.clientEmail
  const phone = String(body.phone || '')
  const location = String(body.location || '')
  const plan = String(body.plan || 'free')
  const contactName = String(body.contactName || body.contact_name || '')
  const nit = String(body.nit || '')
  const notes = String(body.notes || '')

  const tipo = body.type === 'B' ? 'B' : 'A'
  const category = body.category === 'independiente'
    ? 'independiente'
    : (tipo === 'B' ? 'independiente' : 'dependiente')
  const bCategory = String(body.bCategory || 'estandar')
  const accountType = body.accountType === 'individual' ? 'individual' : 'organizacion'

  if (!name) {
    return { ok: false, status: 400, error: 'El nombre de la organización es obligatorio' }
  }

  const baseSlug = String(name).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-')

  let slug = baseSlug
  let counter = 1
  while (true) {
    const found = await orgsRepo.findIdsBySlug(app.db, slug)
    if (!found.length) break
    slug = `${baseSlug}-${counter++}`
  }

  const client = await app.db.connect()
  try {
    await client.query('BEGIN')

    if (email) {
      const dup = await usersRepo.existsByEmail(client, String(email))
      if (dup) {
        await client.query('ROLLBACK')
        return { ok: false, status: 400, error: 'El correo electrónico ya está registrado' }
      }
    }

    const org = await orgsRepo.create(client, {
      name: String(name),
      slug,
      location,
      plan,
      nit,
      contactName,
      notes,
      phone,
      type: tipo,
      category,
      bCategory,
      accountType
    })

    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let autoPassword = 'Sanik-'
    for (let i = 0; i < 6; i++) {
      autoPassword += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    const passwordHash = await bcrypt.hash(autoPassword, 10)

    const clientEmail = String(email || `${slug}@sanik.local`)
    await usersRepo.createClientWithTempPassword(client, { email: clientEmail, passwordHash, tempPassword: autoPassword, orgId: org.id })

    if (tipo === 'B') {
      const space = await spacesRepo.create(client, {
        orgId: org.id,
        name: 'Aire',
        slug: 'aire',
        type: 'aire',
        icon: 'aire',
        color: '#67B7E8'
      })
      await seedAirTemplate(client, space.id)
    }

    await client.query('COMMIT')

    return {
      ok: true,
      org: {
        ...org,
        email: clientEmail,
        credentials: { username: clientEmail, password: autoPassword }
      }
    }
  } catch (err) {
    await client.query('ROLLBACK')
    app.log.error(err)
    return { ok: false, status: 500, error: 'Error interno al registrar el cliente' }
  } finally {
    client.release()
  }
}

export async function updateOrganization(
  app: FastifyInstance,
  id: string,
  body: Record<string, unknown>
): Promise<OrgResult> {
  const client = await app.db.connect()
  try {
    await client.query('BEGIN')

    const updated = await orgsRepo.update(client, id, {
      name: body.name != null ? String(body.name) : null,
      location: body.location != null ? String(body.location) : null,
      plan: body.plan != null ? String(body.plan) : null,
      status: body.status != null ? String(body.status) : null,
      paidUntil: body.paidUntil != null ? String(body.paidUntil) : null,
      nit: body.nit != null ? String(body.nit) : null,
      contactName: body.contactName != null ? String(body.contactName) : null,
      notes: body.notes != null ? String(body.notes) : null,
      phone: body.phone != null ? String(body.phone) : null,
      category: body.category != null ? String(body.category) : null,
      bCategory: body.bCategory != null ? String(body.bCategory) : null,
      paymentExempt: body.paymentExempt != null ? Boolean(body.paymentExempt) : null,
      accountType: body.accountType != null ? String(body.accountType) : null
    })

    if (!updated) {
      await client.query('ROLLBACK')
      return { ok: false, status: 404, error: 'Organización no encontrada' }
    }

    if (body.email !== undefined) {
      const email = String(body.email)
      let count = await usersRepo.setClientEmail(client, id, email)
      if (count === 0 && email) {
        const tempPass = 'Sanik-' + Math.random().toString(36).slice(2, 8)
        const hash = await bcrypt.hash(tempPass, 10)
        await usersRepo.createClientWithTempPassword(client, { email, passwordHash: hash, tempPassword: tempPass, orgId: id })
        count = 1
      }
      if (count > 0) updated.email = email
    }

    await client.query('COMMIT')
    return { ok: true, org: updated }
  } catch (err) {
    await client.query('ROLLBACK')
    app.log.error(err)
    return { ok: false, status: 500, error: 'Error interno al actualizar el cliente' }
  } finally {
    client.release()
  }
}

export async function revealCredentials(
  app: FastifyInstance,
  orgId: string,
  adminUserId: string,
  adminPassword: string
): Promise<{ ok: boolean; status?: number; error?: string; credentials?: { email: string; password: string } }> {
  if (!adminPassword) return { ok: false, status: 400, error: 'La contraseña de administrador es requerida' }

  const rows = await usersRepo.findPasswordAndRoleById(app.db, adminUserId)
  const adminUser = rows[0]

  if (!adminUser || !isSanikRole(adminUser.role))
    return { ok: false, status: 403, error: 'Sin permisos' }

  const valid = await bcrypt.compare(adminPassword, adminUser.password_hash)
  if (!valid) return { ok: false, status: 401, error: 'Contraseña incorrecta' }

  const clientUsers = await usersRepo.findClientUserByOrg(app.db, orgId, 'credentials')
  const clientUser = clientUsers[0]

  if (!clientUser) return { ok: false, status: 404, error: 'Cliente sin usuario creado' }

  return {
    ok: true,
    credentials: {
      email: clientUser.email,
      password: clientUser.temp_password || 'Contraseña ya modificada por el cliente'
    }
  }
}

export async function resetClientPassword(
  app: FastifyInstance,
  orgId: string,
  requesterRole: string
): Promise<{ ok: boolean; status?: number; error?: string; credentials?: { email: string; password: string } }> {
  if (!isSanikRole(requesterRole))
    return { ok: false, status: 403, error: 'Sin permisos' }

  const clientUsers = await usersRepo.findClientUserByOrg(app.db, orgId)
  const clientUser = clientUsers[0]

  if (!clientUser) return { ok: false, status: 404, error: 'No se encontró usuario cliente' }

  const newPassword = 'Sanik-' + Math.random().toString(36).slice(2, 8).toUpperCase()
  const hash = await bcrypt.hash(newPassword, 10)
  await usersRepo.resetClientPassword(app.db, clientUser.id, hash, newPassword)

  return { ok: true, credentials: { email: clientUser.email, password: newPassword } }
}