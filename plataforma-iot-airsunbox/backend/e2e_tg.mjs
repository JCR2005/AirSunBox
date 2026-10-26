import { readFileSync } from 'node:fs'
import { createSigner } from 'fast-jwt'

const env = Object.fromEntries(
  readFileSync('/app/.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const SECRET = env.JWT_SECRET
const ORG    = 'ffc11d58-7896-495a-8c7e-2fd77ce15051'
const DEVICE = '4ec2986e-253b-451f-99f2-d27af855b6c7'
const BASE   = 'http://localhost:3000/api'

const token = createSigner({ key: SECRET, algorithm: 'HS256' })(
  { userId: '1', orgId: ORG, role: 'client', iat: Math.floor(Date.now() / 1000) }
)
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const get  = async url => (await fetch(BASE + url, { headers: H })).json()
const post = async (url, body) => (await fetch(BASE + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json()
const log  = m => process.stdout.write(m + '\n')
const sleep = ms => new Promise(r => setTimeout(r, ms))

const devices = await get('/devices')
const devRow  = devices.find(d => d.id === DEVICE)
const devToken = devRow.token

const countLogs = async () => get(`/alerts/${DEVICE}/logs`)

log('1) GET /api/devices → space_name')
for (const d of devices)
  log(`   - ${d.name} → espacio: ${d.space_name ?? '(sin espacio)'}${d.id === DEVICE ? '   ← ESTA' : ''}`)

log('\n2) POST /api/alerts (f > 70, cooldown 0, email)')
const alert = await post('/alerts', {
  deviceId: DEVICE, variable: 'f', condition: '>', threshold: 70,
  cooldownMinutes: 0,
  message: 'TG E2E {estacion} · {variable} = {valor} · {hora}',
  destination: 'alerta@local.dev', botToken: '999999999:AAF4KE_TG_E2E', chatId: '-1009876543210', channel: 'telegram', botToken: '999999999:AAF4KE_TG_E2E', chatId: '-1001234567890'
})
log(`   → id=${alert.id} | active=${alert.active} | msg=${JSON.stringify(alert.message)}`)
if (!alert.id) { log(`   ERROR: ${JSON.stringify(alert)}`); process.exit(1) }

log('\n3) POST dots f=90 → DEBE DISPARAR (email)')
await post(`/dots/${devToken}`, { f: 90 })
await sleep(1200)
let logs = await countLogs()
log(`   - alert_logs: ${logs.length} | último: ${logs[0] ? JSON.stringify({ v: logs[0].variable, value: logs[0].value, msg: (logs[0].message || '').slice(0, 44) }) : 'NINGUNO'}`)

log('\n4) POST dots f=95 (sigue >70, cooldown 0) → NO DEBE REPETIR')
await post(`/dots/${devToken}`, { f: 95 })
await sleep(1200)
logs = await countLogs()
log(`   - alert_logs: ${logs.length} (esperado 1)`)

log('\n5) POST f=10 luego f=99 → TRANSICIÓN false→true → DEBE DISPARAR OTRA VEZ')
await post(`/dots/${devToken}`, { f: 10 })
await sleep(600)
await post(`/dots/${devToken}`, { f: 99 })
await sleep(1500)
logs = await countLogs()
log(`   - alert_logs: ${logs.length} (esperado 2)`)

log('\n6) Estado de la alerta')
const list = await get(`/alerts/${DEVICE}`)
const estado = list.find(a => a.id === alert.id)
log(`   - trigger_count = ${estado.trigger_count} | last_triggered_at = ${estado.last_triggered_at}`)

log('\n✅ E2E ALERTAS COMPLETADO')
process.exit(0)
