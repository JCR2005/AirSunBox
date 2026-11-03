// Pruebas unitarias del índice de calidad del aire (services/aqiService.ts).
// Corren sobre el código compilado: `npm run build` y luego `npm test`.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { computeAqi, getDeviceAqi } from '../../dist/services/aqiService.js'

// Cinco niveles de 0 a 100, como la plantilla de aire de un espacio
const NIVELES = [
  { id: '1', name: 'Excelente', color: '#1D9E75', cat_order: 1, score_lo: 0, score_hi: 20, phrases: [] },
  { id: '2', name: 'Buena', color: '#3DD9A0', cat_order: 2, score_lo: 21, score_hi: 40, phrases: [] },
  { id: '3', name: 'Precaución', color: '#F59E0B', cat_order: 3, score_lo: 41, score_hi: 60, phrases: [] },
  { id: '4', name: 'Mala', color: '#F97316', cat_order: 4, score_lo: 61, score_hi: 80, phrases: [] },
  { id: '5', name: 'Peligrosa', color: '#EF4444', cat_order: 5, score_lo: 81, score_hi: 100, phrases: ['Permanecer en interiores.'] }
]

// Rangos [min, max) de cada variable por nivel; max null = sin tope
function rangos(variable, limites) {
  return limites.map(([min, max], i) => ({ space_id: 's1', variable_label: variable, cat_order: i + 1, min_value: min, max_value: max }))
}

// pm25 es la variable más prioritaria, luego temperatura y humedad
const CONFIG = {
  categories: NIVELES,
  variables: [
    { space_id: 's1', variable_label: 'pm25', priority: 1 },
    { space_id: 's1', variable_label: 'temperatura', priority: 2 },
    { space_id: 's1', variable_label: 'humedad', priority: 3 }
  ],
  ranges: [
    ...rangos('pm25', [[0, 12], [12, 35], [35, 55], [55, 150], [150, null]]),
    ...rangos('temperatura', [[18, 24], [24, 28], [28, 32], [32, 36], [36, null]]),
    ...rangos('humedad', [[40, 60], [60, 70], [70, 80], [80, 90], [90, null]])
  ]
}

describe('cálculo normal', () => {
  test('combina el promedio ponderado (70 %) y el peor puntaje (30 %)', () => {
    // pm25 20 → Buena, puntaje 31, peso 3
    // temperatura 21 → Excelente, puntaje 10, peso 2
    // humedad 50 → Excelente, puntaje 10, peso 1
    // promedio = (31·3 + 10·2 + 10·1) / 6 = 20,5 → 20,5·0,7 + 31·0,3 = 23,65 → 24
    const r = computeAqi({ pm25: 20, temperatura: 21, humedad: 50 }, CONFIG)
    assert.equal(r.aqi, 24)
    assert.equal(r.category, 'Buena')
    assert.equal(r.metadata.variablesUsed, 3)
    assert.equal(r.metadata.weightedAverage, 21)
    assert.equal(r.metadata.worstScore, 31)
  })

  test('el puntaje de cada variable es el punto medio de su nivel', () => {
    const r = computeAqi({ pm25: 40 }, CONFIG)
    assert.deepEqual(r.variableScores.pm25, { value: 40, score: 51, category: 'Precaución', weight: 3, cat_order: 3 })
  })

  test('la prioridad define el peso: la primera variable pesa más', () => {
    const r = computeAqi({ pm25: 1, temperatura: 19, humedad: 41 }, CONFIG)
    assert.equal(r.variableScores.pm25.weight, 3)
    assert.equal(r.variableScores.temperatura.weight, 2)
    assert.equal(r.variableScores.humedad.weight, 1)
  })

  test('devuelve los niveles del espacio con sus frases', () => {
    const r = computeAqi({ pm25: 200 }, CONFIG)
    assert.equal(r.categories.length, 5)
    assert.deepEqual(r.categories[4].phrases, ['Permanecer en interiores.'])
  })
})

describe('límites entre niveles', () => {
  test('un valor igual al máximo de un rango pasa al nivel siguiente', () => {
    assert.equal(computeAqi({ pm25: 11.99 }, CONFIG).variableScores.pm25.category, 'Excelente')
    assert.equal(computeAqi({ pm25: 12 }, CONFIG).variableScores.pm25.category, 'Buena')
  })

  test('el último rango no tiene tope', () => {
    assert.equal(computeAqi({ pm25: 150 }, CONFIG).variableScores.pm25.category, 'Peligrosa')
    assert.equal(computeAqi({ pm25: 5000 }, CONFIG).variableScores.pm25.category, 'Peligrosa')
  })

  test('el índice pertenece al primer nivel cuyo máximo lo alcanza (inclusive)', () => {
    // Niveles de un solo puntaje para obtener un índice exacto de 20 y de 21
    const config = {
      categories: [
        { id: 'a', name: 'A', color: '#000', cat_order: 1, score_lo: 20, score_hi: 20, phrases: [] },
        { id: 'b', name: 'B', color: '#000', cat_order: 2, score_lo: 21, score_hi: 21, phrases: [] }
      ],
      variables: [{ space_id: 's1', variable_label: 'x', priority: 1 }],
      ranges: rangos('x', [[0, 10], [10, null]])
    }
    const en20 = computeAqi({ x: 5 }, config)
    assert.equal(en20.aqi, 20)
    assert.equal(en20.category, 'A')
    const en21 = computeAqi({ x: 15 }, config)
    assert.equal(en21.aqi, 21)
    assert.equal(en21.category, 'B')
  })

  test('el índice nunca pasa de 100', () => {
    const r = computeAqi({ pm25: 999, temperatura: 50, humedad: 99 }, CONFIG)
    assert.ok(r.aqi <= 100)
    assert.equal(r.category, 'Peligrosa')
  })
})

