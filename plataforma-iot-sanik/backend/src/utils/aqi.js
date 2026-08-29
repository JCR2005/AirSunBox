// ─────────────────────────────────────────────
// SANIK — Motor AQI genérico por espacio
// Calcula el índice de calidad para un espacio a partir de la config
// que el cliente define (categorías, variables en orden de prioridad,
// y rangos numéricos de cada variable por categoría).
//
// El resultado es coherente con el motor "clásico" de aire:
//   score de cada variable = punto medio del tramo de su categoría
//   AQI = promedio ponderado (por prioridad) * 0.7 + peor score * 0.3
// ─────────────────────────────────────────────

// Obtiene la configuración completa del AQI de un espacio
export async function getSpaceConfig(app, spaceId) {
  const [cats, vars, ranges] = await Promise.all([
    app.db.query(
      `SELECT id, name, color, cat_order, score_lo, score_hi, phrases
       FROM space_aqi_categories
       WHERE space_id = $1
       ORDER BY cat_order ASC`,
      [spaceId]
    ),
    app.db.query(
      `SELECT variable_label, priority
       FROM space_aqi_variables
       WHERE space_id = $1
       ORDER BY priority ASC`,
      [spaceId]
    ),
    app.db.query(
      `SELECT variable_label, cat_order, min_value, max_value
       FROM space_variable_ranges
       WHERE space_id = $1`,
      [spaceId]
    )
  ])

  return {
    categories: cats.rows,
    variables: vars.rows,
    ranges: ranges.rows
  }
}

// Punto medio del tramo de una categoría -> score representativo (0-100)
function midScore(cat) {
  const lo = Number(cat.score_lo)
  const hi = Number(cat.score_hi)
  return Math.round((lo + hi) / 2)
}

// Encuentra la categoría que corresponde a un valor de una variable
function categoryForValue(ranges, variable, value, catsById) {
  for (const r of ranges) {
    if (r.variable_label !== variable) continue
    const v = Number(value)
    const min = Number(r.min_value)
    const max = r.max_value == null ? Infinity : Number(r.max_value)
    if (v >= min && (max === Infinity || v < max)) {
      return catsById[r.cat_order]
    }
  }
  return null
}

// ─────────────────────────────────────────────
// computeAqi(latestValues, config)
//   latestValues: { variable: value }  (los últimos valores por variable)
//   config:       resultado de getSpaceConfig()
// Devuelve: { aqi, score, category, categories, variableScores, dominant }
// ─────────────────────────────────────────────
export function computeAqi(latestValues, config) {
  const catsById = {}
  for (const c of config.categories) catsById[c.cat_order] = c

  // Resolver el orden de prioridad (el 1º pesa más)
  const nVars = Math.max(config.variables.length, 1)
  // peso = posiciones invertidas normalizadas -> la suma de pesos = nº de variables
  const weightByVar = {}
  config.variables.forEach((v, i) => {
    weightByVar[v.variable_label] = nVars - i
  })

  const variableScores = {}
  let totalScore = 0
  let totalWeight = 0
  let dominant = { label: null, score: -1, value: null }

  for (const variable of Object.keys(latestValues)) {
    const value = latestValues[variable]
    const cat = categoryForValue(config.ranges, variable, value, catsById)
    if (!cat) continue

    const score = midScore(cat)
    const weight = weightByVar[variable] ?? 1

    variableScores[variable] = {
      value: Number(value),
      score,
      category: cat.name,
      weight,
      cat_order: cat.cat_order
    }

    totalScore += score * weight
    totalWeight += weight

    if (score > dominant.score) {
      dominant = { label: variable, score, value: Number(value) }
    }
  }

  const weighted = totalWeight > 0 ? totalScore / totalWeight : 0
  const maxScore = Math.max(...Object.values(variableScores).map(v => v.score), 0)

  let aqi = Math.round(weighted * 0.7 + maxScore * 0.3)
  aqi = Math.max(0, Math.min(100, aqi))

  // Determinar la categoría resultante a partir de los tramos configurados
  let category = config.categories[config.categories.length - 1]?.name ?? 'Sin datos'
  for (const cat of config.categories) {
    if (aqi <= Number(cat.score_hi)) {
      category = cat.name
      break
    }
  }

  return {
    aqi,
    category,
    categories: config.categories.map(c => ({
      name: c.name, color: c.color, order: c.cat_order,
      score_lo: Number(c.score_lo), score_hi: Number(c.score_hi),
      phrases: Array.isArray(c.phrases) ? c.phrases : []
    })),
    variableScores,
    dominant,
    metadata: {
      variablesUsed: Object.keys(variableScores).length,
      weightedAverage: Math.round(weighted),
      worstScore: maxScore
    }
  }
}

