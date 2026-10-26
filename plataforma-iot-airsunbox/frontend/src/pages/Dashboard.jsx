import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ClienteLayout from '../components/airsunbox/ClienteLayout'
import { devices as devicesApi } from '../services/api'
import { ChevronRight, Radio } from 'lucide-react'
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
  const greetingName = org?.name || user?.name || ''

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

  return (
    <ClienteLayout>
      <div className="min-h-full px-4 py-8 sm:px-8 lg:px-12 lg:py-12 page-bg">
        <style>{pulseStyle}</style>
        <div className="max-w-6xl mx-auto">

          {/* Encabezado */}
          <header>
            <p className="text-sm first-letter:uppercase" style={{ color: 'var(--text2)' }}>{today}</p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-bold leading-tight break-words" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
              {greetingName ? `Hola, ${greetingName}` : 'Hola'}
            </h1>
            <p className="mt-1 text-base" style={{ color: 'var(--text2)' }}>
              Así está tu red de monitoreo ahora.
            </p>
          </header>

          {/* Resumen de la red */}
          <section aria-label="Resumen de la red" className="mt-8 rounded-2xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <dl className="grid grid-cols-3 divide-x" style={{ '--tw-divide-opacity': 1 }}>
              {[
                { label: 'Total de estaciones', value: total, color: 'var(--text)' },
                { label: 'En línea', value: activeCount, color: SKY },
                { label: 'Sin conexión', value: offlineCount, color: offlineCount ? AMBER : 'var(--text)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="px-4 sm:px-6 py-5 flex flex-col justify-between" style={{ borderColor: 'var(--border)' }}>
                  <dt className="text-sm" style={{ color: 'var(--text2)' }}>{label}</dt>
                  <dd className="mt-1 text-3xl sm:text-4xl font-bold" style={{ color, fontFamily: "'Syne', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Proporción en línea / sin conexión */}
            <div className="px-4 sm:px-6 pb-5">
              <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: 'var(--border)' }} role="img"
                   aria-label={`${onlinePct}% de las estaciones en línea`}>
                <span className="h-full transition-[width] duration-700" style={{ width: `${onlinePct}%`, background: SKY }} />
                <span className="h-full transition-[width] duration-700" style={{ width: total ? `${Math.round((offlineCount / total) * 100)}%` : 0, background: AMBER }} />
              </div>
              <p className="mt-2 text-sm flex items-center gap-2" style={{ color: offlineCount ? AMBER : 'var(--text2)' }}>
                {offlineCount > 0 ? (
                  <>
                    <span className="w-2 h-2 rounded-full" style={{ background: AMBER }} />
                    {offlineCount === 1 ? '1 estación sin conexión.' : `${offlineCount} estaciones sin conexión.`}
                    <button type="button" onClick={() => navigate('/dispositivos')} className="font-semibold hover:underline" style={{ color: 'var(--text)' }}>
                      Revisar
                    </button>
                  </>
                ) : total ? (
                  <>
                    <span className="w-2 h-2 rounded-full" style={{ background: SKY }} />
                    Todas las estaciones están reportando.
                  </>
                ) : 'Aún no tienes estaciones registradas.'}
              </p>
            </div>
          </section>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-6 lg:gap-8">

            {/* Mapa */}
            <section aria-labelledby="mapa-titulo">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <h2 id="mapa-titulo" className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Mapa de estaciones</h2>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text2)' }} aria-label="Escala de calidad del aire">
                  {AQI_SCALE.map(s => (
                    <li key={s.key} className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.label}
                    </li>
                  ))}
                  <li className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: OFFLINE }} />Sin conexión
                  </li>
                </ul>
              </div>
              <div className="mt-3 rounded-2xl border overflow-hidden relative z-0 h-[320px] sm:h-[420px]" style={{ borderColor: 'var(--border)' }}>
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
            </section>

            {/* Estado de red */}
            <section aria-labelledby="red-titulo" className="flex flex-col">
              <h2 id="red-titulo" className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Estado de red</h2>
              <div className="mt-3 rounded-2xl border flex-1 flex flex-col" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                {total === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
                    <Radio size={22} style={{ color: SKY }} />
                    <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--text)' }}>Registra tu primera estación</p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text2)' }}>Cuando empiece a enviar datos, la verás aquí y en el mapa.</p>
                  </div>
                ) : (
                  <ul className="px-2 py-1 overflow-y-auto max-h-[420px]">
                    {sorted.slice(0, 6).map((device, i) => {
                      const aqiData = aqis[device.id]
                      const color = stationColor(device)
                      const online = isOnline(device)
                      return (
                        <li key={device.id} className={i ? 'border-t' : ''} style={{ borderColor: 'var(--border)' }}>
                          <button
                            type="button"
                            onClick={() => navigate(`/devices/${device.id}`)}
                            className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left transition-colors hover:bg-[rgba(103,183,232,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B7E8]/40 group"
                          >
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{device.name}</span>
                              <span className="block text-xs mt-0.5 truncate" style={{ color: online ? color : 'var(--text2)' }}>
                                {!online ? 'Sin conexión' : aqiData?.category || 'En línea'}
                                {device.label ? <span style={{ color: 'var(--text2)' }}> · {device.label}</span> : null}
                              </span>
                            </span>
                            {online && aqiData?.aqi != null && (
                              <span className="text-lg font-bold shrink-0" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                                {Math.round(aqiData.aqi)}
                              </span>
                            )}
                            <ChevronRight size={16} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--text2)' }} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {total > 6 && (
                  <div className="mt-auto px-4 pb-4 pt-2">
                    <button
                      type="button"
                      onClick={() => navigate('/dispositivos')}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:border-[#67B7E8]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B7E8]/40"
                      style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}
                    >
                      Ver las {total} estaciones
                    </button>
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>
      </div>
    </ClienteLayout>
  )
}
