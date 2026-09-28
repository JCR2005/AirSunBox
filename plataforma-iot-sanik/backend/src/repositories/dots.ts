import type { Queryable } from '../types/index.js'

export interface DotRow {
  variable: string
  value: string | number
  time: Date
}

export interface SeriesPoint {
  time: string
  value: number
}

const INTERVALS: Record<string, { sqlInterval: string; bucket: string }> = {
  '1h':  { sqlInterval: '1 hour', bucket: '1 minute' },
  '6h':  { sqlInterval: '6 hours', bucket: '5 minutes' },
  '24h': { sqlInterval: '24 hours', bucket: '15 minutes' },
  '7d':  { sqlInterval: '7 days', bucket: '2 hours' },
  '30d': { sqlInterval: '30 days', bucket: '12 hours' }
}

export function resolveInterval(range: string | undefined): { sqlInterval: string; bucket: string } {
  return INTERVALS[range || '24h'] || INTERVALS['24h']
}

export async function latestForDevice(db: Queryable, deviceId: string, variables: string[]) {
  const { rows } = await db.query<DotRow>(
    `SELECT DISTINCT ON (variable) variable, value, time
     FROM dots
     WHERE device_id = $1 AND variable = ANY($2) AND time > NOW() - INTERVAL '1 minute'
     ORDER BY variable, time DESC`,
    [deviceId, variables]
  )
  return rows
}

export async function latestForDeviceInWindow(db: Queryable, deviceId: string, variables: string[], window: string) {
  const { rows } = await db.query<DotRow>(
    `SELECT DISTINCT ON (variable) variable, value
     FROM dots
     WHERE device_id = $1 AND variable = ANY($2)
       AND time > NOW() - INTERVAL '${window}'
     ORDER BY variable, time DESC`,
    [deviceId, variables]
  )
  return rows
}

export async function latestForDeviceAqi(db: Queryable, deviceId: string, variables: string[], window: string) {
  const { rows } = await db.query<DotRow>(
    `SELECT DISTINCT ON (variable) variable, value
     FROM dots
     WHERE device_id = $1 AND variable = ANY($2)
       AND time > NOW() - INTERVAL '${window}'
     ORDER BY variable, time DESC`,
    [deviceId, variables]
  )
  return rows
}

export async function seriesRaw(db: Queryable, deviceId: string, variable: string, sqlInterval: string, limit = 1500): Promise<SeriesPoint[]> {
  const { rows } = await db.query<{ time: Date; value: string | number }>(
    `SELECT time, value
     FROM dots
     WHERE device_id = $1 AND variable = $2
       AND time >= NOW() - $3::interval
     ORDER BY time ASC
     LIMIT ${limit}`,
    [deviceId, variable, sqlInterval]
  )
  return rows.map(r => ({ time: new Date(r.time).toISOString(), value: Number(r.value) }))
}

export async function seriesAggregated(db: Queryable, deviceId: string, variable: string, sqlFunction: string, bucket: string, sqlInterval: string): Promise<SeriesPoint[]> {
  const { rows } = await db.query<{ time: Date; value: string | number }>(
    `SELECT time_bucket($3::interval, time) AS time,
            ROUND(${sqlFunction}::numeric, 2) AS value
     FROM dots
     WHERE device_id = $1 AND variable = $2
       AND time >= NOW() - $4::interval
     GROUP BY 1
     ORDER BY time ASC`,
    [deviceId, variable, bucket, sqlInterval]
  )
  return rows.map(r => ({ time: new Date(r.time).toISOString(), value: Number(r.value) }))
}

export async function seriesMultiVar(db: Queryable, deviceId: string, variables: string[], bucket: string, sqlInterval: string) {
  const { rows } = await db.query<{ time: Date; variable: string; value: string | number }>(
    `SELECT time_bucket($3::interval, time) AS time,
            variable,
            ROUND(AVG(value)::numeric, 2) as value
     FROM dots
     WHERE device_id = $1
       AND variable = ANY($2)
       AND time >= NOW() - $4::interval
     GROUP BY 1, 2
     ORDER BY time ASC`,
    [deviceId, variables, bucket, sqlInterval]
  )
  return rows
}

