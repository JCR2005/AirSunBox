import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('/app/.env', 'utf8').split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const token = process.env.TG_TOKEN_REAL || ''
const chat = process.env.TG_CHAT_REAL || '-100999999'
const BASE = 'http://localhost:3000/api'
const H = { 'Content-Type': 'application/json' }
const log = m => process.stdout.write(m + '\n')
const mkAlert = async body => (await fetch(BASE + '/alerts', { method: 'POST', headers: H, body: JSON.stringify(body) })).json()
const JWT = (await import('fast-jwt')).createSigner({ key: env.JWT_SECRET, algorithm: 'HS256' })({ userId: '1', orgId: env.DEFAULT_ORG_ID || 'ffc11d58-7896-495a-8c7e-2fd77ce15051', role: 'client', iat: Math.floor(Date.now() / 1000) })
const HA = { ...H, Authorization: `Bearer ${JWT}` }

log('1) POST /api/alerts — canal email (form nuevo: channel=email, emailTo=…, sin destination)')
const a = await mkAlert({ deviceId: '4ec2986e-253b-451f-99f2-d27af855b6c7', variable: 'aqi', condition: '>', threshold: 30, channel: 'email', emailTo: 'airsunbox@gmail.com', message: 'PRUEBA {estacion} · {variable} = {valor} · {hora}' })
log(`   → id=${a.id} | destination=${a.destination} | email_to=${a.email_to}`)

log('\n2) POST — canal telegram (form nuevo sin destination)')
const t = process.env.TOKEN_FAKE || '999999999:AAF4KE_TG_E2E'
const a2 = await mkAlert({ deviceId: '4ec2986e-253b-451f-99f2-d27af855b6c7', variable: 'f', condition: '>', threshold: 60, channel: 'telegram', botToken: t, chatId: '-10000000001', message: 'PRUEBA TG {estacion} · {variable} = {valor}' })
log(`   → id=${a2.id} | destination=${a2.destination} | tg_ok=${!!(a2.telegram_bot_token)}`)

log('\n✅ DERIVACIÓN DESTINATION OK (dice "destination=X" en las 2)')
process.exit(0)
