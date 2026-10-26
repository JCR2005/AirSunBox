import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ClienteLayout from '../components/sanik/ClienteLayout'
import { spaces as spacesApi, variables as variablesApi } from '../services/api'
import {
  ArrowLeft, Save, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check, Activity, RefreshCw,
  Gauge, Plus, X, Palette, ListChecks, SlidersHorizontal, Sparkles
} from 'lucide-react'
import { spaceIcon, DEFAULT_CATS, DEFAULT_PHRASES, buildTram, toConfig, generateLabel, normalizeVarName } from './spaceUtils'

const COLORS = { primary: '#67B7E8' }
const MAX_CATS = 12

const UNIT_PRESETS = ['°C', '%', 'ppm', 'ppb', 'µg/m³', 'mg/m³', 'hPa', 'kPa', 'mm', 'km/h', 'm/s', 'kWh', 'W/m²', 'dB', 'Lux']

function UnitChips({ unit, onPick, accent }) {
  const ref = useRef(null)
  const [hintRight, setHintRight] = useState(true)
  const [hintLeft, setHintLeft] = useState(false)

  const update = () => {
    const el = ref.current
    if (!el) return
    setHintRight(el.scrollWidth - el.scrollLeft - el.clientWidth > 8)
    setHintLeft(el.scrollLeft > 4)
  }

  const scrollBy = (dir) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * 160, behavior: 'smooth' })
  }

  useEffect(() => { update() }, [])

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={update}
        className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {UNIT_PRESETS.map(u => (
          <button
            key={u}
            onClick={() => onPick(u)}
            className="px-2 py-1 rounded-md text-[10px] font-bold border transition-all shrink-0 hover:opacity-80"
            style={unit === u
              ? { background: accent + '1F', color: accent, borderColor: accent + '55' }
              : { background: 'var(--bg)', color: 'var(--text2)', borderColor: 'var(--border)' }}
          >
            {u}
          </button>
        ))}
      </div>
      {hintRight && (
        <button
          onClick={() => scrollBy(1)}
          title="Ver más unidades"
          className="absolute right-0 top-0 bottom-0 w-9 flex items-center justify-end rounded-r-md transition-all hover:opacity-80"
          style={{ background: 'linear-gradient(to left, var(--bg) 35%, transparent)' }}
        >
          <ChevronRight size={14} className="animate-pulse" style={{ color: 'var(--text2)' }} />
        </button>
      )}
      {hintLeft && (
        <button
          onClick={() => scrollBy(-1)}
          title="Ver unidades anteriores"
          className="absolute left-0 top-0 bottom-0 w-9 flex items-center justify-start rounded-l-md transition-all hover:opacity-80"
          style={{ background: 'linear-gradient(to right, var(--bg) 35%, transparent)' }}
        >
          <ChevronLeft size={14} className="animate-pulse" style={{ color: 'var(--text2)' }} />
        </button>
      )}
    </div>
  )
}

