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