// ─────────────────────────────────────────────
// getDeviceAqi(app, deviceId)
// Calcula el AQI de una estación usando la config del espacio si pertenece a
// uno, o el motor clásico (air_quality_ranges) en caso contrario.
// Lo usan GET /devices/:id/aqi y el motor de alertas (misma fuente de verdad).
// Devuelve { aqi, category, dominant, variables, categories, metadata, source, spaceId }.
// ─────────────────────────────────────────────
const CLASSIC_AQI_VARS = ['co', 'co2', 'nh3', 'nox', 'no2', 'o3', 'so2', 'pm25', 'pm10']

export async function getDeviceAqi(app, deviceId) {
  const { rows: [device] } = await app.db.query(
    'SELECT id, space_id FROM devices WHERE id = $1',
    [deviceId]
  )
  if (!device) return null

  // ── Estación dentro de un espacio: config del espacio ──
  if (device.space_id) {
    const config = await getSpaceConfig(app, device.space_id)
    if (!config.categories.length || !config.variables.length) {
      return { aqi: null, category: 'Sin datos', dominant: null, variables: {}, categories: [], metadata: null, source: 'space', spaceId: device.space_id }
    }

    const labels = config.variables.map(v => v.variable_label)
    const { rows: latestDots } = await app.db.query(
      `SELECT DISTINCT ON (variable) variable, value
       FROM dots
       WHERE device_id = $1 AND variable = ANY($2)
         AND time > NOW() - INTERVAL '1 hour'
       ORDER BY variable, time DESC`,
      [deviceId, labels]
    )

    const latestValues = {}
    for (const dot of latestDots) latestValues[dot.variable] = Number(dot.value)

    const res = computeAqi(latestValues, config)
    return {
      aqi: res.aqi,
      category: res.category,
      dominant: res.dominant?.label ? res.dominant : null,
      variables: res.variableScores,
      categories: res.categories,
      metadata: res.metadata,
      source: 'space',
      spaceId: device.space_id
    }
  }

  // ── Motor clásico (estación sin espacio) ──
  const { rows: latestDots } = await app.db.query(
    `SELECT DISTINCT ON (variable) variable, value
     FROM dots
     WHERE device_id = $1 AND variable = ANY($2)
       AND time > NOW() - INTERVAL '1 hour'
     ORDER BY variable, time DESC`,
    [deviceId, CLASSIC_AQI_VARS]
  )

  if (!latestDots.length) {
    return { aqi: null, category: 'Sin datos', dominant: null, variables: {}, categories: [], metadata: null, source: 'classic', spaceId: null }
  }

  const variableScores = {}
  let totalScore = 0
  let totalWeight = 0
  let dominant = { label: null, score: -1, value: null }

  for (const dot of latestDots) {
    const { rows: [range] } = await app.db.query(
      `SELECT score, category, weight
       FROM air_quality_ranges
       WHERE variable_label = $1 AND min_value <= $2
         AND (max_value IS NULL OR max_value > $2)
       LIMIT 1`,
      [dot.variable, dot.value]
    )

    if (!range) continue

    variableScores[dot.variable] = {
      value: Number(dot.value),
      score: Number(range.score),
      category: range.category,
      weight: Number(range.weight)
    }

    totalScore += Number(range.score) * Number(range.weight)
    totalWeight += Number(range.weight)

    if (Number(range.score) > dominant.score) {
      dominant = { label: dot.variable, score: Number(range.score), value: Number(dot.value) }
    }
  }

  const weightedAQI = totalWeight > 0 ? totalScore / totalWeight : 0
  const maxScore = Math.max(...Object.values(variableScores).map(v => v.score), 0)

  let aqi = Math.round(weightedAQI * 0.7 + maxScore * 0.3)
  aqi = Math.max(0, Math.min(100, aqi))

  let category = 'Excelente'
  if (aqi <= 20) category = 'Excelente'
  else if (aqi <= 40) category = 'Buena'
  else if (aqi <= 60) category = 'Precaución'
  else if (aqi <= 80) category = 'Mala'
  else category = 'Peligrosa'

  return {
    aqi,
    category,
    dominant: dominant.label ? dominant : null,
    variables: variableScores,
    categories: [],
    metadata: { variablesUsed: Object.keys(variableScores).length, weightedAverage: Math.round(weightedAQI), worstScore: maxScore },
    source: 'classic',
    spaceId: null
  }
}

