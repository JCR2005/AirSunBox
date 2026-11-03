/**
 * smtp_real.mjs
 * Prueba de punta a punta del correo: envía un mensaje real con la
 * configuración SMTP del backend, para comprobar que el canal de alertas por
 * correo funciona.
 *
 *   cd plataforma-iot-airsunbox/backend && npm run build
 *   node ../tools/smtp_real.mjs destino@ejemplo.com
 *
 * Envía un correo de verdad: usa SMTP_* de backend/.env y el mailer compilado
 * del backend (backend/dist). Sin SMTP_HOST, el mailer solo muestra el correo
 * en la consola.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envFile = resolve(__dirname, '../backend/.env')

const env = Object.fromEntries(
  readFileSync(envFile, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
Object.assign(process.env, env)

const { createMailer } = await import('../backend/dist/lib/mailer.js')

const to = process.argv[2]
if (!to) {
  console.error('Uso: node tools/smtp_real.mjs destino@ejemplo.com')
  process.exit(1)
}

const log = m => process.stdout.write(m + '\n')
log((process.env.SMTP_HOST ? 'Enviando correo de prueba a ' : 'Sin SMTP_HOST: solo se muestra el correo para ') + to)
// El mailer espera un logger con .info (sin SMTP configurado vuelca el correo ahí)
const mailer = createMailer({ info: log })
try {
  await mailer.sendAlert(to, 'AirSunBox · prueba de correo', 'Hola,\n\nEste es un correo de prueba de AirSunBox.\nSi lo ves, el canal de correo funciona.\n\n— AirSunBox')
  log('✅ El servidor SMTP aceptó el mensaje')
} catch (e) {
  log('❌ El servidor SMTP rechazó el mensaje: ' + e.message)
  process.exitCode = 1
}
