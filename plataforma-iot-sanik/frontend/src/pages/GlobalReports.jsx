import { useState, useEffect } from 'react'
import PublicLayout from '../components/sanik/PublicLayout'
import { reports as reportsApi } from '../services/api'
import { 
  BarChart3, Thermometer, Wind, Calendar, 
  Download, AlertCircle, Info, RefreshCw, Activity,
  ArrowUp, ArrowDown, Map as MapIcon, ShieldAlert,
  Factory, AlertTriangle, Droplets, Zap
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

const smallIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [12, 20],
  iconAnchor: [6, 20],
  popupAnchor: [1, -15],
  shadowSize: [20, 20],
  className: 'opacity-70'
});

const getContaminationIcon = (level) => {
  let color = 'green';
  if (level === 'Contaminación moderada') color = 'gold';
  if (level === 'Alta contaminación') color = 'red';
  if (level === 'Contaminación crítica') color = 'violet';
  
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
}

function HeatmapLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    const heatPoints = points.map(p => [
      p.lat, 
      p.lng, 
      Math.min(1, Math.max(0.4, (parseFloat(p.avg_temp) - 15) / 20))
    ]);
    const heatLayer = L.heatLayer(heatPoints, {
      radius: 60,
      blur: 15,
      maxZoom: 15,
      gradient: { 0.0: 'blue', 0.2: 'cyan', 0.4: 'lime', 0.6: 'yellow', 0.8: 'orange', 1.0: 'red' }
    }).addTo(map);
    return () => { map.removeLayer(heatLayer); };
  }, [map, points]);
  return null;
}

function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom); }, [center, zoom, map]);
  return null;
}

