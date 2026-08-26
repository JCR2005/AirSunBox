// ─────────────────────────────────────────────
// SANIK — Alcance de variables por dispositivo
//
// Regla para orgs tipo B (independientes / self-service):
//   un dispositivo que vive en un espacio SOLO puede recibir y almacenar
//   las variables PRIVADAS de ESE espacio (las del catálogo con su space_id).
//   Las variables globales (space_id NULL) quedan fuera → evita que una
//   estación de un espacio acumule variables ajenas (ej. 'temperatura'),
//   manteniendo el aislamiento por espacio.
//
// Para orgs tipo A (dependientes) y dispositivos sin espacio NO se restringe
// nada (compatibilidad total con el comportamiento actual).
//
// Uso: const { allowed } = await getDeviceVariableScope(app, deviceId)
//   allowed === null → sin filtro (acepta cualquier variable)
//   allowed === Set  → solo esas labels son válidas
// ─────────────────────────────────────────────
export async function getDeviceVariableScope(app, deviceId) {
  const { rows: [d] } = await app.db.query(
    `SELECT d.space_id, o.type AS org_type
     FROM devices d
     LEFT JOIN organizations o ON o.id = d.org_id
     WHERE d.id = $1`,
    [deviceId]
  )

  if (!d || !d.space_id || d.org_type !== 'B') return { allowed: null }

  const { rows } = await app.db.query(
    `SELECT label FROM variable_catalog WHERE space_id = $1`,
    [d.space_id]
  )

  return { allowed: new Set(rows.map(r => r.label)) }
}

// Devuelve true si el label está permitido para el dispositivo.
export function isLabelAllowed(scope, label) {
  if (!scope?.allowed) return true
  return scope.allowed.has(label)
}