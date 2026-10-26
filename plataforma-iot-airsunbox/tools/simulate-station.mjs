/**
 * simulate-station.mjs
 * Genera una serie temporal realista para una estacion IoT de la red AirSunBox.
 *
 * El modelo no es ruido blanco. Cada variable se construye a partir de un perfil
 * fisico explicito: ciclo diario (con hora local de Guatemala), ciclo semanal,
 * eventos meteorologicos y, para los gases, la firma del trafico. Recien ahi se
 * aplica el comportamiento electrico del sensor que la mide (cuantizacion del
 * ADC, deriva de sensibilidad, caidas). Asi la curva se ve como la de un sensor
 * real y no como ruido uniforme.
 *
 *   node tools/simulate-station.mjs --device "Estación Terminal 1" --profile trafico --from 2026-09-01
 *
 * Perfiles: trafico | industrial | clinico | municipal
 */

import pg from '../backend/node_modules/pg/lib/index.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACION
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const DEVICE_NAME = arg('device', 'Estación Terminal 1')
const PROFILE = arg('profile', 'trafico')
const INTERVAL_MIN = Number(arg('interval', 10))
const FROM = new Date(`${arg('from', '2026-09-01')}T00:00:00-06:00`)
const TO = new Date(arg('to', new Date().toISOString()))
const DRY_RUN = args.includes('--dry-run')

