import type { Queryable } from '../types/index.js'

export interface DeviceVariableScope {
  allowed: Set<string> | null
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

  const { rows } = await db.query<{ label: string }>(
    `SELECT label FROM variable_catalog WHERE space_id = $1`,
    [d.space_id]
  )

  return { allowed: new Set(rows.map(r => r.label)) }
}

export function isLabelAllowed(scope: DeviceVariableScope, label: string): boolean {
  if (!scope?.allowed) return true
  return scope.allowed.has(label)
}