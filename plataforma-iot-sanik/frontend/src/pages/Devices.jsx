import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ClienteLayout from "../components/sanik/ClienteLayout"
import { devices as devicesApi } from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { Search, MapPin, Eye, Wifi, WifiOff, Server, ArrowRight, Clock } from 'lucide-react'

// ─── Helpers compartidos ────────────────────────────────────────────────────
const getAqiColor = (category) => {
  if (!category) return '#9CA3AF'
  const cat = category.toLowerCase()
  if (cat.includes('excelente')) return '#10B981'
  if (cat.includes('buena'))     return '#34D399'
  if (cat.includes('precaución')) return '#F59E0B'
  if (cat.includes('mala'))      return '#F97316'
  return '#EF4444'
}

// ─── Componente mapa ────────────────────────────────────────────────────────
function DevicesMap({ devices, aqis, onSelect }) {
  const mapRef        = useRef(null)
  const instanceRef   = useRef(null)
  const markersLayerRef = useRef(null)
  const boundsSetRef  = useRef(false)

  useEffect(() => {
    const withGPS = devices.filter(d => d.lat && d.lng)
    if (!withGPS.length) return

    const L = window.L

    const initMap = () => {
      if (!mapRef.current || instanceRef.current) return
      const map = L.map(mapRef.current, { scrollWheelZoom: false, zoomControl: true })
      instanceRef.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map)
      markersLayerRef.current = L.layerGroup().addTo(map)
    }

    const updateMarkers = () => {
      if (!instanceRef.current || !markersLayerRef.current) return
      const map = instanceRef.current
      markersLayerRef.current.clearLayers()

      withGPS.forEach(d => {
        const isOnline    = d.status === 'online'
        const aqiData     = aqis ? aqis[d.id] : null
        const markerColor = !isOnline
          ? '#9CA3AF'
          : (aqiData ? getAqiColor(aqiData.category) : '#2BA8A0')

        // ── Círculo de zona AQI (radio en metros reales) ──────────────────
        if (isOnline && aqiData) {
          const radioMetros = 100

          // Relleno difuso
          L.circle([d.lat, d.lng], {
            radius:      radioMetros,
            color:       markerColor,
            fillColor:   markerColor,
            fillOpacity: 0.10,
            weight:      0,
            interactive: false
          }).addTo(markersLayerRef.current)

          // Borde punteado
          L.circle([d.lat, d.lng], {
            radius:      radioMetros,
            color:       markerColor,
            fillColor:   'transparent',
            fillOpacity: 0,
            weight:      1,
            opacity:     0.30,
            dashArray:   '4 6',
            interactive: false
          }).addTo(markersLayerRef.current)
        }
        // ─────────────────────────────────────────────────────────────────

        // Marcador con radar ring
        const icon = L.divIcon({
          html: `
            <div style="position:relative;width:36px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;">
              ${isOnline ? `
                <div style="position:absolute;width:36px;height:36px;border-radius:50%;border:2px solid ${markerColor};opacity:0.25;animation:radarRing1 2s ease-out infinite;"></div>
                <div style="position:absolute;width:24px;height:24px;border-radius:50%;border:2px solid ${markerColor};opacity:0.5;animation:radarRing2 2s ease-out infinite 0.4s;"></div>
              ` : ''}
              <div style="position:absolute;width:14px;height:14px;border-radius:50%;background:${markerColor};border:2.5px solid white;box-shadow:0 2px 10px ${markerColor}99;"></div>
            </div>`,
          className:  '',
          iconAnchor: [18, 18]
        })

        const marker = L.marker([d.lat, d.lng], { icon }).addTo(markersLayerRef.current)

        // Tooltip enriquecido con AQI numérico
        marker.bindTooltip(`
          <div style="min-width:140px">
            <b>${d.name}</b>
            <div style="margin-top:4px">
              <span style="
                display:inline-block;
                background:${markerColor}20;
                color:${markerColor};
                padding:2px 8px;border-radius:999px;
                font-size:11px;font-weight:600
              ">
                ${isOnline
                  ? (aqiData
                      ? `● AQI ${aqiData.aqi ?? ''} · ${aqiData.category}`
                      : '● En línea')
                  : '● Sin señal'}
              </span>
            </div>
            ${aqiData?.pm25 != null ? `<div style="color:#6B7280;font-size:11px;margin-top:4px">PM2.5 · ${aqiData.pm25} µg/m³</div>` : ''}
          </div>
        `, {
          direction: 'top', offset: [0, -10], className: 'leaflet-tooltip-custom'
        })

        marker.on('click', () => onSelect(d))
      })

      // Encuadrar la cámara solo la primera vez
      if (!boundsSetRef.current && withGPS.length > 0) {
        if (withGPS.length === 1) {
          map.setView([withGPS[0].lat, withGPS[0].lng], 14)
        } else {
          map.fitBounds(
            L.latLngBounds(withGPS.map(d => [d.lat, d.lng])),
            { padding: [40, 40] }
          )
        }
        boundsSetRef.current = true
      }
    }

    if (!window.L) {
      const link  = document.createElement('link')
      link.rel    = 'stylesheet'
      link.href   = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)

      const script     = document.createElement('script')
      script.src       = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload    = () => { initMap(); updateMarkers() }
      document.head.appendChild(script)
    } else {
      initMap()
      updateMarkers()
    }

    return () => {}
  }, [devices, aqis, onSelect])

  const withGPS = devices.filter(d => d.lat && d.lng)
  if (!withGPS.length) return null

  return (
    <>
      <style>{`
        @keyframes radarRing1 {
          0%   { transform: scale(0.6); opacity: 0.4; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes radarRing2 {
          0%   { transform: scale(0.6); opacity: 0.6; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        .leaflet-tooltip-custom {
          background: white;
          border: 1px solid #D6E8F5;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .leaflet-tooltip-custom::before { display: none; }
      `}</style>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
    </>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function ClientDevices() {
  const navigate = useNavigate()
  const [search,  setSearch]  = useState('')
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [selected, setSelected] = useState(null)
  const [aqis,    setAqis]    = useState({})

  // Carga inicial de dispositivos
  useEffect(() => {
    devicesApi.list().then(data => {
      setDevices(data)
      setLoading(false)
    })
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

  // Carga AQI por cada dispositivo
  useEffect(() => {
    if (devices.length > 0) {
      devices.forEach(d => {
        devicesApi.aqi(d.id).then(res => {
          if (res) setAqis(prev => ({ ...prev, [d.id]: res }))
        }).catch(() => {})
      })
    }
  }, [devices])

  const filtered = devices.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase())
      || d.label.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || d.status === filter
    return matchSearch && matchFilter
  })

  const online  = devices.filter(d => d.status === 'online').length
  const offline = devices.length - online
  const withGPS = devices.filter(d => d.lat && d.lng).length

  // AQI del dispositivo seleccionado (para el panel lateral)
  const selectedAqi = selected ? aqis[selected.id] : null
  const selectedColor = selectedAqi
    ? getAqiColor(selectedAqi.category)
    : (selected?.status === 'online' ? '#2BA8A0' : '#9CA3AF')

  return (
    <ClienteLayout>
      <div className="min-h-full px-4 py-6 md:px-8 md:py-10 page-bg">

        {/* ── Encabezado ── */}
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1 font-syne" style={{ color: 'var(--text)' }}>
              Mis Estaciones
            </h1>
            <p className="text-xs md:text-sm" style={{ color: 'var(--text2)' }}>
              {devices.length} estaciones
              {' · '}<span style={{ color: '#2BA8A0' }}>{online} en línea</span>
              {' · '}<span style={{ color: '#F59E0B' }}>{offline} sin señal</span>
            </p>
          </div>

          <div className="flex flex-col xs:flex-row items-start xs:items-center gap-3 w-full sm:w-auto">
            {/* Filtros online/offline */}
            <div className="flex items-center gap-1 p-1 rounded-xl border w-full xs:w-auto overflow-x-auto" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              {[['all','Todas'],['online','En línea'],['offline','Sin señal']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-1 xs:flex-none"
                  style={filter === key ? { background: '#67B7E8', color: 'white' } : { color: 'var(--text2)' }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Buscador */}
            <div className="relative w-full xs:w-56">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text2)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar estación..."
                className="pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none w-full"
                style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>
          </div>
        </div>

        {/* ── Mapa + panel lateral ── */}
        {withGPS > 0 && (
          <div
            className="rounded-3xl border overflow-hidden mb-8 flex flex-col lg:flex-row"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', height: 'auto', minHeight: 360 }}
          >
            {/* Mapa */}
            <div className="flex-1 relative min-h-[300px] lg:min-h-0" style={{ zIndex: 0 }}>
              <div
                className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-xl text-[10px] md:text-xs font-semibold"
                style={{ background: 'var(--card)', color: '#67B7E8', border: '1px solid var(--border)' }}
              >
                <MapPin size={11} className="inline mr-1" />
                Presioná una estación
              </div>
              <DevicesMap devices={filtered} aqis={aqis} onSelect={setSelected} />
            </div>

            {/* Panel lateral */}
            <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l flex flex-col" style={{ borderColor: 'var(--border)' }}>

              {/* Header del panel */}
              <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                  {selected ? selected.name : 'Seleccioná una estación'}
                </h3>
                {selected && (
                  <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text2)' }}>
                    {selected.label}
                  </p>
                )}
              </div>

              {selected ? (
                <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto">

                  {/* Pill de estado */}
                  <div className="flex items-center gap-2">
                    <span
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold"
                      style={{
                        background: selected.status === 'online' ? '#2BA8A010' : '#F59E0B10',
                        color:      selected.status === 'online' ? '#2BA8A0'   : '#F59E0B'
                      }}
                    >
                      {selected.status === 'online'
                        ? <><Wifi size={10} /> En línea</>
                        : <><WifiOff size={10} /> Sin señal</>}
                    </span>
                  </div>

                  {/* ── AQI score card ── */}
                  {selectedAqi && (
                    <div
                      className="rounded-xl p-3 flex items-center gap-3"
                      style={{ background: selectedColor + '12' }}
                    >
                      {/* Número */}
                      <div>
                        <div className="text-2xl font-bold leading-none" style={{ color: selectedColor }}>
                          {selectedAqi.aqi ?? '—'}
                        </div>
                        <div className="text-xs font-semibold mt-1" style={{ color: selectedColor }}>
                          {selectedAqi.category}
                        </div>
                      </div>

                      {/* Mini barra */}
                      <div className="flex-1">
                        <div className="text-xs mb-1" style={{ color: 'var(--text2)' }}>Nivel AQI</div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width:      `${Math.min((selectedAqi.aqi ?? 0), 100)}%`,
                              background: selectedColor
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text2)', fontSize: 9 }}>
                          <span>0</span><span>50</span><span>100</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Coordenadas */}
                  {selected.lat && (
                    <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text2)' }}>
                      <MapPin size={11} />
                      {Number(selected.lat).toFixed(5)}, {Number(selected.lng).toFixed(5)}
                    </div>
                  )}

                  {/* Última vez visto */}
                  {selected.last_seen && (
                    <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text2)' }}>
                      <Clock size={11} />
                      {new Date(selected.last_seen).toLocaleString('es-GT')}
                    </div>
                  )}

                  <div className="flex-1" />

                  {/* Botones */}
                  <button
                    onClick={() => navigate(`/devices/${selected.id}`)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                    style={{ background: '#67B7E8' }}
                  >
                    Ver detalles <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="w-full text-xs py-2 rounded-xl border transition-all"
                    style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
                  >
                    Cerrar
                  </button>
                </div>
              ) : (
                <div
                  className="flex-1 flex flex-col items-center justify-center p-6 text-center"
                  style={{ color: 'var(--text2)' }}
                >
                  <MapPin size={28} className="mb-2 opacity-20" />
                  <p className="text-xs">Presioná un punto<br />en el mapa</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Grid de tarjetas ── */}
        {loading ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--text2)' }}>
            Cargando estaciones...
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="text-center py-16 rounded-2xl border border-dashed"
            style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
          >
            <Server size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Sin resultados</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(d => {
              const isOnline = d.status === 'online'
              const aqiData  = aqis[d.id]
              const cardColor = isOnline && aqiData
                ? getAqiColor(aqiData.category)
                : (isOnline ? '#2BA8A0' : '#F59E0B')

              return (
                <div
                  key={d.id}
                  onClick={() => navigate(`/devices/${d.id}`)}
                  className="group rounded-2xl p-5 border cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg"
                  style={{ background: 'var(--card)', borderColor: isOnline ? cardColor + '40' : 'var(--border)' }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: cardColor + '1A', color: cardColor }}
                    >
                      <Server size={18} />
                    </div>

                    {/* ── TERNARIO CORREGIDO ── */}
                    <span
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold"
                      style={{
                        background: isOnline ? cardColor + '1A' : '#F59E0B1A',
                        color:      isOnline ? cardColor         : '#F59E0B'
                      }}
                    >
                      {isOnline
                        ? <><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cardColor }} /><Wifi size={9} /> {aqiData ? aqiData.category : 'En línea'}</>
                        : <><WifiOff size={9} /> Sin señal</>}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm mb-0.5 truncate" style={{ color: 'var(--text)' }}>
                    {d.name}
                  </h3>
                  <p className="text-xs font-mono mb-3" style={{ color: 'var(--text2)' }}>
                    {d.label}
                  </p>

                  <div className="space-y-1 mb-4">
                    {d.lat && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text2)' }}>
                        <MapPin size={11} /> {Number(d.lat).toFixed(4)}, {Number(d.lng).toFixed(4)}
                      </div>
                    )}
                    {d.last_seen && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text2)' }}>
                        <Clock size={11} /> {new Date(d.last_seen).toLocaleString('es-GT')}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-xs" style={{ color: 'var(--text2)' }}>
                      {d.variable_count || 0} variables
                    </span>
                    <span
                      className="flex items-center gap-1 text-xs font-semibold group-hover:gap-2 transition-all"
                      style={{ color: '#67B7E8' }}
                    >
                      <Eye size={12} /> Ver detalles <ArrowRight size={11} />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </ClienteLayout>
  )
}