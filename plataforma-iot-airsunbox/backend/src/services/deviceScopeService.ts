import type { Queryable } from '../types/index.js'

export interface DeviceVariableScope {
  // Nombre que envía la estación → clave interna del catálogo. null = sin
  // restricción (organizaciones dependientes o estaciones fuera de un espacio).
  allowed: Map<string, string> | null
}

export async function getDeviceVariableScope(db: Queryable, deviceId: string): Promise<DeviceVariableScope> {
  const { rows: [d] } = await db.query<{ space_id: string | null; org_type: string | null }>(
    `SELECT d.space_id, o.type AS org_type
     FROM devices d
     LEFT JOIN organizations o ON o.id = d.org_id
     WHERE d.id = $1`,
    [deviceId]
  )

  if (!d || !d.space_id || d.org_type !== 'B') return { allowed: null }

  const { rows } = await db.query<{ label: string; station_key: string }>(
    `SELECT label, COALESCE(station_key, label) AS station_key FROM variable_catalog WHERE space_id = $1`,
    [d.space_id]
  )

  const allowed = new Map<string, string>()
  // La clave interna también se acepta, por compatibilidad con estaciones
  // que ya la envían; el nombre de la estación tiene prioridad.
  for (const r of rows) allowed.set(r.label, r.label)
  for (const r of rows) allowed.set(r.station_key, r.label)
  return { allowed }
}

// Clave interna con la que se guarda la lectura, o null si la variable no
// pertenece al espacio de la estación.
export function resolveVariable(scope: DeviceVariableScope, sent: string): string | null {
  if (!scope?.allowed) return sent
  return scope.allowed.get(sent) ?? null
}