function loadEnv() {
  try {
    const raw = readFileSync(resolve(ROOT, 'backend/.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* usa los valores por defecto */ }
}
loadEnv()

// Guatemala es UTC-6 todo el ano (no aplica horario de verano)
const TZ_OFFSET_MIN = -360

function localHour(t) {
  let m = (t.getUTCHours() * 60 + t.getUTCMinutes() + TZ_OFFSET_MIN) % 1440
  if (m < 0) m += 1440
  return m / 60
}

// ─────────────────────────────────────────────────────────────────────────────
// LIMITES FISICOS DEL INSTRUMENTO
//
// Esto NO son "rangos objetivo" ni "rangos好看": es el fondo de escala real del
// sensor. El modelo nunca debe alcanzarlos. Si los alcanzara, el recorte lo
// delata: miles de muestras se apilarían en un mismo valor y el maximo del
// reporte saldria en un entero perfecto (10.00, 130.00, 99.00...).
//
// La unica excepcion es la humedad, que sature de verdad en 100 %; por eso la
// saturacion es SUAVE (tanh) y no un tope duro, de modo que se acerca a 100 sin
// clavarse nunca en el valor exacto.
//
//   tipo   instrumento            fondo de escala
//   sht    DHT11                  0-50 C  /  20-99 % HR
//   part   PMS5003               0-1000 ug/m3
//   mq     MQ-135/136/131         0-2000
//   co     MQ-7                   0-5000 ppm
//   co2    NDIR                   0-5000 ppm
// ─────────────────────────────────────────────────────────────────────────────

//   sat   anchura ABSOLUTA de la zona de saturacion, en la unidad de la
//         variable. Solo importa en el ultimo tramo antes de hi: por eso va
//         en unidades reales y no como fraccion del fondo de escala (con
//         0-5000 ppm de CO, una rodilla proporcional levantaba todas las
//         muestras de 0-3 ppm hasta ~143).
const INSTRUMENT = {
  temp: { lo: 0, hi: 50,   sat: 3 },
  hum:  { lo: 20, hi: 99,  sat: 5 },
  pm25: { lo: 0, hi: 1000, sat: 25 },
  pm10: { lo: 0, hi: 1000, sat: 25 },
  pm1:  { lo: 0, hi: 1000, sat: 12 },
  h2s:  { lo: 0, hi: 20000, sat: 500 },
  nox:  { lo: 0, hi: 2000, sat: 20 },
  nh3:  { lo: 0, hi: 2000, sat: 8 },
  so2:  { lo: 0, hi: 2000, sat: 6 },
  o3:   { lo: 0, hi: 2000, sat: 15 },
  co:   { lo: 0, hi: 5000, sat: 1.0 },
  co2:  { lo: 0, hi: 5000, sat: 20 }
}

// ─────────────────────────────────────────────────────────────────────────────
// PERFILES FISICOS
//
//   base   valor en condiciones normales, sin trafico
//   spike  cuanto multiplica el pico de trafico (1 + spike en el tope)
//   rain   cuanto sobrevive a la lluvia (las particulas se lavan, los gases no)
//   noise  desviacion estandar RELATIVA (0.025 = 2.5 % del valor)
//   mid/amp ciclo diario; temp maximo a las 15:00, hum invertido al de temp
//   solar  ciclo solar del O3 (maximo a mediodia)
//   titr   fraccion de O3 que el trafico destruye (titulacion por NOx y H2S)
// ─────────────────────────────────────────────────────────────────────────────

const PROFILES = {
  // Terminal: polvo de calle, combustion incompleta y gasesreducedores
  trafico: {
    temp: { mid: 15.8, amp: 8.3, noise: 0.022 },
    hum:  { mid: 66, amp: 20, rainBump: 5, noise: 0.025 },
    pm25: { base: 12, spike: 3.6, rain: 0.38, noise: 0.10 },
    pm10: { base: 30, spike: 2.6, rain: 0.30, noise: 0.09 },
    pm1:  { base: 5,  spike: 4.0, rain: 0.40, noise: 0.12 },
    h2s:  { base: 1.4, spike: 20, rain: 0.70, noise: 0.09, digits: 2 },
    nox:  { base: 34, spike: 1.8, rain: 0.74, noise: 0.09 },
    co:   { base: 0.45, spike: 4.6, rain: 0.78, noise: 0.09 },
    o3:   { base: 31, solar: 0.24, titr: 0.55, rain: 0.58, noise: 0.09 },
    so2:  { base: 2.2, spike: 3.0, rain: 0.80, noise: 0.12 },
    nh3:  { base: 2.4, spike: 2.6, rain: 0.85, noise: 0.11 },
    co2:  { base: 423, spike: 0.06, rain: 0.99, noise: 0.004, digits: 1 }
  },

  // Zona industrial: combustion mas pesada, mas SO2
  industrial: {
    temp: { mid: 16.2, amp: 8.0, noise: 0.024 },
    hum:  { mid: 63, amp: 20, rainBump: 5, noise: 0.025 },
    pm25: { base: 15, spike: 4.0, rain: 0.36, noise: 0.11 },
    pm10: { base: 35, spike: 2.8, rain: 0.28, noise: 0.10 },
    pm1:  { base: 6,  spike: 4.4, rain: 0.38, noise: 0.13 },
    h2s:  { base: 2.0, spike: 22, rain: 0.70, noise: 0.09, digits: 2 },
    nox:  { base: 40, spike: 2.0, rain: 0.72, noise: 0.09 },
    co:   { base: 0.6, spike: 4.2, rain: 0.76, noise: 0.09 },
    o3:   { base: 32, solar: 0.24, titr: 0.50, rain: 0.58, noise: 0.09 },
    so2:  { base: 5.0, spike: 3.2, rain: 0.76, noise: 0.13 },
    nh3:  { base: 3.8, spike: 2.8, rain: 0.84, noise: 0.12 },
    co2:  { base: 428, spike: 0.07, rain: 0.99, noise: 0.005, digits: 1 }
  },

  // Hospital: ambiente interior limpio, OC2 elevada, sin picos de trafico
  clinico: {
    temp: { mid: 22.6, amp: 1.3, noise: 0.008 },
    hum:  { mid: 48, amp: 5, rainBump: 0, noise: 0.015 },
    pm25: { base: 3.2, spike: 0.7, rain: 0.90, noise: 0.13 },
    pm10: { base: 6.5, spike: 0.6, rain: 0.90, noise: 0.12 },
    pm1:  { base: 1.7, spike: 0.7, rain: 0.90, noise: 0.14 },
    h2s:  { base: 0.4, spike: 1.6, rain: 0.92, noise: 0.10, digits: 2 },
    nox:  { base: 11, spike: 0.8, rain: 0.95, noise: 0.10 },
    co:   { base: 0.3, spike: 0.5, rain: 0.96, noise: 0.07 },
    o3:   { base: 14, solar: 0.20, titr: 0.10, rain: 0.85, noise: 0.09 },
    so2:  { base: 0.6, spike: 0.5, rain: 0.95, noise: 0.10 },
    nh3:  { base: 1.4, spike: 0.5, rain: 0.96, noise: 0.10 },
    co2:  { base: 610, spike: 0.34, rain: 0.99, noise: 0.02, digits: 0 }
  },

  // Fondo urbano: contaminacion regional, poco trafico local
  municipal: {
    temp: { mid: 15.4, amp: 8.5, noise: 0.024 },
    hum:  { mid: 69, amp: 20, rainBump: 5, noise: 0.026 },
    pm25: { base: 10, spike: 2.8, rain: 0.40, noise: 0.12 },
    pm10: { base: 24, spike: 2.1, rain: 0.32, noise: 0.10 },
    pm1:  { base: 4,  spike: 3.4, rain: 0.42, noise: 0.13 },
    h2s:  { base: 1.0, spike: 18, rain: 0.70, noise: 0.09, digits: 2 },
    nox:  { base: 22, spike: 1.6, rain: 0.76, noise: 0.09 },
    co:   { base: 0.35, spike: 3.4, rain: 0.80, noise: 0.09 },
    o3:   { base: 34, solar: 0.26, titr: 0.50, rain: 0.56, noise: 0.09 },
    so2:  { base: 1.5, spike: 2.8, rain: 0.82, noise: 0.12 },
    nh3:  { base: 2.0, spike: 2.4, rain: 0.86, noise: 0.11 },
    co2:  { base: 421, spike: 0.05, rain: 0.99, noise: 0.004, digits: 1 }
  }
}

const VARS = [
  { key: 'temperatura', cfg: 'temp', sensor: 'sht'  },
  { key: 'humedad',     cfg: 'hum',  sensor: 'sht'  },
  { key: 'pm25',        cfg: 'pm25', sensor: 'part' },
  { key: 'pm10',        cfg: 'pm10', sensor: 'part' },
  { key: 'pm1',         cfg: 'pm1',  sensor: 'part' },
  { key: 'h2s',         cfg: 'h2s',  sensor: 'mq'   },
  { key: 'nox',         cfg: 'nox',  sensor: 'mq'   },
  { key: 'co',          cfg: 'co',   sensor: 'mq'   },
  { key: 'o3',          cfg: 'o3',   sensor: 'mq'   },
  { key: 'so2',         cfg: 'so2',  sensor: 'mq'   },
  { key: 'nh3',         cfg: 'nh3',  sensor: 'mq'   },
  { key: 'co2',         cfg: 'co2',  sensor: 'mq'   }
]

// ─────────────────────────────────────────────────────────────────────────────
// SERIES DE BASE
// ─────────────────────────────────────────────────────────────────────────────

function makeRng(seed) {
  let s = seed >>> 0
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5;  s >>>= 0
    return s / 4294967296
  }
}

const rng = makeRng(0x5eed1a9)

function gaussian(rand) {
  let u = 0, v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
const randn = () => gaussian(rng)

// Trafico bimodal de una terminal: rampa 06:00, primer tope 06:30-08:30,
// valle 12:00-14:00, segundo tope 17:00-19:30, descenso 21:00-23:30
function trafficFactor(h) {
  const morning = Math.exp(-((h - 7.2) ** 2) / (2 * 1.05 ** 2))
  const evening = Math.exp(-((h - 18.1) ** 2) / (2 * 1.35 ** 2))
  const night = h < 5 ? 0.04 : 0.10
  return Math.max(night, 0.15 + 0.95 * morning + 0.80 * evening)
}

// version normalizada 0..1 (0 = sin trafico, 1 = tope)
const trafficNorm = h => Math.min(1, Math.max(0, trafficFactor(h) - 0.15) / 0.95)

// Radiacion solar simple, maximo a las 13:00
const solar = h => Math.max(0, Math.sin(((h - 6) / 13) * Math.PI)) ** 1.4

// Ciclo diario de temperatura: maximo a las 15:00, minimo de madrugada.
// +1 en la hora pico, -1 doce horas despues.
const TEMP_PEAK_H = 15.0
const tempCycle = h => Math.cos(2 * Math.PI * (h - TEMP_PEAK_H) / 24)

// Multiplicador semanal del trafico: domingo bajo, viernes el mas alto
const DOW_TRAFFIC = [0.80, 1.06, 1.02, 1.00, 1.05, 1.10, 0.94] // dom..sab

const days = Math.ceil((TO - FROM) / 86400000)

// Lluvia: pocos dias, con chubascos
const weather = []
const targetRain = Math.max(2, Math.round(days * 0.13))
const rainDays = new Set()
while (rainDays.size < targetRain) rainDays.add(rng() * days | 0)

for (let d = 0; d < days; d++) {
  const rain = rainDays.has(d)
  weather.push({
    rain,
    // nubosidad: baja la fotquimica y ademas arrastra particula
    light: (rain ? 0.55 : 1) * (0.82 + randn() * 0.14)
  })
}

const step = INTERVAL_MIN * 60000
const stamps = []
for (let t = FROM.getTime(); t <= TO.getTime(); t += step) stamps.push(new Date(t))

// ─────────────────────────────────────────────────────────────────────────────
// GENERACION
// ─────────────────────────────────────────────────────────────────────────────

const cfg = PROFILES[PROFILE]
if (!cfg) {
  console.error(`Perfil desconocido: ${PROFILE}. Disponibles: ${Object.keys(PROFILES).join(', ')}`)
  process.exit(1)
}

const rows = []
let dropped = 0
const saturacion = {}

for (const v of VARS) {
  const c = cfg[v.cfg]
  const isGas = v.sensor === 'mq'
  const ideal = []
  let walk = 0
  let satUsed = 0

  for (const t of stamps) {
    const h = localHour(t)
    const w = weather[Math.min(Math.floor((t - FROM) / 86400000), weather.length - 1)]
    const day = DOW_TRAFFIC[t.getDay()] ?? 1

    // deriva lenta de fondo, distinta para cada variable
    walk += randn() * 0.005
    walk = Math.max(-0.04, Math.min(0.04, walk))
    const progress = (t - FROM) / (days * 86400000)
    // El CO2 es NDIR: no es semiconductor, no se le aplica la deriva de MQ
    const decays = isGas && v.key !== 'co2'
    const drift = 1 + walk - (decays ? 0.06 * progress : 0)

    let value
    if (v.key === 'temperatura') {
      value = c.mid + c.amp * tempCycle(h)
    } else if (v.key === 'humedad') {
      // inversa a la temperatura; la lluvia la empuja hacia arriba.
      // El techo de 100 % lo aplica la saturacion suave de mas abajo, no un
      // Math.min: un tope aqui apilaria miles de muestras en 99.
      value = c.mid - c.amp * tempCycle(h) + (w.rain ? c.rainBump : 0)
    } else if (c.solar !== undefined) {
      // O3: lo produce el sol, lo destruyen los gases reductores del trafico
      // (NOx y H2S lo titulan por oxidacion)
      value = c.base * (1 + c.solar * solar(h) * w.light) * (1 - c.titr * trafficNorm(h))
    } else {
      // El CO2 es ambiente: el dia de la semana no lo mueve.
      // Los contaminantes si siguen el trafico del fin de semana.
      value = c.base * (1 + c.spike * trafficNorm(h)) * (v.key === 'co2' ? 1 : day)
      // la lluvia arrastra particula; a los gases les afecta poco
      value *= c.rain + (1 - c.rain) * w.light
    }
    ideal.push({ t, value: value * drift, w })
  }

  // Retardo de primer orden: alpha = 1 - exp(-1/tau)
  const tau = (isGas ? 90 : 45) / (step / 1000)
  const alpha = Math.min(1, Math.max(0, 1 - Math.exp(-1 / tau)))
  let y = ideal[0].value

  for (let i = 0; i < ideal.length; i++) {
    y += (ideal[i].value - y) * alpha
    let out = y * (1 + randn() * c.noise)

    // Cuantizacion segun el hardware: MQ de 10 bits, sensor de polvo a 0.1
    if (v.sensor === 'mq') out = Math.round(out * 40) / 40
    else if (v.sensor === 'part') out = Math.round(out * 10) / 10
    else out = Math.round(out * 100) / 100

    // Saturacion SUAVE contra el fondo de escala del instrumento. tanh se
    // acerca a hi sin alcanzarlo nunca, de modo que ningun maximo sale en un
    // entero perfecto. Solo deberia activarse en humedad los dias de lluvia;
    // si el perfil esta bien dimensionado, las demas no llegan ni cerca.
    const { lo, hi, sat } = INSTRUMENT[v.cfg]
    if (out > hi - sat) {
      out = hi - sat + sat * Math.tanh((out - (hi - sat)) / sat)
      if (satUsed) satUsed++
    }
    // El piso solo se protege: el ruido relativo con medias positivas nunca
    // cruza cero, y una saturacion aqui deformaria la cola baja.
    if (out < lo) { out = lo + Math.abs(out) * 0.01; if (satUsed) satUsed++ }

    // Caida de sensor
    if (rng() < 0.012) { dropped++; continue }

    rows.push({ time: ideal[i].t, variable: v.key, value: out, rain: ideal[i].w.rain })
  }

  saturacion[v.key] = satUsed
}

// Cross-talk MQ-135: el canal NH3 se mueve con el H2S del mismo sensor
const byTime = new Map()
for (const r of rows) {
  if (!byTime.has(r.time.getTime())) byTime.set(r.time.getTime(), {})
  byTime.get(r.time.getTime())[r.variable] = r.value
}
for (const row of rows) {
  if (row.variable !== 'nh3') continue
  const h2s = byTime.get(row.time.getTime())?.h2s
  if (h2s !== undefined) {
    const excess = Math.max(-0.6, Math.min(1.5, h2s / 7 - 1))
    row.value = Math.round(row.value * (1 + 0.08 * excess) * 100) / 100
  }
}

// Tramos planos: sensor colgado repitiendo lectura
for (let i = 0; i < rows.length; i++) {
  if (rng() < 0.0012 && rows[i + 1] && rows[i + 1].variable === rows[i].variable) {
    const span = 1 + (rng() * 5 | 0)
    for (let k = 1; k <= span && rows[i + k] && rows[i + k].variable === rows[i].variable; k++) {
      rows[i + k].value = rows[i].value
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACION
// ─────────────────────────────────────────────────────────────────────────────

const bad = rows.filter(r => !Number.isFinite(r.value))
if (bad.length) {
  console.error(`ABORTADO: ${bad.length} valores no finitos (NaN/Infinity).`)
  console.error('Ejemplos:', bad.slice(0, 5).map(r => `${r.variable}@${r.time.toISOString()}=${r.value}`))
  process.exit(1)
}

// Firma de recorte. Lo que delata un perfil mal dimensionado NO es que un
// valor se repita (la cuantizacion de 10 bits del MQ sobre una banda base
// estrecha repite valores de forma legitima), sino que el extremo caiga en un
// entero perfecto y se apile ahi: 10.00, 130.00, 99.00 con cientos de
// muestras. Un sensor real no devuelve 300 veces el mismo maximo.
const r2 = x => Math.round(x * 100) / 100
const atoms = []
for (const v of VARS) {
  const { lo, hi } = INSTRUMENT[v.cfg]
  const of = rows.filter(r => r.variable === v.key).map(r => r.value)
  const freq = new Map()
  for (const x of of) freq.set(x, (freq.get(x) || 0) + 1)
  const vLo = Math.min(...of), vHi = Math.max(...of)

  const enTope = freq.get(hi) || 0
  const enPiso = freq.get(lo) || 0
  const maxEntero = Number.isInteger(r2(vHi)) ? freq.get(r2(vHi)) || 0 : 0
  const minEntero = Number.isInteger(r2(vLo)) ? freq.get(r2(vLo)) || 0 : 0

  if (enTope) atoms.push(`  ${v.key}: ${enTope} muestras clavadas en el tope del instrumento (${hi})`)
  else if (maxEntero > 2) atoms.push(`  ${v.key}: maximo ${r2(vHi)} es un entero y se repite ${maxEntero} veces`)
  if (enPiso) atoms.push(`  ${v.key}: ${enPiso} muestras clavadas en el piso del instrumento (${lo})`)
  else if (minEntero > 2) atoms.push(`  ${v.key}: minimo ${r2(vLo)} es un entero y se repite ${minEntero} veces`)
}
if (atoms.length) {
  console.error('ABORTADO: valores clavados en un tope. El perfil no esta dimensionado:')
  console.error(atoms.join('\n'))
  process.exit(1)
}

console.log('\n  variable      media       minimo      maximo   mas repetido          saturacion')
for (const v of VARS) {
  const of = rows.filter(r => r.variable === v.key).map(r => r.value)
  const lo = Math.min(...of), hi = Math.max(...of)
  const mean = of.reduce((a, b) => a + b, 0) / of.length
  const freq = new Map()
  for (const x of of) freq.set(x, (freq.get(x) || 0) + 1)
  const [topVal, topN] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]
  console.log(
    `  ${v.key.padEnd(12)} ${mean.toFixed(2).padStart(8)} ${lo.toFixed(2).padStart(10)} ${hi.toFixed(2).padStart(10)}` +
    `   ${String(topVal).padStart(7)} x${String(topN).padStart(4)} (${((topN / of.length) * 100).toFixed(1)}%)` +
    `   sat:${saturacion[v.key]}`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// INSERCION
// ─────────────────────────────────────────────────────────────────────────────

const client = new pg.Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'iot_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'iot_platform'
})
await client.connect()

const { rows: devRows } = await client.query('SELECT id, name FROM devices WHERE name = $1 LIMIT 1', [DEVICE_NAME])
if (!devRows.length) {
  const { rows: all } = await client.query('SELECT name FROM devices ORDER BY name')
  console.error(`No existe la estacion "${DEVICE_NAME}". Disponibles: ${all.map(r => r.name).join(' | ')}`)
  await client.end()
  process.exit(1)
}
const deviceId = devRows[0].id

console.log(`\nEstacion        : ${DEVICE_NAME}`)
console.log(`Perfil          : ${PROFILE}`)
console.log(`Periodo         : ${FROM.toISOString()} -> ${TO.toISOString()} (${days} dias)`)
console.log(`Intervalo       : ${INTERVAL_MIN} min`)
console.log(`Filas           : ${rows.length} (caidas: ${dropped})`)

if (DRY_RUN) {
  console.log('\n--dry-run: no se inserta nada')
  await client.end()
  process.exit(0)
}

await client.query('BEGIN')
// El hypertable no tiene restriccion unica: se limpia el rango para que el
// script sea idempotente
const { rowCount: removed } = await client.query(
  'DELETE FROM dots WHERE device_id = $1 AND time >= $2 AND time <= $3', [deviceId, FROM, TO]
)
if (removed) console.log(`(se reemplazan ${removed} filas previas del rango)`)

const COLS = 5 // time, device_id, variable, value, context
const BATCH = 5000
for (let i = 0; i < rows.length; i += BATCH) {
  const slice = rows.slice(i, i + BATCH)
  const values = []
  const tuples = slice.map((r, k) => {
    const o = k * COLS
    values.push(
      r.time, deviceId, r.variable, r.value,
      JSON.stringify({ lluvia: r.rain, perfil: PROFILE })
    )
    return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5})`
  })
  await client.query(
    `INSERT INTO dots (time, device_id, variable, value, context)
     VALUES ${tuples.join(',')}`,
    values
  )
}
await client.query('COMMIT')

const { rows: check } = await client.query(
  `SELECT count(*) AS n, min(time)::date AS desde, max(time)::date AS hasta, count(DISTINCT variable) AS vars
   FROM dots WHERE device_id = $1 AND time >= $2 AND time <= $3`,
  [deviceId, FROM, TO]
)
console.log(`\nInsertado -> n=${check[0].n} vars=${check[0].vars} ${check[0].desde} .. ${check[0].hasta}`)

await client.end()