describe('variables sin datos', () => {
  test('una variable configurada sin lectura no participa en el cálculo', () => {
    const r = computeAqi({ pm25: 20 }, CONFIG)
    assert.equal(r.metadata.variablesUsed, 1)
    assert.equal(r.variableScores.temperatura, undefined)
    // Solo pm25: promedio 31 y peor 31 → 31
    assert.equal(r.aqi, 31)
  })

  test('un valor fuera de todos los rangos se ignora', () => {
    const r = computeAqi({ pm25: 20, temperatura: 5 }, CONFIG)
    assert.equal(r.variableScores.temperatura, undefined)
    assert.equal(r.metadata.variablesUsed, 1)
  })

  test('una variable que el espacio no tiene configurada se ignora', () => {
    const r = computeAqi({ pm25: 20, co2: 4000 }, CONFIG)
    assert.equal(r.variableScores.co2, undefined)
  })

  test('sin lecturas útiles no hay variable dominante', () => {
    const r = computeAqi({}, CONFIG)
    assert.equal(r.metadata.variablesUsed, 0)
    assert.equal(r.dominant.label, null)
  })
})

describe('espacio sin configuración', () => {
  // Base de datos falsa: responde según la tabla de la consulta
  function dbFalsa({ categorias = [], variables = [], lecturas = [] } = {}) {
    return {
      async query(sql) {
        if (sql.includes('FROM devices')) return { rows: [{ id: 'd1', space_id: 's1' }] }
        if (sql.includes('space_aqi_categories')) return { rows: categorias }
        if (sql.includes('space_aqi_variables')) return { rows: variables }
        if (sql.includes('space_variable_ranges')) return { rows: CONFIG.ranges }
        if (sql.includes('FROM dots')) return { rows: lecturas }
        throw new Error('Consulta inesperada: ' + sql)
      }
    }
  }

  test('sin niveles ni variables, la estación queda «Sin datos»', async () => {
    const r = await getDeviceAqi(dbFalsa(), 'd1')
    assert.equal(r.aqi, null)
    assert.equal(r.category, 'Sin datos')
    assert.equal(r.dominant, null)
    assert.equal(r.source, 'space')
  })

  test('con niveles pero sin variables, también queda «Sin datos»', async () => {
    const r = await getDeviceAqi(dbFalsa({ categorias: NIVELES }), 'd1')
    assert.equal(r.aqi, null)
  })

  test('configurado pero sin lecturas en la última hora, queda «Sin datos»', async () => {
    const r = await getDeviceAqi(dbFalsa({ categorias: NIVELES, variables: CONFIG.variables }), 'd1')
    assert.equal(r.aqi, null)
    assert.equal(r.category, 'Sin datos')
  })

  test('configurado y con lecturas, calcula el índice', async () => {
    const lecturas = [{ variable: 'pm25', value: '20' }, { variable: 'humedad', value: '50' }]
    const r = await getDeviceAqi(dbFalsa({ categorias: NIVELES, variables: CONFIG.variables, lecturas }), 'd1')
    assert.equal(r.category, 'Buena')
    assert.equal(r.dominant.label, 'pm25')
  })

  test('una estación que no existe devuelve null', async () => {
    const db = { async query() { return { rows: [] } } }
    assert.equal(await getDeviceAqi(db, 'no-existe'), null)
  })

  test('computeAqi sin niveles responde «Sin datos»', () => {
    const r = computeAqi({ pm25: 20 }, { categories: [], variables: [], ranges: [] })
    assert.equal(r.category, 'Sin datos')
    assert.equal(r.metadata.variablesUsed, 0)
  })
})

describe('elección de la variable dominante', () => {
  test('es la de peor puntaje', () => {
    const r = computeAqi({ pm25: 60, temperatura: 21, humedad: 50 }, CONFIG)
    assert.deepEqual(r.dominant, { label: 'pm25', score: 71, value: 60 })
  })

  test('no depende de la prioridad: una variable de menor peso puede dominar', () => {
    // humedad (la de menor prioridad) está en «Mala» y pm25 en «Excelente»
    const r = computeAqi({ pm25: 5, humedad: 85 }, CONFIG)
    assert.equal(r.dominant.label, 'humedad')
  })

  test('ante un empate, queda la primera variable leída', () => {
    const r = computeAqi({ temperatura: 25, pm25: 20 }, CONFIG)
    assert.equal(r.variableScores.temperatura.score, r.variableScores.pm25.score)
    assert.equal(r.dominant.label, 'temperatura')
  })
})
