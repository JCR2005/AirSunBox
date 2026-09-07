import { readFileSync } from 'node:fs'
import { createMailer } from './src/lib/mailer.js'

const env = Object.fromEntries(
  readFileSync('/app/.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
Object.assign(process.env, env)
const log = m => process.stdout.write(m + '\n')
const from = process.argv[2] || 'airsunbox@gmail.com'
log('Enviando … → ' + from)
const m = createMailer(log)
try {
  await m.sendAlert(from, 'Sanik · email real · E2E SMTP', 'Hola,\n\nEsto sale desde el contenedor con ssl smtp.gmail.com:465.\nSi lo ves, el canal Email funciona de verdad.\n\n— Sanik')
  log('✅ sendAlert() resolvió sin lanzar error')
} catch (e) {
  log('❌ SMTP rechazó: ' + e.message)
}
process.exit(0)
