import type { Queryable } from '../types/index.js'

export interface AqiCategoryRow {
  id: string
  name: string
  color: string
  cat_order: number
  score_lo: string | number
  score_hi: string | number
  phrases: unknown
}

export interface AqiVariableRow {
  space_id: string
  variable_label: string
  priority: number
}

export interface AqiRangeRow {
  space_id: string
  variable_label: string
  cat_order: number
  min_value: string | number | null
  max_value: string | number | null
}

export interface SpaceAqiConfig {
  categories: AqiCategoryRow[]
  variables: AqiVariableRow[]
  ranges: AqiRangeRow[]
}

export interface AqiResult {
  aqi: number | null
  category: string
  dominant: { label: string | null; score: number; value: number | null } | null
  variables: AqiVariableScores
  categories: AqiCategoryInfo[]
  metadata: AqiMetadata | null
  source: 'space' | 'classic'
  spaceId: string | null
}

export interface AqiVariableScores extends Record<string, {
  value: number
  score: number
  category: string
  weight?: number
  cat_order?: number
}> {}

export interface AqiCategoryInfo {
  name: string
  color: string
  order: number
  score_lo: number
  score_hi: number
  phrases: string[]
}

export interface AqiMetadata {
  variablesUsed: number
  weightedAverage: number
  worstScore: number
}

export interface AqiComputed {
  aqi: number
  category: string
  categories: AqiCategoryInfo[]
  variableScores: AqiVariableScores
  dominant: { label: string | null; score: number; value: number | null }
  metadata: AqiMetadata
}

export async function getSpaceConfig(db: Queryable, spaceId: string): Promise<SpaceAqiConfig> {
  const [cats, vars, ranges] = await Promise.all([
    db.query<AqiCategoryRow>(
      `SELECT id, name, color, cat_order, score_lo, score_hi, phrases
       FROM space_aqi_categories
       WHERE space_id = $1
       ORDER BY cat_order ASC`,
      [spaceId]
    ),
    db.query<AqiVariableRow>(
      `SELECT variable_label, priority
       FROM space_aqi_variables
       WHERE space_id = $1
       ORDER BY priority ASC`,
      [spaceId]
    ),
    db.query<AqiRangeRow>(
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

function midScore(cat: AqiCategoryRow): number {
  const lo = Number(cat.score_lo)
  const hi = Number(cat.score_hi)
  return Math.round((lo + hi) / 2)
}

function categoryForValue(
  ranges: AqiRangeRow[],
  variable: string,
  value: number,
  catsById: Record<number, AqiCategoryRow>
): AqiCategoryRow | null {
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

export function computeAqi(
  latestValues: Record<string, number>,
  config: SpaceAqiConfig
): AqiComputed {
  const catsById: Record<number, AqiCategoryRow> = {}
  for (const c of config.categories) catsById[c.cat_order] = c

  const nVars = Math.max(config.variables.length, 1)
  const weightByVar: Record<string, number> = {}
  config.variables.forEach((v, i) => {
    weightByVar[v.variable_label] = nVars - i
  })

  const variableScores: AqiVariableScores = {}
  let totalScore = 0
  let totalWeight = 0
  let dominant = { label: null as string | null, score: -1, value: null as number | null }

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
      name: c.name,
      color: c.color,
      order: c.cat_order,
      score_lo: Number(c.score_lo),
      score_hi: Number(c.score_hi),
      phrases: Array.isArray(c.phrases) ? (c.phrases as string[]) : []
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

const CLASSIC_AQI_VARS = ['co', 'co2', 'nh3', 'nox', 'no2', 'o3', 'so2', 'pm25', 'pm10']

interface ClassicRangeRow {
  score: string | number
  category: string
  weight: string | number
}

export async function getDeviceAqi(db: Queryable, deviceId: string): Promise<AqiResult | null> {
  const { rows: [device] } = await db.query<{ id: string; space_id: string | null }>(
    'SELECT id, space_id FROM devices WHERE id = $1',
    [deviceId]
  )
  if (!device) return null

  if (device.space_id) {
    const config = await getSpaceConfig(db, device.space_id)
    if (!config.categories.length || !config.variables.length) {
      return { aqi: null, category: 'Sin datos', dominant: null, variables: {}, categories: [], metadata: null, source: 'space', spaceId: device.space_id }
    }

    const labels = config.variables.map(v => v.variable_label)
    const { rows: latestDots } = await db.query<{ variable: string; value: string | number }>(
      `SELECT DISTINCT ON (variable) variable, value
       FROM dots
       WHERE device_id = $1 AND variable = ANY($2)
         AND time > NOW() - INTERVAL '1 hour'
       ORDER BY variable, time DESC`,
      [deviceId, labels]
    )

    const latestValues: Record<string, number> = {}
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

  const { rows: latestDots } = await db.query<{ variable: string; value: string | number }>(
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

  const variableScores: AqiVariableScores = {}
  let totalScore = 0
  let totalWeight = 0
  let dominant = { label: null as string | null, score: -1, value: null as number | null }

  for (const dot of latestDots) {
    const { rows: [range] } = await db.query<ClassicRangeRow>(
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

export async function seedAirTemplate(client: Queryable, spaceId: string): Promise<void> {
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