export async function countForDeviceVariable(db: Queryable, deviceId: string, variable: string): Promise<number> {
  const { rows: [row] } = await db.query<{ total: number }>(
    'SELECT COUNT(*)::int as total FROM dots WHERE device_id = $1 AND variable = $2',
    [deviceId, variable]
  )
  return row?.total || 0
}

export async function pageRaw(db: Queryable, deviceId: string, variable: string, limit: number, offset: number): Promise<SeriesPoint[]> {
  const { rows } = await db.query<{ time: Date; value: string | number }>(
    `SELECT time, value
     FROM dots
     WHERE device_id = $1 AND variable = $2
     ORDER BY time DESC
     LIMIT $3 OFFSET $4`,
    [deviceId, variable, limit, offset]
  )
  return rows.map(r => ({ time: new Date(r.time).toISOString(), value: Number(r.value) }))
}

export interface QualityBand {
  category: string
  score: number
  min_value: number
  max_value: number | null
}

export interface StationReading {
  time: string
  value: number
  category: string | null
  score: number | null
}

export interface StationVariableRecords {
  variable: string
  total: number
  min: number | null
  avg: number | null
  max: number | null
  firstTime: string | null
  lastTime: string | null
  truncated: boolean
  readings: StationReading[]
}

export interface StationCoverage {
  firstReading: string | null
  lastReading: string | null
  totalReadings: number
  includedReadings: number
  truncated: boolean
  limitPerVariable: number
}

export interface StationIdentity {
  id: string
  name: string
  serial: string | null
  lat: number | null
  lng: number | null
  space_name: string | null
}

export async function stationIdentity(db: Queryable, deviceId: string): Promise<StationIdentity | null> {
  const { rows } = await db.query<StationIdentity>(
    `SELECT d.id, d.name, d.serial, d.lat, d.lng, s.name AS space_name
     FROM devices d
     LEFT JOIN spaces s ON s.id = d.space_id
     WHERE d.id = $1`,
    [deviceId]
  )
  return rows[0] || null
}

export async function qualityBands(db: Queryable, variables: string[]): Promise<Record<string, QualityBand[]>> {
  if (!variables.length) return {}
  const { rows } = await db.query<QualityBand & { variable_label: string }>(
    `SELECT variable_label, category, score, min_value, max_value
     FROM air_quality_ranges
     WHERE variable_label = ANY($1)
     ORDER BY variable_label, min_value`,
    [variables]
  )
  const grouped: Record<string, QualityBand[]> = {}
  for (const row of rows) {
    if (!grouped[row.variable_label]) grouped[row.variable_label] = []
    grouped[row.variable_label].push(row)
  }
  return grouped
}

function classify(bands: QualityBand[] | undefined, value: number): Pick<StationReading, 'category' | 'score'> {
  if (!bands) return { category: null, score: null }
  const band = bands.find(b => b.min_value <= value && (b.max_value === null || b.max_value > value))
  return band ? { category: band.category, score: band.score } : { category: null, score: null }
}

export async function stationRecords(
  db: Queryable,
  deviceId: string,
  start: Date,
  end: Date,
  limitPerVariable: number
): Promise<StationVariableRecords[]> {
  // Estadísticas sobre todo el rango: el recorte del PDF no debe alterarlas
  const { rows: stats } = await db.query<{
    variable: string
    total: number
    min: string | null
    avg: string | null
    max: string | null
    first_time: Date
    last_time: Date
  }>(
    `SELECT variable,
            COUNT(*)::int AS total,
            MIN(value) AS min,
            AVG(value) AS avg,
            MAX(value) AS max,
            MIN(time) AS first_time,
            MAX(time) AS last_time
     FROM dots
     WHERE device_id = $1 AND time >= $2 AND time <= $3
     GROUP BY variable
     ORDER BY variable`,
    [deviceId, start, end]
  )

  if (!stats.length) return []

  // row_number() permite tope por variable en una sola pasada
  const { rows: capped } = await db.query<{ variable: string; time: Date; value: string | number; rn: number }>(
    `SELECT variable, time, value,
            ROW_NUMBER() OVER (PARTITION BY variable ORDER BY time DESC) AS rn
     FROM dots
     WHERE device_id = $1 AND time >= $2 AND time <= $3`,
    [deviceId, start, end]
  )

  const bands = await qualityBands(db, stats.map(s => s.variable))
  const kept = capped.filter(r => r.rn <= limitPerVariable)

  return stats.map(s => {
    const readings = kept
      .filter(r => r.variable === s.variable)
      .sort((a, b) => b.rn - a.rn)
      .map(r => {
        const value = Number(r.value)
        return { time: new Date(r.time).toISOString(), value, ...classify(bands[s.variable], value) }
      })

    return {
      variable: s.variable,
      total: s.total,
      min: s.min === null ? null : Number(s.min),
      avg: s.avg === null ? null : Number(s.avg),
      max: s.max === null ? null : Number(s.max),
      firstTime: new Date(s.first_time).toISOString(),
      lastTime: new Date(s.last_time).toISOString(),
      truncated: s.total > limitPerVariable,
      readings
    }
  })
}

