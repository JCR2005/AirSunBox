import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import AdminLayout from '../../components/admin/AdminLayout'
import { devices as devicesApi, dots as dotsApi } from '../../services/api'
import { useWebSocket } from '../../hooks/useWebSocket'
import MapPicker from '../../components/MapPicker'

import { 
  ArrowLeft, Wifi, WifiOff, MapPin, Bell, Tag, Info, X,
  Thermometer, Droplets, Wind, Sun, Cloud, Cpu, Gauge, 
  Battery, Zap, Factory, Waves, Flame, Trees, Shield, 
  Activity, CloudLightning, Eye
} from 'lucide-react'

const RANGES = ['1h', '6h', '24h', '7d', '30d']
const COLORS = ['#4DB6FF','#60A5FA','#F59E0B','#A78BFA','#F87171','#34D399','#FB923C','#C084FC','#22D3EE','#FBBF24','#818CF8','#E879F9']

const AVAILABLE_ICONS = {
  'map-pin': MapPin, 'thermometer': Thermometer, 'droplets': Droplets,
  'wind': Wind, 'sun': Sun, 'cloud': Cloud, 'cloud-lightning': CloudLightning,
  'cpu': Cpu, 'gauge': Gauge, 'battery': Battery, 'zap': Zap,
  'factory': Factory, 'waves': Waves, 'flame': Flame, 'trees': Trees,
  'shield': Shield, 'activity': Activity, 'eye': Eye
}

function SensorKPI({ name, unit, value }) {
  return (
    <div className="border rounded-xl p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs" style={{ color: 'var(--text2)' }}>{name}</span>
      </div>
      <div className="text-xl font-bold" style={{ color: 'var(--text)' }}>
        {value != null ? Number(value).toFixed(1) : '—'}
        <span className="text-sm font-normal ml-1" style={{ color: 'var(--text2)' }}>{unit}</span>
      </div>
    </div>
  )
}

