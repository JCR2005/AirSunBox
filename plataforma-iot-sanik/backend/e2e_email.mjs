import { readFileSync } from 'node:fs'
import { createSigner } from 'fast-jwt'
const env = Object.fromEntries(readFileSync('/app/.env', 'utf8').split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const ORG = 'ffc11d58-7896-495a-8c7e-2fd77ce15051'
const DEV = '4ec2986e-253b-451f-99f2-d27af855b6c7'
const BASE = 'http://localhost:3000/api'
const signer = createSigner({ key: env.JWT_SECRET, algorithm: 'HS256' })
const token = signer({ userId: '1', orgId: ORG, role: 'client', iat: Math.floor(Date.now() / 1000) })
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const get = async u => (await (await fetch(BASE + u, { headers: H })).json())
const post = async (u, b) => (await (await fetch(BASE + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json())
const log = m => process.stdout.write(m + '\n')
const sleep = ms => new Promise(r => setTimeout(r, ms))

const dev = (await get('/alerts/' + DEV + '/sensors')).find(s => s.variable === 'f')
if (!dev) { log('❌ no hay variable f'); process.exit(1) }

log('1) POST /api/alerts — form REAL (sin destination / emailTo)')
const a = await post('/alerts', {
  deviceId: DEV, variable: 'f', condition: '>', threshold: 60,
  channel: 'email', emailTo: 'airsunbox@gmail.com',
  cooldownMinutes: 0, message: 'REAL {estacion} = {valor} · {hora}'
})
log(`   → id=${String(a.id || '').slice(0, 8)} | destination=${JSON.stringify(a.destination)}`)
if (!a.id) { log(`   ❌ ${JSON.stringify(a).slice(0, 100)}`); process.exit(1) }

log('2) POST dots f=85 → DISPARO REAL EMAIL')
const dot = await post('/dots/' + dev.id, { f: 85 })
await sleep(2500)
const logs = await get('/alerts/' + DEV + '/logs')
log(`   → alert_logs: ${logs.length} | msg: ${JSON.stringify((logs[0]?.message || '').slice(0, 30))}`)
log('✅ revisá airsunbox@gmail.com (SPAM)')
process.exit(0)
