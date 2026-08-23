import fp from 'fastify-plugin'
import pg from 'pg'

const { Pool } = pg

async function dbPlugin(app) {
  const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 5432,
    user:     process.env.DB_USER     || 'iot_user',
    password: process.env.DB_PASSWORD || 'iot_password',
    database: process.env.DB_NAME     || 'iot_platform',
  })

  // Verificar conexión al arrancar
  try {
    await pool.query('SELECT 1')
    app.log.info('✅ Conectado a TimescaleDB')
  } catch (err) {
    app.log.error('❌ Error conectando a TimescaleDB:', err.message)
    throw err
  }

  // Decorar app con db para usarlo en todas las rutas
  app.decorate('db', pool)

  // Cerrar conexión al apagar
  app.addHook('onClose', async () => {
    await pool.end()
  })
}

export default fp(dbPlugin)
