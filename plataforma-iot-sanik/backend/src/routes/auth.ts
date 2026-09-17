import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import bcrypt from 'bcrypt'
import * as usersRepo from '../repositories/users.js'
import * as orgsRepo from '../repositories/organizations.js'
import { login, register, requestPasswordReset, resetPassword, isSanikRole, verifyOtpLogin } from '../services/authService.js'
import { createMailer } from '../lib/mailer.js'

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
      enabled: !!user?.otp_code_hash,
      policy: org?.two_fa_policy || 'optional'
    }
  })

  // ── Perfil del usuario actual ──────────────────
  api.get('/me', { onRequest: [app.authenticate] }, async (req) => {
    const rows = await usersRepo.findMe(app.db, req.user.userId)
    return rows[0]
  })

  // ── Crear usuario (solo admin/superadmin de Sanik) ──
  api.post('/users', {
    schema: {
      body: Type.Object({
        email: Type.String(),
        password: Type.String(),
        name: Type.Optional(Type.String()),
        phone: Type.Optional(Type.String()),
        role: Type.Optional(Type.String()),
        orgId: Type.Optional(Type.String())
      })
    },
    onRequest: [app.authenticate]
  }, async (req, reply) => {
    const { role: myRole } = req.user
    const { email, password, name, phone, role, orgId } = req.body

    if (role === 'admin' && myRole !== 'superadmin')
      return reply.code(403).send({ error: 'Solo el superadmin puede crear administradores' })

    if (role && isSanikRole(role) && !isSanikRole(myRole))
      return reply.code(403).send({ error: 'Sin permisos' })

    const dup = await usersRepo.existsByEmail(app.db, email)
    if (dup)
      return reply.code(400).send({ error: 'Ese correo ya está registrado' })

    const hash = await bcrypt.hash(password, 10)
    const targetOrgId = orgId || req.user.orgId

    const user = await usersRepo.createUser(app.db, {
      orgId: targetOrgId,
      email,
      passwordHash: hash,
      role: (role as 'superadmin' | 'admin' | 'worker' | 'client') || 'client',
      name,
      phone
    })

    return reply.code(201).send(user)
  })

  // ── Listar usuarios de Sanik (equipo interno) ──
  api.get('/team', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!isSanikRole(req.user.role))
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
    const { role: myRole } = req.user
    const { status, role } = req.body

    if (!isSanikRole(myRole))
      return reply.code(403).send({ error: 'Sin permisos' })

    if (role === 'admin' && myRole !== 'superadmin')
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