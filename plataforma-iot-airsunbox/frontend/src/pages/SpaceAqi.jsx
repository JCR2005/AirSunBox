import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ClienteLayout from '../components/airsunbox/ClienteLayout'
import { spaces as spacesApi, variables as variablesApi } from '../services/api'
import {
  ArrowLeft, Save, ChevronUp, ChevronDown, ChevronRight, Check, Activity, RefreshCw,
  Plus, X, MessageSquareQuote, AlertCircle, Info
} from 'lucide-react'
import { spaceIcon, DEFAULT_CATS, DEFAULT_PHRASES, buildTram, toConfig, generateLabel, normalizeVarName } from './spaceUtils'

const COLORS = { primary: '#67B7E8' }
const MAX_CATS = 12
const MAX_VARS = 20

const UNIT_PRESETS = ['°C', '%', 'ppm', 'ppb', 'µg/m³', 'mg/m³', 'hPa', 'kPa', 'mm', 'km/h', 'm/s', 'kWh', 'W/m²', 'dB', 'Lux']

const PRESET_COLORS = [
  '#10B981', '#34D399', '#A3E635', '#FACC15', '#F59E0B', '#F97316',
  '#EF4444', '#DC2626', '#EC4899', '#8B5CF6', '#6366F1', '#3B82F6',
  '#67B7E8', '#0EA5E9', '#14B8A6', '#2BA8A0'
]

const STEPS = [
  { id: 'cats',   n: 1, title: 'Niveles',   hint: 'Cómo se califica el aire' },
  { id: 'vars',   n: 2, title: 'Variables', hint: 'Qué se mide y su prioridad' },
  { id: 'limits', n: 3, title: 'Límites',   hint: 'Dónde empieza cada nivel' },
]

const INPUT = 'w-full rounded-xl border px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--space-accent)]/30 focus:border-[var(--space-accent)]'
const inputStyle = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }

const fmt = (n) => (n == null || Number.isNaN(Number(n)) ? '…' : Number(n).toLocaleString('es-GT'))

// Muestra de color que abre la paleta en un popover: la paleta completa solo
// aparece cuando se va a cambiar el color, no en cada nivel a la vez.
function ColorSwatch({ color, onChange, label }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={`Cambiar color de ${label}`}
        aria-expanded={open}
        className="w-10 h-10 rounded-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--space-accent)]"
        style={{ background: color, boxShadow: `0 4px 14px ${color}55, inset 0 0 0 1px rgba(255,255,255,0.25)` }}
      />
      {open && (
        <div className="absolute z-40 left-0 top-12 w-[232px] rounded-2xl border p-3 shadow-2xl" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-8 gap-1.5">
            {PRESET_COLORS.map(hex => {
              const selected = color.toLowerCase() === hex.toLowerCase()
              return (
                <button
                  key={hex}
                  type="button"
                  title={hex}
                  onClick={() => { onChange(hex); setOpen(false) }}
                  className="w-6 h-6 rounded-md flex items-center justify-center transition-transform hover:scale-110"
                  style={{ background: hex, boxShadow: selected ? `0 0 0 2px var(--card), 0 0 0 4px ${hex}` : 'none' }}
                >
                  {selected && <Check size={11} strokeWidth={3.5} color="#fff" />}
                </button>
              )
            })}
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--text2)' }}>
            <input type="color" value={color} onChange={e => onChange(e.target.value)} className="w-7 h-7 rounded-md border-0 bg-transparent cursor-pointer p-0" />
            Otro color <span className="font-mono ml-auto" style={{ color: 'var(--text)' }}>{color.toUpperCase()}</span>
          </label>
        </div>
      )}
    </div>
  )
}

function IconButton({ onClick, disabled, title, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-25 disabled:pointer-events-none ${danger ? 'hover:bg-red-500/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
      style={{ color: danger ? '#EF4444' : 'var(--text2)' }}
    >
      {children}
    </button>
  )
}

function AddRow({ onClick, disabled, children, note }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full mt-3 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-3.5 text-sm font-semibold transition-colors hover:border-[var(--space-accent)] hover:text-[var(--space-accent)] disabled:opacity-40 disabled:pointer-events-none"
      style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
    >
      <Plus size={16} /> {children}
      {note && <span className="text-xs font-normal opacity-70">· {note}</span>}
    </button>
  )
}

