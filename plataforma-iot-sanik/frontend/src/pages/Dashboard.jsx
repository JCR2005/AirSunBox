import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ClienteLayout from '../components/sanik/ClienteLayout'
import { devices as devicesApi } from '../services/api'
import { Activity, Cpu, AlertTriangle, MapPin, Navigation } from 'lucide-react'
import useAuthStore from '../store/auth'
import { useWebSocket } from '../hooks/useWebSocket'

// Importes para el Mapa
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

const pulseStyle = `
  @keyframes pulse-ring {
    0% { transform: scale(0.8); opacity: 1; }
    100% { transform: scale(2.4); opacity: 0; }
  }
  .pulse-marker { position: relative; }
  .pulse-marker::before {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 12px; height: 12px;
    border-radius: 50%;
    animation: pulse-ring 1.5s ease-out infinite;
  }
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

  // Función para obtener el color exacto del AQI
  const getAqiColor = (category) => {
    if (!category) return '#9CA3AF'
    const cat = category.toLowerCase()
    if (cat.includes('excelente')) return '#10B981'  
    if (cat.includes('buena')) return '#34D399'      
    if (cat.includes('precaución')) return '#F59E0B' 
    if (cat.includes('mala')) return '#F97316'       
    return '#EF4444'                                 
  }

  // Creador de íconos que toma en cuenta el AQI
  const createIcon = (device) => {
    const isOnline = device.status === 'online'
    const aqiData = aqis[device.id]
    const markerColor = !isOnline ? '#9CA3AF' : (aqiData ? getAqiColor(aqiData.category) : '#2BA8A0')
    
    return L.divIcon({
      html: `<div style="
        width:14px;height:14px;border-radius:50%;
        background:${markerColor};
        border:2px solid white;
        box-shadow:0 0 0 4px ${isOnline ? markerColor + '4D' : 'rgba(156,163,175,0.3)'};
        animation:${isOnline ? 'pulse-ring 1.5s ease-out infinite' : 'none'}
      "></div>`,
      className: '',
      iconAnchor: [7, 7]
    })
  }

  const activeCount = devices.filter(d => d.status === 'online' || d.status === 'active').length
  const offlineCount = devices.filter(d => d.status === 'offline' || d.status === 'inactive').length

  const today = new Intl.DateTimeFormat('es-GT', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(new Date())

  const STAT_CARDS = [
    { label: 'Total Estaciones', value: devices.length, icon: Cpu, color: '#67B7E8', bg: 'rgba(103,183,232,0.12)' },
    { label: 'En Línea', value: activeCount, icon: Activity, color: '#2BA8A0', bg: 'rgba(43,168,160,0.1)' },
    { label: 'Sin Conexión', value: offlineCount, icon: AlertTriangle, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  ]

  const defaultCenter = [14.8347, -91.5185] 
  const mapCenter = devices.length > 0 && devices[0].lat ? [devices[0].lat, devices[0].lng] : defaultCenter
  const greetingName = org?.name || user?.name || '';

  if (loading) return (
    <ClienteLayout>
      <div className="flex items-center justify-center h-screen text-sm font-medium" style={{color:'var(--text2)'}}>
        Preparando tu panel...
      </div>
    </ClienteLayout>
  )

  return (
    <ClienteLayout>
      <div 
        className="min-h-full px-6 py-6 md:px-10 md:py-10 page-bg"
      >
        <style>{pulseStyle}</style>
        {offlineCount > 0 && (
          <div className="mb-6 flex items-center gap-3 px-5 py-3.5 rounded-2xl border"
            style={{background:'rgba(245,158,11,0.08)', borderColor:'rgba(245,158,11,0.3)'}}>
            <AlertTriangle size={16} style={{color:'#F59E0B', flexShrink:0}}/>
            <p className="text-sm font-medium" style={{color:'#F59E0B'}}>
              {offlineCount} estación{offlineCount > 1 ? 'es' : ''} sin conexión.
            </p>
          </div>
        )}
        
        <div className="mb-8 md:mb-10 flex flex-col gap-1">
          <p className="text-xs md:text-sm font-semibold capitalize tracking-wide" style={{ color: '#67B7E8' }}>
            {today}
          </p>
          <h1 className="text-responsive-h1 font-bold tracking-tight font-syne" style={{ color: 'var(--text)' }}>
            {greetingName ? `Bienvenido, ${greetingName}` : 'Bienvenido'}
          </h1>
          <p className="text-sm md:text-base mt-2" style={{ color: 'var(--text2)' }}>
            Panel general de monitoreo {org?.name ? `para ${org.name}` : 'de estaciones'}.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
          {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
            <div 
              key={label} 
              className="group rounded-3xl p-5 md:p-6 transition-all duration-300 hover:-translate-y-1.5 cursor-default" 
              style={{ 
                background: 'var(--card)', 
                border: '1px solid var(--border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
              }}
            >
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: bg }}>
                  <Icon size={20} className="md:w-[22px]" strokeWidth={2.5} style={{ color }} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-3xl md:text-5xl font-bold tracking-tight font-syne" style={{ color: 'var(--text)' }}>
                  {value}
                </div>
                <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--text2)' }}>
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          
          <div className="lg:col-span-2 rounded-3xl p-5 md:p-6 flex flex-col overflow-hidden relative min-h-[350px] md:min-h-[450px]" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(103,183,232,0.12)', color: '#67B7E8' }}>
                <MapPin size={18} className="md:w-[20px]" strokeWidth={2.5} />
              </div>
              <h2 className="text-responsive-h2 font-bold font-syne" style={{ color: 'var(--text)' }}>
                Ubicación
              </h2>
            </div>
            
            <div className="flex-1 w-full h-full relative z-0 rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
              <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} className="h-[300px] md:h-full min-h-[300px]">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {devices.map((device) => {
                  const aqiData = aqis[device.id]
                  const markerColor = device.status === 'online' && aqiData ? getAqiColor(aqiData.category) : (device.status === 'online' ? '#2BA8A0' : '#F59E0B')
                  
                  return (
                    device.lat && device.lng && (
                    <Marker key={device.id} position={[device.lat, device.lng]} icon={createIcon(device)}>
                        <Popup>
                          <div className="text-center font-sans">
                            <strong className="block mb-2 text-sm">{device.name}</strong>
                            
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border" style={{
                              background: markerColor + '1A', // Fondo con 10% opacidad
                              color: markerColor,
                              borderColor: markerColor + '4D' // Borde con 30% opacidad
                            }}>
                              <span 
                                className="w-1.5 h-1.5 rounded-full" 
                                style={{ 
                                  background: markerColor,
                                  boxShadow: `0 0 6px ${markerColor}`
                                }} 
                              />
                              {device.status === 'online' ? (aqiData ? aqiData.category : 'En línea') : 'Desconectado'}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    )
                  )
                })}
              </MapContainer>
            </div>
          </div>

          <div className="rounded-3xl p-8 flex flex-col" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}>
            <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Estado de red</h2>
            
            <div className="space-y-2 overflow-y-auto overflow-x-hidden max-h-[350px] pr-2">
              {devices.slice(0, 6).map((device) => {
                const aqiData = aqis[device.id]
                const dotColor = device.status === 'online' && aqiData ? getAqiColor(aqiData.category) : (device.status === 'online' ? '#2BA8A0' : '#F59E0B')
                
                return (
                <div key={device.id} className="flex items-center justify-between py-3 border-b last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] px-2 rounded-xl transition-colors" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                      style={{ 
                        background: dotColor, 
                        boxShadow: `0 0 10px ${dotColor}80` 
                      }} 
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>{device.name}</p>
                      <p className="text-xs font-medium mt-0.5 truncate" style={{ color: 'var(--text2)' }}>{device.label}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/dispositivos')}
                    className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0"
                    style={{ color: 'var(--text2)' }}
                    title="Ver detalle"
                  >
                    <Navigation size={16} />
                  </button>
                </div>
              )})}
              
              {devices.length === 0 && (
                <p className="text-sm text-center py-6 font-medium" style={{ color: 'var(--text2)' }}>
                  No hay estaciones registradas aún.
                </p>
              )}
            </div>

            {devices.length > 6 && (
              <button 
                onClick={() => navigate('/dispositivos')}
                className="mt-6 w-full py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
                style={{ background: 'var(--primary)', color: '#fff' }}
              >
                Ver todas las estaciones
              </button>
            )}
          </div>

        </div>
      </div>
    </ClienteLayout>
  )
}