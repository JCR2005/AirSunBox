import { readFileSync } from 'node:fs'
import { createSigner } from 'fast-jwt'

const e = Object.fromEntries(
  readFileSync('/app/.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const ORG    = 'ffc11d58-7896-495a-8c7e-2fd77ce15051'
const DEVICE = '4ec2986e-253b-451f-99f2-d27af855b6c7'
const BASE   = 'http://localhost:3000/api'
const token  = createSigner({ key: e.JWT_SECRET, algorithm: 'HS256' })(
  { userId: '1', orgId: ORG, role: 'client', iat: Math.floor(Date.now() / 1000) }
)
const H  = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const get  = async url => (await (await fetch(BASE + url, { headers: H })).json())
const post = async (url, b) => (await (await fetch(BASE + url, { method: 'POST', headers: H, body: JSON.stringify(b) })).json())
const log  = m => process.stdout.write(m + '\n')
const sleep = ms => new Promise(r => setTimeout(r, ms))

const devices = await get('/devices')
const devRow  = devices.find(d => d.id === DEVICE)
const devToken = devRow.token
log(`1) GET /api/devices → token del device: ${String(devToken).slice(0, 10)}…`)
if (!devToken) { log(`   ❌ devices vacío: ${JSON.stringify(devices).slice(0, 140)}`); process.exit(1) }

log('\n2) POST /api/alerts — form REAL (channel=email, emailTo=TU CASILLA, SIN destination)')
const alert = await post('/alerts', {
  deviceId: DEVICE, variable: 'f', condition: '>', threshold: 75,
  cooldownMinutes: 0,
  channel: 'email', emailTo: 'airsunbox@gmail.com',
  message: 'REAL {estacion} · f = {valor} · {hora}'
})
log(`   → id=${String(alert.id || '').slice(0, 8)} | destination=${JSON.stringify(alert.destination)}`)
if (!alert.id) { log(`   ❌ ${JSON.stringify(alert).slice(0, 140)}`); process.exit(1) }

log('\n3) POST dots f=88 → DISPARAR EMAIL REAL')
await post(`/dots/${devToken}`, { f: 88 })
await sleep(2000)
const logs = await get(`/alerts/${DEVICE}/logs`)
log(`   - alert_logs: ${logs.length} | último: ${JSON.stringify((logs[0]?.message || '').slice(0, 48))}`)
log('\n✅ revisá airsunbox@gmail.com → bandeja principal + SPAM')
process.exit(0)
