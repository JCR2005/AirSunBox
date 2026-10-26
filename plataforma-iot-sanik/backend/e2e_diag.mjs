import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('/app/.env', 'utf8').split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const { createRequire } = await import("node:module"); const R = createRequire("/app/"); const p = new R("pg").Pool({
const p = new Pool({ host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME })

A = await p.query("SELECT id, channel, destination, email_to, bot_token, chat_id, message, threshold, cooldown_minutes, active FROM alerts ORDER BY created_at DESC LIMIT 2")
for (const a of A) {
  console.log('ALERTA', String(a.id).slice(0, 8), '| canal=', a.channel)
  console.log('   destination =', JSON.stringify(a.destination))
  console.log('   email_to    =', JSON.stringify(a.email_to))
  console.log('   telegram    =', a.bot_token ? 'Tiene token+' + String(a.chat_id).slice(0, 8) : 'sin token')
  console.log('   msg =', JSON.stringify(String(a.message).slice(0, 50)))
}

const { rows: L } = await p.query("SELECT source, status, message, created_at FROM alert_logs WHERE source='email' ORDER BY created_at DESC LIMIT 5")
console.log('── logs EMAIL recientes ──')
for (const l of L) console.log(' ', String(l.created_at).slice(11, 19), l.status, '|', JSON.stringify(String(l.message).slice(0, 100)))

await p.end()
process.exit(0)