export default function SpaceAqi() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [space, setSpace] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [numCats, setNumCats] = useState(3)
  const [cats, setCats] = useState([])
  const [vars, setVars] = useState([])              // [{ _id, name, unit, label, catalogLabel }]
  const [ranges, setRanges] = useState([])          // [{variable_label,cat_order,min_value,max_value}]
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [step, setStep] = useState('cats')         // cats | vars | limits
  const [openPhrases, setOpenPhrases] = useState(null)
  const [baseline, setBaseline] = useState(null)   // estado guardado, para detectar cambios
  const [triedSave, setTriedSave] = useState(false) // los campos vacíos se marcan recién al intentar guardar

  const openConfig = (cfg, cat) => {
    const nc = Math.max(cfg.categories.length, 2)
    setNumCats(nc)
    setCats(cfg.categories.map((x, i) => ({
      name: x.name, color: x.color, score_lo: x.score_lo, score_hi: x.score_hi,
      phrases: Array.isArray(x.phrases) ? x.phrases : [],
      _id: i
    })))

    // Solo variables LOCALES del espacio (creadas por esta empresa).
    // Las de la plantilla global no se auto-incluyen: cada org crea las suyas.
    const localSet = new Set(cat.filter(x => String(x.space_id) === String(id)).map(x => x.label))
    const list = cfg.variables
      .filter(v => localSet.has(v.variable_label))
      .map((v, i) => {
        const cv = cat.find(x => x.label === v.variable_label)
        return { _id: i, label: v.variable_label, catalogLabel: v.variable_label, stationKey: cv?.station_key || v.variable_label, name: cv?.name || v.variable_label, unit: cv?.unit || '' }
      })
    setVars(list)

    const rangeMap = {}
    cfg.ranges.forEach(r => {
      if (!rangeMap[r.variable_label]) rangeMap[r.variable_label] = {}
      rangeMap[r.variable_label][r.cat_order] = r.max_value
    })
    const builtRanges = []
    list.forEach(v => {
      for (let i = 0; i < nc; i++) {
        builtRanges.push({
          variable_label: v.label,
          cat_order: i + 1,
          min_value: i === 0 ? 0 : null,
          max_value: (rangeMap[v.label] && rangeMap[v.label][i + 1] != null)
            ? rangeMap[v.label][i + 1]
            : null
        })
      }
    })
    setRanges(builtRanges)
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true); setLoadError('')
      try {
        const [cfg, cat] = await Promise.all([
          spacesApi.config(id),
          variablesApi.list(id)
        ])
        if (!active) return
        setSpace(cfg)
        setCatalog(cat)
        openConfig(cfg.aqiConfig, cat)
      } catch (e) {
        if (active) setLoadError(e.message || 'No se pudo cargar la configuración')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [id])

  // Recalcula tramas y rangos cuando cambia la cantidad de categorías
  const rebuildFor = (n, nextCats) => {
    setNumCats(n)
    setCats(nextCats)
    if (nextCats.length === 0) { setRanges([]); return }
    const newRanges = []
    vars.forEach(v => {
      for (let i = 0; i < n; i++) {
        const catOrder = i + 1
        const prev = ranges.find(r => r.variable_label === v.label && r.cat_order === catOrder)
        newRanges.push({
          variable_label: v.label,
          cat_order: catOrder,
          min_value: i === 0 ? 0 : null,
          max_value: prev?.max_value ?? null
        })
      }
    })
    setRanges(newRanges)
  }

  const addCat = () => {
    if (cats.length >= MAX_CATS) return
    const n = cats.length + 1
    const next = buildTram(n).map((t, i) => ({
      ...(cats[i] || DEFAULT_CATS[i] || { name: `Nivel ${i + 1}`, color: '#10B981', phrases: [DEFAULT_PHRASES[i] || DEFAULT_PHRASES[5]] }),
      score_lo: t.score_lo, score_hi: t.score_hi, phrases: (cats[i]?.phrases) || DEFAULT_CATS[i]?.phrases || [DEFAULT_PHRASES[i] || DEFAULT_PHRASES[5]], _id: i
    }))
    rebuildFor(n, next)
  }

  const removeCat = (i) => {
    if (cats.length <= 1) return
    const n = cats.length - 1
    const next = buildTram(n).map((t, j) => {
      const c = cats[j < i ? j : j + 1]
      return { name: c.name, color: c.color, score_lo: t.score_lo, score_hi: t.score_hi, phrases: c.phrases || [], _id: j }
    })
    rebuildFor(n, next)
  }

  const addVar = () => {
    if (vars.length >= MAX_VARS) return
    const card = { _id: Date.now(), name: '', unit: '', label: '', catalogLabel: null }
    setVars([...vars, card])
    const extra = []
    for (let i = 0; i < numCats; i++) {
      extra.push({ variable_label: '', cat_order: i + 1, min_value: i === 0 ? 0 : null, max_value: null })
    }
    setRanges([...ranges, ...extra])
  }

  const updateVar = (_id, patch) => {
    const card = vars.find(v => v._id === _id)
    if (!card) return
    if (patch.name !== undefined) {
      const oldLabel = card.label
      const newLabel = generateLabel(patch.name.trim())
      if (oldLabel !== newLabel) {
        setRanges(rs => rs.map(r => r.variable_label === oldLabel ? { ...r, variable_label: newLabel } : r))
        patch.label = newLabel
      }
    }
    setVars(vars.map(v => v._id === _id ? { ...v, ...patch } : v))
  }

  const removeVar = (_id) => {
    const card = vars.find(v => v._id === _id)
    if (!card) return
    setVars(vars.filter(v => v._id !== _id))
    setRanges(ranges.filter(r => r.variable_label !== card.label))
  }

  const moveVar = (idx, dir) => {
    const a = [...vars]
    const b = idx + dir
    if (b < 0 || b >= a.length) return
    ;[a[idx], a[b]] = [a[b], a[idx]]
    setVars(a)
  }

  const setRangeMax = (label, catOrder, val) => {
    setRanges(ranges.map(r =>
      r.variable_label === label && r.cat_order === catOrder
        ? { ...r, max_value: val === '' ? null : Number(val) }
        : r
    ))
  }

  // Validación de límites: cada max debe superar al anterior (orden estrictamente creciente)
  const rangeErrors = {}
  for (const v of vars) {
    let prevMax = null
    let prevSet = false
    for (let i = 0; i < cats.length - 1; i++) {
      const r = ranges.find(x => x.variable_label === v.label && x.cat_order === i + 1)
      const val = r?.max_value ?? null
      const key = v.label + ':' + (i + 1)
      if (val == null || Number.isNaN(Number(val))) {
        rangeErrors[key] = 'req'
      } else if (prevSet && Number(val) <= prevMax) {
        rangeErrors[key] = prevMax
      } else {
        prevMax = Number(val)
        prevSet = true
      }
    }
  }

  const validate = () => {
    if (cats.length === 0) return 'Agregá al menos un nivel al índice.'
    if (vars.length === 0) return 'Agregá al menos una variable y definí sus límites para poder guardar el índice.'
    for (const v of vars) {
      if (!v.name.trim()) {
        const n = vars.indexOf(v) + 1
        return `La variable ${n} necesita un nombre.`
      }
    }
    const seen = new Set()
    for (const v of vars) {
      if (!v.label) return 'Todas las variables necesitan un nombre válido (el identificador se genera desde el nombre).'
      if (seen.has(v.label)) return `Dos variables quedaron con el identificador "${v.label}". Cambiá un nombre.`
      seen.add(v.label)
    }
    for (const v of vars) {
      for (let i = 0; i < cats.length - 1; i++) {
        if (!rangeErrors[v.label + ':' + (i + 1)]) continue
        return 'Revisá los límites: completá el valor de cada nivel (menos el último) y que cada uno sea mayor que el anterior. Los que faltan están marcados en rojo.'
      }
    }
    return null
  }

  const save = async () => {
    const check = validate()
    if (check) {
      setSaveErr(check); setMsg(''); setTriedSave(true)
      // Lleva al paso donde está el problema
      setStep(issues.cats ? 'cats' : issues.vars ? 'vars' : 'limits')
      return
    }
    setSaving(true); setMsg(''); setSaveErr('')
    try {
      const nextCatalog = [...catalog]
      const locals = catalog.filter(x => String(x.space_id) === String(id))
      const remap = {}
      for (const v of vars) {
        const name = v.name.trim()
        const unit = v.unit.trim()
        const norm = normalizeVarName(name)
        // Reutilizar una variable local existente: por label actual, por label generado o por nombre normalizado.
        const match = locals.find(x => x.label === v.catalogLabel)
          || locals.find(x => x.label === generateLabel(name) || x.station_key === generateLabel(name))
          || locals.find(x => normalizeVarName(x.name) === norm)
        if (match) {
          const target = match.label
          const changed = v.catalogLabel !== target || match.name !== name || (match.unit || '') !== unit
          if (changed) {
            await variablesApi.update(target, { name, unit })
          }
          remap[v.label] = target
          v.catalogLabel = target
          v.stationKey = match.station_key || target
          continue
        }
        // Renombrada sin colisión → actualizar la fila existente (el label queda como id técnico).
        if (v.catalogLabel) {
          await variablesApi.update(v.catalogLabel, { name, unit })
          remap[v.label] = v.catalogLabel
          continue
        }
        // Variable nueva → crearla como variable local del espacio
        const created = await variablesApi.create({ name, unit, label: generateLabel(name), space_id: id })
        nextCatalog.push(created)
        remap[v.label] = created.label
        v.catalogLabel = created.label
        v.stationKey = created.station_key || created.label
      }
      setCatalog(nextCatalog)

      // Aplicar el label canónico (reutilizado/renombrado) a variables y rangos antes de guardar
      const configVars = vars.map(v => ({ ...v, label: remap[v.label] || v.label }))
      const configRanges = ranges.map(r => ({ ...r, variable_label: remap[r.variable_label] || r.variable_label }))
      const res = await spacesApi.saveConfig(id, toConfig(cats, configVars, configRanges))
      setSpace(res)
      // El backend puede haber asignado otro identificador (p. ej. temperatura-2):
      // la pantalla muestra el real, que es el que se programa en la estación.
      setVars(configVars)
      setRanges(configRanges)
      setBaseline(stateKeyRef.current)
      setMsg('Configuración guardada correctamente.')
    } catch (e) {
      setSaveErr('No se pudo guardar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const completed = {
    cats: cats.length > 0,
    vars: vars.length > 0,
    limits: vars.length > 0 && cats.length > 0 && vars.every(v => {
      for (let i = 0; i < cats.length - 1; i++) {
        if (rangeErrors[v.label + ':' + (i + 1)]) return false
      }
      return true
    })
  }

  const accent = (space && space.color) || COLORS.primary

  // ── Estado derivado para la interfaz ─────────────────────────────
  const stateKey = JSON.stringify({
    c: cats.map(({ name, color, phrases }) => ({ name, color, phrases })),
    v: vars.map(v => [v.name, v.unit]),
    r: ranges.map(r => [vars.findIndex(v => v.label === r.variable_label), r.cat_order, r.max_value])
  })
  const stateKeyRef = useRef(stateKey)
  stateKeyRef.current = stateKey
  useEffect(() => {
    if (!loading && space && baseline === null) setBaseline(stateKey)
  }, [loading, space, baseline, stateKey])
  const dirty = baseline !== null && stateKey !== baseline

  useEffect(() => {
    if (!dirty) return
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const dupLabels = new Set(vars.filter(v => v.label && vars.some(o => o !== v && o.label === v.label)).map(v => v.label))
  const issues = {
    cats: (cats.length === 0 ? 1 : 0) + cats.filter(c => !c.name.trim()).length,
    vars: (vars.length === 0 ? 1 : 0) + vars.filter(v => !v.name.trim() || dupLabels.has(v.label)).length,
    limits: vars.length === 0 ? 1 : Object.keys(rangeErrors).length
  }
  const done = {
    cats: completed.cats && issues.cats === 0,
    vars: completed.vars && issues.vars === 0,
    limits: completed.limits
  }

  const patchCat = (i, patch) => setCats(cats.map((x, j) => j === i ? { ...x, ...patch } : x))
  const maxOf = (label, catOrder) => ranges.find(r => r.variable_label === label && r.cat_order === catOrder)?.max_value ?? null
  const stepIdx = STEPS.findIndex(s => s.id === step)

  useEffect(() => {
    if (!msg && !saveErr) return
    const t = setTimeout(() => { setMsg(''); setSaveErr('') }, saveErr ? 9000 : 4500)
    return () => clearTimeout(t)
  }, [msg, saveErr])

  return (
    <ClienteLayout>
      <div className="min-h-full page-bg" style={{ ['--space-accent']: accent }}>

        {/* Barra superior fija: contexto y guardado siempre a mano */}
        <div className="sticky top-0 z-30 border-b px-4 md:px-8 py-3 backdrop-blur-md" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 82%, transparent)' }}>
          <div className="flex items-center gap-3">
            <IconButton onClick={() => navigate(`/espacios/${id}`)} title={`Volver a ${space?.name || 'espacio'}`}>
              <ArrowLeft size={17} />
            </IconButton>
            {space && (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ background: accent }}>
                {spaceIcon(space.icon, space.type, 18)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg md:text-xl font-bold leading-tight truncate" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
                Índice de calidad
              </h1>
              <p className="text-xs truncate" style={{ color: 'var(--text2)' }}>{space?.name || 'Cargando…'}</p>
            </div>
            {space && (
              <>
                <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium" style={{ color: dirty ? '#D97706' : 'var(--text2)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: dirty ? '#F59E0B' : '#10B981' }} />
                  {dirty ? 'Cambios sin guardar' : 'Todo guardado'}
                </span>
                <button
                  onClick={save}
                  disabled={saving || !dirty}
                  className="flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed"
                  style={{ background: accent, boxShadow: dirty ? `0 6px 18px ${accent}55` : 'none' }}
                >
                  {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                  <span className="hidden sm:inline">{saving ? 'Guardando…' : 'Guardar'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="px-4 py-6 md:px-8 md:py-8">
          {loading && !space ? (
            <div className="text-center py-16 text-sm flex items-center justify-center" style={{ color: 'var(--text2)' }}>
              <RefreshCw size={16} className="animate-spin mr-2" /> Cargando configuración…
            </div>
          ) : !space && loadError ? (
            <div className="text-center py-16">
              <p className="text-sm font-medium" style={{ color: 'var(--text2)' }}>{loadError}</p>
              <button onClick={() => navigate(`/espacios/${id}`)} className="mt-4 text-sm font-bold" style={{ color: accent }}>Volver al espacio</button>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] items-start">

              {/* ── Editor por pasos ─────────────────────────────── */}
              <div className="rounded-3xl border min-w-0" style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
                <nav className="grid grid-cols-3 border-b" style={{ borderColor: 'var(--border)' }} aria-label="Pasos de la configuración">
                  {STEPS.map((s, i) => {
                    const active = step === s.id
                    const ok = done[s.id]
                    const n = issues[s.id]
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStep(s.id)}
                        aria-current={active ? 'step' : undefined}
                        className={`relative flex items-center gap-3 px-3 md:px-5 py-4 text-left transition-colors ${i === 0 ? 'rounded-tl-3xl' : ''} ${i === STEPS.length - 1 ? 'rounded-tr-3xl' : ''}`}
                        style={{ background: active ? accent + '12' : 'transparent' }}
                      >
                        <span
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors"
                          style={ok
                            ? { background: '#10B981', color: '#fff' }
                            : active ? { background: accent, color: '#fff' } : { background: 'var(--bg)', color: 'var(--text2)', boxShadow: 'inset 0 0 0 1px var(--border)' }}
                        >
                          {ok ? <Check size={15} strokeWidth={3} /> : s.n}
                        </span>
                        <span className="min-w-0 hidden sm:block">
                          <span className="block text-sm font-bold truncate" style={{ color: active ? 'var(--text)' : 'var(--text2)' }}>{s.title}</span>
                          <span className="block text-xs truncate" style={{ color: 'var(--text2)' }}>
                            {!ok && n > 0 && baseline !== null ? `${n} por resolver` : s.hint}
                          </span>
                        </span>
                        <span className="sm:hidden text-xs font-bold" style={{ color: active ? 'var(--text)' : 'var(--text2)' }}>{s.title}</span>
                        {active && <span className="absolute left-4 right-4 -bottom-px h-0.5 rounded-full" style={{ background: accent }} />}
                      </button>
                    )
                  })}
                </nav>

                <div className="p-4 md:p-6">
                  {/* Paso 1: niveles */}
                  {step === 'cats' && (
                    <section aria-labelledby="paso-niveles">
                      <h2 id="paso-niveles" className="text-lg font-bold" style={{ color: 'var(--text)' }}>Niveles del índice</h2>
                      <p className="text-sm mt-1 mb-5 max-w-2xl" style={{ color: 'var(--text2)' }}>
                        Cada nivel es una calificación del aire. El nivel 1 es el mejor y el puntaje de 0 a 100 se reparte en partes iguales.
                      </p>
                      <div className="space-y-2.5">
                        {cats.map((c, i) => {
                          const open = openPhrases === c._id
                          const count = (c.phrases || []).filter(p => p.trim()).length
                          return (
                            <div key={c._id} className="rounded-2xl border transition-colors" style={{ borderColor: !c.name.trim() && triedSave ? '#EF4444' : open ? c.color + '80' : 'var(--border)', background: 'var(--bg)' }}>
                              <div className="flex items-center gap-3 p-3">
                                <span className="w-5 text-center text-xs font-bold tabular-nums shrink-0" style={{ color: 'var(--text2)' }}>{i + 1}</span>
                                <ColorSwatch color={c.color} label={c.name || `nivel ${i + 1}`} onChange={hex => patchCat(i, { color: hex })} />
                                <div className="flex-1 min-w-0">
                                  <input
                                    value={c.name}
                                    onChange={e => patchCat(i, { name: e.target.value })}
                                    placeholder={`Nombre del nivel ${i + 1}`}
                                    aria-label={`Nombre del nivel ${i + 1}`}
                                    className="w-full bg-transparent text-base font-semibold outline-none rounded-md px-1.5 -mx-1.5 py-0.5 focus:ring-2 focus:ring-[var(--space-accent)]/40"
                                    style={{ color: 'var(--text)' }}
                                  />
                                  <p className="text-xs" style={{ color: 'var(--text2)' }}>Puntaje {c.score_lo} – {c.score_hi}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setOpenPhrases(open ? null : c._id)}
                                  aria-expanded={open}
                                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
                                  style={{ color: open ? 'var(--text)' : 'var(--text2)' }}
                                >
                                  <MessageSquareQuote size={15} />
                                  <span className="hidden md:inline">{count === 1 ? '1 frase' : `${count} frases`}</span>
                                  <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                                </button>
                                <IconButton danger onClick={() => removeCat(i)} disabled={cats.length <= 1}
                                  title={cats.length <= 1 ? 'El índice necesita al menos un nivel' : `Quitar el nivel ${c.name || i + 1}`}>
                                  <X size={15} />
                                </IconButton>
                              </div>
                              {open && (
                                <div className="px-3 pb-4 sm:pl-[5.5rem]">
                                  <p className="text-xs mb-2" style={{ color: 'var(--text2)' }}>
                                    Recomendaciones que ve el usuario cuando una estación está en este nivel. Si hay varias, se alternan.
                                  </p>
                                  <div className="space-y-2">
                                    {(c.phrases || []).map((ph, k) => (
                                      <div key={k} className="flex items-center gap-2">
                                        <input
                                          value={ph}
                                          onChange={e => patchCat(i, { phrases: c.phrases.map((x, q) => q === k ? e.target.value : x) })}
                                          placeholder="Ej.: Personas con asma deben limitar el esfuerzo prolongado."
                                          aria-label={`Frase ${k + 1} del nivel ${c.name || i + 1}`}
                                          className={INPUT}
                                          style={{ ...inputStyle, background: 'var(--card)' }}
                                        />
                                        <IconButton danger title="Quitar frase" onClick={() => patchCat(i, { phrases: c.phrases.filter((_, q) => q !== k) })}>
                                          <X size={14} />
                                        </IconButton>
                                      </div>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => patchCat(i, { phrases: [...(c.phrases || []), ''] })}
                                    className="mt-2 flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
                                    style={{ color: accent }}
                                  >
                                    <Plus size={14} /> Agregar frase
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <AddRow onClick={addCat} disabled={cats.length >= MAX_CATS} note={`${cats.length} de ${MAX_CATS}`}>Agregar nivel</AddRow>
                    </section>
                  )}

                  {/* Paso 2: variables */}
                  {step === 'vars' && (
                    <section aria-labelledby="paso-variables">
                      <h2 id="paso-variables" className="text-lg font-bold" style={{ color: 'var(--text)' }}>Variables del índice</h2>
                      <p className="text-sm mt-1 mb-5 max-w-2xl" style={{ color: 'var(--text2)' }}>
                        Lo que miden las estaciones para calcular el índice. Ordenalas por importancia: la de arriba pesa más.
                      </p>
                      <datalist id="aqi-unidades">
                        {UNIT_PRESETS.map(u => <option key={u} value={u} />)}
                      </datalist>
                      {vars.length > 0 && (
                        <div className="hidden sm:grid grid-cols-[2rem_minmax(0,1fr)_8.5rem_6.5rem] gap-3 px-3 mb-2 text-xs font-semibold" style={{ color: 'var(--text2)' }}>
                          <span>#</span><span>Nombre</span><span>Unidad</span><span className="text-right">Orden</span>
                        </div>
                      )}
                      <div className="space-y-2.5">
                        {vars.map((v, i) => {
                          const dup = dupLabels.has(v.label)
                          return (
                            <div key={v._id} className="rounded-2xl border p-3" style={{ borderColor: (dup || (!v.name.trim() && triedSave)) ? '#EF4444' : 'var(--border)', background: 'var(--bg)' }}>
                              <div className="grid grid-cols-[2rem_minmax(0,1fr)] sm:grid-cols-[2rem_minmax(0,1fr)_8.5rem_6.5rem] gap-3 items-center">
                                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums" style={{ background: accent + '1A', color: accent }}>{i + 1}</span>
                                <div className="min-w-0">
                                  <input
                                    value={v.name}
                                    onChange={e => updateVar(v._id, { name: e.target.value })}
                                    placeholder="Ej.: Temperatura"
                                    aria-label={`Nombre de la variable ${i + 1}`}
                                    className={INPUT}
                                    style={inputStyle}
                                  />
                                </div>
                                <input
                                  value={v.unit}
                                  onChange={e => updateVar(v._id, { unit: e.target.value })}
                                  list="aqi-unidades"
                                  placeholder="Unidad"
                                  aria-label={`Unidad de la variable ${i + 1}`}
                                  className={`${INPUT} col-start-2 sm:col-start-auto`}
                                  style={inputStyle}
                                />
                                <div className="flex items-center justify-end gap-0.5 col-start-2 sm:col-start-auto">
                                  <IconButton onClick={() => moveVar(i, -1)} disabled={i === 0} title="Subir prioridad"><ChevronUp size={16} /></IconButton>
                                  <IconButton onClick={() => moveVar(i, 1)} disabled={i === vars.length - 1} title="Bajar prioridad"><ChevronDown size={16} /></IconButton>
                                  <IconButton danger onClick={() => removeVar(v._id)} title="Quitar del índice (la variable sigue existiendo)"><X size={15} /></IconButton>
                                </div>
                              </div>
                              {(v.label || dup) && (
                                <p className="text-xs mt-2 sm:pl-11" style={{ color: dup ? '#EF4444' : 'var(--text2)' }}>
                                  {dup
                                    ? 'Otra variable ya usa este nombre. Cambiá uno de los dos.'
                                    : <>La estación la envía como <span className="font-mono font-semibold" style={{ color: 'var(--text)' }}>{v.catalogLabel ? (v.stationKey || v.label) : v.label}</span></>}
                                </p>
                              )}
                            </div>
                          )
                        })}
                        {vars.length === 0 && (
                          <div className="text-center py-10 rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                            <Activity size={24} className="mx-auto mb-2" style={{ color: accent }} />
                            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Todavía no hay variables</p>
                            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>Sin variables el índice no se puede calcular.</p>
                          </div>
                        )}
                      </div>
                      <AddRow onClick={addVar} disabled={vars.length >= MAX_VARS} note={`${vars.length} de ${MAX_VARS}`}>Agregar variable</AddRow>
                      <p className="flex items-start gap-2 text-xs mt-4" style={{ color: 'var(--text2)' }}>
                        <Info size={14} className="shrink-0 mt-0.5" />
                        Las variables nuevas quedan disponibles para las estaciones del espacio, en «Editar variables» de cada estación.
                      </p>
                    </section>
                  )}

                  {/* Paso 3: límites */}
                  {step === 'limits' && (
                    <section aria-labelledby="paso-limites">
                      <h2 id="paso-limites" className="text-lg font-bold" style={{ color: 'var(--text)' }}>Límites de cada variable</h2>
                      <p className="text-sm mt-1 mb-5 max-w-2xl" style={{ color: 'var(--text2)' }}>
                        Escribí hasta qué valor llega cada nivel. El siguiente empieza donde termina el anterior y el último queda abierto.
                      </p>
                      {vars.length === 0 ? (
                        <div className="text-center py-10 rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Primero agregá variables</p>
                          <button onClick={() => setStep('vars')} className="mt-3 text-sm font-bold inline-flex items-center gap-1" style={{ color: accent }}>
                            Ir a variables <ChevronRight size={15} />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {vars.map((v, vIdx) => {
                            const pending = cats.slice(0, -1).filter((_, i) => rangeErrors[v.label + ':' + (i + 1)]).length
                            return (
                              <div key={v._id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                                <div className="flex items-center justify-between gap-3 mb-3">
                                  <h3 className="font-semibold truncate" style={{ color: 'var(--text)' }}>
                                    {v.name || `Variable ${vIdx + 1}`}
                                    {v.unit && <span className="font-normal ml-1.5 text-sm" style={{ color: 'var(--text2)' }}>({v.unit})</span>}
                                  </h3>
                                  <span className="flex items-center gap-1.5 text-xs font-semibold shrink-0" style={{ color: pending ? '#D97706' : '#10B981' }}>
                                    {pending ? <AlertCircle size={14} /> : <Check size={14} />}
                                    {pending ? `${pending} por completar` : 'Completo'}
                                  </span>
                                </div>
                                <div className="overflow-x-auto -mx-1 px-1 pb-1">
                                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cats.length}, minmax(112px, 1fr))` }}>
                                    {cats.map((c, i) => {
                                      const last = i === cats.length - 1
                                      const lo = i === 0 ? 0 : maxOf(v.label, i)
                                      const val = maxOf(v.label, i + 1)
                                      const err = rangeErrors[v.label + ':' + (i + 1)]
                                      const showErr = err && (val != null || triedSave)
                                      return (
                                        <div key={c._id} className="rounded-xl overflow-hidden border" style={{ borderColor: showErr ? '#EF4444' : 'var(--border)', background: 'var(--card)' }}>
                                          <div className="h-1.5" style={{ background: c.color }} />
                                          <div className="p-2.5">
                                            <p className="text-xs font-semibold truncate" style={{ color: c.color }}>{c.name || `Nivel ${i + 1}`}</p>
                                            {last ? (
                                              <>
                                                <p className="text-sm font-semibold mt-2 py-1.5" style={{ color: 'var(--text)' }}>Más de {fmt(lo)}</p>
                                                <p className="text-xs" style={{ color: 'var(--text2)' }}>Sin límite</p>
                                              </>
                                            ) : (
                                              <>
                                                <label className="sr-only" htmlFor={`lim-${v._id}-${i}`}>Máximo de {c.name} para {v.name}</label>
                                                <input
                                                  id={`lim-${v._id}-${i}`}
                                                  type="number"
                                                  inputMode="decimal"
                                                  placeholder="Hasta…"
                                                  value={val ?? ''}
                                                  onChange={e => setRangeMax(v.label, i + 1, e.target.value)}
                                                  className="w-full mt-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold outline-none tabular-nums transition-all focus:ring-2 focus:ring-[var(--space-accent)]/30 focus:border-[var(--space-accent)]"
                                                  style={{ ...inputStyle, borderColor: showErr ? '#EF4444' : 'var(--border)' }}
                                                />
                                                <p className="text-xs mt-1 truncate" style={{ color: showErr ? '#EF4444' : 'var(--text2)' }}>
                                                  {showErr ? (err === 'req' ? 'Falta este valor' : `Debe superar ${fmt(err)}`) : `Desde ${fmt(lo)}`}
                                                </p>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </section>
                  )}

                  {/* Navegación entre pasos */}
                  <div className="flex items-center justify-between gap-3 mt-8 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => stepIdx > 0 ? setStep(STEPS[stepIdx - 1].id) : navigate(`/espacios/${id}`)}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
                    >
                      {stepIdx > 0 ? 'Anterior' : 'Cancelar'}
                    </button>
                    {stepIdx < STEPS.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setStep(STEPS[stepIdx + 1].id)}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-105"
                        style={{ background: accent }}
                      >
                        Siguiente: {STEPS[stepIdx + 1].title} <ChevronRight size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={save}
                        disabled={saving || !dirty}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-105 disabled:opacity-45 disabled:cursor-not-allowed"
                        style={{ background: accent }}
                      >
                        {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                        {saving ? 'Guardando…' : 'Guardar configuración'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Vista previa en vivo ─────────────────────────── */}
              <aside className="xl:sticky xl:top-24 space-y-4" aria-label="Vista previa del índice">
                <div className="rounded-3xl border p-5 md:p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Así se verá el índice</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>Se actualiza mientras editás.</p>

                  {cats.length > 0 ? (
                    <>
                      <div className="mt-5 flex h-4 rounded-full overflow-hidden" style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}>
                        {cats.map(c => (
                          <div key={c._id} title={`${c.name} (${c.score_lo}–${c.score_hi})`} className="h-full transition-all duration-300" style={{ background: c.color, flex: c.score_hi - c.score_lo + 1 }} />
                        ))}
                      </div>
                      <div className="relative h-4 mt-1 text-[11px] tabular-nums" style={{ color: 'var(--text2)' }}>
                        {cats.map(c => (
                          <span key={c._id} className="absolute -translate-x-1/2 first:translate-x-0" style={{ left: `${c.score_lo}%` }}>{c.score_lo}</span>
                        ))}
                        <span className="absolute right-0">100</span>
                      </div>

                      <ol className="mt-5 space-y-3">
                        {cats.map((c, i) => {
                          const phrase = (c.phrases || []).find(p => p.trim())
                          return (
                            <li key={c._id} className="flex gap-3">
                              <span className="w-1 rounded-full shrink-0" style={{ background: c.color }} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{c.name || `Nivel ${i + 1}`}</span>
                                  <span className="text-xs tabular-nums shrink-0" style={{ color: 'var(--text2)' }}>{c.score_lo}–{c.score_hi}</span>
                                </div>
                                <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text2)' }}>
                                  {phrase || <span className="italic opacity-70">Sin recomendación</span>}
                                </p>
                              </div>
                            </li>
                          )
                        })}
                      </ol>
                    </>
                  ) : (
                    <p className="text-sm mt-5" style={{ color: 'var(--text2)' }}>Agregá un nivel para ver la escala.</p>
                  )}
                </div>

                <div className="rounded-3xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                  <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text)' }}>Estado de la configuración</h2>
                  <ul className="space-y-2.5">
                    {STEPS.map(s => {
                      const ok = done[s.id]
                      const detail = s.id === 'cats' ? `${cats.length} ${cats.length === 1 ? 'nivel' : 'niveles'}`
                        : s.id === 'vars' ? `${vars.length} ${vars.length === 1 ? 'variable' : 'variables'}`
                        : ok ? 'Completos' : vars.length ? `${issues.limits} por completar` : 'Faltan variables'
                      return (
                        <li key={s.id}>
                          <button type="button" onClick={() => setStep(s.id)} className="w-full flex items-center gap-2.5 text-sm text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/5">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={ok ? { background: '#10B981', color: '#fff' } : { background: 'rgba(245,158,11,0.15)', color: '#D97706' }}>
                              {ok ? <Check size={12} strokeWidth={3} /> : <AlertCircle size={12} />}
                            </span>
                            <span className="font-medium" style={{ color: 'var(--text)' }}>{s.title}</span>
                            <span className="ml-auto text-xs" style={{ color: ok ? 'var(--text2)' : '#D97706' }}>{detail}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="text-xs mt-4 pt-3 border-t" style={{ color: 'var(--text2)', borderColor: 'var(--border)' }}>
                    Al guardar, el índice de las estaciones del espacio se recalcula con esta configuración.
                  </p>
                </div>
              </aside>
            </div>
          )}
        </div>

        {(msg || saveErr) && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md" role={saveErr ? 'alert' : 'status'}>
            <div
              className="rounded-2xl px-4 py-3.5 text-sm font-medium flex items-center gap-3 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-5 fade-in duration-300"
              style={{
                background: saveErr ? 'rgba(239,68,68,0.14)' : 'rgba(16,185,129,0.14)',
                color: saveErr ? '#EF4444' : '#10B981',
                border: '1px solid ' + (saveErr ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.35)')
              }}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: saveErr ? '#EF4444' : '#10B981', color: 'white' }}>
                {saveErr ? <X size={13} /> : <Check size={13} />}
              </span>
              <span className="flex-1">{saveErr || msg}</span>
              <button onClick={() => { setMsg(''); setSaveErr('') }} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0" style={{ color: 'currentColor' }} title="Cerrar">
                <X size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </ClienteLayout>
  )
}
