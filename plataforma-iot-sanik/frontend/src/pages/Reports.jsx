import { useState, useEffect } from 'react'
import ClienteLayout from '../components/sanik/ClienteLayout'
import AdminLayout from '../components/admin/AdminLayout'
import useAuthStore from '../store/auth'
import { reports as reportsApi, organizations as orgsApi } from '../services/api'
import { 
  BarChart3, Thermometer, Wind, Filter, Calendar, 
  Map as MapIcon, Download, AlertCircle, Info, RefreshCw,
  ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react'

// Leaflet
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import 'leaflet.heat'

// Fix para iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Iconos especiales para extremos (MÁS PEQUEÑOS)
const hotIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [15, 25],
  iconAnchor: [7, 25],
  popupAnchor: [1, -20],
  shadowSize: [25, 25]
});

const coldIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [15, 25],
  iconAnchor: [7, 25],
  popupAnchor: [1, -20],
  shadowSize: [25, 25]
});

// Icono por defecto pequeño
const smallIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [12, 20],
  iconAnchor: [6, 20],
  popupAnchor: [1, -15],
  shadowSize: [20, 20],
  className: 'opacity-70'
});

// Componente para la capa de calor
function HeatmapLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    // Preparar puntos: [lat, lng, intensidad]
    // La intensidad se basa en la temperatura, normalizada (ej: 18-35 -> 0-1)
    const heatPoints = points.map(p => [
      p.lat, 
      p.lng, 
      Math.min(1, Math.max(0.4, (parseFloat(p.avg_temp) - 15) / 20)) // Mínimo 0.4 para destacar más
    ]);

    const heatLayer = L.heatLayer(heatPoints, {
      radius: 60, // Aumentado de 40 a 60
      blur: 15,   // Reducido de 25 a 15
      maxZoom: 15,
      gradient: {
        0.0: 'blue',
        0.2: 'cyan',
        0.4: 'lime',
        0.6: 'yellow',
        0.8: 'orange',
        1.0: 'red'
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}

// Componente para recalibrar centro del mapa
function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function Reports() {
  const { user } = useAuthStore()
  const isClient = user?.role === 'client'
  
  const [activeTab, setActiveTab] = useState('heatmaps')
  const [loading, setLoading] = useState(true)
  const [heatmapData, setHeatmapData] = useState([])
  const [riskData, setRiskData] = useState([])
  const [sortOrder, setSortOrder] = useState('desc') // 'asc' | 'desc'
  
  const toggleSort = () => {
    const nextOrder = sortOrder === 'desc' ? 'asc' : 'desc'
    setSortOrder(nextOrder)
    const sorted = [...riskData].sort((a, b) => {
      return nextOrder === 'desc' ? b.riskScore - a.riskScore : a.riskScore - b.riskScore
    })
    setRiskData(sorted)
  }

  const [orgs, setOrgs] = useState([])
  
  // Filtros
  const [filters, setFilters] = useState({
    orgId: isClient ? user?.orgId : '',
    start: '',
    end: ''
  })

  // Cargar organizaciones (solo si es admin)
  useEffect(() => {
    if (!isClient) {
      orgsApi.list().then(setOrgs)
    }
  }, [isClient])

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'heatmaps') {
        const data = await reportsApi.getHeatmapData(filters.orgId, filters.start, filters.end)
        setHeatmapData(data)
      } else {
        const data = await reportsApi.getRespiratoryRisk(filters.orgId, filters.start, filters.end)
        const sorted = [...data].sort((a, b) => {
          return sortOrder === 'desc' ? b.riskScore - a.riskScore : a.riskScore - b.riskScore
        })
        setRiskData(sorted)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeTab, filters.orgId])

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value })
  }

  // Quetzaltenango coords por defecto
  const XELA_COORDS = [14.8347, -91.5181]

  // Detectar estaciones extremas
  const getExtremes = () => {
    if (heatmapData.length === 0) return { max: null, min: null };
    
    let maxStation = heatmapData[0];
    let minStation = heatmapData[0];

    heatmapData.forEach(d => {
      if (parseFloat(d.max_temp) > parseFloat(maxStation.max_temp)) maxStation = d;
      if (parseFloat(d.min_temp) < parseFloat(minStation.min_temp)) minStation = d;
    });

    return { max: maxStation, min: minStation };
  }

  const extremes = getExtremes();

  // Elegir Layout
  const Layout = isClient ? ClienteLayout : AdminLayout

  return (
    <Layout>
      <div className="space-y-8 p-6 lg:p-10">
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
              Centro de Reportes
            </h1>
            <p className="text-base mt-2" style={{ color: 'var(--text2)' }}>
              Análisis avanzado de datos ambientales y riesgos de salud.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchData}
              className="p-2.5 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button className="flex items-center gap-2 bg-[#67B7E8] hover:bg-[#52A8E0] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#67B7E8]/20">
              <Download size={18} /> Exportar PDF
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="rounded-3xl p-6 border flex flex-wrap items-end gap-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          {!isClient && (
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text2)' }}>Organización</label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={16} />
                <select 
                  name="orgId"
                  value={filters.orgId}
                  onChange={handleFilterChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[#67B7E8]/20"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  <option value="">Todas las organizaciones</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="flex-1 min-w-[150px]">
            <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text2)' }}>Desde</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={16} />
              <input 
                type="date" 
                name="start"
                value={filters.start}
                onChange={handleFilterChange}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text2)' }}>Hasta</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={16} />
              <input 
                type="date" 
                name="end"
                value={filters.end}
                onChange={handleFilterChange}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>
          </div>

          <button 
            onClick={fetchData}
            className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ background: 'rgba(103,183,232,0.1)', color: '#67B7E8' }}
          >
            Aplicar Filtros
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 rounded-2xl w-fit" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <button 
            onClick={() => setActiveTab('heatmaps')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'heatmaps' ? 'bg-[#67B7E8] text-white shadow-md' : 'text-gray-400 hover:bg-black/5'}`}
          >
            <Thermometer size={18} /> Islas de Calor
          </button>
          <button 
            onClick={() => setActiveTab('respiratory')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'respiratory' ? 'bg-[#67B7E8] text-white shadow-md' : 'text-gray-400 hover:bg-black/5'}`}
          >
            <Wind size={18} /> Riesgo Respiratorio
          </button>
        </div>

        {/* Contenido Reporte 1: Islas de Calor */}
        {activeTab === 'heatmaps' && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 rounded-3xl overflow-hidden border shadow-sm relative min-h-[500px]" style={{ borderColor: 'var(--border)' }}>
              <MapContainer center={XELA_COORDS} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <ChangeView center={XELA_COORDS} zoom={13} />
                <HeatmapLayer points={heatmapData} />
                
                {heatmapData.map(d => {
                  const isMax = extremes.max && d.id === extremes.max.id;
                  const isMin = extremes.min && d.id === extremes.min.id;
                  
                  return (
                    d.lat && d.lng && (
                      <Marker 
                        key={d.id} 
                        position={[d.lat, d.lng]}
                        icon={isMax ? hotIcon : isMin ? coldIcon : smallIcon}
                      >
                        <Popup>
                          <div className="text-center">
                            <strong className="block mb-1">{d.name}</strong>
                            {isMax && <div className="text-[10px] font-bold text-red-600 uppercase mb-1">🔥 Punto más cálido</div>}
                            {isMin && <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">❄️ Punto más fresco</div>}
                            <div className="text-2xl font-bold" style={{ color: isMax ? '#ef4444' : isMin ? '#3b82f6' : 'var(--text)' }}>
                              {parseFloat(d.avg_temp).toFixed(1)}°C
                            </div>
                            <div className="text-xs text-gray-500">Humedad: {parseFloat(d.avg_hum).toFixed(0)}%</div>
                          </div>
                        </Popup>
                      </Marker>
                    )
                  )
                })}
              </MapContainer>
              
              {/* Leyenda del Mapa */}
              <div className="absolute bottom-6 left-6 z-[1000] bg-white/90 dark:bg-black/80 backdrop-blur p-4 rounded-2xl border shadow-lg" style={{ borderColor: 'var(--border)' }}>
                <h4 className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--text)' }}>Escala Térmica (Heatmap)</h4>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-32 rounded-full bg-gradient-to-r from-blue-500 via-green-400 via-yellow-400 via-orange-400 to-red-500" />
                </div>
                <div className="flex justify-between mt-1 text-[10px] font-bold" style={{ color: 'var(--text2)' }}>
                  <span>Fresco (15°C)</span>
                  <span>Calor (35°C+)</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl p-8 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <AlertCircle size={20} className="text-[#67B7E8]" /> Resumen Térmico
                </h3>
                
                <div className="space-y-4">
                   <div className="flex justify-between items-center p-4 rounded-2xl bg-black/5 dark:bg-white/5">
                      <span className="text-sm font-medium" style={{ color: 'var(--text2)' }}>Temp. Promedio</span>
                      <span className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                        {heatmapData.length > 0 ? (heatmapData.reduce((acc, curr) => acc + parseFloat(curr.avg_temp), 0) / heatmapData.length).toFixed(1) : '—'}°C
                      </span>
                   </div>
                   <div className="flex justify-between items-center p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                      <span className="text-sm font-bold text-red-500">Punto más cálido</span>
                      <span className="text-xl font-black text-red-600">
                        {heatmapData.length > 0 ? Math.max(...heatmapData.map(d => parseFloat(d.max_temp))).toFixed(1) : '—'}°C
                      </span>
                   </div>
                   <div className="flex justify-between items-center p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                      <span className="text-sm font-bold text-blue-500">Punto más fresco</span>
                      <span className="text-xl font-black text-blue-600">
                        {heatmapData.length > 0 ? Math.min(...heatmapData.map(d => parseFloat(d.min_temp))).toFixed(1) : '—'}°C
                      </span>
                   </div>
                </div>
              </div>

              <div className="rounded-3xl p-8 border border-amber-500/20 bg-amber-500/5" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-amber-600">
                  <Info size={16} /> Conclusión Ambiental
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
                  {heatmapData.some(d => d.avg_temp > 28) 
                    ? "Se detectan islas de calor moderadas en las zonas industriales registradas. Se recomienda aumentar la cobertura vegetal en estas áreas."
                    : "Las temperaturas se mantienen dentro de los rangos normales para la región durante este periodo."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Contenido Reporte 2: Riesgo Respiratorio */}
        {activeTab === 'respiratory' && (
          <div className="space-y-6">
             <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Riesgo Bajo', color: '#10b981', desc: 'Aire óptimo' },
                  { label: 'Riesgo Moderado', color: '#f59e0b', desc: 'Sensibles vigilar' },
                  { label: 'Riesgo Alto', color: '#ef4444', desc: 'Evitar esfuerzo' },
                  { label: 'Riesgo Muy Alto', color: '#7c3aed', desc: 'Emergencia' },
                ].map(l => (
                  <div key={l.label} className="p-4 rounded-2xl border flex items-center gap-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
                    <div>
                      <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>{l.label}</div>
                      <div className="text-[10px] uppercase font-bold opacity-50" style={{ color: 'var(--text2)' }}>{l.desc}</div>
                    </div>
                  </div>
                ))}
             </div>

             <div className="rounded-3xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/5 dark:bg-white/5 border-b" style={{ borderColor: 'var(--border)' }}>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text2)' }}>Estación / Zona</th>
                      <th 
                        className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors" 
                        style={{ color: 'var(--text2)' }}
                        onClick={toggleSort}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Nivel de Riesgo
                          {sortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                        </div>
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-center" style={{ color: 'var(--text2)' }}>Enfermedad Probable</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text2)' }}>Recomendación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskData.map(row => (
                      <tr key={row.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{row.name}</div>
                          <div className="text-[10px] text-gray-500 font-mono">ID: {row.id.split('-')[0]}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                            row.riskLevel === 'Alto' ? 'bg-red-100 text-red-600' : 
                            row.riskLevel === 'Moderado' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                          }`}>
                            {row.riskLevel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>{row.disease || 'Estable'}</div>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>{row.conclusion}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>

             <div className="rounded-3xl p-8 border flex items-start gap-6 bg-[#67B7E8]/5" style={{ borderColor: '#67B7E830' }}>
                <div className="w-12 h-12 rounded-2xl bg-[#67B7E8]/10 flex items-center justify-center shrink-0">
                  <BarChart3 className="text-[#67B7E8]" />
                </div>
                <div>
                   <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>Análisis de Vulnerabilidad</h3>
                   <p className="text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
                     Basado en los niveles de PM2.5 detectados en {riskData.filter(d => d.riskLevel === 'Alto').length} zonas, 
                     se estima un riesgo incrementado para grupos vulnerables (niños y adultos mayores). 
                     Se recomienda emitir alertas preventivas a través de los canales digitales.
                   </p>
                </div>
             </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
