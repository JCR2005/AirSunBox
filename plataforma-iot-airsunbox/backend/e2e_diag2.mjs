import { readFileSync } from 'node:fs'
import { Pool } from '/app/node_modules/pg/lib/index.js'
const e = Object.fromEntries(readFileSync('/app/.env', 'utf8').split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const p = new Pool({ host: e.DB_HOST, port: Number(e.DB_PORT), user: e.DB_USER, password: e.DB_PASSWORD, database: e.DB_NAME })

const { rows: A } = await p.query("SELECT id, channel, destination, email_to FROM alerts ORDER BY created_at DESC LIMIT 2")
for (const a of A) console.log('ALERTA', String(a.id).slice(0, 8), '|', a.channel, '| dest=', JSON.stringify(a.destination))

const { rows: L } = await p.query("SELECT source, status, message, created_at FROM alert_logs WHERE source='email' ORDER BY created_at DESC LIMIT 3")
for (const l of L) console.log(' EMAIL-LOG', String(l.status).slice(0, 20), '|', JSON.stringify(String(l.message).slice(0, 90)))

await p.end()
process.exit(0)
