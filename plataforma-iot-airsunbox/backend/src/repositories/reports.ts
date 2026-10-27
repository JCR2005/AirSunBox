import type { Queryable } from '../types/index.js'

export interface GlobalStatsRow {
  total_clients: string
  total_devices: string
  active_devices: string
  pending_requests: string
}

export async function globalStats(db: Queryable): Promise<GlobalStatsRow> {
  const { rows: [stats] } = await db.query<GlobalStatsRow>(`
    SELECT
      (SELECT COUNT(*) FROM organizations WHERE slug != 'airsunbox-internal') as total_clients,
      (SELECT COUNT(*) FROM devices) as total_devices,
      (SELECT COUNT(*) FROM devices WHERE last_seen > NOW() - INTERVAL '5 minutes') as active_devices,
      (SELECT COUNT(*) FROM requests WHERE status = 'pending') as pending_requests
  `)
  return stats
}

function buildHeatmapQuery(orgId?: string, start?: string, end?: string): { text: string; params: unknown[] } {
  let query = `
    SELECT
      d.id, d.name, d.lat, d.lng,
      AVG(CASE WHEN dot.variable IN ('temperatura', 'temperature') THEN dot.value END) as avg_temp,
      AVG(CASE WHEN dot.variable IN ('humedad', 'humidity') THEN dot.value END) as avg_hum,
      MAX(CASE WHEN dot.variable IN ('temperatura', 'temperature') THEN dot.value END) as max_temp,
      MIN(CASE WHEN dot.variable IN ('temperatura', 'temperature') THEN dot.value END) as min_temp
    FROM devices d
    JOIN dots dot ON dot.device_id = d.id
    WHERE dot.variable IN ('temperatura', 'temperature', 'humedad', 'humidity')
  `
  const params: unknown[] = []
  let i = 1

  if (orgId) {
    query += ` AND d.org_id = $${i++}`
    params.push(orgId)
  }
  if (start) {
    query += ` AND dot.time >= $${i++}`
    params.push(start)
  }
  if (end) {
    query += ` AND dot.time <= $${i++}`
    params.push(end)
  }

  query += ` GROUP BY d.id, d.name, d.lat, d.lng`
  return { text: query, params }
}

export async function heatmap(db: Queryable, orgId?: string, start?: string, end?: string) {
  const { text, params } = buildHeatmapQuery(orgId, start, end)
  const { rows } = await db.query(text, params)
  return rows
}

function buildRespiratoryQuery(orgId?: string, start?: string, end?: string): { text: string; params: unknown[] } {
  const targetVars = ['pm25', 'pm10', 'so2', 'nox', 'o3', 'temperatura', 'temperature', 'humedad', 'humidity']
  let query = `
    SELECT
      d.id, d.name, dot.variable,
      AVG(dot.value) as avg_value,
      MAX(dot.value) as max_value,
      COUNT(*) as samples
    FROM devices d
    JOIN dots dot ON dot.device_id = d.id
    WHERE dot.variable = ANY($1)
  `
  const params: unknown[] = [targetVars]
  let i = 2

  if (orgId) {
    query += ` AND d.org_id = $${i++}`
    params.push(orgId)
  }
  if (start) {
    query += ` AND dot.time >= $${i++}`
    params.push(start)
  }
  if (end) {
    query += ` AND dot.time <= $${i++}`
    params.push(end)
  }

  query += ` GROUP BY d.id, d.name, dot.variable`
  return { text: query, params }
}

export async function respiratoryData(db: Queryable, orgId?: string, start?: string, end?: string) {
  const { text, params } = buildRespiratoryQuery(orgId, start, end)
  const { rows } = await db.query<{ id: string; name: string; variable: string; avg_value: string; max_value: string }>(text, params)
  return rows
}

function buildEnvironmentalQuery(start?: string, end?: string): { text: string; params: unknown[] } {
  const targetVars = ['pm25', 'pm10', 'co', 'o3', 'so2', 'nox', 'h2s']
  let query = `
    SELECT
      d.id, d.name, d.lat, d.lng, dot.variable,
      AVG(dot.value) as avg_value
    FROM devices d
    JOIN dots dot ON dot.device_id = d.id
    WHERE dot.variable = ANY($1)
  `
  const params: unknown[] = [targetVars]
  let i = 2

  if (start) {
    query += ` AND dot.time >= $${i++}`
    params.push(start)
  }
  if (end) {
    query += ` AND dot.time <= $${i++}`
    params.push(end)
  }

  query += ` GROUP BY d.id, d.name, d.lat, d.lng, dot.variable`
  return { text: query, params }
}