// ─────────────────────────────────────────────
// seedAirTemplate(client, spaceId)
// Llena la plantilla estándar de "Aire" (5 categorías + variables
// clásicas + rangos de la configuración real de air_quality_ranges).
// Se usa al crear espacios nuevos (orgs tipo B) para que ya tengan
// una config funcional sin que el cliente configure nada.
// ─────────────────────────────────────────────
export async function seedAirTemplate(client, spaceId) {
  await client.query(
    `INSERT INTO space_aqi_categories (space_id, name, color, cat_order, score_lo, score_hi, phrases)
     VALUES
       ($1,'Excelente','#10B981',1,0,20,ARRAY['El aire es ideal. No hay impacto en la salud respiratoria.']),
       ($1,'Buena','#34D399',2,21,40,ARRAY['Calidad aceptable. Riesgo mínimo para grupos vulnerables.']),
       ($1,'Precaución','#F59E0B',3,41,60,ARRAY['Personas con asma deben limitar el esfuerzo prolongado.']),
       ($1,'Mala','#F97316',4,61,80,ARRAY['Riesgo respiratorio. Reducir actividades al aire libre.']),
       ($1,'Peligrosa','#EF4444',5,81,100,ARRAY['Peligro inminente. Permanecer en interiores.'])`,
    [spaceId]
  )

  await client.query(
    `INSERT INTO space_aqi_variables (space_id, variable_label, priority)
     SELECT $1, variable_label, ROW_NUMBER() OVER (ORDER BY weight DESC, variable_label)
     FROM (
       SELECT DISTINCT variable_label, MAX(weight) AS weight
       FROM air_quality_ranges
       WHERE variable_label IN ('pm25','pm10','co2','co','no2','nox','nh3','o3','so2')
       GROUP BY variable_label
     ) t
     ON CONFLICT (space_id, variable_label) DO NOTHING`,
    [spaceId]
  )

  await client.query(
    `INSERT INTO space_variable_ranges (space_id, variable_label, cat_order, min_value, max_value)
     SELECT
       $1, r.variable_label,
       CASE r.score WHEN 0 THEN 1 WHEN 25 THEN 2 WHEN 50 THEN 3 WHEN 75 THEN 4 ELSE 5 END,
       r.min_value, r.max_value
     FROM air_quality_ranges r
     WHERE r.variable_label IN ('pm25','pm10','co2','co','no2','nox','nh3','o3','so2')
     ON CONFLICT (space_id, variable_label, cat_order) DO NOTHING`,
    [spaceId]
  )
}
