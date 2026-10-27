import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import bcrypt from 'bcrypt'
import * as usersRepo from '../repositories/users.js'
import * as orgsRepo from '../repositories/organizations.js'
import { login, register, requestPasswordReset, resetPassword, checkResetToken, isInternalRole, isAdminRole, isValidRole, verifyOtpLogin, sendTwoFactorCode, enableTwoFactor, disableTwoFactor } from '../services/authService.js'
import { createMailer } from '../lib/mailer.js'
import { revokeToken } from '../services/sessionRevocation.js'
import { bearerToken } from '../lib/bearer.js'

export default async function authRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<TypeBoxTypeProvider>()
  const mailer = createMailer(app.log)

  // ── Login ──────────────────────────────────────
  api.post('/login', {
    schema: {
      body: Type.Object({
        email: Type.String(),
        password: Type.String()
      })
    }
  }, async (req, reply) => {
    const result = await login(app, req.body.email, req.body.password)
    if (!result.ok) return reply.code(result.status || 401).send({ error: result.error })
    return {
      token: result.token,
      redirect: result.redirect,
      user: result.user,
      org: result.org,
      requiresOtp: result.requiresOtp,
      tempToken: result.tempToken,
      message: result.message
    }
  })

  // ── OTP Verification (2do factor) ──────────────
  api.post('/otp/verify', {
    schema: {
      body: Type.Object({
        code: Type.String({ pattern: '^[0-9]{6}$' }),
        tempToken: Type.String()
      })
    }
  }, async (req, reply) => {
    const result = await verifyOtpLogin(app, req.body.tempToken, req.body.code)
    if (!result.ok) return reply.code(result.status || 401).send({ error: result.error })
    return {
      token: result.token,
      redirect: result.redirect,
      user: result.user,
      org: result.org
    }
  })

  // ── Estado 2FA ─────────────────────────────────
  api.get('/2fa/status', { onRequest: [app.authenticate] }, async (req, reply) => {
    const rows = await usersRepo.findById(app.db, req.user.userId)
    const user = rows[0]
    const orgRows = await orgsRepo.findById(app.db, req.user.orgId || '')
    const org = orgRows[0]
    return {
      enabled: !!user?.two_fa_enabled,
      backupCodesLeft: user?.backup_codes?.length ?? 0,
      policy: org?.two_fa_policy || 'optional'
    }
  })

  // ── Enviar código por email (para activar o desactivar 2FA) ──
  api.post('/2fa/send-code', { onRequest: [app.authenticate] }, async (req, reply) => {
    const result = await sendTwoFactorCode(app, req.user.userId)
    if (!result.ok) return reply.code(result.status || 400).send({ error: result.error })
    return { message: 'Te enviamos un código a tu email' }
  })

  // ── Habilitar 2FA ─────────────────────────────────
  api.post('/2fa/enable', {
    schema: {
      body: Type.Object({
        code: Type.String({ pattern: '^[0-9]{6}$' })
      })
    },
    onRequest: [app.authenticate]
  }, async (req, reply) => {
    const result = await enableTwoFactor(app, req.user.userId, req.body.code)
    if (!result.ok) return reply.code(result.status || 400).send({ error: result.error })
    return { backupCodes: result.backupCodes }
  })

  // ── Deshabilitar 2FA ──────────────────────────────
  api.post('/2fa/disable', {
    schema: {
      body: Type.Object({
        code: Type.String({ pattern: '^([0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}|[0-9]{6})$' })
      })
    },
    onRequest: [app.authenticate]
  }, async (req, reply) => {
    const result = await disableTwoFactor(app, req.user.userId, req.body.code)
    if (!result.ok) return reply.code(result.status || 401).send({ error: result.error })
    return { message: '2FA deshabilitado correctamente' }
  })

  // ── Perfil del usuario actual ──────────────────
  // ── Cerrar sesión: el token deja de valer también en el servidor ──
  api.post('/logout', { onRequest: [app.authenticate] }, async (req, reply) => {
    try {
      await revokeToken(app, bearerToken(req), req.user.exp ?? 0)
    } catch (err) {
      app.log.error(`No se pudo revocar el token al cerrar sesión: ${(err as Error).message}`)
      return reply.code(503).send({ error: 'No se pudo cerrar la sesión en el servidor' })
    }
    return reply.code(204).send()
  })

  api.get('/me', { onRequest: [app.authenticate] }, async (req) => {
    const rows = await usersRepo.findMe(app.db, req.user.userId)
    return rows[0]
  })

  // ── Editar el propio perfil ────────────────────
  // Solo nombre y teléfono: el correo identifica la cuenta y el rol lo asigna
  // un administrador.
  api.patch('/me', {
    onRequest: [app.authenticate],
    schema: {
      body: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 120 }),
        phone: Type.Optional(Type.Union([Type.String({ maxLength: 30 }), Type.Null()]))
      })
    }
  }, async (req, reply) => {
    const name = req.body.name.trim()
    const phone = req.body.phone?.trim() || null
    if (!name) return reply.code(400).send({ error: 'El nombre no puede quedar vacío' })
    if (phone && !/^\+?[0-9\s()-]{7,30}$/.test(phone))
      return reply.code(400).send({ error: 'Teléfono inválido: usá solo números, espacios, guiones o +' })
    await usersRepo.updateProfile(app.db, req.user.userId, name, phone)
    const rows = await usersRepo.findMe(app.db, req.user.userId)
    return rows[0]
  })

  // ── Crear usuario (solo admin/superadmin de AirSunBox) ──
  // Solo el superadmin crea admin/superadmin. Los roles internos quedan en la
  // organización de AirSunBox de quien los crea; un cliente va a la org indicada.
  api.post('/users', {
    schema: {
      body: Type.Object({
        email: Type.String(),
        password: Type.String({ minLength: 6 }),
        name: Type.Optional(Type.String()),
        phone: Type.Optional(Type.String()),
        role: Type.Optional(Type.String()),
        orgId: Type.Optional(Type.String())
      })
    },
    onRequest: [app.authenticate]
  }, async (req, reply) => {
    const { role: myRole } = req.user
    const { email, password, name, phone, orgId } = req.body
    const role = req.body.role || 'client'

    if (!isAdminRole(myRole))
      return reply.code(403).send({ error: 'Sin permisos' })

    if (!isValidRole(role))
      return reply.code(400).send({ error: 'Rol inválido' })

    if (isAdminRole(role) && myRole !== 'superadmin')
      return reply.code(403).send({ error: 'Solo el superadmin puede crear administradores' })

    const targetOrgId = isInternalRole(role) ? req.user.orgId : orgId
    if (!targetOrgId)
      return reply.code(400).send({ error: 'Indicá la organización del cliente' })

    const dup = await usersRepo.existsByEmail(app.db, email)
    if (dup)
      return reply.code(400).send({ error: 'Ese correo ya está registrado' })

    const hash = await bcrypt.hash(password, 10)

    const user = await usersRepo.createUser(app.db, {
      orgId: targetOrgId,
      email,
      passwordHash: hash,
      role,
      name,
      phone
    })

    return reply.code(201).send(user)
  })

  // ── Listar usuarios de AirSunBox (equipo interno) ──
  api.get('/team', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!isInternalRole(req.user.role))
      return reply.code(403).send({ error: 'Sin permisos' })
    return usersRepo.listTeam(app.db)
  })

  // ── Actualizar estado de usuario (suspender/activar) ──
  api.patch('/users/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        status: Type.Optional(Type.String()),
        role: Type.Optional(Type.String())
      })
    },
    onRequest: [app.authenticate]
  }, async (req, reply) => {
    const { role: myRole, userId: myId } = req.user
    const { status, role } = req.body

    if (!isInternalRole(myRole))
      return reply.code(403).send({ error: 'Sin permisos' })

    if (role && !isValidRole(role))
      return reply.code(400).send({ error: 'Rol inválido' })

    if (status && status !== 'active' && status !== 'suspended')
      return reply.code(400).send({ error: 'Estado inválido' })

    if (req.params.id === myId)
      return reply.code(403).send({ error: 'No podés cambiar tu propio rol o estado' })

    const [target] = await usersRepo.findPasswordAndRoleById(app.db, req.params.id)
    if (!target)
      return reply.code(404).send({ error: 'Usuario no encontrado' })

    // Tocar a un admin/superadmin, o convertir a alguien en uno, es solo del superadmin
    if ((isAdminRole(target.role) || (role && isAdminRole(role))) && myRole !== 'superadmin')
      return reply.code(403).send({ error: 'Solo el superadmin puede cambiar este rol' })

    const user = await usersRepo.updateUserStatusAndRole(app.db, req.params.id, status ?? null, role ?? null)
    return user
  })

  // ── Registro público (self-service) ─────────────────
  api.post('/register', {
    schema: {
      body: Type.Object({
        orgName: Type.Optional(Type.String()),
        email: Type.Optional(Type.String()),
        password: Type.Optional(Type.String()),
        confirmPassword: Type.Optional(Type.String()),
        name: Type.Optional(Type.String()),
        phone: Type.Optional(Type.String()),
        location: Type.Optional(Type.String()),
        contactName: Type.Optional(Type.String()),
        accountType: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const result = await register(app, req.body)
    if (!result.ok) return reply.code(result.status || 400).send({ error: result.error })
    return reply.code(201).send({
      token: result.token,
      redirect: result.redirect,
      user: result.user,
      org: result.org
    })
  })

  // ── Recuperación de contraseña — solicitar enlace ──
  api.post('/forgot-password', {
    schema: {
      body: Type.Object({
        email: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const result = await requestPasswordReset(app, req.body?.email || '', mailer)
    if (!result.ok) return reply.code(result.status || 400).send({ error: result.error })
    return reply.code(result.status || 200).send({ message: result.message })
  })

  // ── Recuperación de contraseña — ¿el enlace sigue vigente? ──
  api.post('/reset-password/check', {
    schema: {
      body: Type.Object({
        token: Type.Optional(Type.String())
      })
    }
  }, async (req) => {
    return { valid: await checkResetToken(app, req.body?.token) }
  })

  // ── Recuperación de contraseña — restablecer con el token ──
  api.post('/reset-password', {
    schema: {
      body: Type.Object({
        token: Type.Optional(Type.String()),
        password: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const result = await resetPassword(app, req.body?.token, req.body?.password)
    if (!result.ok) return reply.code(result.status || 400).send({ error: result.error })
    return { message: result.message }
  })
}