export default function AdminDeviceDetail() {
  const { clientId, deviceId } = useParams()
  const navigate = useNavigate()
  const [device, setDevice] = useState(null)
  const [variables, setVariables] = useState([])
  const [lastValues, setLastValues] = useState({})
  const [chartData, setChartData] = useState([])
  const [range, setRange] = useState('24h')
  const [activeVars, setActiveVars] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  
  const [editForm, setEditForm] = useState({ 
    name: '', label: '', lat: '', lng: '',
    description: '', icon: 'map-pin', tags: [] 
  })

  // Carga inicial
  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [dev, vars, lv] = await Promise.all([
          devicesApi.get(deviceId, clientId),
          devicesApi.variables(deviceId, clientId),
          devicesApi.lastValues(deviceId, clientId)
        ])
        if (!active) return
        setDevice(dev)
        setEditForm({
          name: dev.name || '', label: dev.label || '',
          lat: dev.lat != null ? dev.lat.toString() : '',
          lng: dev.lng != null ? dev.lng.toString() : '',
          description: dev.description || '',
          icon: dev.icon || 'map-pin',
          tags: Array.isArray(dev.tags) ? dev.tags : []
        })
        const varList = vars || []
        setVariables(varList)
        // Inicializar activeVars con las variables reales del dispositivo
        if (varList.length) setActiveVars(varList.map(v => v.label))

        const map = {}
        ;(lv || []).forEach(v => { map[v.label] = v.last_value })
        setLastValues(map)
      } catch (err) {
        if (active) setError(err.message || 'No se pudo cargar el dispositivo')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [clientId, deviceId])

  // Refresco de últimos valores cada 5 segundos
  useEffect(() => {
    if (!deviceId) return
    const fetch = () => {
      devicesApi.lastValues(deviceId, clientId).then(lv => {
        const map = {}
        ;(lv || []).forEach(v => { map[v.label] = v.last_value })
        setLastValues(map)
      }).catch(() => {})
    }
    const interval = setInterval(fetch, 5000)
    return () => clearInterval(interval)
  }, [deviceId, clientId])

  // ── Tiempo real por WebSocket (respuesta inmediata) ──
  const { lastValues: wsValues } = useWebSocket([deviceId])
  const wsRefreshRef = useRef(null)
  useEffect(() => {
    const mine = wsValues[deviceId]
    if (!mine || !Object.keys(mine).length) return

    setLastValues(prev => {
      const next = { ...prev }
      Object.entries(mine).forEach(([variable, val]) => {
        next[variable] = val.value
      })
      return next
    })

    // Re-fetch de la gráfica cuando cambian las variables activas
    clearTimeout(wsRefreshRef.current)
    wsRefreshRef.current = setTimeout(() => {
      if (!deviceId || !activeVars.length) return
      dotsApi.getMultiple(deviceId, activeVars, range, clientId).then(data => {
        const timeMap = {}
        for (const [variable, points] of Object.entries(data || {})) {
          if (!Array.isArray(points)) continue
          points.forEach(p => {
            const t = new Date(p.time).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            if (!timeMap[t]) timeMap[t] = { time: t, _rawTime: new Date(p.time).getTime() }
            timeMap[t][variable] = p.value
          })
        }
        const sorted = Object.values(timeMap).sort((a, b) => a._rawTime - b._rawTime)
        setChartData(sorted)
      }).catch(() => {})
    }, 800)
  }, [wsValues, deviceId])

  // Datos históricos para la gráfica
  useEffect(() => {
    if (!deviceId || !activeVars.length) return
    
    dotsApi.getMultiple(deviceId, activeVars, range, clientId).then(data => {
      const timeMap = {}
      
      for (const [variable, points] of Object.entries(data || {})) {
        if (!Array.isArray(points)) continue;

        points.forEach(p => {
          // Manteniendo los segundos para evitar que Postman aplaste los datos
          const t = new Date(p.time).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          
          if (!timeMap[t]) {
            timeMap[t] = { time: t, _rawTime: new Date(p.time).getTime() }
          }
          timeMap[t][variable] = p.value
        })
      }
      
      const sortedData = Object.values(timeMap).sort((a, b) => a._rawTime - b._rawTime)
      
      setChartData(sortedData.slice(-60))
    }).catch((err) => {
      console.error("Error en la gráfica:", err)
    })
  }, [clientId, deviceId, range, activeVars])

  const varMap = {}
  variables.forEach(v => { varMap[v.label] = v })

  const handleSave = async () => {
    const payload = {
      name: editForm.name || undefined,
      label: editForm.label || undefined,
      lat: editForm.lat ? parseFloat(editForm.lat) : null,
      lng: editForm.lng ? parseFloat(editForm.lng) : null,
      description: editForm.description || '',
      icon: editForm.icon || 'map-pin',
      tags: editForm.tags
    }
    const updated = await devicesApi.update(deviceId, payload, clientId)
    setDevice(updated)
    setShowEdit(false)
  }

  const handleAddTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const newTag = e.target.value.trim().toLowerCase()
      if (newTag && !editForm.tags.includes(newTag)) {
        setEditForm(prev => ({ ...prev, tags: [...prev.tags, newTag] }))
        e.target.value = ''
      }
    }
  }

  const handleRemoveTag = (tagToRemove) => {
    setEditForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }))
  }

  const tokenPreview = device?.token || '—'
  const DynamicIcon = AVAILABLE_ICONS[device?.icon] || MapPin
  const latValue = device?.lat != null ? parseFloat(device.lat) : null
  const lngValue = device?.lng != null ? parseFloat(device.lng) : null
  const hasValidGPS = latValue != null && lngValue != null && !isNaN(latValue) && !isNaN(lngValue)

  return (
    <AdminLayout>
      <div className="p-4 lg:p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64" style={{ color: 'var(--text2)' }}>Cargando...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

            {/* ── COLUMNA IZQUIERDA ── */}
            <div className="space-y-6">
              
              {/* Card Principal */}
              <aside className="rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => navigate(`/admin/clientes/${clientId}`)} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text2)' }}>
                    <ArrowLeft size={16} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <DynamicIcon size={18} className="text-[#67B7E8] flex-shrink-0" />
                      <h1 className="text-lg font-bold truncate" style={{ color: 'var(--text)' }}>{device?.name}</h1>
                    </div>
                    <span className="text-xs block truncate" style={{ color: 'var(--text2)' }}>{device?.label}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${device?.status === 'online' ? 'bg-[#1D9E75]/10 text-[#1D9E75]' : 'bg-[#DFF1FF] text-[#2E8ED3]'}`}>
                    {device?.status === 'online' ? <Wifi size={10} /> : <WifiOff size={10} />}
                    {device?.status === 'online' ? 'En línea' : 'Sin señal'}
                  </span>
                </div>

                <div className="space-y-3 text-xs" style={{ color: 'var(--text2)' }}>
                  <div>
                    <div className="uppercase tracking-wide">ID</div>
                    <div className="font-mono" style={{ color: 'var(--text)' }}>{device?.id}</div>
                  </div>
                  <div>
                    <div className="uppercase tracking-wide">TOKEN</div>
                    <div className="font-mono break-all" style={{ color: 'var(--text)' }}>{tokenPreview}</div>
                  </div>
                  <div>
                    <div className="uppercase tracking-wide">Última actividad</div>
                    <div style={{ color: 'var(--text)' }}>{device?.last_seen ? new Date(device.last_seen).toLocaleString('es-GT') : '—'}</div>
                  </div>
                  <div>
                    <div className="uppercase tracking-wide">Ubicación</div>
                    <div style={{ color: 'var(--text)' }}>
                      {hasValidGPS ? `${latValue.toFixed(6)}, ${lngValue.toFixed(6)}` : '—'}
                    </div>
                  </div>
                </div>

                <Link to={`/alerts/${deviceId}`}
                  className="flex items-center justify-center gap-2 mt-6 border px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
                  <Bell size={14} /> Alertas
                </Link>

                <button onClick={() => setShowEdit(true)}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--green)', color: 'white' }}>
                  Editar propiedades
                </button>
              </aside>

              {/* Card Metadatos */}
              <div className="border rounded-2xl p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Info size={15} className="text-[#67B7E8]" />
                  <h3 className="font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--text)' }}>Metadatos</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text2)' }}>Descripción</span>
                    <p className="text-xs rounded-xl p-2.5 border min-h-[50px]" style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--bg)' }}>
                      {device?.description || 'Sin descripción asignada.'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text2)' }}>Ícono Asignado</span>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                        <DynamicIcon size={16} className="text-[#67B7E8]" />
                      </div>
                      <span className="font-mono text-xs" style={{ color: 'var(--text)' }}>{device?.icon || 'map-pin'}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    <span className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text2)' }}>
                      <Tag size={11} className="inline mr-1" /> Etiquetas
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {device?.tags?.length > 0 ? (
                        device.tags.map((tag, i) => (
                          <span key={i} className="text-[10px] font-bold px-2 py-0.5 bg-[#67B7E8]/10 text-[#67B7E8] rounded-md border border-[#67B7E8]/20">{tag}</span>
                        ))
                      ) : (
                        <span className="text-xs italic" style={{ color: 'var(--text2)' }}>Sin etiquetas</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card GPS */}
              <div className="border rounded-2xl p-4 flex flex-col" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={15} className="text-[#1D9E75]" />
                  <h3 className="font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--text)' }}>Ubicación GPS</h3>
                </div>
                {hasValidGPS ? (
                  <div className="relative z-0 rounded-xl overflow-hidden border h-[180px]" style={{ borderColor: 'var(--border)' }}>
                    <MapPicker lat={latValue} lng={lngValue} height={180} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center border border-dashed rounded-xl h-[150px]" style={{ borderColor: 'var(--border)' }}>
                    <MapPin size={22} className="mb-1 opacity-20" style={{ color: 'var(--text)' }} />
                    <span className="text-xs" style={{ color: 'var(--text2)' }}>GPS no establecido</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── COLUMNA DERECHA ── */}
            <section>
              {error && (
                <div className="mb-4 border rounded-lg px-3 py-2 text-xs" style={{ borderColor: '#F97316', color: '#FDBA74', background: 'rgba(249,115,22,0.1)' }}>
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Variables</h2>
                <div className="flex items-center gap-2">
                  {RANGES.map(r => (
                    <button key={r} onClick={() => setRange(r)}
                      className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                      style={range === r
                        ? { background: '#1D9E75', color: 'white' }
                        : { color: 'var(--text2)', border: '1px solid var(--border)', background: 'transparent' }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                {variables.map(v => (
                  <SensorKPI
                    key={v.label}
                    name={v.name}
                    unit={v.unit}
                    value={lastValues[v.label]}
                  />
                ))}
              </div>

              {/* Gráfica */}
              <div className="border rounded-2xl p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                {/* Toggles de variables */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {variables.map((v, i) => (
                    <button key={v.label}
                      onClick={() => setActiveVars(prev =>
                        prev.includes(v.label) ? prev.filter(x => x !== v.label) : [...prev, v.label]
                      )}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all"
                      style={{
                        background: activeVars.includes(v.label) ? `${COLORS[i % COLORS.length]}20` : 'transparent',
                        color: activeVars.includes(v.label) ? COLORS[i % COLORS.length] : 'var(--text2)',
                        border: `1px solid ${activeVars.includes(v.label) ? COLORS[i % COLORS.length] + '40' : 'var(--border)'}`
                      }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      {v.name}
                    </button>
                  ))}
                </div>

                <ResponsiveContainer width="100%" height={340}>
                  <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="time" stroke="var(--text2)" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis stroke="var(--text2)" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                    {variables.map((v, i) => (
                      activeVars.includes(v.label) && (
                        <Line key={v.label} type="monotone" dataKey={v.label}
                          stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={true} name={v.name} />
                      )
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* MODAL EDICIÓN */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-lg border max-h-[90vh] overflow-y-auto shadow-2xl" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base" style={{ color: 'var(--text)' }}>Editar dispositivo</h2>
              <button onClick={() => setShowEdit(false)} style={{ color: 'var(--text2)' }}><X size={18} /></button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text2)' }}>Nombre</label>
                  <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text2)' }}>Label</label>
                  <input value={editForm.label} onChange={e => setEditForm(p => ({ ...p, label: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                </div>
              </div>

              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text2)' }}>Descripción</label>
                <textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  rows={2} className="w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  placeholder="Ej: Estación instalada en planta alta..." />
              </div>

              <div>
                <label className="text-xs block mb-1.5" style={{ color: 'var(--text2)' }}>Etiquetas (Enter para agregar)</label>
                <div className="w-full border rounded-lg p-2 flex flex-wrap gap-1.5 items-center min-h-[42px]"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                  {editForm.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 bg-[#67B7E8]/10 text-[#67B7E8] rounded-md border border-[#67B7E8]/20">
                      {tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)}><X size={10} /></button>
                    </span>
                  ))}
                  <input type="text" onKeyDown={handleAddTag}
                    placeholder={editForm.tags.length === 0 ? 'Ej: exterior, norte' : ''}
                    className="flex-1 bg-transparent text-sm outline-none min-w-[120px]"
                    style={{ color: 'var(--text)' }} />
                </div>
              </div>

              <div>
                <label className="text-xs block mb-1.5" style={{ color: 'var(--text2)' }}>Ícono</label>
                <div className="grid grid-cols-6 gap-2 p-3 rounded-xl border max-h-[140px] overflow-y-auto"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                  {Object.entries(AVAILABLE_ICONS).map(([iconKey, IconComponent]) => {
                    const isSelected = editForm.icon === iconKey
                    return (
                      <button key={iconKey} type="button" onClick={() => setEditForm(p => ({ ...p, icon: iconKey }))}
                        className="flex items-center justify-center p-2.5 rounded-xl border transition-all"
                        style={{ borderColor: isSelected ? '#67B7E8' : 'var(--border)', background: isSelected ? 'rgba(103,183,232,0.12)' : 'transparent', color: isSelected ? '#67B7E8' : 'var(--text)' }}
                        title={iconKey}>
                        <IconComponent size={20} strokeWidth={isSelected ? 2.5 : 2} />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text2)' }}>Latitud</label>
                  <input value={editForm.lat} onChange={e => setEditForm(p => ({ ...p, lat: e.target.value }))}
                    type="number" step="any" className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text2)' }}>Longitud</label>
                  <input value={editForm.lng} onChange={e => setEditForm(p => ({ ...p, lng: e.target.value }))}
                    type="number" step="any" className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                </div>
              </div>

              <div>
                <label className="text-xs block mb-1.5" style={{ color: 'var(--text2)' }}>Ubicación en el mapa</label>
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                  <MapPicker
                    lat={editForm.lat ? parseFloat(editForm.lat) : null}
                    lng={editForm.lng ? parseFloat(editForm.lng) : null}
                    onChange={({ lat, lng }) => setEditForm(p => ({ ...p, lat: lat.toFixed(6), lng: lng.toFixed(6) }))}
                    height={130}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowEdit(false)}
                className="flex-1 border rounded-lg py-2 text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
                Cancelar
              </button>
              <button onClick={handleSave}
                className="flex-1 rounded-lg py-2 text-sm font-medium"
                style={{ background: 'var(--green)', color: 'white' }}>
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}