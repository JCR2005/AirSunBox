import type { Queryable } from '../types/index.js'
import { getSpaceConfig } from './aqiService.js'

// Reporte de un espacio (organizaciones independientes): se arma con las
// variables y niveles que definió el propio espacio, no con las variables
// globales de AirSunBox.

export interface SpaceLevel { name: string; color: string; lo: number; hi: number | null }

interface Stats { avg: number | null; min: number | null; max: number | null; count: number }

const num = (v: unknown): number | null => (v == null ? null : Number(v))

function levelIndex(levels: SpaceLevel[], value: number): number {
  const i = levels.findIndex(l => l.hi == null || value <= l.hi)
  return i === -1 ? levels.length - 1 : i
}

export async function buildSpaceReport(db: Queryable, spaceId: string, start: Date, end: Date) {
  const { rows: [space] } = await db.query<{ id: string; name: string; type: string; color: string | null }>(
    'SELECT id, name, type, color FROM spaces WHERE id = $1', [spaceId]
  )
  if (!space) return null

  const cfg = await getSpaceConfig(db, spaceId)
  const categories = [...cfg.categories].sort((a, b) => Number(a.cat_order) - Number(b.cat_order))

  // Variables del índice (por prioridad); si el índice no tiene, las del espacio
  let labels = cfg.variables.map(v => v.variable_label)
  if (!labels.length) {
    const { rows } = await db.query<{ label: string }>(
      'SELECT label FROM variable_catalog WHERE space_id = $1 ORDER BY name', [spaceId]
    )
    labels = rows.map(r => r.label)
  }

  const { rows: meta } = await db.query<{ label: string; name: string; unit: string | null; station_key: string }>(
    `SELECT label, name, unit, COALESCE(station_key, label) AS station_key
     FROM variable_catalog WHERE label = ANY($1)`, [labels]
  )
  const metaBy = new Map(meta.map(m => [m.label, m]))

  const { rows: devices } = await db.query<{ id: string; name: string; lat: number | null; lng: number | null }>(
    'SELECT id, name, lat, lng FROM devices WHERE space_id = $1 ORDER BY name', [spaceId]
  )
  const deviceIds = devices.map(d => d.id)

  const empty = {
    space, period: { start: start.toISOString(), end: end.toISOString() },
    levels: categories.map(c => ({ name: c.name, color: c.color })),
    devices, variables: [] as unknown[]
  }
  if (!labels.length || !deviceIds.length) {
    return { ...empty, variables: labels.map(l => ({ label: l, ...(metaBy.get(l) || {}), stats: { avg: null, min: null, max: null, count: 0 }, levels: null, hoursByLevel: [], totalHours: 0, daily: [], byDevice: [] })) }
  }

  const params = [deviceIds, labels, start, end]
  const [byDeviceRes, hourlyRes, dailyRes] = await Promise.all([
    db.query<{ device_id: string; variable: string; avg: string; min: string; max: string; count: string }>(
      `SELECT device_id, variable, AVG(value) AS avg, MIN(value) AS min, MAX(value) AS max, COUNT(*) AS count
       FROM dots
       WHERE device_id = ANY($1) AND variable = ANY($2) AND time >= $3 AND time <= $4
       GROUP BY device_id, variable`, params
    ),
    // Promedio horario del espacio: cada hora se clasifica en un nivel
    db.query<{ variable: string; avg: string }>(
      `SELECT variable, AVG(value) AS avg
       FROM dots
       WHERE device_id = ANY($1) AND variable = ANY($2) AND time >= $3 AND time <= $4
       GROUP BY variable, time_bucket('1 hour', time)`, params
    ),
    // Días calendario de Guatemala (no UTC), devueltos como 'YYYY-MM-DD'
    db.query<{ variable: string; day: string; avg: string; min: string; max: string }>(
      `SELECT variable, to_char(time_bucket('1 day', time AT TIME ZONE 'America/Guatemala'), 'YYYY-MM-DD') AS day,
              AVG(value) AS avg, MIN(value) AS min, MAX(value) AS max
       FROM dots
       WHERE device_id = ANY($1) AND variable = ANY($2) AND time >= $3 AND time <= $4
       GROUP BY variable, day ORDER BY day`, params
    )
  ])

  const deviceName = new Map(devices.map(d => [d.id, d.name]))

  const variables = labels.map(label => {
    const m = metaBy.get(label)
    // Niveles de la variable según los rangos del espacio
    const maxBy: Record<number, number> = {}
    for (const r of cfg.ranges) if (r.variable_label === label && r.max_value != null) maxBy[Number(r.cat_order)] = Number(r.max_value)
    let levels: SpaceLevel[] | null = null
    if (categories.length && Object.keys(maxBy).length) {
      let lo = 0
      levels = categories.map((c, i) => {
        const last = i === categories.length - 1
        const hi = last ? null : (maxBy[Number(c.cat_order)] ?? null)
        const l = { name: c.name, color: c.color, lo, hi }
        if (hi != null) lo = hi
        return l
      })
    }

    const rows = byDeviceRes.rows.filter(r => r.variable === label)
    const count = rows.reduce((a, r) => a + Number(r.count), 0)
    const stats: Stats = count
      ? {
          avg: rows.reduce((a, r) => a + Number(r.avg) * Number(r.count), 0) / count,
          min: Math.min(...rows.map(r => Number(r.min))),
          max: Math.max(...rows.map(r => Number(r.max))),
          count
        }
      : { avg: null, min: null, max: null, count: 0 }

    const hours = hourlyRes.rows.filter(r => r.variable === label).map(r => Number(r.avg))
    const hoursByLevel = levels ? levels.map(() => 0) : []
    if (levels) for (const h of hours) hoursByLevel[levelIndex(levels, h)]++

    return {
      label,
      station_key: m?.station_key ?? label,
      name: m?.name ?? label,
      unit: m?.unit ?? '',
      levels,
      stats,
      level: levels && stats.avg != null ? levelIndex(levels, stats.avg) : null,
      hoursByLevel,
      totalHours: hours.length,
      daily: dailyRes.rows.filter(r => r.variable === label).map(r => ({
        day: r.day, avg: num(r.avg), min: num(r.min), max: num(r.max)
      })),
      byDevice: rows.map(r => ({
        id: r.device_id,
        name: deviceName.get(r.device_id) ?? r.device_id,
        avg: Number(r.avg), min: Number(r.min), max: Number(r.max), count: Number(r.count),
        level: levels ? levelIndex(levels, Number(r.avg)) : null
      })).sort((a, b) => a.name.localeCompare(b.name))
    }
  })

  return { ...empty, variables }
}
