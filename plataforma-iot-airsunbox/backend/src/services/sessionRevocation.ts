import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { JwtPayload } from '../types/index.js'

// Cierre de sesión: el token deja de valer en el servidor, no solo en el
// navegador. Se guarda el SHA-256 del token en Redis hasta que vence solo.
// Sin Redis no se puede consultar la lista: el token sigue valiendo hasta su
// vencimiento (24 h), igual que antes de existir el cierre en el servidor.
const loggedOutKey = (token: string) => `logout:${crypto.createHash('sha256').update(token).digest('hex')}`

export async function revokeToken(app: FastifyInstance, token: string, exp: number): Promise<void> {
  const ttl = exp - Math.floor(Date.now() / 1000)
  if (ttl <= 0) return
  await app.redis.set(loggedOutKey(token), '1', { EX: ttl })
}

export async function isTokenLoggedOut(app: FastifyInstance, token: string): Promise<boolean> {
  try {
    return (await app.redis.get(loggedOutKey(token))) !== null
  } catch {
    return false
  }
}

// Cierre de sesión en todos los dispositivos al cambiar la contraseña.
//
// Se guarda el segundo del cambio (users.password_changed_at y una copia en
// Redis para no consultar la base en cada petición). Un token emitido antes
// de ese segundo deja de valer. Un login posterior, aunque sea en el mismo
// segundo, emite un token con iat >= cambio y sigue siendo válido.

const key = (userId: string) => `pwdchg:${userId}`
// Más que la vida máxima de una sesión: pasado esto, los tokens viejos ya
// vencieron solos y la marca no hace falta.
const TTL_SECONDS = 8 * 24 * 3600

export async function markPasswordChanged(app: FastifyInstance, userId: string): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000)
  await app.db.query('UPDATE users SET password_changed_at = to_timestamp($1) WHERE id = $2', [nowSec, userId])
  try {
    await app.redis.set(key(userId), String(nowSec), { EX: TTL_SECONDS })
  } catch (err) {
    app.log.error(`No se pudo registrar el cambio de contraseña en Redis: ${(err as Error).message}`)
  }
}

export async function isSessionRevoked(app: FastifyInstance, payload: JwtPayload): Promise<boolean> {
  if (!payload?.userId || typeof payload.iat !== 'number') return false
  let changedSec: number | null = null
  try {
    const cached = await app.redis.get(key(payload.userId))
    if (cached) changedSec = Number(cached)
  } catch {
    // Sin Redis se consulta la base: más lento, pero no se pierde la revocación
    const { rows: [u] } = await app.db.query<{ s: number | null }>(
      'SELECT EXTRACT(EPOCH FROM password_changed_at)::bigint AS s FROM users WHERE id = $1',
      [payload.userId]
    )
    changedSec = u?.s != null ? Number(u.s) : null
  }
  return changedSec != null && payload.iat < changedSec
}

export const SESSION_REVOKED = {
  error: 'Tu contraseña cambió. Iniciá sesión de nuevo.',
  code: 'SESSION_REVOKED'
}
