import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { FileText, FileSpreadsheet, RefreshCw, Layers, AlertCircle } from 'lucide-react'
import ClienteLayout from '../../components/airsunbox/ClienteLayout'
import { spaces as spacesApi, reports as reportsApi } from '../../services/api'
import { exportSpaceReportPDF, exportSpaceReportExcel } from '../../utils/exportUtils'

const ACCENT = '#67B7E8'
const PRESETS = [
  { id: '7', label: '7 días', days: 7 },
  { id: '30', label: '30 días', days: 30 },
  { id: '90', label: '90 días', days: 90 },
  { id: 'custom', label: 'Personalizado' },
]

const fmt = (v, d = 1) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('es-GT', { maximumFractionDigits: d, minimumFractionDigits: Math.abs(v) >= 100 ? 0 : d }))
// `d` llega como 'YYYY-MM-DD' (día de Guatemala): se lee sin convertir zona
const dayLabel = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const dateInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

// Horas que pasó la variable en cada nivel del índice (barra apilada + leyenda)
function LevelHours({ levels, hours, total }) {
  if (!levels || !total) {
    return <p className="text-sm" style={{ color: 'var(--text2)' }}>Sin niveles configurados para esta variable.</p>
  }
  return (
    <div>
      <div className="flex gap-[2px] h-3 rounded-full overflow-hidden" role="img"
           aria-label={levels.map((l, i) => `${l.name}: ${hours[i]} h`).join(', ')}>
        {levels.map((l, i) => hours[i] > 0 && (
          <span key={i} title={`${l.name}: ${hours[i]} h (${Math.round((hours[i] / total) * 100)} %)`}
                style={{ flexGrow: hours[i], background: l.color }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
        {levels.map((l, i) => (
          <li key={i} className="flex items-center gap-1.5 text-xs" style={{ color: hours[i] ? 'var(--text)' : 'var(--text2)' }}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: l.color, opacity: hours[i] ? 1 : 0.35 }} />
            {l.name}
            <span className="tabular-nums" style={{ color: 'var(--text2)' }}>{hours[i]} h · {Math.round((hours[i] / total) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TrendTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border px-3 py-2 text-xs shadow-lg" style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}>
      <p className="font-semibold mb-1">{dayLabel(d.day)}</p>
      <p>Promedio <span className="font-semibold tabular-nums">{fmt(d.avg)}</span> {unit}</p>
      <p style={{ color: 'var(--text2)' }}>Mín {fmt(d.min)} · Máx {fmt(d.max)}</p>
    </div>
  )
}

function VariableSection({ v }) {
  const level = v.level != null && v.levels ? v.levels[v.level] : null
  const color = level?.color || ACCENT
  const data = v.daily.map(d => ({ ...d, band: [d.min, d.max] }))
  return (
    <section className="rounded-3xl border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="flex items-baseline justify-between gap-3 mb-5">
        <h3 className="text-lg font-bold first-letter:uppercase" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>{v.name}</h3>
        <span className="text-xs font-mono" style={{ color: 'var(--text2)' }}>{v.station_key}{v.unit ? ` · ${v.unit}` : ''}</span>
      </div>

      {v.stats.count === 0 ? (
        <p className="text-sm py-6" style={{ color: 'var(--text2)' }}>No hay lecturas de esta variable en el periodo.</p>
      ) : (
        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-6">
          <dl className="grid grid-cols-3 lg:grid-cols-1 gap-4 content-start">
            <div className="col-span-3 lg:col-span-1">
              <dt className="text-xs" style={{ color: 'var(--text2)' }}>Promedio del periodo</dt>
              <dd className="mt-1">
                <span className="text-4xl font-bold tracking-tight tabular-nums" style={{ color: 'var(--text)' }}>{fmt(v.stats.avg)}</span>
                {v.unit && <span className="text-base font-semibold ml-1.5" style={{ color: 'var(--text2)' }}>{v.unit}</span>}
              </dd>
              {level && <dd className="text-sm font-semibold mt-1" style={{ color: level.color }}>{level.name}</dd>}
            </div>
            <div>
              <dt className="text-xs" style={{ color: 'var(--text2)' }}>Mínimo</dt>
              <dd className="text-base font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{fmt(v.stats.min)}</dd>
            </div>
            <div>
              <dt className="text-xs" style={{ color: 'var(--text2)' }}>Máximo</dt>
              <dd className="text-base font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{fmt(v.stats.max)}</dd>
            </div>
            <div>
              <dt className="text-xs" style={{ color: 'var(--text2)' }}>Lecturas</dt>
              <dd className="text-base font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{v.stats.count.toLocaleString('es-GT')}</dd>
            </div>
          </dl>

          <div className="min-w-0">
            <p className="text-xs mb-2" style={{ color: 'var(--text2)' }}>Promedio diario, con el rango entre mínimo y máximo</p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={dayLabel} tick={{ fontSize: 11, fill: 'var(--text2)' }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text2)' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<TrendTooltip unit={v.unit} />} cursor={{ stroke: 'var(--text2)', strokeDasharray: '3 3' }} />
                  <Area dataKey="band" stroke="none" fill={color} fillOpacity={0.15} activeDot={false} isAnimationActive={false} />
                  <Line dataKey="avg" stroke={color} strokeWidth={2} dot={data.length <= 14 ? { r: 3, strokeWidth: 0, fill: color } : false} activeDot={{ r: 5 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {v.stats.count > 0 && (
        <div className="mt-6 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Horas en cada nivel</p>
          <LevelHours levels={v.levels} hours={v.hoursByLevel} total={v.totalHours} />
        </div>
      )}
    </section>
  )
}

export default function SpaceReport() {
  const [spaces, setSpaces] = useState(null)
  const [spaceId, setSpaceId] = useState('')
  const [preset, setPreset] = useState('7')
  const [custom, setCustom] = useState(() => {
    const end = new Date()
    return { start: dateInput(new Date(end.getTime() - 7 * 86400000)), end: dateInput(end) }
  })
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState('')

  useEffect(() => {
    spacesApi.list()
      .then(list => { setSpaces(list || []); if (list?.length) setSpaceId(list[0].id) })
      .catch(() => setSpaces([]))
  }, [])

  const range = useMemo(() => {
    if (preset === 'custom') {
      if (!custom.start || !custom.end) return null
      const start = new Date(`${custom.start}T00:00:00`)
      const end = new Date(`${custom.end}T23:59:59`)
      return start < end ? { start: start.toISOString(), end: end.toISOString() } : null
    }
    const days = PRESETS.find(p => p.id === preset).days
    const end = new Date()
    return { start: new Date(end.getTime() - days * 86400000).toISOString(), end: end.toISOString() }
  }, [preset, custom])

  const load = async () => {
    if (!spaceId || !range) return
    setLoading(true); setError('')
    try {
      setReport(await reportsApi.space(spaceId, range.start, range.end))
    } catch (e) {
      setError(e.message || 'No se pudo generar el reporte')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [spaceId, preset, preset === 'custom' ? `${custom.start}|${custom.end}` : ''])

  const current = spaces?.find(s => s.id === spaceId)
  const totalReadings = report?.variables?.reduce((a, v) => a + (v.stats?.count || 0), 0) || 0
  const hasData = totalReadings > 0

  const doExport = async (kind) => {
    if (!report) return
    setExporting(kind)
    try {
      if (kind === 'pdf') await exportSpaceReportPDF(report)
      else exportSpaceReportExcel(report)
    } finally {
      setExporting('')
    }
  }

  return (
    <ClienteLayout>
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Reportes</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>Cómo estuvo cada espacio en el periodo que elijas, con sus propias variables y niveles.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => doExport('pdf')} disabled={!hasData || !!exporting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:border-[#67B7E8] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--card)' }}>
              {exporting === 'pdf' ? <RefreshCw size={15} className="animate-spin" /> : <FileText size={15} />} Exportar PDF
            </button>
            <button type="button" onClick={() => doExport('xlsx')} disabled={!hasData || !!exporting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:border-[#67B7E8] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--card)' }}>
              {exporting === 'xlsx' ? <RefreshCw size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Exportar Excel
            </button>
          </div>
        </div>

        {spaces === null ? (
          <p className="text-sm" style={{ color: 'var(--text2)' }}>Cargando espacios…</p>
        ) : spaces.length === 0 ? (
          <div className="rounded-3xl border p-10 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <Layers size={28} className="mx-auto mb-3" style={{ color: ACCENT }} />
            <p className="font-semibold" style={{ color: 'var(--text)' }}>Todavía no tenés espacios</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>Los reportes se arman por espacio. <Link to="/espacios" className="font-semibold" style={{ color: ACCENT }}>Creá el primero</Link>.</p>
          </div>
        ) : (
          <>
            {/* Filtros: espacio y periodo, en una fila */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Espacio">
                {spaces.map(s => {
                  const on = s.id === spaceId
                  const c = s.color || ACCENT
                  return (
                    <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => setSpaceId(s.id)}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors"
                            style={on ? { background: c + '1F', borderColor: c, color: 'var(--text)' } : { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text2)' }}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} /> {s.name}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex p-1 rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }} role="radiogroup" aria-label="Periodo">
                  {PRESETS.map(p => (
                    <button key={p.id} type="button" role="radio" aria-checked={preset === p.id} onClick={() => setPreset(p.id)}
                            className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                            style={preset === p.id ? { background: ACCENT, color: '#fff' } : { color: 'var(--text2)' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                {preset === 'custom' && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text2)' }}>
                    <label className="sr-only" htmlFor="rep-desde">Desde</label>
                    <input id="rep-desde" type="date" value={custom.start} max={custom.end} onChange={e => setCustom(c => ({ ...c, start: e.target.value }))}
                           className="rounded-lg border px-2.5 py-1.5" style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                    a
                    <label className="sr-only" htmlFor="rep-hasta">Hasta</label>
                    <input id="rep-hasta" type="date" value={custom.end} min={custom.start} onChange={e => setCustom(c => ({ ...c, end: e.target.value }))}
                           className="rounded-lg border px-2.5 py-1.5" style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div role="alert" className="mb-6 flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(229,72,77,0.08)', color: '#E5484D' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {loading && !report ? (
              <p className="text-sm flex items-center gap-2" style={{ color: 'var(--text2)' }}><RefreshCw size={14} className="animate-spin" /> Generando reporte…</p>
            ) : report && (
              <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
                <p className="text-sm" style={{ color: 'var(--text2)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text)' }}>{current?.name}</span>
                  {' '}— {report.devices.length} {report.devices.length === 1 ? 'estación' : 'estaciones'}, {totalReadings.toLocaleString('es-GT')} lecturas,
                  del {new Date(report.period.start).toLocaleDateString('es-GT')} al {new Date(report.period.end).toLocaleDateString('es-GT')}.
                </p>

                {!hasData ? (
                  <div className="rounded-3xl border p-10 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <p className="font-semibold" style={{ color: 'var(--text)' }}>No hay lecturas en este periodo</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
                      {report.devices.length ? 'Probá con un periodo más largo o revisá que las estaciones estén enviando datos.' : 'Este espacio todavía no tiene estaciones.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {report.variables.map(v => <VariableSection key={v.label} v={v} />)}

                    {report.devices.length > 1 && (
                      <section className="rounded-3xl border p-6 overflow-x-auto" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                        <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Promedio por estación</h3>
                        <table className="w-full text-sm min-w-[480px]">
                          <thead>
                            <tr>
                              <th className="text-left font-semibold pb-2" style={{ color: 'var(--text2)' }}>Estación</th>
                              {report.variables.map(v => (
                                <th key={v.label} className="text-right font-semibold pb-2 px-3" style={{ color: 'var(--text2)' }}>{v.name}{v.unit ? ` (${v.unit})` : ''}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {report.devices.map(d => (
                              <tr key={d.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                                <td className="py-2.5" style={{ color: 'var(--text)' }}>{d.name}</td>
                                {report.variables.map(v => {
                                  const r = v.byDevice.find(x => x.id === d.id)
                                  const lv = r && r.level != null && v.levels ? v.levels[r.level] : null
                                  return (
                                    <td key={v.label} className="py-2.5 px-3 text-right tabular-nums" style={{ color: 'var(--text)' }}>
                                      {r ? (
                                        <span className="inline-flex items-center gap-1.5" title={lv?.name}>
                                          {lv && <span className="w-2 h-2 rounded-full" style={{ background: lv.color }} />}
                                          {fmt(r.avg)}
                                        </span>
                                      ) : '—'}
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </section>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </ClienteLayout>
  )
}
