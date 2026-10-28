import { Link } from 'react-router-dom'

// Niveles de una variable según la configuración AQI del espacio:
// [{ name, color, lo, hi }] con hi = null en el último (abierto).
export function variableLevels(aqiConfig, label) {
  const cats = [...(aqiConfig?.categories || [])].sort((a, b) => a.cat_order - b.cat_order)
  if (!cats.length) return null
  const maxByOrder = {}
  for (const r of aqiConfig?.ranges || []) {
    if (r.variable_label === label) maxByOrder[r.cat_order] = r.max_value
  }
  if (!Object.keys(maxByOrder).length) return null
  let lo = 0
  return cats.map((c, i) => {
    const last = i === cats.length - 1
    const hi = last ? null : (maxByOrder[c.cat_order] != null ? Number(maxByOrder[c.cat_order]) : null)
    const level = { name: c.name, color: c.color, lo, hi }
    if (hi != null) lo = hi
    return level
  })
}

function levelFor(levels, value) {
  const i = levels.findIndex(l => l.hi == null || value <= l.hi)
  return i === -1 ? levels.length - 1 : i
}

const fmt = (v) => {
  const n = Number(v)
  return Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1)
}

// Lectura de una variable: valor, unidad y en qué nivel del índice está.
export default function ReadingTile({ to, name, unit, value, levels, size = 'md' }) {
  const has = value != null && !Number.isNaN(Number(value))
  const idx = has && levels ? levelFor(levels, Number(value)) : -1
  const level = idx >= 0 ? levels[idx] : null
  // Posición del marcador: dentro del tramo del nivel (el último, abierto, al centro)
  let marker = null
  if (level) {
    const span = level.hi != null ? Math.max(level.hi - level.lo, 1e-9) : null
    const within = span ? Math.min(1, Math.max(0, (Number(value) - level.lo) / span)) : 0.5
    marker = ((idx + within) / levels.length) * 100
  }
  const big = size === 'lg'

  return (
    <Link
      to={to}
      className="group h-full rounded-2xl border flex flex-col p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B7E8]"
      style={{ background: 'var(--card)', borderColor: level ? level.color + '55' : 'var(--border)' }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="block text-sm font-semibold truncate first-letter:uppercase" style={{ color: 'var(--text)' }}>{name}</span>
        {unit && <span className="text-xs shrink-0" style={{ color: 'var(--text2)' }}>{unit}</span>}
      </div>

      <div className={`flex-1 flex items-center ${big ? 'py-5' : 'py-3'}`}>
        <span
          className={`${big ? 'text-5xl' : 'text-4xl'} font-bold tracking-tight tabular-nums leading-none`}
          style={{ color: has ? 'var(--text)' : 'var(--border)' }}
        >
          {has ? fmt(value) : '—'}
        </span>
      </div>

      {levels ? (
        <div>
          <div className="relative">
            <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
              {levels.map((l, i) => (
                <span key={i} className="flex-1" style={{ background: l.color, opacity: has ? (i === idx ? 1 : 0.35) : 0.18 }} />
              ))}
            </div>
            {marker != null && (
              <span
                className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-500"
                style={{ left: `${marker}%`, background: 'var(--card)', boxShadow: `0 0 0 2.5px ${level.color}` }}
                aria-hidden="true"
              />
            )}
          </div>
          <p className="text-xs font-semibold mt-2.5" style={{ color: level ? level.color : 'var(--text2)' }}>
            {level ? level.name : 'Sin lecturas todavía'}
          </p>
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text2)' }}>{has ? 'Última lectura' : 'Sin lecturas todavía'}</p>
      )}
    </Link>
  )
}
