import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import pg from 'pg'

const { Pool } = pg

async function dbPlugin(app: FastifyInstance) {
  const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT     || 5432),
    user:     process.env.DB_USER     || 'iot_user',
    password: process.env.DB_PASSWORD || 'iot_password',
    database: process.env.DB_NAME     || 'iot_platform',
    max: Number(process.env.DB_POOL_MAX || 50),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT || 5000),
  })

  pool.on('error', (err) => {
    app.log.error(`❌ Error inesperado en pool PG: ${err.message}`)
  })

  try {
    await pool.query('SELECT 1')
    app.log.info('✅ Conectado a TimescaleDB')
  } catch (err) {
    app.log.error(`❌ Error conectando a TimescaleDB: ${(err as Error).message}`)
    throw err
  }

  app.decorate('db', pool)

  app.addHook('onClose', async () => {
    await pool.end()
  })
}

export default fp(dbPlugin)