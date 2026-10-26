import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ClienteLayout from '../components/airsunbox/ClienteLayout'
import { devices as devicesApi } from '../services/api'
import { Activity, AlertTriangle, ChevronRight, CloudSun, Cpu, MapPin, Moon, Radio, Sun } from 'lucide-react'
import useAuthStore from '../store/auth'
import { useWebSocket } from '../hooks/useWebSocket'

// Importes para el Mapa
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

const SKY = '#67B7E8'
const AMBER = '#E0A23B'
const OFFLINE = '#9CA3AF'

// Escala de AQI (misma en el mapa, la lista y la leyenda)
const AQI_SCALE = [
  { key: 'excelente', label: 'Excelente', color: '#10B981' },
  { key: 'buena', label: 'Buena', color: '#34D399' },
  { key: 'precaución', label: 'Precaución', color: '#F59E0B' },
  { key: 'mala', label: 'Mala', color: '#F97316' },
  { key: 'peligrosa', label: 'Peligrosa', color: '#EF4444' },
]

const pulseStyle = `
  @keyframes pulse-ring {
    0% { box-shadow: 0 0 0 0 var(--ring); }
    100% { box-shadow: 0 0 0 10px transparent; }
  }
  @media (prefers-reduced-motion: reduce) { .aqi-dot { animation: none !important; } }
`