export default function GlobalReports() {
  const [activeTab, setActiveTab] = useState('heatmaps')
  const [loading, setLoading] = useState(true)
  const [heatmapData, setHeatmapData] = useState([])
  const [riskData, setRiskData] = useState([])
  const [envData, setEnvData] = useState([])
  const [selectedStation, setSelectedStation] = useState(null)
  const [sortOrder, setSortOrder] = useState('desc') // 'asc' | 'desc'
  
  const toggleSort = () => {
    const nextOrder = sortOrder === 'desc' ? 'asc' : 'desc'
    setSortOrder(nextOrder)
    const sorted = [...riskData].sort((a, b) => {
      return nextOrder === 'desc' ? b.riskScore - a.riskScore : a.riskScore - b.riskScore
    })
    setRiskData(sorted)
  }

  const [filters, setFilters] = useState({ start: '', end: '' })

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'heatmaps') {
        const data = await reportsApi.getGlobalHeatmap(filters.start, filters.end)
        setHeatmapData(data)
      } else if (activeTab === 'respiratory') {
        const data = await reportsApi.getGlobalRespiratoryRisk(filters.start, filters.end)
        const sorted = [...data].sort((a, b) => {
          return sortOrder === 'desc' ? b.riskScore - a.riskScore : a.riskScore - b.riskScore
        })
        setRiskData(sorted)
      } else if (activeTab === 'environmental') {
        const data = await reportsApi.getGlobalEnvironmentalReport(filters.start, filters.end)
        setEnvData(data)
        if (data.length > 0 && !selectedStation) {
          setSelectedStation(data[0])
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [activeTab])

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value })
  }

  const XELA_COORDS = [14.8347, -91.5181]

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

  return (
    <PublicLayout>
      <div className="space-y-6 md:space-y-8 p-4 md:p-6 lg:p-12 max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
              Reportes Ambientales Globales
            </h1>
            <p className="text-sm md:text-lg mt-2 max-w-2xl" style={{ color: 'var(--text2)' }}>
              Visualización pública de datos de toda la red Sanik. Análisis de islas de calor y riesgos respiratorios en tiempo real.
            </p>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            <button 
              onClick={fetchData}
              className="p-2 md:p-3 rounded-2xl border hover:bg-black/5 dark:hover:bg-white/5 transition-all"
              style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#67B7E8] hover:bg-[#52A8E0] text-white px-4 md:px-6 py-2.5 md:py-3 rounded-2xl text-xs md:text-sm font-bold transition-all shadow-xl shadow-[#67B7E8]/30">
              <Download size={18} /> <span className="whitespace-nowrap">Descargar Reporte</span>
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="rounded-3xl md:rounded-[2.5rem] p-4 md:p-8 border flex flex-wrap items-end gap-4 md:gap-6 shadow-sm" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="w-full md:flex-1 min-w-[150px]">
            <label className="text-[10px] md:text-xs font-bold uppercase tracking-widest block mb-2 md:mb-3 ml-1" style={{ color: 'var(--text2)' }}>Rango desde</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" size={16} />
              <input 
                type="date" 
                name="start"
                value={filters.start}
                onChange={handleFilterChange}
                className="w-full pl-10 md:pl-12 pr-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl text-xs md:text-sm border outline-none focus:ring-2 focus:ring-[#67B7E8]/20 transition-all"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>
          </div>

          <div className="w-full md:flex-1 min-w-[150px]">
            <label className="text-[10px] md:text-xs font-bold uppercase tracking-widest block mb-2 md:mb-3 ml-1" style={{ color: 'var(--text2)' }}>Rango hasta</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" size={16} />
              <input 
                type="date" 
                name="end"
                value={filters.end}
                onChange={handleFilterChange}
                className="w-full pl-10 md:pl-12 pr-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl text-xs md:text-sm border outline-none focus:ring-2 focus:ring-[#67B7E8]/20 transition-all"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>
          </div>

          <button 
            onClick={fetchData}
            className="w-full md:w-auto px-10 py-3 md:py-3.5 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold transition-all bg-[#67B7E8]/10 text-[#67B7E8] hover:bg-[#67B7E8] hover:text-white"
          >
            Filtrar Datos
          </button>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto pb-1 md:pb-0 gap-2 md:gap-3 p-1.5 rounded-2xl md:rounded-[1.5rem] w-full md:w-fit shadow-inner scrollbar-hide" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <button 
            onClick={() => setActiveTab('heatmaps')}
            className={`flex items-center whitespace-nowrap gap-2 md:gap-2.5 px-4 md:px-8 py-2.5 md:py-3.5 rounded-xl md:rounded-[1.2rem] text-xs md:text-sm font-bold transition-all ${activeTab === 'heatmaps' ? 'bg-[#67B7E8] text-white shadow-lg' : 'text-gray-400 hover:bg-black/5'}`}
          >
            <Thermometer size={16} className="md:w-5 md:h-5" /> Islas de Calor
          </button>
          <button 
            onClick={() => setActiveTab('respiratory')}
            className={`flex items-center whitespace-nowrap gap-2 md:gap-2.5 px-4 md:px-8 py-2.5 md:py-3.5 rounded-xl md:rounded-[1.2rem] text-xs md:text-sm font-bold transition-all ${activeTab === 'respiratory' ? 'bg-[#67B7E8] text-white shadow-lg' : 'text-gray-400 hover:bg-black/5'}`}
          >
            <Wind size={16} className="md:w-5 md:h-5" /> Riesgo Salud
          </button>
          <button 
            onClick={() => setActiveTab('environmental')}
            className={`flex items-center whitespace-nowrap gap-2 md:gap-2.5 px-4 md:px-8 py-2.5 md:py-3.5 rounded-xl md:rounded-[1.2rem] text-xs md:text-sm font-bold transition-all ${activeTab === 'environmental' ? 'bg-[#67B7E8] text-white shadow-lg' : 'text-gray-400 hover:bg-black/5'}`}
          >
            <ShieldAlert size={16} className="md:w-5 md:h-5" /> Contaminación
          </button>
        </div>

        {/* Contenido Reporte 1: Islas de Calor */}
        {activeTab === 'heatmaps' && (
          <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
            <div className="lg:col-span-2 rounded-3xl md:rounded-[2.5rem] overflow-hidden border shadow-xl relative h-[400px] md:h-[500px] lg:h-auto lg:min-h-[600px]" style={{ borderColor: 'var(--border)' }}>
              <MapContainer center={XELA_COORDS} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <ChangeView center={XELA_COORDS} zoom={13} />
                <HeatmapLayer points={heatmapData} />
                {heatmapData.map(d => (
                  d.lat && d.lng && (
                    <Marker key={d.id} position={[d.lat, d.lng]} icon={d.id === extremes.max?.id ? hotIcon : d.id === extremes.min?.id ? coldIcon : smallIcon}>
                      <Popup>
                        <div className="text-center p-1">
                          <strong className="block text-sm mb-1">{d.name}</strong>
                          <div className="text-3xl font-black" style={{ color: d.id === extremes.max?.id ? '#ef4444' : d.id === extremes.min?.id ? '#3b82f6' : 'var(--text)' }}>
                            {parseFloat(d.avg_temp).toFixed(1)}°C
                          </div>
                          <div className="text-[10px] uppercase font-bold text-gray-400 mt-1">Humedad: {parseFloat(d.avg_hum).toFixed(0)}%</div>
                        </div>
                      </Popup>
                    </Marker>
                  )
                ))}
              </MapContainer>
              <div className="absolute bottom-8 left-8 z-[1000] bg-white/95 dark:bg-black/90 backdrop-blur-md p-5 rounded-3xl border shadow-2xl" style={{ borderColor: 'var(--border)' }}>
                <h4 className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text)' }}>Gradiente Térmico</h4>
                <div className="h-3 w-48 rounded-full bg-gradient-to-r from-blue-500 via-green-400 via-yellow-400 via-orange-400 to-red-500" />
                <div className="flex justify-between mt-2 text-[10px] font-black opacity-60" style={{ color: 'var(--text)' }}>
                  <span>FRESCO (15°C)</span>
                  <span>CALOR (35°C+)</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[2.5rem] p-10 border shadow-sm" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <h3 className="text-xl font-bold mb-8 flex items-center gap-3" style={{ color: 'var(--text)' }}>
                  <Activity size={24} className="text-[#67B7E8]" /> Métricas Globales
                </h3>
                <div className="space-y-6">
                   <div className="p-6 rounded-3xl bg-black/5 dark:bg-white/5 border border-transparent hover:border-[#67B7E8]/30 transition-all">
                      <span className="text-xs font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--text2)' }}>Media Nacional</span>
                      <span className="text-3xl font-black" style={{ color: 'var(--text)' }}>
                        {heatmapData.length > 0 ? (heatmapData.reduce((acc, curr) => acc + parseFloat(curr.avg_temp), 0) / heatmapData.length).toFixed(1) : '—'}°C
                      </span>
                   </div>
                   <div className="p-6 rounded-3xl bg-red-500/10 border border-red-500/20">
                      <span className="text-xs font-bold text-red-500 uppercase tracking-widest block mb-1">Máxima Registrada</span>
                      <span className="text-3xl font-black text-red-600">
                        {heatmapData.length > 0 ? Math.max(...heatmapData.map(d => parseFloat(d.max_temp))).toFixed(1) : '—'}°C
                      </span>
                   </div>
                   <div className="p-6 rounded-3xl bg-blue-500/10 border border-blue-500/20">
                      <span className="text-xs font-bold text-blue-500 uppercase tracking-widest block mb-1">Mínima Registrada</span>
                      <span className="text-3xl font-black text-blue-600">
                        {heatmapData.length > 0 ? Math.min(...heatmapData.map(d => parseFloat(d.min_temp))).toFixed(1) : '—'}°C
                      </span>
                   </div>
                </div>
              </div>
              <div className="rounded-[2rem] p-8 border border-amber-500/20 bg-amber-500/5 flex gap-4" style={{ borderColor: 'var(--border)' }}>
                <Info size={24} className="text-amber-500 shrink-0" />
                <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text2)' }}>
                  Los datos mostrados corresponden al promedio de todas las estaciones activas en el territorio nacional durante el periodo seleccionado.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Contenido Reporte 2: Riesgo Respiratorio */}
        {activeTab === 'respiratory' && (
          <div className="space-y-6 md:space-y-8">
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                {[
                  { label: 'Riesgo Bajo', color: '#10b981', desc: 'Aire Óptimo' },
                  { label: 'Moderado', color: '#f59e0b', desc: 'Precaución' },
                  { label: 'Riesgo Alto', color: '#ef4444', desc: 'Evitar Aire' },
                  { label: 'Crítico', color: '#7c3aed', desc: 'Emergencia' },
                ].map(l => (
                  <div key={l.label} className="p-3 md:p-6 rounded-2xl md:rounded-3xl border flex items-center gap-3 md:gap-5 shadow-sm transition-transform hover:scale-[1.02]" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <div className="w-2 h-2 md:w-4 md:h-4 rounded-full shadow-lg shrink-0" style={{ background: l.color, boxShadow: `0 0 10px ${l.color}40` }} />
                    <div className="min-w-0">
                      <div className="text-[10px] md:text-sm font-black truncate" style={{ color: 'var(--text)' }}>{l.label}</div>
                      <div className="text-[8px] md:text-[10px] uppercase font-black opacity-40 tracking-widest mt-0.5 truncate" style={{ color: 'var(--text2)' }}>{l.desc}</div>
                    </div>
                  </div>
                ))}
             </div>

             <div className="rounded-3xl md:rounded-[2.5rem] border overflow-hidden shadow-2xl" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-black/5 dark:bg-white/5 border-b" style={{ borderColor: 'var(--border)' }}>
                        <th className="px-4 md:px-8 py-4 md:py-6 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text2)' }}>Estación / Localidad</th>
                        <th 
                          className="px-4 md:px-8 py-4 md:py-6 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors" 
                          style={{ color: 'var(--text2)' }}
                          onClick={toggleSort}
                        >
                          <div className="flex items-center justify-center gap-2">
                            Riesgo
                            {sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                          </div>
                        </th>
                        <th className="px-4 md:px-8 py-4 md:py-6 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-center" style={{ color: 'var(--text2)' }}>Enfermedad</th>
                        <th className="px-4 md:px-8 py-4 md:py-6 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text2)' }}>Recomendación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riskData.map(row => (
                        <tr key={row.id} className="border-b last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--border)' }}>
                          <td className="px-4 md:px-8 py-4 md:py-6">
                            <div className="text-xs md:text-base font-bold" style={{ color: 'var(--text)' }}>{row.name}</div>
                            <div className="text-[8px] md:text-[10px] text-gray-400 font-mono tracking-wider mt-1">S/N: {row.id.toUpperCase()}</div>
                          </td>
                          <td className="px-4 md:px-8 py-4 md:py-6 text-center">
                            <span className={`px-2 md:px-4 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest ${
                              row.riskLevel === 'Alto' || row.riskLevel === 'Muy Alto' ? 'bg-red-500/10 text-red-500' : 
                              row.riskLevel === 'Moderado' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                            }`}>
                              {row.riskLevel}
                            </span>
                          </td>
                          <td className="px-4 md:px-8 py-4 md:py-6 text-center">
                            <div className="inline-flex items-center gap-2 px-2 md:px-3 py-1 rounded-lg bg-blue-500/5 text-blue-500 font-bold text-[8px] md:text-xs border border-blue-500/10">
                              {row.disease || '--'}
                            </div>
                          </td>
                          <td className="px-4 md:px-8 py-4 md:py-6 max-w-[200px] md:max-w-md">
                            <p className="text-[10px] md:text-sm font-medium leading-relaxed truncate md:whitespace-normal" style={{ color: 'var(--text2)' }}>{row.conclusion}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </div>

             <div className="rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 border flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8 bg-[#67B7E8]/5 shadow-sm" style={{ borderColor: '#67B7E830' }}>
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-[1.5rem] bg-[#67B7E8] flex items-center justify-center shrink-0 shadow-xl shadow-[#67B7E8]/40">
                  <BarChart3 className="text-white" size={24} />
                </div>
                <div className="text-center md:text-left">
                   <h3 className="text-lg md:text-2xl font-black mb-2 md:mb-3" style={{ color: 'var(--text)', fontFamily: 'Syne' }}>Informe Epidemiológico</h3>
                   <p className="text-xs md:text-base leading-relaxed font-medium" style={{ color: 'var(--text2)' }}>
                     El análisis algorítmico detecta variaciones en tiempo real para prevenir crisis respiratorias basadas en la calidad del aire local.
                   </p>
                </div>
             </div>
          </div>
        )}

        {/* Contenido Reporte 3: Contaminación Ambiental */}
        {activeTab === 'environmental' && (
          <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
            <div className="lg:col-span-2 rounded-3xl md:rounded-[2.5rem] overflow-hidden border shadow-xl relative h-[400px] md:h-[500px] lg:h-auto lg:min-h-[600px]" style={{ borderColor: 'var(--border)' }}>
              <MapContainer center={XELA_COORDS} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <ChangeView center={XELA_COORDS} zoom={13} />
                {envData.map(d => (
                  d.lat && d.lng && (
                    <Marker 
                      key={d.id} 
                      position={[d.lat, d.lng]} 
                      icon={getContaminationIcon(d.classification)}
                      eventHandlers={{
                        click: () => setSelectedStation(d),
                      }}
                    >
                      <Popup>
                        <div className="text-center p-1">
                          <strong className="block text-sm mb-1">{d.name}</strong>
                          <div className="text-xs font-black uppercase" style={{ color: d.levelColor }}>
                            {d.classification}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  )
                ))}
              </MapContainer>
              
              {/* Leyenda Ambiental */}
              <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8 z-[1000] bg-white/95 dark:bg-black/90 backdrop-blur-md p-3 md:p-6 rounded-2xl md:rounded-3xl border shadow-2xl" style={{ borderColor: 'var(--border)' }}>
                <h4 className="text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-2 md:mb-4" style={{ color: 'var(--text)' }}>Niveles de Contaminación</h4>
                <div className="space-y-1.5 md:space-y-3">
                  {[
                    { label: 'Baja', color: '#10b981' },
                    { label: 'Moderada', color: '#f59e0b' },
                    { label: 'Alta', color: '#ef4444' },
                    { label: 'Crítica', color: '#7c3aed' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-2 md:gap-3">
                      <div className="w-2 h-2 md:w-3 md:h-3 rounded-full" style={{ background: l.color }} />
                      <span className="text-[8px] md:text-[10px] font-bold" style={{ color: 'var(--text2)' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4 md:space-y-6">
              {selectedStation ? (
                <div className="rounded-3xl md:rounded-[2.5rem] p-5 md:p-8 border shadow-sm animate-in fade-in slide-in-from-right-4 duration-500" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <h3 className="text-lg md:text-xl font-bold" style={{ color: 'var(--text)' }}>{selectedStation.name}</h3>
                    <div className="px-2 md:px-3 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white shadow-sm" style={{ background: selectedStation.levelColor }}>
                      {selectedStation.classification}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="p-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-transparent xl:col-span-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--text2)' }}>
                          <Info size={14} className="text-[#67B7E8]" /> Diagnóstico Ambiental
                        </h4>
                        <p className="text-xs leading-relaxed font-medium" style={{ color: 'var(--text)' }}>
                          {selectedStation.diagnosis}
                        </p>
                      </div>

                      <div className="p-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-transparent xl:col-span-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--text2)' }}>
                          <BarChart3 size={14} className="text-[#67B7E8]" /> Factores que más influyen
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                          {selectedStation.factors.slice(0, 4).map((f, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px] border-b border-black/5 pb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold" style={{ color: 'var(--text)' }}>{f.name}:</span>
                                <span style={{ color: 'var(--text2)' }}>{f.influence}</span>
                              </div>
                              <div className="font-mono" style={{ color: f.score > 1 ? selectedStation.levelColor : 'var(--text2)' }}>
                                {f.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-5 rounded-2xl bg-purple-500/5 border border-purple-500/10">
                        <h4 className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 text-purple-600">
                          <Droplets size={14} /> Tipo de Contaminación
                        </h4>
                        <div className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>
                          {selectedStation.contaminationType}
                        </div>
                        <p className="text-[10px] leading-relaxed font-medium opacity-70" style={{ color: 'var(--text)' }}>
                          {selectedStation.contaminationTypeDesc}
                        </p>
                      </div>

                      <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                        <h4 className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 text-blue-500">
                          <Zap size={14} /> Contaminante Predominante
                        </h4>
                        <div className="text-base font-bold mb-1" style={{ color: 'var(--text)' }}>
                          {selectedStation.predominantPollutant.name}
                        </div>
                        <p className="text-[10px] leading-relaxed font-bold italic" style={{ color: 'var(--text)' }}>
                          {selectedStation.predominantPollutant.reason}
                        </p>
                      </div>

                      <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                        <h4 className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 text-amber-600">
                          <Factory size={14} /> Fuentes Probables
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedStation.probableSources.map((s, i) => (
                            <span key={i} className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 text-[9px] font-bold">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                        <h4 className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 text-emerald-600">
                          <AlertTriangle size={14} /> Recomendaciones
                        </h4>
                        <ul className="space-y-1">
                          {selectedStation.recommendations.slice(0, 3).map((rec, i) => (
                            <li key={i} className="text-[9px] font-medium flex items-start gap-2" style={{ color: 'var(--text2)' }}>
                              <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1 shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[2.5rem] p-12 border border-dashed flex flex-col items-center justify-center text-center space-y-4 h-full" style={{ borderColor: 'var(--border)' }}>
                  <MapIcon size={48} className="text-gray-300" />
                  <p className="text-sm font-bold text-gray-400">Selecciona una estación en el mapa para ver el detalle ambiental</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
