import { readFileSync } from 'node:fs'
import { createSigner } from 'fast-jwt'
const env = Object.fromEntries(readFileSync('/app/.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const SECRET=env.JWT_SECRET, ORG='ffc11d58-7896-495a-8c7e-2fd77ce15051', DEV='4ec2986e-253b-451f-99f2-d27af855b6c7', BASE='http://localhost:3000/api'
const t=createSigner({key:SECRET,algorithm:'HS256'})({userId:'1',orgId:ORG,role:'client',iat:Math.floor(Date.now()/1000)})
const H={Authorization:`Bearer ${t}`,'Content-Type':'application/json'}
const get=async u=>(await fetch(BASE+u,{headers:H})).json()
const post=async(u,b)=>(await fetch(BASE+u,{method:'POST',headers:H,body:JSON.stringify(b)})).json()
const log=m=>process.stdout.write(m+'\n')
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const {rows:[d]}=await new (await import('pg')).Pool({host:env.DB_HOST||'timescaledb',port:Number(env.DB_PORT||5432),user:env.DB_USER||'iot_user',password:env.DB_PASSWORD||'iot_password',database:env.DB_NAME||'iot_platform'}).query('SELECT token FROM devices WHERE id=$1',[DEV])
log('1) devices espacio')
for(const x of await get('/devices')) log(`   - ${x.name} → ${x.space_name}`)
log('\n2) POST alert (telegram, bot falso)')
const a=await post('/alerts',{deviceId:DEV,variable:'f',condition:'>',threshold:60,cooldownMinutes:0,channel:'telegram',botToken:'123456:AAF_TG_FAKE_E2E',chatId:'-100777',message:'TG REAL {estacion} · {variable} = {valor} · {hora}'})
log(`   → id=${a.id} | channel=${a.channel} | tg_bot=${!!a.telegram_bot_token} | tg_chat=${a.telegram_chat_id}`)
if(!a.id){log(`   ERROR ${JSON.stringify(a)}`);process.exit(1)}
log('\n3) dots f=90 → DEBE IR A api.telegram.org (fbots ok=false → email NO, log fallo)')
await post(`/dots/${d.token}`,{f:90})
await sleep(1600)
const logs=await get(`/alerts/${DEV}/logs`)
log(`   - alert_logs: ${logs.length} | canal=${logs[0]?.channel} | status=${logs[0]?.status}`)
log('   → revisa docker logs iot_backend (busca "api.telegram.org" o "Telegram")')
process.exit(0)
