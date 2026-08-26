import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import { createMailer } from '../lib/mailer.js'

// Roles permitidos en el sistema
// superadmin = admin central (solo uno, no se puede crear desde la app)
// admin = administrador Sanik
// worker = trabajador Sanik
// client = cliente (municipalidad, empresa)
const SANIK_ROLES = ['superadmin', 'admin', 'worker']

export default async function authRoutes(app) {

  const mailer = createMailer(app.log)

  // ── Login ──────────────────────────────────────
  app.post('/login', async (req, reply) => {
    const { email, password } = req.body

    const { rows } = await app.db.query(
      `SELECT u.id, u.email, u.password_hash, u.role, u.name, u.status,
              u.org_id, o.name as org_name, o.slug as org_slug, o.plan, o.status as org_status,
              o.type as org_type, o.category as org_category, o.b_category as org_b_category,
              o.payment_exempt as org_payment_exempt, o.account_type as org_account_type
      FROM users u
      LEFT JOIN organizations o ON o.id = u.org_id
       WHERE u.email = $1`,
      [email]
    )

    if (!rows.length)
      return reply.code(401).send({ error: 'Correo o contraseña incorrectos' })

    const user = rows[0]

    if (user.status === 'suspended')
      return reply.code(403).send({ error: 'Tu cuenta está suspendida. Contactá a Sanik.' })

    if (user.org_status === 'suspended' && !SANIK_ROLES.includes(user.role))
      return reply.code(403).send({ error: 'Tu organización está suspendida. Contactá a Sanik.' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid)
      return reply.code(401).send({ error: 'Correo o contraseña incorrectos' })

    const token = app.jwt.sign({
      userId: user.id,
      orgId:  user.org_id,
      role:   user.role
    })

    // Ruta a la que redirigir según el rol:
    // · Sanik (admin/superadmin/worker) → panel admin
    // · Cliente de org tipo B (self-service) → gestiona sus espacios
    // · Cliente regular → dispositivos
    const redirect = SANIK_ROLES.includes(user.role)
      ? '/admin'
      : (user.org_type === 'B' ? '/espacios' : '/dispositivos')

    return {
      token,
      redirect,
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
      org:  { id: user.org_id, name: user.org_name, slug: user.org_slug, plan: user.plan, type: user.org_type, category: user.org_category, bCategory: user.org_b_category, accountType: user.org_account_type, paymentExempt: user.org_payment_exempt }
    }
  })

  // ── Perfil del usuario actual ──────────────────
  app.get('/me', { onRequest: [app.authenticate] }, async (req) => {
    const { rows } = await app.db.query(
      `SELECT u.id, u.email, u.role, u.name, u.phone,
              o.id as org_id, o.name as org_name, o.slug, o.plan, o.location
       FROM users u 
      LEFT JOIN organizations o ON o.id = u.org_id
       WHERE u.id = $1`,
      [req.user.userId]
    )
    return rows[0]
  })

  // ── Crear usuario (solo admin/superadmin de Sanik) ──
  app.post('/users', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { role: myRole } = req.user
    const { email, password, name, phone, role, orgId } = req.body

    // Solo superadmin puede crear admins
    if (role === 'admin' && myRole !== 'superadmin')
      return reply.code(403).send({ error: 'Solo el superadmin puede crear administradores' })

    // Solo Sanik puede crear workers y admins
    if (SANIK_ROLES.includes(role) && !SANIK_ROLES.includes(myRole))
      return reply.code(403).send({ error: 'Sin permisos' })

    const existing = await app.db.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length)
      return reply.code(400).send({ error: 'Ese correo ya está registrado' })

    const hash = await bcrypt.hash(password, 10)
    const targetOrgId = orgId || req.user.orgId

    const { rows: [user] } = await app.db.query(
      `INSERT INTO users (org_id, email, password_hash, role, name, phone)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, role, name`,
      [targetOrgId, email, hash, role || 'client', name, phone]
    )

    return reply.code(201).send(user)
  })

  // ── Listar usuarios de Sanik (equipo interno) ──
  app.get('/team', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { role } = req.user
    if (!SANIK_ROLES.includes(role))
      return reply.code(403).send({ error: 'Sin permisos' })

    const { rows } = await app.db.query(
      `SELECT u.id, u.email, u.role, u.name, u.status, u.created_at
       FROM users u
        LEFT JOIN organizations o ON o.id = u.org_id
      WHERE (o.slug = 'sanik-internal' OR u.org_id IS NULL)
       ORDER BY u.created_at ASC`
    )
    return rows
  })

  // ── Actualizar estado de usuario (suspender/activar) ──
  app.patch('/users/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { role: myRole } = req.user
    const { status, role } = req.body

    if (!SANIK_ROLES.includes(myRole))
      return reply.code(403).send({ error: 'Sin permisos' })

    // Solo superadmin puede cambiar rol de admins
    if (role === 'admin' && myRole !== 'superadmin')
      return reply.code(403).send({ error: 'Solo el superadmin puede cambiar este rol' })

    const updates = []
    const values = []
    let i = 1

    if (status) { updates.push(`status = $${i++}`); values.push(status) }
    if (role)   { updates.push(`role = $${i++}`);   values.push(role) }

    values.push(req.params.id)

    const { rows: [user] } = await app.db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, email, role, status`,
      values
    )
    return user
  })

  // ── Registro público (self-service) ─────────────────
  // Crea una organización tipo B (autogestionada) + su usuario admin
  // + un espacio base "Aire". Sin aprobación (org activa de inmediato).
  app.post('/register', async (req, reply) => {
    const { orgName, email, password, confirmPassword, name, phone, location, contactName, accountType } = req.body || {}

    // 'individual' = persona natural (su org interna se llama "Cuenta de <nombre>")
    // 'organizacion' = empresa, municipio, universidad, etc. (default)
    const accType = accountType === 'individual' ? 'individual' : 'organizacion'

    if (!email || !password || !name) {
      return reply.code(400).send({ error: 'Faltan campos obligatorios (email, password, name)' })
    }

    if (password !== confirmPassword) {
      return reply.code(400).send({ error: 'Las contraseñas no coinciden' })
    }

    if (password.length < 6) {
      return reply.code(400).send({ error: 'La contraseña debe tener al menos 6 caracteres' })
    }

    const orgDisplayName = accType === 'individual'
      ? `Cuenta de ${name.trim()}`
      : orgName?.trim()

    if (!orgDisplayName) {
      return reply.code(400).send({ error: 'El nombre de la organización es obligatorio' })
    }

    // Slug generado automáticamente desde el nombre (único con sufijo numérico)
    const slugify = (s) => s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim().replace(/\s+/g, '-') || 'org'
    const baseSlug = slugify(orgDisplayName)
    let cleanSlug = baseSlug
    let counter = 1
    while (true) {
      const { rows } = await app.db.query('SELECT id FROM organizations WHERE slug = $1', [cleanSlug])
      if (!rows.length) break
      cleanSlug = `${baseSlug}-${counter++}`
    }

    const dupEmail = await app.db.query('SELECT id FROM users WHERE email = $1', [email])
    if (dupEmail.rows.length)
      return reply.code(400).send({ error: 'Ese correo ya está registrado' })

    const hash = await bcrypt.hash(password, 10)

    const client = await app.db.connect()
    try {
      await client.query('BEGIN')

      const { rows: [org] } = await client.query(
        `INSERT INTO organizations (name, slug, type, is_self_service, category, b_category, account_type, location, contact_name)
         VALUES ($1, $2, 'B', TRUE, 'independiente', 'estandar', $3, $4, $5)
         RETURNING id, name, slug, type, category, b_category, account_type, payment_exempt`,
        [orgDisplayName, cleanSlug, accType, location?.trim() || null, contactName?.trim() || name]
      )

      const { rows: [user] } = await client.query(
        `INSERT INTO users (org_id, email, password_hash, role, name, phone)
         VALUES ($1, $2, $3, 'client', $4, $5)
         RETURNING id, email, role, name`,
        [org.id, email, hash, name.trim(), phone?.trim() || null]
      )

      await client.query('COMMIT')

      const token = app.jwt.sign({ userId: user.id, orgId: org.id, role: user.role })

      return reply.code(201).send({
        token,
        redirect: '/espacios',
        user: { id: user.id, email: user.email, role: user.role, name: user.name },
        org: { id: org.id, name: org.name, slug: org.slug, type: org.type, category: org.category, bCategory: org.b_category, accountType: org.account_type, paymentExempt: org.payment_exempt }
      })
    } catch (err) {
      await client.query('ROLLBACK')
      app.log.error(err)
      return reply.code(500).send({ error: 'Error al registrar la organización' })
    } finally {
      client.release()
    }
  })

  // ── Recuperación de contraseña — solicitar enlace ──
  // Cubre cuentas individuales y organizaciones autogestionadas:
  // el email es UNIQUE en users, así que un solo flujo sirve para ambas.
  // Responde siempre 200 para no revelar si un email está registrado.
  app.post('/forgot-password', async (req, reply) => {
    const email = (req.body?.email || '').trim().toLowerCase()
    if (!email)
      return reply.code(400).send({ error: 'El email es obligatorio' })

    const { rows } = await app.db.query(
      `SELECT u.id, u.status, u.org_id,
              o.status as org_status, o.slug as org_slug
       FROM users u
       LEFT JOIN organizations o ON o.id = u.org_id
       WHERE u.email = $1`,
      [email]
    )

    const user = rows[0]
    const generic = { message: 'Si el correo está registrado, vas a recibir un enlace para restablecer tu contraseña.' }

    if (!user)
      return reply.code(200).send(generic)

    if (user.status === 'suspended')
      return reply.code(200).send(generic)

    if (user.org_slug !== 'sanik-internal' && user.org_status === 'suspended')
      return reply.code(200).send(generic)

    const token = crypto.randomBytes(32).toString('hex')
    const hash = await bcrypt.hash(token, 10)

    await app.db.query(
      `UPDATE users
       SET reset_token_hash = $1, reset_token_expires_at = NOW() + INTERVAL '60 minutes'
       WHERE id = $2`,
      [hash, user.id]
    )

    try {
      await mailer.sendPasswordReset(email, token)
    } catch (err) {
      app.log.error(`No se pudo enviar el email de recuperación a ${email}:`, err)
    }

    return reply.code(200).send(generic)
  })

  // ── Recuperación de contraseña — restablecer con el token ──
  app.post('/reset-password', async (req, reply) => {
    const { token, password } = req.body || {}

    if (!token || !password)
      return reply.code(400).send({ error: 'Faltan el token y la nueva contraseña' })

    if (password.length < 6)
      return reply.code(400).send({ error: 'La contraseña debe tener al menos 6 caracteres' })

    // No se puede consultar por bcrypt, así que buscamos los resets vigentes
    // y comparamos el token contra cada hash.
    const { rows } = await app.db.query(
      `SELECT u.id, u.status, u.reset_token_hash, u.reset_token_expires_at,
              o.status as org_status, o.slug as org_slug
       FROM users u
       LEFT JOIN organizations o ON o.id = u.org_id
       WHERE u.reset_token_hash IS NOT NULL
         AND u.reset_token_expires_at > NOW()`
    )

    let match = null
    for (const row of rows) {
      if (await bcrypt.compare(token, row.reset_token_hash)) { match = row; break }
    }

    if (!match)
      return reply.code(400).send({ error: 'El enlace es inválido o ya expiró. Volvé a pedir la recuperación.' })

    if (match.status === 'suspended')
      return reply.code(403).send({ error: 'Tu cuenta está suspendida. Contactá a Sanik.' })

    if (match.org_slug !== 'sanik-internal' && match.org_status === 'suspended')
      return reply.code(403).send({ error: 'Tu organización está suspendida. Contactá a Sanik.' })

    const hash = await bcrypt.hash(password, 10)

    await app.db.query(
      `UPDATE users
       SET password_hash = $1, reset_token_hash = NULL, reset_token_expires_at = NULL
       WHERE id = $2`,
      [hash, match.id]
    )

    return { message: 'Contraseña actualizada. Ya podés iniciar sesión.' }
  })
}