export function stationCoverage(
  variables: StationVariableRecords[],
  limitPerVariable: number
): StationCoverage {
  const times = variables.map(v => v.firstTime).filter(Boolean) as string[]
  const lastTimes = variables.map(v => v.lastTime).filter(Boolean) as string[]
  const totalReadings = variables.reduce((acc, v) => acc + v.total, 0)
  const includedReadings = variables.reduce((acc, v) => acc + v.readings.length, 0)

  return {
    firstReading: times.length ? times.reduce((a, b) => (a < b ? a : b)) : null,
    lastReading: lastTimes.length ? lastTimes.reduce((a, b) => (a > b ? a : b)) : null,
    totalReadings,
    includedReadings,
    truncated: includedReadings < totalReadings,
    limitPerVariable
  }
}

export async function insert(db: Queryable, time: Date, deviceId: string, variable: string, value: number): Promise<void> {
  await db.query(
    'INSERT INTO dots (time, device_id, variable, value) VALUES ($1, $2, $3, $4)',
    [time, deviceId, variable, value]
  )
}

export async function insertBatch(
  db: Queryable,
  rows: Array<{ time: Date; deviceId: string; variable: string; value: number }>
): Promise<void> {
  if (rows.length === 0) return
  const values: (Date | string | number)[] = []
  const placeholders = rows.map((_, i) => {
    const base = i * 4
    values.push(rows[i].time, rows[i].deviceId, rows[i].variable, rows[i].value)
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`
  }).join(', ')
  await db.query(
    `INSERT INTO dots (time, device_id, variable, value) VALUES ${placeholders}`,
    values
  )
}

export async function ensureDeviceVariable(db: Queryable, deviceId: string, variableLabel: string): Promise<void> {
  await db.query(
    `INSERT INTO device_variables (device_id, variable_label)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [deviceId, variableLabel]
  )
}

export async function registerDeviceVariables(db: Queryable, deviceId: string, labels: string[]): Promise<void> {
  if (labels.length === 0) return
  await db.query(
    `INSERT INTO device_variables (device_id, variable_label)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [deviceId, labels]
  )
}

export async function replaceDeviceVariables(db: Queryable, deviceId: string, labels: string[]): Promise<void> {
  if (labels.length > 0) {
    await db.query(
      `DELETE FROM device_variables WHERE device_id = $1 AND NOT (variable_label = ANY($2))`,
      [deviceId, labels]
    )
    for (const label of labels) {
      await db.query(
        `INSERT INTO device_variables (device_id, variable_label)
         VALUES ($1, $2)
         ON CONFLICT (device_id, variable_label) DO NOTHING`,
        [deviceId, label]
      )
    }
  }
}

export async function airQualityRange(db: Queryable, variableLabel: string, value: number | string) {
  const { rows: [range] } = await db.query<{ score: string | number; category: string; weight: string | number }>(
    `SELECT score, category, weight
     FROM air_quality_ranges
     WHERE variable_label = $1 AND min_value <= $2 AND (max_value IS NULL OR max_value > $2)
     LIMIT 1`,
    [variableLabel, value]
  )
  return range
}