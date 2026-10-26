const { readFileSync } = require('node:fs')
const { Pool } = require('/home/carlos/Documentos/Sanik/plataforma-iot-sanik/backend/node_modules/pg')
const e = new Proxy({}, { get: (_, k) => readFileSync('/home/carlos/Documentos/Sanik/plataforma-iot-sanik/backend/.env', 'utf8').split('\n').find(l => l.startsWith(k + '='))?.slice(k.length + 1)?.trim() ?? '' })
const p = new Pool({ host: e.DB_HOST, port: Number(e.DB_PORT) || 5432, user: e.DB_USER, password: e.DB_PASSWORD, database: e.DB_NAME })
const { rows } = { rows: [] }
require('/home/carlos/Documentos/Sanik/plataforma-iot-sanik/backend/node_modules/pg')
process.exit(0)
