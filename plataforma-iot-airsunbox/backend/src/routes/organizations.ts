import type { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import * as orgsRepo from '../repositories/organizations.js'
import { isInternalTeam, createOrganization, updateOrganization, revealCredentials, resetClientPassword } from '../services/organizationsService.js'

export default async function organizationsRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<TypeBoxTypeProvider>()
  const auth = { onRequest: [app.authenticate] }

  // ── 1. LISTAR TODAS LAS ORGANIZACIONES ──
  api.get('/', auth, async (req, reply) => {
    if (!(await isInternalTeam(app, req.user?.userId)))
      return reply.code(403).send({ error: 'Sin permisos' })
    return orgsRepo.listAllForInternal(app.db)
  })

  // ── 2. OBTENER UNA ORGANIZACIÓN ──
  api.get('/:id', {
    ...auth,
    schema: { params: Type.Object({ id: Type.String() }) }
  }, async (req, reply) => {
    if (!(await isInternalTeam(app, req.user?.userId)))
      return reply.code(403).send({ error: 'Sin permisos' })
    const rows = await orgsRepo.findByIdWithEmail(app.db, req.params.id)
    if (!rows.length) return reply.code(404).send({ error: 'Organización no encontrada' })
    return rows[0]
  })

  // ── 3. CREAR ORGANIZACIÓN ──
  api.post('/', {
    ...auth,
    schema: {
      body: Type.Object({
        name: Type.Optional(Type.String()),
        organizationName: Type.Optional(Type.String()),
        orgName: Type.Optional(Type.String()),
        email: Type.Optional(Type.String()),
        clientEmail: Type.Optional(Type.String()),
        phone: Type.Optional(Type.String()),
        location: Type.Optional(Type.String()),
        plan: Type.Optional(Type.String()),
        contactName: Type.Optional(Type.String()),
        contact_name: Type.Optional(Type.String()),
        nit: Type.Optional(Type.String()),
        notes: Type.Optional(Type.String()),
        type: Type.Optional(Type.String()),
        category: Type.Optional(Type.String()),
        bCategory: Type.Optional(Type.String()),
        accountType: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    if (!(await isInternalTeam(app, req.user?.userId)))
      return reply.code(403).send({ error: 'Sin permisos' })

    const result = await createOrganization(app, req.body as Record<string, unknown>)
    if (!result.ok) return reply.code(result.status || 500).send({ error: result.error })
    return reply.code(201).send(result.org)
  })

  // ── 4. ACTUALIZAR ORGANIZACIÓN ──
  api.put('/:id', {
    ...auth,
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        name: Type.Optional(Type.String()),
        location: Type.Optional(Type.String()),
        plan: Type.Optional(Type.String()),
        status: Type.Optional(Type.String()),
        paidUntil: Type.Optional(Type.String()),
        nit: Type.Optional(Type.String()),
        contactName: Type.Optional(Type.String()),
        notes: Type.Optional(Type.String()),
        phone: Type.Optional(Type.String()),
        email: Type.Optional(Type.String()),
        category: Type.Optional(Type.String()),
        bCategory: Type.Optional(Type.String()),
        paymentExempt: Type.Optional(Type.Boolean()),
        accountType: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    if (!(await isInternalTeam(app, req.user?.userId)))
      return reply.code(403).send({ error: 'Sin permisos' })

    const result = await updateOrganization(app, req.params.id, req.body as Record<string, unknown>)
    if (!result.ok) return reply.code(result.status || 500).send({ error: result.error })
    return result.org
  })

  // ── 5. SUSPENDER / ACTIVAR ──
  api.patch('/:id/status', {
    ...auth,
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        status: Type.String()
      })
    }
  }, async (req, reply) => {
    if (!(await isInternalTeam(app, req.user?.userId)))
      return reply.code(403).send({ error: 'Sin permisos' })
    return orgsRepo.setStatus(app.db, req.params.id, req.body.status)
  })

  // ── 6. REVELAR CREDENCIALES ──
  api.post('/:id/reveal-credentials', {
    ...auth,
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        adminPassword: Type.Optional(Type.String())
      })
    }
  }, async (req, reply) => {
    const result = await revealCredentials(app, req.params.id, req.user.userId, req.body?.adminPassword || '')
    if (!result.ok) return reply.code(result.status || 500).send({ error: result.error })
    return result.credentials
  })

  // ── 7. RESETEAR CONTRASEÑA ──
  api.post('/:id/reset-client-password', {
    ...auth,
    schema: {
      params: Type.Object({ id: Type.String() })
    }
  }, async (req, reply) => {
    const result = await resetClientPassword(app, req.params.id, req.user.role)
    if (!result.ok) return reply.code(result.status || 500).send({ error: result.error })
    return result.credentials
  })
}