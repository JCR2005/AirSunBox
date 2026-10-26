import { createSigner } from 'fast-jwt'
import { readFileSync } from 'node:fs'
import pg from 'pg'

const e = Object.fromEntries(
  readFileSync('/app/.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const pool = new pg.Pool({ host: e.DB_HOST, port: Number(e.DB_PORT), user: e.DB_USER, password: e.DB_PASSWORD, database: e.DB_NAME })
const { rows } = await pool.query('SELECT id, org_id FROM devices ORDER BY created_at LIMIT 3')
await pool.end()
const DEV = rows[0]
const ORG = DEV.org_id
const token = createSigner({ key: e.JWT_SECRET, algorithm: 'HS256' })(
  { userId: '1', orgId: ORG, role: 'client', iat: Math.floor(Date.now() / 1000) }
)
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const get = async u => (await (await fetch('http://localhost:3000/api' + u, { headers: H })).json())
const post = async (u, b) => (await (await fetch('http://localhost:3000/api' + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json())
const log = m => process.stdout.write(m + '\n')
const sleep = ms => new Promise(r => setTimeout(r, ms))n

log('1) ¿qué device toma el form? (GET /devices con el token del user)')
const devices = await get('/devices')
const dev = devices.find(d => d.id === DEV.id) || devices[0]
log(`   → ${dev.name} · org=${dev.org_id === ORG ? 'OK' : 'MISMATCH'} · var=${dev.variable || dev.variables?.[0]}`)

log('\n2) POST /api/alerts con emailTo REAL, SIN destination (caso 500 del form)')
const alert = await post('/alerts', {
  deviceId: dev.id, variable: 'f', condition: '>', threshold: 50,
  cooldownMinutes: 0, channel: 'email', emailTo: 'airsunbox@gmail.com',
  message: 'REAL AQI {estacion} · f = {valor} · {hora}'
})
log(`   → id=${String(alert.id || '').slice(0, 8)} | destDerivado=${JSON.stringify(alert.destination).slice(0, 30)}`)
if (!alert.id) { log(`   ❌ ${JSON.stringify(alert).slice(0, 120)}`); process.exit(1) }

log('\n3) POST f=90 → DEBE DISPARAR Y MANDAR A airsunbox@gmail.com')
const devRow = await get(`/devices/${dev.id}`)
await post(`/dots/${devRow.token}`, { f: 90 })
await sleep(1500)
const logs = await get(`/alerts/${DEV.id}/logs`)
log(`   - alert_logs: ${logs.length} | último=${JSON.stringify((logs[0]?.message || '').slice(0, 40))}`)

log('\n✅ E2E EMAIL REAL — alert_logs disparado. Revisá airsunbox@gmail.com (SPAM también)')
process.exit(0)
