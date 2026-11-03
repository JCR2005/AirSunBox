// Pruebas de seguridad contra un backend en marcha (el CI las corre junto con
// las de humo): revocación de sesiones y aislamiento entre organizaciones.
//
//   SMOKE_BASE_URL=http://localhost:3000 DB_PASSWORD=... npm run test:smoke
//
// La prueba de cambio de contraseña necesita la base para fijar un enlace de
// recuperación conocido (el real solo viaja por correo); sin DB_PASSWORD se
// omite.
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import pg from 'pg'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000'
const sufijo = crypto.randomBytes(4).toString('hex')

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

// Cada registro crea una organización independiente con su usuario cliente
async function registrar(nombre, password = 'Prueba-Segura-123') {
  const email = `${nombre}.${sufijo}@airsunbox.test`
  const r = await api('/api/auth/register', {
    method: 'POST',
    body: { name: nombre, email, password, confirmPassword: password, accountType: 'individual' }
  })
  assert.equal(r.status, 201, `registro de ${nombre}: ${JSON.stringify(r.body)}`)
  return { email, password, token: r.body.token, orgId: r.body.org.id }
}

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms))

// Las rutas de autenticación permiten 10 llamadas por minuto y por IP. Este
// archivo usa 8: tres registros, la recuperación (pedido, cambio y reintento)
// y dos inicios de sesión. Las pruebas comparten usuarios para no pasarse.
describe('revocación de sesiones', () => {
  let u
  // Token vigente para la prueba de logout: el del login con la clave nueva
  // o, si se omite el cambio de contraseña, el del registro
  let tokenVigente

  before(async () => {
    u = await registrar('clave')
    tokenVigente = u.token
  })

  test('cambiar la contraseña invalida los tokens anteriores', { skip: !process.env.DB_PASSWORD && 'sin DB_PASSWORD' }, async () => {
    assert.equal((await api('/api/auth/me', { token: u.token })).status, 200)

    // La revocación compara segundos: el token debe ser de un segundo anterior
    // al cambio, como pasa en la realidad
    await esperar(1100)

    // Pedir la recuperación y reemplazar el enlace (que viaja por correo) por
    // uno conocido, guardado igual que el real: solo su hash SHA-256
    assert.equal((await api('/api/auth/forgot-password', { method: 'POST', body: { email: u.email } })).status, 200)
    const enlace = crypto.randomBytes(32).toString('hex')
    const db = new pg.Client({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'iot_user',
      database: process.env.DB_NAME || 'iot_platform',
      password: process.env.DB_PASSWORD
    })
    await db.connect()
    try {
      const { rowCount } = await db.query(
        'UPDATE users SET reset_token_hash = $1 WHERE email = $2 AND reset_token_hash IS NOT NULL',
        [crypto.createHash('sha256').update(enlace).digest('hex'), u.email]
      )
      assert.equal(rowCount, 1, 'forgot-password debía generar un enlace')
    } finally {
      await db.end()
    }

    const nueva = 'Otra-Clave-456'
    assert.equal((await api('/api/auth/reset-password', { method: 'POST', body: { token: enlace, password: nueva } })).status, 200)

    // El token emitido antes del cambio ya no vale
    const vieja = await api('/api/auth/me', { token: u.token })
    assert.equal(vieja.status, 401)
    assert.equal(vieja.body?.code, 'SESSION_REVOKED')

    // El enlace es de un solo uso
    assert.equal((await api('/api/auth/reset-password', { method: 'POST', body: { token: enlace, password: 'Tercera-789' } })).status, 400)

    // La contraseña anterior ya no entra y la nueva sí
    assert.equal((await api('/api/auth/login', { method: 'POST', body: { email: u.email, password: u.password } })).status, 401)
    const login = await api('/api/auth/login', { method: 'POST', body: { email: u.email, password: nueva } })
    assert.equal(login.status, 200)
    assert.equal((await api('/api/auth/me', { token: login.body.token })).status, 200)
    tokenVigente = login.body.token
  })

  test('cerrar sesión invalida el token', async () => {
    assert.equal((await api('/api/auth/me', { token: tokenVigente })).status, 200)

    const salida = await api('/api/auth/logout', { token: tokenVigente, method: 'POST' })
    assert.ok(salida.status >= 200 && salida.status < 300, `logout respondió ${salida.status}`)

    assert.equal((await api('/api/auth/me', { token: tokenVigente })).status, 401)
    assert.equal((await api('/api/spaces', { token: tokenVigente })).status, 401)
  })
})

