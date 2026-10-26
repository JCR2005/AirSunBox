// Crea (o restablece) un superadmin en la organización interna de AirSunBox.
//
//   SUPERADMIN_PASSWORD='...' node dist/scripts/createSuperadmin.js admin@dominio.com
//
// Sin SUPERADMIN_PASSWORD genera una contraseña aleatoria y la imprime una
// sola vez. Reemplaza al superadmin con contraseña conocida que sembraba
// init.sql.
import 'dotenv/config'
import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import pg from 'pg'

const email = process.argv[2]?.trim().toLowerCase()
if (!email || !email.includes('@')) {
  console.error('Uso: node dist/scripts/createSuperadmin.js <email>')
  process.exit(1)
}

const given = process.env.SUPERADMIN_PASSWORD
if (given !== undefined && given.length < 10) {
  console.error('SUPERADMIN_PASSWORD debe tener al menos 10 caracteres')
  process.exit(1)
}
const password = given || crypto.randomBytes(12).toString('base64url')

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'iot_user',
  password: process.env.DB_PASSWORD || 'iot_password',
  database: process.env.DB_NAME || 'iot_platform'
})

try {
  const { rows: [org] } = await pool.query<{ id: string }>(
    `SELECT id FROM organizations WHERE slug = 'airsunbox-internal'`
  )
  if (!org) throw new Error('No existe la organización airsunbox-internal')

  const hash = await bcrypt.hash(password, 10)
  await pool.query(
    `INSERT INTO users (org_id, email, password_hash, role, name, status)
     VALUES ($1, $2, $3, 'superadmin', 'Super Admin', 'active')
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, role = 'superadmin',
           status = 'active', org_id = EXCLUDED.org_id, temp_password = NULL`,
    [org.id, email, hash]
  )

  console.log(`Superadmin listo: ${email}`)
  if (!given) console.log(`Contraseña generada (no se vuelve a mostrar): ${password}`)
} catch (err) {
  console.error(`Error: ${(err as Error).message}`)
  process.exitCode = 1
} finally {
  await pool.end()
}