export default function ClientDashboard() {
  const navigate = useNavigate()
  const { user, org } = useAuthStore()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [aqis, setAqis] = useState({}) // Guarda el AQI de cada dispositivo

  useEffect(() => {
    devicesApi.list().then(setDevices).finally(() => setLoading(false))
  }, [])

  // ── Tiempo real por WebSocket ──
  const deviceIds = devices.map(d => d.id)
  const { lastValues } = useWebSocket(deviceIds)

  const wsRefreshRef = useRef(null)
  useEffect(() => {
    if (!Object.keys(lastValues).length) return
    clearTimeout(wsRefreshRef.current)
    wsRefreshRef.current = setTimeout(() => {
      if (!devices.length) return
      devices.forEach(d => {
        devicesApi.aqi(d.id).then(res => {
          if (res) setAqis(prev => ({ ...prev, [d.id]: res }))
        }).catch(() => {})
      })
    }, 800)
  }, [lastValues])

  // Efecto para consultar el AQI de cada dispositivo
  useEffect(() => {
    if (devices.length > 0) {
      devices.forEach(d => {
        devicesApi.aqi(d.id).then(res => {
          if (res) {
            setAqis(prev => ({ ...prev, [d.id]: res }))
          }
        }).catch(() => {})
      })
    }
  }, [devices])

  const aqiColor = (category) => {
    if (!category) return null
    const cat = category.toLowerCase()
    return AQI_SCALE.find(s => cat.includes(s.key))?.color || '#EF4444'
  }

  const isOnline = (d) => d.status === 'online' || d.status === 'active'

  // Color de una estación: su categoría de AQI si está en línea y tiene datos
  const stationColor = (device) => {
    if (!isOnline(device)) return OFFLINE
    return aqiColor(aqis[device.id]?.category) || SKY
  }

  const createIcon = (device) => {
    const color = stationColor(device)
    const online = isOnline(device)
    return L.divIcon({
      html: `<span class="aqi-dot" style="
        display:block;width:14px;height:14px;border-radius:50%;
        background:${color};border:2px solid #fff;
        --ring:${color}66;
        ${online ? 'animation:pulse-ring 1.8s ease-out infinite;' : ''}
      "></span>`,
      className: '',
      iconAnchor: [7, 7]
    })
  }

  const activeCount = devices.filter(isOnline).length
  const offlineCount = devices.filter(d => d.status === 'offline' || d.status === 'inactive').length
  const total = devices.length
  const onlinePct = total ? Math.round((activeCount / total) * 100) : 0

  const today = new Intl.DateTimeFormat('es-GT', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(new Date())

  const defaultCenter = [14.8347, -91.5185]
  const mapCenter = devices.length > 0 && devices[0].lat ? [devices[0].lat, devices[0].lng] : defaultCenter
  // Cuenta individual: el nombre de la persona ("Hola, Ana"), no "Cuenta de Ana"
  const greetingName = org?.accountType === 'individual'
    ? (user?.name || '').trim().split(/\s+/)[0]
    : (org?.name || user?.name || '')

  // Estado de red: primero las que requieren atención (peor AQI), al final las desconectadas
  const rank = (d) => {
    if (!isOnline(d)) return 1000
    const v = Number(aqis[d.id]?.aqi)
    return Number.isFinite(v) ? -v : 0
  }
  const sorted = [...devices].sort((a, b) => rank(a) - rank(b))

  if (loading) return (
    <ClienteLayout>
      <div className="flex items-center justify-center h-screen text-sm" style={{color:'var(--text2)'}}>
        Preparando tu panel…
      </div>
    </ClienteLayout>
  )

  // Saludo según la hora: sol de día (como el logo), atardecer y luna de noche
  const hour = new Date().getHours()
  const greeting = hour < 12
    ? { text: 'Buenos días', Icon: Sun, color: '#E0A23B', tint: 'rgba(224,162,59,0.14)' }
    : hour < 19
      ? { text: 'Buenas tardes', Icon: CloudSun, color: SKY, tint: 'rgba(103,183,232,0.14)' }
      : { text: 'Buenas noches', Icon: Moon, color: '#8B9CF7', tint: 'rgba(139,156,247,0.16)' }

  const KPIS = [
    { label: 'Total de estaciones', value: total, icon: Cpu, color: SKY,
      note: total ? 'registradas en tu red' : 'aún sin estaciones' },
    { label: 'En línea', value: activeCount, icon: Activity, color: '#2CB67D',
      note: total ? `${onlinePct}% de la red reportando` : '—', bar: onlinePct },
    { label: 'Sin conexión', value: offlineCount, icon: AlertTriangle, color: offlineCount ? AMBER : 'var(--text2)',
      note: offlineCount ? 'requieren revisión' : 'todo en orden', action: offlineCount > 0 },
  ]

  const cardStyle = { background: 'var(--card)', borderColor: 'var(--border)' }

  return (
    <ClienteLayout>
      <div className="min-h-full px-4 py-6 md:px-8 md:py-10 page-bg">
        <style>{pulseStyle}</style>

        {/* Encabezado: saludo según la hora, en vivo */}
        <header className="mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: greeting.tint, color: greeting.color }} aria-hidden="true">
              <greeting.Icon size={22} strokeWidth={2.25} />
            </span>
            <h1 className="font-display text-[1.9rem] md:text-[2.6rem] font-extrabold leading-[1.1] break-words" style={{ color: 'var(--text)' }}>
              {greeting.text}{greetingName ? `, ${greetingName}` : ''}
            </h1>
          </div>
          <p className="mt-3 text-sm flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: 'var(--text2)' }}>
            {total > 0 && (
              <span className="inline-flex items-center gap-2 font-semibold" style={{ color: activeCount ? '#2CB67D' : 'var(--text2)' }}>
                <span className={`w-2 h-2 rounded-full ${activeCount ? 'live-dot' : ''}`} style={{ background: activeCount ? '#2CB67D' : OFFLINE }} />
                {activeCount ? 'En vivo' : 'Sin señal'}
              </span>
            )}
            {total > 0 && <span aria-hidden="true">·</span>}
            <span className="first-letter:uppercase">{today}</span>
            {total > 0 && <span aria-hidden="true">·</span>}
            {total > 0 && <span>{activeCount} de {total} estaciones reportando</span>}
          </p>
        </header>

        {/* Indicadores */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 md:mb-8">
          {KPIS.map(({ label, value, icon: Icon, color, note, bar, action }) => (
            <div key={label} className="rounded-2xl p-5 border flex flex-col" style={cardStyle}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: 'var(--text2)' }}>{label}</span>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color.startsWith('#') ? color : '#8FA899'}1F`, color }}>
                  <Icon size={17} strokeWidth={2.25} />
                </span>
              </div>
              <div className="mt-3 text-3xl md:text-4xl font-bold tracking-tight" style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </div>
              {bar != null ? (
                <div className="mt-3">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${bar}%`, background: color }} />
                  </div>
                  <p className="mt-2 text-xs" style={{ color: 'var(--text2)' }}>{note}</p>
                </div>
              ) : (
                <p className="mt-auto pt-3 text-xs flex items-center gap-2" style={{ color: 'var(--text2)' }}>
                  {note}
                  {action && (
                    <button type="button" onClick={() => navigate('/dispositivos')} className="font-semibold inline-flex items-center gap-0.5 hover:gap-1.5 transition-all" style={{ color: AMBER }}>
                      Revisar <ChevronRight size={12} />
                    </button>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">

          {/* Mapa */}
          <section aria-labelledby="mapa-titulo" className="xl:col-span-2 rounded-2xl border p-4 md:p-5 flex flex-col" style={cardStyle}>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(103,183,232,0.12)', color: SKY }}>
                <MapPin size={17} strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <h2 id="mapa-titulo" className="font-bold text-sm md:text-base" style={{ color: 'var(--text)' }}>Mapa de estaciones</h2>
                <p className="text-xs" style={{ color: 'var(--text2)' }}>Cada punto toma el color de su calidad del aire</p>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden border relative z-0 h-[300px] md:h-[440px]" style={{ borderColor: 'var(--border)' }}>
              <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {devices.map((device) => {
                  if (!device.lat || !device.lng) return null
                  const aqiData = aqis[device.id]
                  const color = stationColor(device)
                  return (
                    <Marker key={device.id} position={[device.lat, device.lng]} icon={createIcon(device)}>
                      <Popup>
                        <div className="font-sans text-center min-w-[140px]">
                          <strong className="block text-sm mb-1.5">{device.name}</strong>
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                            {!isOnline(device) ? 'Sin conexión' : aqiData?.category ? `${aqiData.category}${aqiData.aqi != null ? ` · AQI ${Math.round(aqiData.aqi)}` : ''}` : 'En línea'}
                          </span>
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
              </MapContainer>
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs" style={{ color: 'var(--text2)' }} aria-label="Escala de calidad del aire">
              {AQI_SCALE.map(s => (
                <li key={s.key} className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.label}
                </li>
              ))}
              <li className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: OFFLINE }} />Sin conexión
              </li>
            </ul>
          </section>

          {/* Estado de red */}
          <section aria-labelledby="red-titulo" className="rounded-2xl border p-4 md:p-5 flex flex-col" style={cardStyle}>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(44,182,125,0.12)', color: '#2CB67D' }}>
                <Radio size={17} strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <h2 id="red-titulo" className="font-bold text-sm md:text-base" style={{ color: 'var(--text)' }}>Estado de red</h2>
                <p className="text-xs" style={{ color: 'var(--text2)' }}>Primero las que necesitan atención</p>
              </div>
            </div>

            {total === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 rounded-xl border border-dashed" style={{ borderColor: 'var(--border)' }}>
                <Cpu size={28} style={{ color: 'var(--text2)', opacity: 0.4 }} />
                <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--text)' }}>Registra tu primera estación</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text2)' }}>Cuando empiece a enviar datos aparecerá aquí y en el mapa.</p>
              </div>
            ) : (
              <ul className="-mx-2 overflow-y-auto max-h-[440px]">
                {sorted.slice(0, 6).map((device) => {
                  const aqiData = aqis[device.id]
                  const color = stationColor(device)
                  const online = isOnline(device)
                  return (
                    <li key={device.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/devices/${device.id}`)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B7E8]/40 group"
                      >
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold"
                              style={{ background: `${color}1F`, color, fontVariantNumeric: 'tabular-nums' }}>
                          {online && aqiData?.aqi != null ? Math.round(aqiData.aqi) : <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold truncate" style={{ color: 'var(--text)' }}>{device.name}</span>
                          <span className="block text-xs mt-0.5 truncate" style={{ color: 'var(--text2)' }}>
                            <span style={{ color: online ? color : 'var(--text2)' }}>{!online ? 'Sin conexión' : aqiData?.category || 'En línea'}</span>
                            {device.label ? ` · ${device.label}` : ''}
                          </span>
                        </span>
                        <ChevronRight size={16} className="shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" style={{ color: 'var(--text2)' }} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {total > 6 && (
              <button
                type="button"
                onClick={() => navigate('/dispositivos')}
                className="mt-auto pt-3 flex items-center justify-center gap-1 text-xs font-bold transition-all hover:gap-2"
                style={{ color: SKY }}
              >
                Ver las {total} estaciones <ChevronRight size={13} />
              </button>
            )}
          </section>

        </div>
      </div>
    </ClienteLayout>
  )
}
