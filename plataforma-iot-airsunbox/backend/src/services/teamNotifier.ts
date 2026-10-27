import type { FastifyInstance } from 'fastify'
import { createMailer, type Mailer } from '../lib/mailer.js'
import { INTERNAL_ROLES } from '../types/index.js'

let _mailer: Mailer | null = null
const mailer = (app: FastifyInstance): Mailer => {
  if (!_mailer) _mailer = createMailer(app.log)
  return _mailer
}

// Destinatarios: el equipo interno activo y el buzón de AirSunBox (SMTP_USER),
// así el aviso llega aunque algún usuario interno tenga un correo que no recibe.
async function teamEmails(app: FastifyInstance): Promise<string[]> {
  const { rows } = await app.db.query<{ email: string }>(
    `SELECT email FROM users WHERE role = ANY($1) AND status = 'active'`,
    [INTERNAL_ROLES]
  )
  const emails = rows.map(r => r.email.toLowerCase())
  const inbox = process.env.SMTP_USER?.toLowerCase()
  if (inbox?.includes('@')) emails.push(inbox)
  return [...new Set(emails)]
}

/**
 * Avisa por correo al equipo AirSunBox (RF39). No bloquea la respuesta al
 * cliente: si el correo falla, queda en el log y el aviso sigue visible en
 * el panel de administración.
 */
export function notifyTeam(app: FastifyInstance, subject: string, lines: string[], link: string): void {
  void (async () => {
    const to = await teamEmails(app)
    if (to.length) await mailer(app).sendTeamNotice(to, subject, lines, link)
  })().catch(err => app.log.error({ err }, '[teamNotifier] no se pudo avisar al equipo'))
}

export async function orgName(app: FastifyInstance, orgId: string): Promise<string> {
  const { rows: [org] } = await app.db.query<{ name: string }>(
    'SELECT name FROM organizations WHERE id = $1', [orgId]
  )
  return org?.name ?? 'Un cliente'
}
