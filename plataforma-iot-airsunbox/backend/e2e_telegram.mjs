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
const pool = new pg.Pool({
  host: env.DB_HOST || 'timescaledb', port: Number(env.DB_PORT || 5432),
  user: env.DB_USER || 'iot_user', password: env.DB_PASSWORD || 'iot_password',
  database: env.DB_NAME || 'iot_platform'
})
const { rows: [devRow] } = await pool.query('SELECT token FROM devices WHERE id=$1', [DEVICE])
const devToken = devRow.token
const countLogs = async () => get(`/alerts/${DEVICE}/logs`)

log('1) POST /api/alerts — Telegram (f > 60, bot fake)')
const alert = await post('/alerts', {
  deviceId: DEVICE, variable: 'f', condition: '>', threshold: 60,
  cooldownMinutes: 0,
  channel: 'telegram',
  botToken: '999999999:AAEXPIRE-BOTFALLO', chatId: '-1007770001111',
  message: 'TG E2E {estacion} · {variable} = {valor} · {hora}'
})
log(`   → id=${alert.id} | channel=${alert.channel} | tg_bot_token=${!!alert.telegram_bot_token} | tg_chat_id=${alert.telegram_chat_id}`)
if (!alert.id) { log(`   ERROR: ${JSON.stringify(alert)}`); process.exit(1) }

log('\n2) POST dots f=90 → DEBE INTENTAR TELEGRAM (fallara con 401 en el backend)')
await post(`/dots/${devToken}`, { f: 90 })
await sleep(1600)
const logs = await countLogs()
const tgl = logs.find(l => (l.message || '').toLowerCase().includes('telegram'))
log(`   - alert_logs: ${logs.length} | ch=${logs[0]?.channel}`)
log(`   - mensaje (telegram): ${JSON.stringify((logs[0]?.message || '').slice(0, 60))}`)
log(`   - ¿bot_token guardado? ${logs[0] && logs[0].channel.includes('telegram') ? 'SÍ ✓' : 'NO'}`)

log('\n3) Última disparo del bot (estado)')
log(`   - trigger_count=${logs.length ? (await get(`/alerts/${DEVICE}`)).find(a => a.id === alert.id).trigger_count : '—'}`)

log('\n✅ E2E TELEGRAM (canal) COMPLETADO — verificar log de error 401 en iot_backend')
process.exit(0)
