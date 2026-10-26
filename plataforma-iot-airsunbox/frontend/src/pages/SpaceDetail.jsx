import ScrollHint from '../components/ScrollHint'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ClienteLayout from '../components/airsunbox/ClienteLayout'
import EditSpaceModal from '../components/airsunbox/EditSpaceModal'
import { spaces as spacesApi, variables as variablesApi, devices as devicesApi } from '../services/api'
import {
  Plus, Trash2, Pencil, ArrowLeft, ArrowRight, Trash, RefreshCw,
  Server, Wifi, WifiOff, MapPin, Gauge, ListChecks, Layers, X, Check, MoreHorizontal
} from 'lucide-react'
import { spaceIcon, generateLabel, TYPE_LABELS, normalizeVarName } from './spaceUtils'
import MapPicker from '../components/MapPicker'

const COLORS = { primary: '#67B7E8' }
const INPUT = (accent) => `w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[${accent}]/20 focus:border-[${accent}]`
const inputStyle = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }

function getStatusColor(status) {
  return status === 'online' ? '#2BA8A0' : '#F59E0B'
}

function DeviceCard({ device, onDetail, onEditVariables, onTogglePublic, showPublicToggle, accent }) {
  const isOnline = device.status === 'online'
  const color = getStatusColor(device.status)
  return (
    <div
      onClick={() => onDetail(device.id)}
      className="group rounded-2xl p-5 border cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg"
      style={{ background: 'var(--card)', borderColor: isOnline ? color + '40' : 'var(--border)' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '1A', color }}>
          <Server size={18} />
        </div>
        <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: color + '1A', color }}>
          {isOnline
            ? <><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} /><Wifi size={9} /> En línea</>
            : <><WifiOff size={9} /> Sin señal</>}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-0.5">
        <h4 className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>{device.name}</h4>
        <button
          onClick={(e) => { e.stopPropagation(); onEditVariables(device) }}
          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0"
          title="Editar variables de la estación"
        >
          <Pencil size={13} style={{ color: 'var(--text2)' }} />
        </button>
      </div>
      <p className="text-xs font-mono mb-3" style={{ color: 'var(--text2)' }}>{device.label}</p>
      <div className="space-y-1 mb-4">
        {device.lat && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text2)' }}>
            <MapPin size={11} /> {Number(device.lat).toFixed(4)}, {Number(device.lng).toFixed(4)}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs" style={{ color: 'var(--text2)' }}>{device.variable_count || 0} variables</span>
        <span className="flex items-center gap-1 text-xs font-semibold group-hover:gap-2 transition-all" style={{ color: accent }}>
          Ver detalles <ArrowRight size={11} />
        </span>
      </div>
      {showPublicToggle && (
        <div
          className="flex items-center justify-between pt-3 mt-3 border-t"
          style={{ borderColor: 'var(--border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text2)' }}>
            <MapPin size={11} /> Mostrar en mapa público
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={!!device.public_map}
            title={device.public_map ? 'Visible en el mapa público' : 'Oculta en el mapa público'}
            onClick={() => onTogglePublic(device, !device.public_map)}
            className="relative w-9 h-5 rounded-full transition-colors"
            style={{ background: device.public_map ? accent : 'var(--border)' }}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${device.public_map ? 'left-[17px]' : 'left-0.5'}`}
            />
          </button>
        </div>
      )}
    </div>
  )
}

function AddDeviceModal({ spaceId, onClose, onAdd, accent = COLORS.primary }) {
  const [form, setForm] = useState({ name: '', label: '', lat: '', lng: '' })
  const [catalog, setCatalog] = useState([])
  const [catalogReady, setCatalogReady] = useState(false)
  const [selectedVariables, setSelectedVariables] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Estación dentro de este espacio: se ofrecen SOLO las variables
    // creadas para ESE espacio (aisladas), no el catálogo global.
    const fetchCatalog = async () => {
      try {
        const data = await variablesApi.list(spaceId)
        const locals = data.filter(v => String(v.space_id) === String(spaceId))
        // Deduplicar por nombre normalizado: evita variables repetidas creadas por el config AQI
        const seen = new Set()
        const dedup = locals.filter(v => {
          const key = normalizeVarName(v.name)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setCatalog(dedup)
        setSelectedVariables(dedup.map(v => v.label))
        setCatalogReady(true)
      } catch { /* sin catálogo no se bloquea */ }
    }
    fetchCatalog()
  }, [spaceId])

  const handleToggleVariable = (label) => {
    setSelectedVariables(prev => prev.includes(label)
      ? prev.filter(x => x !== label)
      : [...prev, label])
  }

  const handleSelectAll = () => {
    if (selectedVariables.length === catalog.length) setSelectedVariables([])
    else setSelectedVariables(catalog.map(v => v.label))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const device = await devicesApi.create({
        name: form.name,
        label: form.label,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        selectedVariables,
        spaceId
      })
      setSuccess(true)
      setTimeout(() => { onAdd(device); onClose() }, 1500)
    } catch (err) {
      setError(err.message || 'No se pudo crear el dispositivo')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-[24px] p-8 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <ScrollHint />
        {success ? (
          <div className="flex flex-col items-center justify-center py-10 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-[#2BA8A0]/10 text-[#2BA8A0] rounded-full flex items-center justify-center mb-4 shadow-sm shadow-[#2BA8A0]/10">
              <Check size={32} strokeWidth={3} />
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-2" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
              ¡Estación enlazada!
            </h3>
            <p className="text-sm max-w-[280px] text-center" style={{ color: 'var(--text2)' }}>
              El dispositivo <strong>{form.name}</strong> quedó dentro de este espacio.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Nueva estación</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text2)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                  {error}
                </div>
              )}

              <div>
                <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>Nombre de la estación</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value, label: generateLabel(e.target.value) }))}
                  placeholder="Ej. Sensor principal"
                  className={INPUT(accent)}
                  style={inputStyle}
                />
                <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text2)' }}>ID: {form.label || '—'}</p>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>Ubicación en mapa <span className="opacity-60">(opcional)</span></label>
                <MapPicker
                  lat={form.lat ? parseFloat(form.lat) : null}
                  lng={form.lng ? parseFloat(form.lng) : null}
                  onChange={({ lat, lng }) => setForm(prev => ({ ...prev, lat: lat.toFixed(6), lng: lng.toFixed(6) }))}
                  height={140}
                />
                {form.lat && form.lng && (
                  <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text2)' }}>
                    Coords: {form.lat}, {form.lng}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold tracking-tight" style={{ color: 'var(--text)' }}>Variables a medir</label>
                  <button type="button" onClick={handleSelectAll} className="text-[11px] font-bold px-2 py-1 rounded bg-black/5 dark:bg-white/5 hover:opacity-80 transition-all" style={{ color: accent }}>
                    {catalog.length > 0 && (selectedVariables.length === catalog.length ? 'Desmarcar todas' : 'Seleccionar todas')}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 border rounded-xl p-3 max-h-[160px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                  {catalog.map(v => {
                    const isSelected = selectedVariables.includes(v.label)
                    return (
                      <button
                        key={v.label}
                        type="button"
                        onClick={() => handleToggleVariable(v.label)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-semibold transition-all border ${isSelected ? 'border-[#2BA8A0] bg-[#2BA8A0]/5 text-[#2BA8A0]' : 'border-transparent opacity-70'}`}
                        style={!isSelected ? { color: 'var(--text)', background: 'var(--card)' } : {}}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#2BA8A0] border-[#2BA8A0]' : 'border-neutral-400'}`}>
                          {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className="truncate">{v.name} <span className="opacity-50 text-[10px]">({v.unit})</span></span>
                      </button>
                    )
                  })}
                  {!catalogReady && catalog.length === 0 && (
                    <p className="text-center text-[11px] py-4 col-span-2" style={{ color: 'var(--text2)' }}>Cargando variables del espacio...</p>
                  )}
                  {catalogReady && catalog.length === 0 && (
                    <div className="text-center py-4 col-span-2">
                      <p className="text-[11px] font-semibold" style={{ color: 'var(--text2)' }}>
                        Este espacio aún no tiene variables propias.
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text2)' }}>
                        Creálas en "Configurar AQI y variables" para poder asignarlas a la estación.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#2BA8A0]/10 rounded-xl p-4 text-xs font-medium text-[#2BA8A0]">
                El estado inicial será <strong>Pendiente</strong> hasta que reporte señal física.
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 rounded-xl py-3 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text2)' }}>Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 text-white py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50" style={{ background: accent, boxShadow: `0 4px 12px ${accent}40` }}>{loading ? 'Creando...' : 'Crear'}</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function EditDeviceVariablesModal({ device, spaceId, onClose, onSaved, accent = COLORS.primary }) {
  const [catalog, setCatalog] = useState([])
  const [catalogReady, setCatalogReady] = useState(false)
  const [selectedVariables, setSelectedVariables] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Solo las variables creadas para ESE espacio (aisladas), no el catálogo global.
    let active = true
    const fetchCatalog = async () => {
      try {
        const [data, current] = await Promise.all([
          variablesApi.list(spaceId),
          devicesApi.variables(device.id).catch(() => [])
        ])
        if (!active) return
        const locals = data.filter(v => String(v.space_id) === String(spaceId))
        // Deduplicar por nombre normalizado: evita variables repetidas creadas por el config AQI
        const seen = new Set()
        const dedup = locals.filter(v => {
          const key = normalizeVarName(v.name)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setCatalog(dedup)
        // Pre-chequear las variables que la estación ya tiene asignadas
        const currentLabels = (current || []).map(v => v.label)
        const preserved = dedup.filter(v => currentLabels.includes(v.label)).map(v => v.label)
        setSelectedVariables(preserved.length ? preserved : dedup.map(v => v.label))
        setCatalogReady(true)
      } catch { /* sin catálogo no se bloquea */ }
    }
    fetchCatalog()
    return () => { active = false }
  }, [device.id, spaceId])

  const handleToggleVariable = (label) => {
    setSelectedVariables(prev => prev.includes(label)
      ? prev.filter(x => x !== label)
      : [...prev, label])
  }

  const handleSelectAll = () => {
    if (selectedVariables.length === catalog.length) setSelectedVariables([])
    else setSelectedVariables(catalog.map(v => v.label))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await devicesApi.update(device.id, { selectedVariables, spaceId })
      setSuccess(true)
      setTimeout(() => { onSaved(); onClose() }, 1200)
    } catch (err) {
      setError(err.message || 'No se pudieron guardar las variables')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-[24px] p-8 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <ScrollHint />
        {success ? (
          <div className="flex flex-col items-center justify-center py-10 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-[#2BA8A0]/10 text-[#2BA8A0] rounded-full flex items-center justify-center mb-4 shadow-sm shadow-[#2BA8A0]/10">
              <Check size={32} strokeWidth={3} />
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-2" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
              ¡Variables actualizadas!
            </h3>
            <p className="text-sm max-w-[280px] text-center" style={{ color: 'var(--text2)' }}>
              La estación <strong>{device.name}</strong> quedó actualizada.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Variables de la estación</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text2)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs font-mono uppercase" style={{ color: 'var(--text2)' }}>{device.name} · {device.label}</p>
              {error && (
                <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                  {error}
                </div>
              )}

              <div className="pt-1">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold tracking-tight" style={{ color: 'var(--text)' }}>Variables a medir</label>
                  <button type="button" onClick={handleSelectAll} className="text-[11px] font-bold px-2 py-1 rounded bg-black/5 dark:bg-white/5 hover:opacity-80 transition-all" style={{ color: accent }}>
                    {catalog.length > 0 && (selectedVariables.length === catalog.length ? 'Desmarcar todas' : 'Seleccionar todas')}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 border rounded-xl p-3 max-h-[200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                  {catalog.map(v => {
                    const isSelected = selectedVariables.includes(v.label)
                    return (
                      <button
                        key={v.label}
                        type="button"
                        onClick={() => handleToggleVariable(v.label)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-semibold transition-all border ${isSelected ? 'border-[#2BA8A0] bg-[#2BA8A0]/5 text-[#2BA8A0]' : 'border-transparent opacity-70'}`}
                        style={!isSelected ? { color: 'var(--text)', background: 'var(--card)' } : {}}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#2BA8A0] border-[#2BA8A0]' : 'border-neutral-400'}`}>
                          {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className="truncate">{v.name} <span className="opacity-50 text-[10px]">({v.unit})</span></span>
                      </button>
                    )
                  })}
                  {!catalogReady && catalog.length === 0 && (
                    <p className="text-center text-[11px] py-4 col-span-2" style={{ color: 'var(--text2)' }}>Cargando variables del espacio...</p>
                  )}
                  {catalogReady && catalog.length === 0 && (
                    <div className="text-center py-4 col-span-2">
                      <p className="text-[11px] font-semibold" style={{ color: 'var(--text2)' }}>
                        Este espacio aún no tiene variables propias.
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text2)' }}>
                        Creálas en "Configurar AQI y variables" para poder asignarlas a la estación.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#2BA8A0]/10 rounded-xl p-4 text-xs font-medium text-[#2BA8A0]">
                Las variables sin datos no afectan el AQI: se integran cuando el sensor empiece a reportar.
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 rounded-xl py-3 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text2)' }}>Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 text-white py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50" style={{ background: accent, boxShadow: `0 4px 12px ${accent}40` }}>{loading ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function SpaceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [space, setSpace] = useState(null)
  const [deviceList, setDeviceList] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [editDevice, setEditDevice] = useState(null)

  const [editModal, setEditModal] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)
  useEffect(() => {
    if (!moreOpen) return
    const onDown = (e) => { if (!moreRef.current?.contains(e.target)) setMoreOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [moreOpen])
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true); setLoadError('')
    try {
      const [cfg, devs] = await Promise.all([
        spacesApi.config(id),
        spacesApi.devices(id).catch(() => [])
      ])
      setSpace(cfg)
      setDeviceList(devs)
    } catch (e) {
      setLoadError(e.message || 'No se pudo cargar el espacio')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const remove = async () => {
    setDeleting(true)
    try {
      await spacesApi.delete(id)
      navigate('/espacios')
    } catch (err) {
      setLoadError(err.message)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const togglePublic = async (device, value) => {
    try {
      await devicesApi.update(device.id, { publicMap: value })
      setDeviceList(prev => prev.map(d => d.id === device.id ? { ...d, public_map: value } : d))
    } catch (err) {
      setLoadError(err.message)
      setTimeout(() => setLoadError(''), 4000)
    }
  }

  const onlineCount = deviceList.filter(d => d.status === 'online').length
  const aqiConfig = space?.aqiConfig || { categories: [], variables: [] }
  const accent = (space && space.color) || COLORS.primary

  if (loading && !space) {
    return (
      <ClienteLayout>
        <div className="flex items-center justify-center min-h-[70vh] text-sm" style={{ color: 'var(--text2)' }}>
          <RefreshCw size={16} className="animate-spin mr-2" /> Cargando espacio...
        </div>
      </ClienteLayout>
    )
  }

  if (!space && !loading) {
    return (
      <ClienteLayout>
        <div className="p-8 text-center py-16">
          <p className="text-sm font-medium" style={{ color: 'var(--text2)' }}>{loadError || 'Este espacio no existe o no tenés acceso.'}</p>
          <button onClick={() => navigate('/espacios')} className="mt-4 text-sm font-bold" style={{ color: accent }}>Volver a espacios</button>
        </div>
      </ClienteLayout>
    )
  }

  return (
    <ClienteLayout>
      {showAddDevice && (
        <AddDeviceModal
          spaceId={space.id}
          accent={accent}
          onClose={() => setShowAddDevice(false)}
          onAdd={() => { spacesApi.devices(id).then(setDeviceList).catch(() => {}) }}
        />
      )}
      {editModal && (
        <EditSpaceModal
          space={space}
          onClose={() => setEditModal(false)}
          onSaved={(updated) => {
            setSpace(prev => ({ ...prev, ...updated }))
            setEditModal(false)
          }}
        />
      )}
      {editDevice && (
        <EditDeviceVariablesModal
          device={editDevice}
          spaceId={space.id}
          accent={accent}
          onClose={() => setEditDevice(null)}
          onSaved={() => { spacesApi.devices(id).then(setDeviceList).catch(() => {}) }}
        />
      )}

      <div className="min-h-full px-4 py-6 md:px-8 md:py-10 page-bg">

        <button onClick={() => navigate('/espacios')} className="flex items-center gap-2 text-sm font-semibold mb-6 transition-colors hover:opacity-80" style={{ color: 'var(--text2)' }}>
          <ArrowLeft size={16} /> Volver a espacios
        </button>

        {/* ── Encabezado del espacio ── */}
        <header className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
          <div className="flex items-start gap-4 min-w-0">
            <span className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: accent + '24', color: accent }} aria-hidden="true">
              {spaceIcon(space.icon, space.type, 26)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-[1.9rem] md:text-[2.4rem] font-extrabold leading-[1.1] break-words" style={{ color: 'var(--text)' }}>
                  {space.name}
                </h1>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md" style={{ background: accent + '1A', color: accent }}>
                  {TYPE_LABELS[space.type] || (space.type ? space.type.charAt(0).toUpperCase() + space.type.slice(1) : 'Otro')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <p className="text-sm max-w-xl" style={{ color: 'var(--text2)' }}>
                  {space.description || 'Sin descripción. Editalo para agregarle contexto.'}
                </p>
                <button
                  onClick={() => setEditModal(true)}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
                  aria-label="Editar espacio"
                  title="Editar espacio (nombre, tipo, icono, color)"
                >
                  <Pencil size={13} style={{ color: 'var(--text2)' }} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowAddDevice(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ background: accent }}
            >
              <Plus size={16} /> Nueva estación
            </button>
            <button
              onClick={() => navigate(`/espacios/${id}/aqi`)}
              className="flex items-center justify-center gap-2 border rounded-xl px-4 py-2.5 text-sm font-bold transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--card)' }}
            >
              <Gauge size={16} /> Configurar índice
            </button>
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-label="Más opciones del espacio"
                className="w-10 h-10 flex items-center justify-center border rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--text2)', background: 'var(--card)' }}
              >
                <MoreHorizontal size={18} />
              </button>
              {moreOpen && (
                <div role="menu" className="absolute right-0 top-full mt-2 w-52 rounded-2xl border p-1.5 z-30 shadow-[0_12px_32px_rgba(15,31,24,0.14)] user-menu-pop" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                  <button role="menuitem" onClick={() => { setMoreOpen(false); setEditModal(true) }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-[rgba(103,183,232,0.10)]" style={{ color: 'var(--text)' }}>
                    <Pencil size={15} style={{ color: 'var(--text2)' }} /> Editar espacio
                  </button>
                  <div className="h-px my-1.5 mx-2" style={{ background: 'var(--border)' }} />
                  <button role="menuitem" onClick={() => { setMoreOpen(false); setConfirmDelete(true) }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-red-500/10" style={{ color: '#E5484D' }}>
                    <Trash2 size={15} /> Eliminar espacio
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {msg && (
          <div className="mb-6 rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
            {msg}
          </div>
        )}
        {loadError && (
          <div className="mb-6 rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
            {loadError}
          </div>
        )}

        {/* ── Resumen: estado de las estaciones y configuración del índice ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-2xl p-5 border flex flex-col" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: 'var(--text2)' }}>Estaciones</span>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: accent + '1F', color: accent }}><Server size={17} /></span>
            </div>
            <div className="mt-3 text-3xl md:text-4xl font-bold tracking-tight" style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{deviceList.length}</div>
            <p className="mt-auto pt-3 text-xs" style={{ color: 'var(--text2)' }}>{deviceList.length ? 'en este espacio' : 'aún sin estaciones'}</p>
          </div>

          <div className="rounded-2xl p-5 border flex flex-col" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: 'var(--text2)' }}>En línea</span>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(44,182,125,0.12)', color: '#2CB67D' }}><Wifi size={17} /></span>
            </div>
            <div className="mt-3 text-3xl md:text-4xl font-bold tracking-tight" style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{onlineCount}</div>
            <div className="mt-3">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${deviceList.length ? Math.round((onlineCount / deviceList.length) * 100) : 0}%`, background: '#2CB67D' }} />
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--text2)' }}>
                {deviceList.length ? `${Math.round((onlineCount / deviceList.length) * 100)}% reportando` : '—'}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate(`/espacios/${id}/aqi`)}
            className="group rounded-2xl p-5 border flex flex-col text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B7E8]/40"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = accent + '80' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-semibold" style={{ color: 'var(--text2)' }}>Índice de calidad</span>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: accent + '1F', color: accent }}><Gauge size={17} /></span>
            </div>
            <div className="mt-3 flex items-baseline gap-4" style={{ color: 'var(--text)' }}>
              <span><span className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>{aqiConfig.categories.length}</span> <span className="text-sm" style={{ color: 'var(--text2)' }}>categorías</span></span>
              <span><span className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>{aqiConfig.variables.length}</span> <span className="text-sm" style={{ color: 'var(--text2)' }}>variables</span></span>
            </div>
            <span className="mt-auto pt-3 text-xs font-bold inline-flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: accent }}>
              Configurar índice <ArrowRight size={12} />
            </span>
          </button>
        </div>

        {/* ── Estaciones del espacio ── */}
        <div className="mb-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Estaciones del espacio</h2>
          {deviceList.length > 0 && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
              {deviceList.length === 1 ? '1 estación' : `${deviceList.length} estaciones`} dentro de {space.name}
            </p>
          )}
        </div>

        {deviceList.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {deviceList.map(d => (
              <DeviceCard key={d.id} device={d} accent={accent} onDetail={devId => navigate(`/devices/${devId}`)} onEditVariables={d => setEditDevice(d)} showPublicToggle={(space?.type || '') === 'aire'} onTogglePublic={togglePublic} />
            ))}
          </div>
        ) : (
          <section className="rounded-2xl border px-6 py-12 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <span className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center" style={{ background: accent + '1F', color: accent }} aria-hidden="true">
              <Server size={24} />
            </span>
            <h3 className="mt-5 font-display text-xl font-extrabold" style={{ color: 'var(--text)' }}>Agregá la primera estación</h3>
            <p className="mt-2 text-sm max-w-md mx-auto" style={{ color: 'var(--text2)' }}>
              Cada estación envía sus mediciones a este espacio y aparece en el mapa y en los reportes.
            </p>
            <button
              onClick={() => setShowAddDevice(true)}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: accent }}
            >
              <Plus size={16} /> Agregar estación
            </button>
          </section>
        )}

        {/* ── Modal confirmar eliminación ── */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500"><Trash size={18} /></div>
                <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Eliminar espacio</h3>
              </div>
              <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
                Vas a eliminar <strong>{space.name}</strong>. Las estaciones quedarán sin espacio asignado. Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setConfirmDelete(false)} className="px-4 py-2.5 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
                  Cancelar
                </button>
                <button
                  onClick={remove}
                  disabled={deleting}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ClienteLayout>
  )
}