describe('aislamiento entre organizaciones', () => {
  let duena, ajena, espacio, estacion

  before(async () => {
    duena = await registrar('duena')
    ajena = await registrar('ajena')

    const e = await api('/api/spaces', {
      token: duena.token, method: 'POST',
      body: { name: 'Espacio privado', slug: `privado-${sufijo}`, type: 'aire' }
    })
    assert.equal(e.status, 201, `crear espacio: ${JSON.stringify(e.body)}`)
    espacio = e.body.id

    const d = await api('/api/devices', {
      token: duena.token, method: 'POST',
      body: { name: 'Estación privada', label: `privada-${sufijo}`, spaceId: espacio }
    })
    assert.ok(d.status === 200 || d.status === 201, `crear estación: ${JSON.stringify(d.body)}`)
    estacion = d.body.id ?? d.body.device?.id
    assert.ok(estacion, 'la respuesta de crear estación trae su id')
  })

  // Lecturas que la dueña puede hacer y la otra organización no
  const lecturas = () => [
    `/api/spaces/${espacio}`,
    `/api/spaces/${espacio}/devices`,
    `/api/spaces/${espacio}/aqi`,
    `/api/devices/${estacion}`,
    `/api/devices/${estacion}/variables`,
    `/api/devices/${estacion}/last-values`,
    `/api/devices/${estacion}/aqi`,
    `/api/devices/${estacion}/photo`,
    `/api/reports/space/${espacio}`,
    `/api/reports/space/${espacio}?deviceId=${estacion}`
  ]

  test('la dueña puede leer su espacio, su estación y su reporte', async () => {
    for (const ruta of lecturas()) {
      const r = await api(ruta, { token: duena.token })
      assert.equal(r.status, 200, `${ruta} debería responder 200 a la dueña (${r.status})`)
    }
  })

  test('otra organización no puede leer estaciones, espacios ni reportes ajenos', async () => {
    for (const ruta of lecturas()) {
      const r = await api(ruta, { token: ajena.token })
      assert.ok(r.status === 403 || r.status === 404, `${ruta} respondió ${r.status} a otra organización`)
    }
  })

  test('pasar el orgId ajeno en la consulta no da acceso', async () => {
    const r = await api(`/api/devices/${estacion}?orgId=${duena.orgId}`, { token: ajena.token })
    assert.ok(r.status === 403 || r.status === 404, `respondió ${r.status}`)
  })

  test('los listados de otra organización no incluyen lo ajeno', async () => {
    const espacios = await api('/api/spaces', { token: ajena.token })
    assert.equal(espacios.status, 200)
    assert.ok(!JSON.stringify(espacios.body).includes(espacio), 'el listado de espacios incluye uno ajeno')

    const estaciones = await api('/api/devices', { token: ajena.token })
    assert.equal(estaciones.status, 200)
    assert.ok(!JSON.stringify(estaciones.body).includes(estacion), 'el listado de estaciones incluye una ajena')
  })

  test('otra organización no puede modificar ni borrar lo ajeno', async () => {
    const editar = await api(`/api/spaces/${espacio}`, { token: ajena.token, method: 'PUT', body: { name: 'Tomado' } })
    assert.ok(editar.status === 403 || editar.status === 404, `PUT espacio respondió ${editar.status}`)

    const borrar = await api(`/api/devices/${estacion}`, { token: ajena.token, method: 'DELETE' })
    assert.ok(borrar.status === 403 || borrar.status === 404, `DELETE estación respondió ${borrar.status}`)

    // Sigue existiendo y con su nombre
    const sigue = await api(`/api/spaces/${espacio}`, { token: duena.token })
    assert.equal(sigue.status, 200)
    assert.equal(sigue.body.name ?? sigue.body.space?.name, 'Espacio privado')
  })
})