const PRESET_COLORS = [
  '#10B981', '#34D399', '#A3E635', '#FACC15', '#F59E0B', '#F97316',
  '#EF4444', '#DC2626', '#EC4899', '#8B5CF6', '#6366F1', '#3B82F6',
  '#67B7E8', '#0EA5E9', '#14B8A6', '#2BA8A0'
]

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
        return { _id: i, label: v.variable_label, catalogLabel: v.variable_label, name: cv?.name || v.variable_label, unit: cv?.unit || '' }
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
    if (vars.length >= 20) return
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
    if (cats.length === 0) return 'Agregá al menos una categoría para que el índice tenga niveles.'
    if (vars.length === 0) return 'Agregá al menos una variable y definí sus límites para poder guardar el índice.'
    for (const v of vars) {
      if (!v.name.trim()) {
        const n = vars.indexOf(v) + 1
        return `La variable ${n} necesita un nombre antes de guardar.`
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
        return 'Revisá los límites: cada categoría (excepto la última) necesita un max y deben ir en orden creciente sin repetirse. Las celdas con error están en rojo.'
      }
    }
    return null
  }

  const save = async () => {
    const check = validate()
    if (check) { setSaveErr(check); setMsg(''); return }
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
          || locals.find(x => x.label === generateLabel(name))
          || locals.find(x => normalizeVarName(x.name) === norm)
        if (match) {
          const target = match.label
          const changed = v.catalogLabel !== target || match.name !== name || (match.unit || '') !== unit
          if (changed) {
            await variablesApi.update(target, { name, unit })
          }
          remap[v.label] = target
          v.catalogLabel = target
          continue
        }
        // Renombrada sin colisión → actualizar la fila existente (el label queda como id técnico).
        if (v.catalogLabel) {
          await variablesApi.update(v.catalogLabel, { name, unit })
          remap[v.label] = v.catalogLabel
          continue
        }
        // Variable nueva → crearla como variable local del espacio
        const created = await variablesApi.create({ name, unit, space_id: id })
        nextCatalog.push(created)
        remap[v.label] = created.label
        v.catalogLabel = created.label
      }
      setCatalog(nextCatalog)

      // Aplicar el label canónico (reutilizado/renombrado) a variables y rangos antes de guardar
      const configVars = vars.map(v => ({ ...v, label: remap[v.label] || v.label }))
      const configRanges = ranges.map(r => ({ ...r, variable_label: remap[r.variable_label] || r.variable_label }))
      const res = await spacesApi.saveConfig(id, toConfig(cats, configVars, configRanges))
      setSpace(res)
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

  useEffect(() => {
    if (!msg && !saveErr) return
    const t = setTimeout(() => { setMsg(''); setSaveErr('') }, saveErr ? 9000 : 4500)
    return () => clearTimeout(t)
  }, [msg, saveErr])

  return (
    <ClienteLayout>
      <div className="min-h-full px-4 py-6 md:px-8 md:py-10 page-bg" style={{ ['--space-accent']: accent }}>

        <button onClick={() => navigate(`/espacios/${id}`)} className="flex items-center gap-2 text-sm font-semibold mb-6 transition-colors hover:opacity-80" style={{ color: 'var(--text2)' }}>
          <ArrowLeft size={16} /> Volver a {space?.name || 'espacio'}
        </button>

        {loading && !space ? (
          <div className="text-center py-12 text-sm flex items-center justify-center" style={{ color: 'var(--text2)' }}>
            <RefreshCw size={16} className="animate-spin mr-2" /> Cargando configuración...
          </div>
        ) : !space && loadError ? (
          <div className="text-center py-16">
            <p className="text-sm font-medium" style={{ color: 'var(--text2)' }}>{loadError}</p>
            <button onClick={() => navigate(`/espacios/${id}`)} className="mt-4 text-sm font-bold" style={{ color: accent }}>Volver al espacio</button>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="mb-8 rounded-3xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: `linear-gradient(135deg, ${accent}24 0%, rgba(43,168,160,0.06) 55%, ${accent}05 100%)` }}>
              <div className="p-6 md:p-7">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg" style={{ background: `linear-gradient(135deg,${accent},#2BA8A0)`, color: 'white' }}>
                      {spaceIcon(space.icon, space.type, 26)}
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
                        Índice de calidad
                      </h1>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: accent + '1F', color: accent }}>{space.name}</span>
                        <span className="text-[11px] font-mono uppercase" style={{ color: 'var(--text2)' }}>{space.slug}</span>
                        <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                          <Gauge size={12} /> AQI del espacio
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Vista previa del índice */}
                  {cats.length > 0 && (
                    <div className="w-full xl:max-w-md flex-shrink-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text2)' }}>
                          <Sparkles size={11} style={{ color: accent }} /> Vista previa del índice
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: accent }}>{cats.length} {cats.length === 1 ? 'categoría' : 'categorías'}</span>
                      </div>
                      <div className="flex h-5 rounded-full overflow-hidden border" style={{ borderColor: 'var(--border)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)' }}>
                        {cats.map(c => (
                          <div key={c._id} title={`${c.name} (${c.score_lo}–${c.score_hi})`} className="h-full transition-all duration-300" style={{ background: c.color, width: `calc(100% / ${cats.length})` }} />
                        ))}
                      </div>
                      <div className="flex mt-2 gap-2">
                        {cats.map(c => (
                          <span key={c._id} className="flex items-center gap-1 min-w-0 truncate text-[9px] font-semibold" style={{ color: c.color, flex: 1 }}>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                            <span className="truncate">{c.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {loadError && (
              <div className="mb-6 rounded-2xl px-4 py-3.5 text-sm font-medium flex items-center gap-2.5" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#EF4444', color: 'white' }}><X size={13} /></span>
                {loadError}
              </div>
            )}

            <div className="rounded-3xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
              <div className="p-5 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Configuración del índice</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                    Definí las categorías, las variables que participan y sus límites para calcular el AQI.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg" style={{ background: completed.cats ? 'rgba(16,185,129,0.12)' : accent + '1A', color: completed.cats ? '#10B981' : accent }}>{completed.cats ? <Check size={12} /> : <Palette size={12} />} Categorías</span>
                  <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg" style={{ background: completed.vars ? 'rgba(16,185,129,0.12)' : accent + '1A', color: completed.vars ? '#10B981' : accent }}>{completed.vars ? <Check size={12} /> : <ListChecks size={12} />} Variables</span>
                  <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg" style={{ background: completed.limits ? 'rgba(16,185,129,0.12)' : accent + '1A', color: completed.limits ? '#10B981' : accent }}>{completed.limits ? <Check size={12} /> : <SlidersHorizontal size={12} />} Límites</span>
                </div>
              </div>

              <div className="p-5 md:p-6 space-y-8">
                {/* 1. Categorías */}
                <section>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `linear-gradient(135deg,${accent},#2BA8A0)`, color: 'white' }}>1</span>
                      <div>
                        <h3 className="font-bold text-sm leading-tight" style={{ color: 'var(--text)' }}>Categorías del índice</h3>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text2)' }}>Tramas de 0 a 100 repartidas equitativamente. Nivel 1 = mejor.</p>
                        {vars.length === 0 && (
                          <p className="text-[11px] mt-2 rounded-xl px-3 py-2 font-semibold max-w-md" style={{ background: 'rgba(251,191,36,0.12)', color: '#B45309', border: '1px solid rgba(251,191,36,0.28)' }}>
                            Las categorías son los niveles del índice. Para que el AQI se calcule necesitás al menos una variable en el paso 2 y sus límites en el paso 3.
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={addCat}
                      disabled={cats.length >= MAX_CATS}
                      className="flex items-center gap-1.5 text-xs font-bold text-white px-3.5 py-2 rounded-xl transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                      style={{ background: `linear-gradient(135deg,${accent},#2BA8A0)`, boxShadow: `0 6px 16px ${accent}59` }}
                    >
                      <Plus size={13} /> Agregar categoría
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                    {cats.map((c, i) => (
                      <div key={c._id} className="group relative rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                        <div className="h-1.5 transition-colors" style={{ background: c.color }} />
                        <div className="p-4">
                          <button
                            onClick={() => removeCat(i)}
                            disabled={cats.length <= 1}
                            title={cats.length <= 1 ? 'Un índice necesita al menos 1 categoría' : 'Quitar categoría'}
                            className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center border transition-all hover:bg-red-500/10 disabled:opacity-20 disabled:pointer-events-none opacity-0 group-hover:opacity-100"
                            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: '#EF4444' }}
                          >
                            <X size={13} />
                          </button>
                          <div className="flex items-center justify-between mb-2 pr-6">
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text2)' }}>Nivel {i + 1}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: c.color + '1A', color: c.color }}>{c.score_lo} – {c.score_hi}</span>
                          </div>
                          <input
                            value={c.name}
                            onChange={e => setCats(cats.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                            className="w-full bg-transparent text-sm font-semibold outline-none rounded-lg px-0 py-1 transition-all focus:px-2 focus:ring-2 focus:ring-[var(--space-accent)]"
                            style={{ color: 'var(--text)' }}
                          />
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text2)' }}>Color</span>
                              <span className="text-[11px] font-mono" style={{ color: c.color }}>{c.color}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {PRESET_COLORS.map(hex => {
                                const selected = c.color.toLowerCase() === hex.toLowerCase()
                                return (
                                  <button
                                    key={hex}
                                    type="button"
                                    title={hex}
                                    onClick={() => setCats(cats.map((x, j) => j === i ? { ...x, color: hex } : x))}
                                    className="w-7 h-7 rounded-lg transition-all hover:scale-110 active:scale-90 flex items-center justify-center"
                                    style={{
                                      background: hex,
                                      border: '1px solid rgba(255,255,255,0.25)',
                                      boxShadow: selected
                                        ? `0 0 0 2px ${hex}, 0 0 0 3.5px rgba(0,0,0,0.35)`
                                        : 'none'
                                    }}
                                  >
                                    {selected && <Check size={12} strokeWidth={3.5} style={{ color: '#fff' }} />}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text2)' }}>Frases de recomendación</span>
                              <span className="text-[10px]" style={{ color: 'var(--text2)' }}>{c.phrases?.length || 0}</span>
                            </div>
                            <p className="text-[10px] mb-1.5" style={{ color: 'var(--text2)' }}>Se muestran al entrar a una estación cuando toca este nivel. Si ponés varias, rotan.</p>
                            <div className="space-y-1.5">
                              {(c.phrases || []).map((ph, k) => (
                                <div key={k} className="flex items-center gap-1.5">
                                  <input
                                    value={ph}
                                    onChange={e => {
                                      const next = (c.phrases || []).map((x, q) => q === k ? e.target.value : x)
                                      setCats(cats.map((x, j) => j === i ? { ...x, phrases: next } : x))
                                    }}
                                    className="flex-1 border rounded-lg px-2 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-[var(--space-accent)] transition-all"
                                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                                  />
                                  <button
                                    type="button"
                                    title="Quitar frase"
                                    onClick={() => {
                                      const next = (c.phrases || []).filter((_, q) => q !== k)
                                      setCats(cats.map((x, j) => j === i ? { ...x, phrases: next } : x))
                                    }}
                                    className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                                    style={{ color: '#EF4444' }}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...(c.phrases || []), '']
                                setCats(cats.map((x, j) => j === i ? { ...x, phrases: next } : x))
                              }}
                              className="mt-2 flex items-center gap-1 text-[11px] font-bold transition-all hover:opacity-80"
                              style={{ color: accent }}
                            >
                              <Plus size={12} /> Agregar frase
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {cats.length === 0 && (
                      <div className="col-span-full text-center py-10 rounded-2xl border border-dashed" style={{ borderColor: 'var(--border)' }}>
                        <Sparkles size={22} className="mx-auto mb-2 opacity-40" style={{ color: accent }} />
                        <p className="text-sm font-medium" style={{ color: 'var(--text2)' }}>Sin categorías</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>Hacé clic en "Agregar categoría" para empezar.</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* 2. Variables */}
                <section>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `linear-gradient(135deg,${accent},#2BA8A0)`, color: 'white' }}>2</span>
                      <div>
                        <h3 className="font-bold text-sm leading-tight" style={{ color: 'var(--text)' }}>Variables del índice</h3>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text2)' }}>Creá tus propias variables y ordená su prioridad (arriba pesa más). El identificador técnico se genera solo desde el nombre. Cada nueva variable quedará disponible para integrarse a las estaciones del espacio (en "Editar variables" de cada estación).</p>
                      </div>
                    </div>
                    <button
                      onClick={addVar}
                      disabled={vars.length >= 20}
                      className="flex items-center gap-1.5 text-xs font-bold text-white px-3.5 py-2 rounded-xl transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                      style={{ background: `linear-gradient(135deg,${accent},#2BA8A0)`, boxShadow: `0 6px 16px ${accent}59` }}
                    >
                      <Plus size={13} /> Agregar variable
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                    {vars.map((v, i) => {
                      const dup = vars.some(o => o !== v && o.label && o.label === v.label)
                      return (
                        <div key={v._id} className="group relative rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" style={{ borderColor: v.label && !dup ? 'var(--border)' : '#EF4444', background: 'var(--bg)' }}>
                          <div className="h-1.5 transition-colors" style={{ background: v.label && !dup ? `linear-gradient(90deg,${accent},#2BA8A0)` : '#EF4444' }} />
                          <div className="p-4">
                            <button
                              onClick={() => removeVar(v._id)}
                              title="Quitar del índice (no borra la variable del sistema)"
                              className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center border transition-all hover:bg-red-500/10 opacity-0 group-hover:opacity-100"
                              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: '#EF4444' }}
                            >
                              <X size={13} />
                            </button>
                            <div className="flex items-center justify-between mb-2 pr-6">
                              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text2)' }}>Variable {i + 1}</span>
                              <span className="flex items-center gap-1.5">
                                {v.catalogLabel && (
                                  <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(43,168,160,0.12)', color: '#2BA8A0', border: '1px solid rgba(43,168,160,0.3)' }}>priv</span>
                                )}
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md truncate" style={{ background: v.label ? accent + '1A' : 'rgba(0,0,0,0.04)', color: v.label ? accent : 'var(--text2)' }}>{v.label || 'id...'}</span>
                              </span>
                            </div>
                            <input
                              value={v.name}
                              onChange={e => updateVar(v._id, { name: e.target.value })}
                              placeholder="Nombre, ej. Temperatura"
                              className="w-full bg-transparent text-sm font-semibold outline-none rounded-lg px-0 py-1 transition-all focus:px-2 focus:ring-2 focus:ring-[var(--space-accent)]"
                              style={{ color: 'var(--text)' }}
                            />
                            <UnitChips unit={v.unit} accent={accent} onPick={u => updateVar(v._id, { unit: v.unit === u ? '' : u })} />
                            <input
                              value={v.unit}
                              onChange={e => updateVar(v._id, { unit: e.target.value })}
                              placeholder="Unidad, ej. °C (o elegí una de arriba)"
                              className="w-full bg-transparent text-[11px] outline-none rounded-lg px-0 py-1 transition-all focus:px-2 focus:ring-2 focus:ring-[var(--space-accent)]"
                              style={{ color: 'var(--text2)' }}
                            />
                            {dup && (
                              <p className="text-[10px] font-semibold mt-1.5" style={{ color: '#EF4444' }}>Identificador duplicado, cambiá este nombre.</p>
                            )}
                            <div className="flex items-center gap-2 mt-3 pt-2.5 border-t" style={{ borderColor: 'var(--border)' }}>
                              <button onClick={() => moveVar(i, -1)} disabled={i === 0} className="w-7 h-7 rounded-lg flex items-center justify-center border transition-all hover:text-[var(--space-accent)] disabled:opacity-20 disabled:pointer-events-none" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
                                <ChevronUp size={13} />
                              </button>
                              <button onClick={() => moveVar(i, 1)} disabled={i === vars.length - 1} className="w-7 h-7 rounded-lg flex items-center justify-center border transition-all hover:text-[var(--space-accent)] disabled:opacity-20 disabled:pointer-events-none" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
                                <ChevronDown size={13} />
                              </button>
                              <span className="text-[10px]" style={{ color: 'var(--text2)' }}>Prioridad</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {vars.length === 0 && (
                      <div className="col-span-full text-center py-10 rounded-2xl border border-dashed" style={{ borderColor: 'var(--border)' }}>
                        <Activity size={22} className="mx-auto mb-2 opacity-40" style={{ color: accent }} />
                        <p className="text-sm font-medium" style={{ color: 'var(--text2)' }}>Sin variables</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>Hacé clic en "Agregar variable" para crear la primera. El índice no se calcula sin variables.</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* 3. Rangos */}
                {vars.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2.5 mb-2">
                      <span className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `linear-gradient(135deg,${accent},#2BA8A0)`, color: 'white' }}>3</span>
                      <div>
                        <h3 className="font-bold text-sm leading-tight" style={{ color: 'var(--text)' }}>Límites de cada variable</h3>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text2)' }}>Límite superior (max) de cada categoría. El del último nivel queda abierto.</p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse min-w-[560px]">
                          <thead>
                            <tr style={{ background: accent + '0F' }}>
                              <th className="text-left py-3 pl-4 pr-4 font-bold text-[11px] uppercase tracking-wide" style={{ color: 'var(--text2)' }}>Variable</th>
                              {cats.map((c, i) => (
                                <th key={c._id} className="text-left py-3 px-2 font-bold text-[11px]" style={{ color: c.color }}>
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                                    {c.name}
                                    {i === cats.length - 1 && <span className="text-[9px] font-medium opacity-60">(sin límite)</span>}
                                  </span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {vars.map((v, vIdx) => (
                              <tr key={v.label} style={{ borderTop: '1px solid var(--border)' }}>
                                <td className="py-2.5 pl-4 pr-4 font-semibold whitespace-nowrap" style={{ color: 'var(--text)' }}>{v.name || `Variable ${vIdx + 1}`}</td>
                                {cats.map((c, i) => {
                                  const r = ranges.find(x => x.variable_label === v.label && x.cat_order === c._id + 1)
                                  if (i === cats.length - 1) {
                                    return <td key={c._id} className="py-2.5 px-2 text-xs italic" style={{ color: 'var(--text2)' }}>abierto</td>
                                  }
                                  const err = rangeErrors[v.label + ':' + (c._id + 1)]
                                  return (
                                    <td key={c._id} className="py-2.5 px-2">
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          placeholder="max"
                                          value={r?.max_value ?? ''}
                                          onChange={e => setRangeMax(v.label, c._id + 1, e.target.value)}
                                          className={`w-24 bg-transparent border rounded-lg px-2.5 py-1.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--space-accent)] focus:border-[var(--space-accent)] ${err ? 'border-red-500' : ''}`}
                                          style={{ borderColor: err ? '#EF4444' : 'var(--border)', color: 'var(--text)' }}
                                        />
                                        <span className="text-[10px]" style={{ color: err ? '#EF4444' : 'var(--text2)' }}>{err ? (err === 'req' ? 'requerido' : 'debe ser > ' + err) : 'max'}</span>
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>
                )}

                {/* Guardar */}
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
                  <button onClick={() => navigate(`/espacios/${id}`)} className="px-4 py-2.5 rounded-xl text-sm font-bold border transition-all hover:bg-black/5" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
                    Cancelar
                  </button>
                  <div className="flex items-center gap-3">
                    <p className="hidden md:block text-[11px] max-w-[240px] text-right" style={{ color: 'var(--text2)' }}>
                      Los cambios se guardan en el espacio y se aplican al calcular su índice en tiempo real.
                    </p>
                    <button
                      onClick={save}
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                      style={{ background: `linear-gradient(135deg,${accent},#2BA8A0)`, boxShadow: `0 8px 20px ${accent}59` }}
                    >
                      {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />} {saving ? 'Guardando...' : 'Guardar configuración'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {(msg || saveErr) && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md">
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