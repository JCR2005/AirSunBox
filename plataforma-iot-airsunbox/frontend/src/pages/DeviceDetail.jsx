import ScrollHint from '../components/ScrollHint'
import { useEffect, useState, useRef, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import ClienteLayout from '../components/airsunbox/ClienteLayout'
import { devices as devicesApi, dots as dotsApi, spaces as spacesApi } from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { exportStationWeeklyPDF } from '../utils/exportUtils'
import StationSheet from '../components/station/StationSheet'
import EspConnect from '../components/station/EspConnect'
import ReadingTile, { variableLevels } from '../components/station/ReadingTile'

import { 
  ArrowLeft, Wifi, WifiOff, MapPin, Bell, Tag, Info,
  Thermometer, Droplets, Wind, Sun, Cloud, Cpu, Gauge, 
  Battery, Zap, Factory, Waves, Flame, Trees, Shield, 
  Activity, CloudLightning, Clock, Leaf, Eye, EyeOff, SlidersHorizontal, ChevronDown,
  Code, Copy, Check, X, Layers, ArrowUp, ArrowDown, KeyRound, Pencil, Save, FileText
} from 'lucide-react'

const RANGES = ['1h', '6h', '24h', '7d', '30d']
const COLORS = ['#4DB6FF','#60A5FA','#F59E0B','#A78BFA','#F87171','#34D399','#FB923C','#C084FC','#22D3EE','#FBBF24','#818CF8','#E879F9']

const SPACE_TITLES = { aire: 'Calidad del Aire', agua: 'Calidad del Agua', suelo: 'Calidad del Suelo', ruido: 'Nivel de Ruido' }

function agoText(ts) {
  if (!ts) return null
  const s = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000))
  if (s < 5) return 'ahora'
  if (s < 60) return `hace ${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `hace ${m}m`
  return `hace ${Math.round(m / 60)}h`
}

// Genera el código ESP8266/ESP32 con la estructura del POST
// que envía las variables REALES de la estación.
// Nombre con el que la estación envía la variable (único en su espacio) y un
// nombre de variable válido en C para el sketch (pm2.5 → pm2_5).
const sentKey = (v) => v.station_key || v.label
const cName = (v) => sentKey(v).replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1')

function generateEspSketch(vars, url, deviceLabel) {
  const https = url.startsWith('https://')
  const declarations = vars.map(v => `float ${cName(v)};   // ${v.name} (${v.unit || 'sin unidad'})`).join('\n')
  const reads = vars.map(v => {
    const u = (v.unit || '').toLowerCase()
    const start = u.includes('°c') ? '25.0' : u.includes('ppb') ? '300.0' : u.includes('%') ? '60.0' : '1.0'
    return `  ${cName(v)} = ${start};   // TODO: lectura real de tu sensor (${v.name})`
  }).join('\n')
  const fmtEntries = vars.map((v, i) => `    "\\"${sentKey(v)}\\":%g${i < vars.length - 1 ? ',' : ''}"`).join('\n')
  const fmtArgs = vars.map(v => `    ${cName(v)}`).join(',\n')
  const client = https
    ? `#if defined(ESP32)
  WiFiClientSecure client;
#else
  BearSSL::WiFiClientSecure client;
#endif
  // Cifra la conexión sin validar el certificado. Para validarlo, cargá el
  // certificado raíz con client.setCACert(...) en lugar de setInsecure().
  client.setInsecure();`
    : `  WiFiClient client;`

  return `// ============================================================
// Estación: ${deviceLabel || ''}
// Envía las lecturas a AirSunBox con un POST en formato JSON.
// Funciona en ESP32 y ESP8266 (Arduino IDE).
// ============================================================
#if defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include <WiFiClientSecure.h>
#else
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClientSecureBearSSL.h>
#endif

#define WIFI_SSID "TU_WIFI"
#define WIFI_PASS "TU_PASS"

// Dirección de envío con el token de ESTA estación
const char* API_URL = "${url}";

// Cada cuánto envía (ms). La estación figura «en línea» si envió en los
// últimos 15 minutos.
const unsigned long INTERVALO_MS = 60000;

// Variables que mide la estación
${declarations}

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 20) {
    delay(500); Serial.print("."); intentos++;
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " WiFi OK" : " Sin WiFi");
}

bool enviarLecturas() {
${client}
  HTTPClient http;
  if (!http.begin(client, API_URL)) return false;
  http.addHeader("Content-Type", "application/json");

  char payload[512];   // ampliar si la estación tiene muchas variables
  snprintf(payload, sizeof(payload),
    "{"
${fmtEntries}
    "}",
${fmtArgs}
  );

  int code = http.POST(payload);
  Serial.printf("POST %d\\n", code);   // 201 = lecturas guardadas
  http.end();
  return code >= 200 && code < 300;
}

void setup() {
  Serial.begin(115200);
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
${reads}
  enviarLecturas();
  delay(INTERVALO_MS);
}`
}

const AVAILABLE_ICONS = {
  'map-pin': MapPin, 'thermometer': Thermometer, 'droplets': Droplets,
  'wind': Wind, 'sun': Sun, 'cloud': Cloud, 'cloud-lightning': CloudLightning,
  'cpu': Cpu, 'gauge': Gauge, 'battery': Battery, 'zap': Zap,
  'factory': Factory, 'waves': Waves, 'flame': Flame, 'trees': Trees,
  'shield': Shield, 'activity': Activity
}

export default function ClientDeviceDetail() {
  const { id: deviceId } = useParams() 
  const navigate = useNavigate()
  
  const [device, setDevice] = useState(null)
  const [variables, setVariables] = useState([])
  const [lastValues, setLastValues] = useState({})
  const [chartData, setChartData] = useState([])
  const [range, setRange] = useState('24h')
  const [useCustomRange, setUseCustomRange] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [generatingReport, setGeneratingReport] = useState(false)
  const [activeVars, setActiveVars] = useState([])
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [aqiData, setAqiData] = useState({ aqi: null, category: 'Sin Datos', color: '#9CA3AF' })
  const [activeView, setActiveView] = useState('variables') 
  const [spaceAqiConfig, setSpaceAqiConfig] = useState(null)
  const [spaceInfo, setSpaceInfo] = useState(null)
  const [showStationVarsModal, setShowStationVarsModal] = useState(false)
  const [stationVarsDraft, setStationVarsDraft] = useState([])
  const [savingStationVars, setSavingStationVars] = useState(false)
  const [showQuickModal, setShowQuickModal] = useState(false)
  const [quickDraft, setQuickDraft] = useState([])
  const [showEditModal, setShowEditModal] = useState(false)
  const [editDraft, setEditDraft] = useState({ name: '', label: '', description: '', icon: 'map-pin', tagsText: '', lat: '', lng: '', serial: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')
  const [copiedKey, setCopiedKey] = useState(null)
  const [nowTick, setNowTick] = useState(Date.now()) 

  const getAqiColor = (category) => {
    if (!category) return '#9CA3AF'
    const cat = category.toLowerCase()
    if (cat.includes('sin dato')) return '#9CA3AF'   // sin lecturas: neutro, no «peligro»
    if (cat.includes('excelente')) return '#10B981'  
    if (cat.includes('buena')) return '#34D399'      
    if (cat.includes('precaución')) return '#F59E0B' 
    if (cat.includes('mala')) return '#F97316'       
    return '#EF4444'                                 
  }

  const areAllVarsSelected = variables.length > 0 && activeVars.length === variables.length

  // Reloj para tiempos relativos (30s)
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const copyText = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch (_) {}
  }

  const spaceTitle = (spaceInfo?.type && SPACE_TITLES[spaceInfo.type]) || 'Calidad del Aire'
  const spaceColor = spaceInfo?.color || '#67B7E8'

  // ── Vista rápida: variables elegidas por el usuario (display_variables) ──
  const quickLabels = Array.isArray(device?.display_variables) && device.display_variables.length
    ? device.display_variables
    : variables.slice(0, 4).map(v => v.label)
  const quickViewVars = quickLabels
    .map(lbl => variables.find(v => v.label === lbl))
    .filter(Boolean)
    .slice(0, 4)
  const quickHasData = quickViewVars.some(v => lastValues[v.label] != null)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [dev, vars, lv, aqiRes] = await Promise.all([
          devicesApi.get(deviceId),
          devicesApi.variables(deviceId),
          devicesApi.lastValues(deviceId),
          devicesApi.aqi(deviceId).catch(() => null) 
        ])
        
        if (!active) return
        setDevice(dev)
        
        const varList = vars || []
        setVariables(varList)
        
        if (varList.length) {
          setActiveVars(varList.slice(0, 2).map(v => v.label))
        }

        const map = {}
        ;(lv || []).forEach(v => { map[v.label] = v.last_value })
        setLastValues(map)

        if (aqiRes) {
          setAqiData({
            aqi: aqiRes.aqi,
            category: aqiRes.category,
            color: getAqiColor(aqiRes.category),
            categories: aqiRes.categories || [],
            dominantPollutant: aqiRes.dominantPollutant || null
          })
        }

        // Si la estación pertenece a un espacio, cargar config AQI del espacio
        if (dev?.space_id) {
          try {
            const cfg = await spacesApi.config(dev.space_id)
            setSpaceAqiConfig(cfg.aqiConfig)
            setSpaceInfo(cfg)
          } catch (_) {}
        }
      } catch (err) {
        if (active) setError(err.message || 'No se pudo cargar la estación')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [deviceId])

  useEffect(() => {
    if (!deviceId) return
    const fetchLiveUpdates = () => {
      devicesApi.lastValues(deviceId).then(lv => {
        const map = {}
        ;(lv || []).forEach(v => { map[v.label] = v.last_value })
        setLastValues(map)
      }).catch(() => {})

      devicesApi.aqi(deviceId).then(aqiRes => {
        if (aqiRes) {
          setAqiData({
            aqi: aqiRes.aqi,
            category: aqiRes.category,
            color: getAqiColor(aqiRes.category),
            categories: aqiRes.categories || [],
            dominantPollutant: aqiRes.dominantPollutant || null
          })
        }
      }).catch(() => {})
    }

    const interval = setInterval(fetchLiveUpdates, 5000)
    return () => clearInterval(interval)
  }, [deviceId])

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

    // Refrescar AQI con debounce
    clearTimeout(wsRefreshRef.current)
    wsRefreshRef.current = setTimeout(() => {
      devicesApi.aqi(deviceId).then(aqiRes => {
        if (aqiRes) {
          setAqiData({
            aqi: aqiRes.aqi,
            category: aqiRes.category,
            color: getAqiColor(aqiRes.category),
            categories: aqiRes.categories || [],
            dominantPollutant: aqiRes.dominantPollutant || null
          })
        }
      }).catch(() => {})
    }, 600)
  }, [wsValues, deviceId])

  // El rango personalizado manda sobre los preajustes (1h..30d)
  const customWindow = useMemo(() => {
    if (!useCustomRange || !customStart || !customEnd) return null
    const s = new Date(customStart)
    const e = new Date(customEnd)
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s >= e) return null
    return { start: s.toISOString(), end: e.toISOString(), spanMs: e.getTime() - s.getTime() }
  }, [useCustomRange, customStart, customEnd])

  useEffect(() => {
    if (!deviceId || !activeVars.length || activeView !== 'grafica') {
      if (activeView === 'grafica' && !activeVars.length) {
        setChartData([]) 
      }
      return
    }
    
    setChartLoading(true)
    dotsApi.getMultiple(
      deviceId, activeVars, customWindow ? '' : range, undefined,
      customWindow?.start, customWindow?.end
    ).then(data => {
      // Si el rango abarca varios días, la hora sola no distingue los puntos
      const showDate = !!customWindow && customWindow.spanMs > 24 * 3600 * 1000
      const timeMap = {}
      for (const [variable, points] of Object.entries(data || {})) {
        if (!Array.isArray(points)) continue
        points.forEach(p => {
          const t = showDate
            ? new Date(p.time).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
            : new Date(p.time).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })
          if (!timeMap[t]) {
            timeMap[t] = { time: t, _rawTime: new Date(p.time).getTime() }
          }
          timeMap[t][variable] = p.value
        })
      }
      const sortedData = Object.values(timeMap).sort((a, b) => a._rawTime - b._rawTime)
      setChartData(sortedData)
    }).catch((err) => {
      console.error("Error en la gráfica:", err)
    }).finally(() => {
      setChartLoading(false)
    })
  }, [deviceId, range, activeVars, activeView, customWindow])

  const DynamicIcon = AVAILABLE_ICONS[device?.icon] || Activity

  // Genera el reporte con exactamente las variables visibles en la gráfica,
  // para el rango de fechas activo
  const handleGenerateReport = async () => {
    if (!deviceId || !activeVars.length) return
    if (!customWindow) return
    setGeneratingReport(true)
    try {
      const payload = await dotsApi.stationWeekly(deviceId, {
        start: customWindow.start,
        end: customWindow.end
      })
      // Dejar solo las variables que el usuario tiene visibles en el chart
      const visibles = payload.variables.filter(v => activeVars.includes(v.variable))
      if (!visibles.length) {
        alert('No hay lecturas de las variables seleccionadas en ese rango de fechas.')
        return
      }
      exportStationWeeklyPDF({
        ...payload,
        variables: visibles,
        weeks: payload.weeks.filter(w => visibles.some(v => v.byWeek[w] !== undefined))
      })
    } catch (err) {
      console.error('Error al generar el reporte:', err)
      alert('No se pudo generar el reporte. Revisa el rango de fechas e inténtalo de nuevo.')
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleToggleAllVariables = () => {
    if (areAllVarsSelected) {
      setActiveVars([]) 
    } else {
      setActiveVars(variables.map(v => v.label)) 
    }
  }

  const scrollToDetails = () => {
    document.getElementById('detalles-view')?.scrollIntoView({ behavior: 'smooth' })
  }

  const openStationVarsModal = () => {
    // Inicializar con las variables actuales de la estación
    const currentLabels = variables.map(v => v.label)
    setStationVarsDraft(currentLabels)
    setShowStationVarsModal(true)
  }

  const toggleStationVarDraft = (label) => {
    setStationVarsDraft(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label])
  }

  const saveStationVarsModal = async () => {
    setSavingStationVars(true)
    try {
      await devicesApi.update(deviceId, { selectedVariables: stationVarsDraft, spaceId: device?.space_id })
      setShowStationVarsModal(false)
      // Recargar variables de la estación
      const vars = await devicesApi.variables(deviceId)
      setVariables(vars || [])
    } catch (err) {
      console.error('No se pudo guardar variables de la estación:', err)
    } finally {
      setSavingStationVars(false)
    }
  }

  const openQuickModal = () => {
    setQuickDraft(quickLabels)
    setShowQuickModal(true)
  }

  const toggleQuickDraft = (label) => {
    setQuickDraft(prev => {
      if (prev.includes(label)) return prev.filter(x => x !== label)
      if (prev.length >= 4) return prev
      return [...prev, label]
    })
  }

  const reorderQuickDraft = (label, dir) => {
    setQuickDraft(prev => {
      const i = prev.indexOf(label)
      const j = i + dir
      if (i === -1 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const saveQuickModal = async () => {
    setSavingStationVars(true)
    try {
      await devicesApi.update(deviceId, { displayVariables: quickDraft })
      setDevice(prev => ({ ...prev, display_variables: quickDraft }))
      setShowQuickModal(false)
    } catch (err) {
      console.error('No se pudo guardar la vista rápida:', err)
    } finally {
      setSavingStationVars(false)
    }
  }

  // ── Edición de la estación (nombre, ubicación, metadatos, hardware) ──
  const openEditModal = () => {
    setEditDraft({
      name: device?.name || '',
      label: device?.label || '',
      description: device?.description || '',
      icon: device?.icon || 'map-pin',
      tagsText: (device?.tags || []).join(', '),
      lat: device?.lat ?? '',
      lng: device?.lng ?? ''
    })
    setEditError('')
    setShowEditModal(true)
  }

  const saveEditModal = async () => {
    setSavingEdit(true)
    setEditError('')
    try {
      const tags = editDraft.tagsText.split(',').map(s => s.trim()).filter(Boolean)
      const payload = {
        name: editDraft.name.trim() || undefined,
        label: editDraft.label.trim() || (device?.label || undefined),
        description: editDraft.description,
        icon: editDraft.icon,
        tags
      }
      const hasGps = editDraft.lat !== '' && editDraft.lng !== ''
      if (hasGps) {
        payload.lat = Number(editDraft.lat)
        payload.lng = Number(editDraft.lng)
      }
      const updated = await devicesApi.update(deviceId, payload)
      setDevice(prev => ({ ...prev, ...(updated || payload) }))
      setShowEditModal(false)
    } catch (err) {
      setEditError(err?.message || 'No se pudo guardar los cambios')
      console.error('No se pudo editar la estación:', err)
    } finally {
      setSavingEdit(false)
    }
  }

  // ── Datos de integración ESP32 (POST /api/dots) ──
  // Misma dirección que el sitio: en producción entra por nginx con HTTPS
  // (el puerto 3000 del backend no está publicado).
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://18.223.121.208'
  const dotToken = device?.token || '<TOKEN_DE_LA_ESTACION>'
  const dotEndpoint = `${siteOrigin}/api/dots/${dotToken}`
  const sampleVars = quickViewVars.length ? quickViewVars : variables.slice(0, 4)
  const espVars = variables.length ? variables : sampleVars
  const esp32Json = JSON.stringify(Object.fromEntries(espVars.map(v => [sentKey(v), 0])), null, 2)
  const esp32Sketch = generateEspSketch(espVars, dotEndpoint, device?.label)

  return (
    <ClienteLayout>
      <div className="p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64" style={{ color: 'var(--text2)' }}>Cargando...</div>
        ) : error ? (
          <div className="mb-4 border rounded-lg px-3 py-2 text-xs" style={{ borderColor: '#F97316', color: '#FDBA74', background: 'rgba(249,115,22,0.1)' }}>
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">

            <div className="z-10">
              <StationSheet
                device={device}
                icon={DynamicIcon}
                spaceInfo={spaceInfo}
                spaceColor={spaceColor}
                onBack={() => navigate(device?.space_id ? `/espacios/${device.space_id}` : '/dispositivos')}
                onEdit={openEditModal}
                onDeviceChange={(patch) => setDevice(prev => ({ ...prev, ...patch }))}
                copiedKey={copiedKey}
                onCopy={copyText}
              />
            </div>

            <section className="flex flex-col min-w-0">

              <div className="flex flex-col">
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 w-full items-stretch">
                  
                  <div className="border rounded-[3rem] p-10 flex flex-col items-center justify-between shadow-lg relative overflow-visible min-h-[450px]" style={{ background: `radial-gradient(circle at 50% 30%, ${aqiData.color}1A, transparent 65%), var(--card)`, borderColor: 'var(--border)' }}>
                    {device?.status === 'online' && (
                      <div className="absolute top-6 right-6 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-md bg-white dark:bg-gray-900" style={{ border: '1px solid var(--border)' }}>
                        <span className="relative flex w-2 h-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1D9E75] opacity-60"></span>
                          <span className="relative inline-flex rounded-full w-2 h-2 bg-[#1D9E75]"></span>
                        </span>
                        <span className="text-[10px] font-black tracking-widest" style={{ color: '#1D9E75' }}>EN VIVO</span>
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-4 w-full z-20">
                      <div className="flex items-center gap-2 group relative">
                        <h3 className="text-lg font-black uppercase tracking-widest text-center" style={{ color: 'var(--text2)' }}>
                          {spaceTitle}
                        </h3>
                        <div className="cursor-help p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[#67B7E8]">
                          <Info size={18} />
                        </div>
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-72 p-5 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 pointer-events-none" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                          <h4 className="text-xs font-black uppercase mb-3 text-center tracking-wider" style={{ color: 'var(--text)' }}>Niveles de Riesgo y AQI</h4>
                          <ul className="space-y-2.5 text-xs font-medium">
                            {aqiData.categories?.length ? aqiData.categories.map((c, i) => (
                              <li key={i} className="flex items-center justify-between">
                                <span className="font-bold" style={{ color: c.color }}>
                                  {c.score_lo} - {c.score_hi} {c.name}
                                </span>
                                <span style={{ color: 'var(--text2)' }} className="text-right pl-3">
                                  {Array.isArray(c.phrases) ? c.phrases[0] : ''}
                                </span>
                              </li>
                            )) : (
                              <>
                                <li className="flex items-center justify-between"><span className="text-[#10B981] font-bold">0 - 20 Excelente</span><span style={{ color: 'var(--text2)' }}>Sin riesgo</span></li>
                                <li className="flex items-center justify-between"><span className="text-[#34D399] font-bold">21 - 40 Buena</span><span style={{ color: 'var(--text2)' }}>Riesgo bajo</span></li>
                                <li className="flex items-center justify-between"><span className="text-[#F59E0B] font-bold">41 - 60 Precaución</span><span style={{ color: 'var(--text2)' }}>Sensibles moderarse</span></li>
                                <li className="flex items-center justify-between"><span className="text-[#F97316] font-bold">61 - 80 Mala</span><span style={{ color: 'var(--text2)' }}>Riesgo respiratorio</span></li>
                                <li className="flex items-center justify-between"><span className="text-[#EF4444] font-bold">81 - 100 Peligrosa</span><span style={{ color: 'var(--text2)' }}>Evitar exteriores</span></li>
                              </>
                            )}
                          </ul>
                        </div>
                      </div>

                      <div className="w-full max-w-[250px] relative mt-2">
                        <div className="flex w-full h-2.5 rounded-full overflow-hidden shadow-inner opacity-80">
                          {aqiData.categories?.length ? (
                            aqiData.categories.map((c, i) => (
                              <div
                                key={i}
                                className="h-full"
                                style={{
                                  width: `${((Number(c.score_hi) - Number(c.score_lo)) / 100) * 100}%`,
                                  background: c.color
                                }}
                                title={`${c.name} (${c.score_lo}–${c.score_hi})`}
                              />
                            ))
                          ) : (
                            <>
                              <div className="h-full w-1/5 bg-[#10B981]"></div>
                              <div className="h-full w-1/5 bg-[#34D399]"></div>
                              <div className="h-full w-1/5 bg-[#F59E0B]"></div>
                              <div className="h-full w-1/5 bg-[#F97316]"></div>
                              <div className="h-full w-1/5 bg-[#EF4444]"></div>
                            </>
                          )}
                        </div>
                        {aqiData.aqi != null && aqiData.categories?.length && (
                          <div
                            className="absolute top-3.5 w-3 h-3 bg-white border border-gray-400 rounded-full shadow-md transition-all duration-700"
                            style={{
                              left: `calc(${Math.min(100, Math.max(0, aqiData.aqi))}% - 6px)`
                            }}
                          />
                        )}
                        {aqiData.aqi != null && !aqiData.categories?.length && (
                          <div
                            className="absolute top-3.5 w-3 h-3 bg-white border border-gray-400 rounded-full shadow-md transition-all duration-700"
                            style={{ left: `calc(${Math.min(100, Math.max(0, aqiData.aqi))}% - 6px)` }}
                          />
                        )}
                        <div className="flex justify-between w-full mt-2 text-[10px] font-bold" style={{ color: 'var(--text2)' }}>
                          <span>0</span>
                          <span>100</span>
                        </div>
                      </div>
                    </div>

                    <div className="relative w-64 h-64 sm:w-72 sm:h-72 my-4 z-10">
                      {/* Brillo ambiental */}
                      <div className="absolute inset-0 rounded-full animate-pulse" style={{ background: `radial-gradient(circle, ${aqiData.color}40, transparent 65%)`, filter: 'blur(14px)' }} />
                      {/* Anillo gauge */}
                      {aqiData.aqi != null && (
                        <div className="absolute inset-0 rounded-full" style={{
                          background: `conic-gradient(${aqiData.color} ${Math.min(100, Math.max(0, aqiData.aqi)) * 3.6}deg, ${aqiData.color}22 0deg)`,
                          WebkitMaskImage: 'radial-gradient(closest-side, transparent 60%, black 61%)',
                          maskImage: 'radial-gradient(closest-side, transparent 60%, black 61%)'
                        }} />
                      )}
                      {/* Sombra de rastro del anillo fuera de la máscara */}
                      <div className="absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 0 0 1px ${aqiData.color}22` }} />
                      {/* Círculo interior */}
                      <div
                        className="absolute inset-4 sm:inset-5 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all duration-500 hover:scale-105"
                        style={{ backgroundColor: aqiData.color, boxShadow: `0 25px 50px -12px ${aqiData.color}90` }}
                      >
                        <Leaf size={36} className="mb-2 opacity-90" />
                        <span className="text-6xl font-black drop-shadow-lg mb-1">
                          {aqiData.aqi != null ? Math.round(aqiData.aqi) : '--'}
                        </span>
                        <span className="text-xl font-bold text-center leading-none px-4 drop-shadow-lg">
                          {aqiData.category}
                        </span>
                      </div>
                    </div>

                    {aqiData.aqi != null && (
                    <div className="w-full px-4 text-center animate-in fade-in duration-500 mt-2">
                      <div className="inline-block px-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                          {(() => {
                            if (!aqiData.category) return 'Esperando datos de la estación...'
                            if (aqiData.categories?.length) {
                              const idx = aqiData.categories.findIndex(c => aqiData.aqi != null && aqiData.aqi <= Number(c.score_hi))
                              const i = idx === -1 ? (aqiData.categories.length - 1) : idx
                              const phrases = aqiData.categories[i]?.phrases
                              if (Array.isArray(phrases) && phrases.length) {
                                // Rotación estable por tiempo (~20s)
                                const k = Math.floor(Date.now() / 20000 + (aqiData.aqi || 0)) % phrases.length
                                return phrases[k]
                              }
                            }
                            // Fallback hardcoded
                            const cat = aqiData.category.toLowerCase()
                            if (cat.includes('excelente')) return 'El aire es ideal. No hay impacto en la salud respiratoria.'
                            if (cat.includes('buena')) return 'Calidad aceptable. Riesgo mínimo para grupos vulnerables.'
                            if (cat.includes('precaución')) return 'Personas con asma deben limitar el esfuerzo prolongado.'
                            if (cat.includes('mala')) return 'Riesgo respiratorio. Reducir actividades al aire libre.'
                            return 'Peligro inminente. Permanecer en interiores.'
                          })()}
                        </p>
                      </div>
                    </div>
                    )}

                    <div className="flex items-center justify-center gap-1.5 mt-3 w-full">
                      {aqiData.dominantPollutant && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ color: 'var(--text2)', border: '1px solid var(--border)' }}
                              title="La variable del índice con el peor nivel en este momento">
                          Variable dominante: <span className="text-[#67B7E8]">{variables.find(v => v.label === aqiData.dominantPollutant)?.name || aqiData.dominantPollutant}</span>
                        </span>
                      )}
                      <span className="relative flex w-2 h-2">
                        <span className={`absolute inline-flex h-full w-full rounded-full ${device?.status === 'online' ? 'animate-ping bg-[#1D9E75] opacity-60' : ''}`}></span>
                        <span className="relative inline-flex rounded-full w-2 h-2" style={{ background: device?.status === 'online' ? '#1D9E75' : '#F59E0B' }}></span>
                      </span>
                      <span className="text-[11px] font-bold" style={{ color: 'var(--text2)' }}>
                        {device?.status === 'online'
                          ? `Datos ${agoText(device?.last_seen) || 'recientes'}`
                          : 'Sin señal — esperando datos'}
                      </span>
                    </div>
                  </div>

                  {variables.length > 0 ? (
                    <div className="border rounded-[3rem] p-7 md:p-8 flex flex-col shadow-lg 2xl:min-h-[450px]" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                      <div className="flex items-start justify-between gap-3 mb-5">
                        <div>
                          <h2 className="text-lg font-bold" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Lecturas actuales</h2>
                          <p className="text-sm" style={{ color: 'var(--text2)' }}>
                            {quickHasData && device?.last_seen ? `Última lectura ${agoText(device.last_seen) || 'ahora'}` : 'Sin lecturas todavía'}
                          </p>
                        </div>
                        <button
                          onClick={openQuickModal}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
                          style={{ color: 'var(--text2)', border: '1px solid var(--border)' }}
                          title="Elegir qué variables se ven aquí (hasta 4)"
                        >
                          <SlidersHorizontal size={13} /> Elegir variables
                        </button>
                      </div>

                      {!quickHasData && (
                        <div className="mb-5 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: '#67B7E812', border: '1px solid #67B7E833' }}>
                          <Cpu size={18} className="shrink-0" style={{ color: '#67B7E8' }} />
                          <p className="text-sm flex-1" style={{ color: 'var(--text)' }}>
                            La estación todavía no envió datos.
                          </p>
                          <button
                            onClick={() => { setActiveView('conexion'); scrollToDetails() }}
                            className="text-sm font-semibold shrink-0 hover:underline" style={{ color: '#67B7E8' }}>
                            Ver cómo conectarla
                          </button>
                        </div>
                      )}

                      <div className={`grid gap-4 2xl:flex-1 auto-rows-fr ${quickViewVars.length === 1 ? 'grid-cols-1' : `grid-cols-2 ${quickViewVars.length === 3 ? 'lg:grid-cols-3 2xl:grid-cols-2' : quickViewVars.length >= 4 ? 'lg:grid-cols-4 2xl:grid-cols-2' : ''}`}`}>
                        {quickViewVars.map((v, i) => (
                          <div key={v.label} className={quickViewVars.length % 2 === 1 && i === quickViewVars.length - 1 && quickViewVars.length > 1 ? 'col-span-2 lg:col-span-1 2xl:col-span-2' : ''}>
                          <ReadingTile
                            to={`/variableDetail/${deviceId}/${v.label}`}
                            name={v.name}
                            unit={v.unit}
                            value={lastValues[v.label]}
                            levels={variableLevels(spaceAqiConfig, v.label)}
                            size={quickViewVars.length <= 2 ? 'lg' : 'md'}
                          />
                          </div>
                        ))}
                      </div>
                      {variables.length > quickViewVars.length && (
                        <div className="flex justify-center mt-6">
                          <button
                            onClick={() => { setActiveView('variables'); scrollToDetails() }}
                            className="text-xs font-bold px-3 py-1.5 rounded-full hover:scale-105 transition-all" style={{ color: 'var(--text2)', border: '1px solid var(--border)' }}>
                            +{variables.length - quickViewVars.length} más en Métricas
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border rounded-[3rem] p-8 flex flex-col items-center justify-center text-center shadow-lg min-h-[450px]" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                      <span className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#67B7E81A', color: '#67B7E8' }}>
                        <Activity size={24} />
                      </span>
                      <h2 className="text-lg font-bold" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Sin variables asignadas</h2>
                      <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--text2)' }}>
                        {device?.space_id
                          ? 'Asigná variables a esta estación desde su espacio para ver sus lecturas aquí.'
                          : 'El equipo AirSunBox asigna las variables de esta estación. Si falta alguna, reportá una incidencia.'}
                      </p>
                    </div>
                  )}

                </div>
              </div>

              <div id="detalles-view" className="flex justify-center mt-8 mb-8 scroll-mt-8">
                <div role="tablist" aria-label="Vista de la estación" className="w-full max-w-2xl grid grid-cols-3 gap-1 p-1.5 rounded-[2rem] shadow-lg" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => { setActiveView('variables'); scrollToDetails(); }}
                    className={`flex items-center justify-center gap-2 px-2 sm:px-4 py-3 rounded-3xl text-sm font-bold whitespace-nowrap transition-all duration-300 ${activeView === 'variables' ? 'bg-[#1D9E75] text-white shadow-md' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                    style={activeView !== 'variables' ? { color: 'var(--text2)' } : {}}
                  >
                    <Gauge size={17} className="hidden sm:block shrink-0" /> Métricas
                  </button>
                  <button
                    onClick={() => { setActiveView('grafica'); scrollToDetails(); }}
                    className={`flex items-center justify-center gap-2 px-2 sm:px-4 py-3 rounded-3xl text-sm font-bold whitespace-nowrap transition-all duration-300 ${activeView === 'grafica' ? 'bg-[#1D9E75] text-white shadow-md' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                    style={activeView !== 'grafica' ? { color: 'var(--text2)' } : {}}
                  >
                    <Activity size={17} className="hidden sm:block shrink-0" /> Gráfica
                  </button>
                  <button
                    onClick={() => { setActiveView('conexion'); scrollToDetails(); }}
                    className={`flex items-center justify-center gap-2 px-2 sm:px-4 py-3 rounded-3xl text-sm font-bold whitespace-nowrap transition-all duration-300 ${activeView === 'conexion' ? 'bg-[#1D9E75] text-white shadow-md' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                    style={activeView !== 'conexion' ? { color: 'var(--text2)' } : {}}
                  >
                    <Cpu size={17} className="hidden sm:block shrink-0" /> Conectar ESP32
                  </button>
                </div>
              </div>

              <div className="pb-12">
                {activeView === 'conexion' ? (
                  <div className="animate-in fade-in duration-300">
                    <EspConnect
                      endpoint={dotEndpoint}
                      hasToken={!!device?.token}
                      vars={espVars}
                      json={esp32Json}
                      sketch={esp32Sketch}
                      inSpace={!!device?.space_id}
                      copiedKey={copiedKey}
                      onCopy={copyText}
                    />
                  </div>
                ) : activeView === 'variables' ? (
                  <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(175px,1fr))] animate-in fade-in duration-300">
                    {variables.map(v => (
                      <div key={v.label} className="min-h-[170px]">
                        <ReadingTile
                          to={`/variableDetail/${deviceId}/${v.label}`}
                          name={v.name}
                          unit={v.unit}
                          value={lastValues[v.label]}
                          levels={variableLevels(spaceAqiConfig, v.label)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border rounded-[2.5rem] p-8 shadow-sm relative animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    
                    {chartLoading && (
                      <div className="absolute inset-0 bg-white/70 dark:bg-black/70 rounded-[2.5rem] z-30 flex items-center justify-center backdrop-blur-sm">
                        <div className="text-sm font-bold text-[#1D9E75] animate-pulse">Procesando millones de datos...</div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-8 flex-wrap gap-6">
                      
                      <div className="flex flex-wrap gap-2 items-center">
                        
                        {variables.length > 0 && (
                          <button
                            onClick={handleToggleAllVariables}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all border shadow-sm hover:scale-105 mr-2"
                            style={{
                              background: areAllVarsSelected ? 'var(--bg)' : '#1D9E75',
                              color: areAllVarsSelected ? 'var(--text)' : '#fff',
                              borderColor: areAllVarsSelected ? 'var(--border)' : '#1D9E75'
                            }}
                          >
                            {areAllVarsSelected ? (
                              <>
                                <EyeOff size={13} />
                                Ocultar todas
                              </>
                            ) : (
                              <>
                                <Eye size={13} />
                                Mostrar todas
                              </>
                            )}
                          </button>
                        )}

                        {variables.map((v, i) => {
                          const isAct = activeVars.includes(v.label)
                          const col = COLORS[i % COLORS.length]
                          return (
                            <button key={v.label}
                              onClick={() => setActiveVars(prev => prev.includes(v.label) ? prev.filter(x => x !== v.label) : [...prev, v.label])}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                              style={{
                                background: isAct ? `${col}15` : 'transparent',
                                color: isAct ? col : 'var(--text2)',
                                border: `2px solid ${isAct ? col + '40' : 'var(--border)'}`
                              }}>
                              <span className="w-3 h-3 rounded-full" style={{ background: col, opacity: isAct ? 1 : 0.3 }} />
                              {v.name}
                            </button>
                          )
                        })}
                      </div>
                      
                       <div className="flex items-center gap-1.5 p-1.5 rounded-2xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                         {RANGES.map(r => (
                           <button key={r} onClick={() => { setRange(r); setUseCustomRange(false) }}
                             className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${range === r && !useCustomRange ? 'bg-[#1D9E75] text-white shadow-md scale-105' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                             style={range !== r || useCustomRange ? { color: 'var(--text2)' } : {}}>
                             {r}
                           </button>
                         ))}
                         <button
                           onClick={() => {
                             setUseCustomRange(true)
                             if (!customStart && !customEnd) {
                               const toLocal = d => {
                                 const p = n => String(n).padStart(2, '0')
                                 return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
                               }
                               const hasta = new Date()
                               const desde = new Date(hasta.getTime() - 7 * 24 * 3600 * 1000)
                               setCustomStart(toLocal(desde))
                               setCustomEnd(toLocal(hasta))
                             }
                           }}
                           className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${useCustomRange ? 'bg-[#1D9E75] text-white shadow-md scale-105' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                           style={!useCustomRange ? { color: 'var(--text2)' } : {}}
                         >
                           Fechas
                         </button>
                       </div>
                     </div>

                     {/* Rango personalizado + generación de reporte */}
                     {useCustomRange && (
                       <div
                         className="flex flex-wrap items-end gap-3 mb-6 p-4 rounded-2xl"
                         style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                       >
                         <label className="flex flex-col gap-1.5">
                           <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--text2)' }}>
                             Desde
                           </span>
                           <input
                             type="datetime-local"
                             value={customStart}
                             onChange={e => setCustomStart(e.target.value)}
                             className="px-3 py-2 rounded-xl text-xs font-bold"
                             style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                           />
                         </label>
                         <label className="flex flex-col gap-1.5">
                           <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--text2)' }}>
                             Hasta
                           </span>
                           <input
                             type="datetime-local"
                             value={customEnd}
                             onChange={e => setCustomEnd(e.target.value)}
                             className="px-3 py-2 rounded-xl text-xs font-bold"
                             style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                           />
                         </label>

                         <div className="flex-1" />

                         <button
                           onClick={handleGenerateReport}
                           disabled={generatingReport || !customWindow}
                           title={customWindow
                             ? `Generar el reporte de ${activeVars.length} variable(s) entre las fechas indicadas`
                             : 'Selecciona un rango de fechas válido'}
                           className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-[#67B7E8] text-white shadow-sm hover:bg-[#52A8E0] transition-all disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
                         >
                           {generatingReport ? (
                             <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generando...</>
                           ) : (
                             <><FileText size={15} /> Generar reporte</>
                           )}
                         </button>
                       </div>
                     )}

                    <ResponsiveContainer width="100%" height={450}>
                      <LineChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="time" stroke="var(--text2)" tick={{ fontSize: 12, fontWeight: 700 }} tickMargin={15} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                        <YAxis stroke="var(--text2)" tick={{ fontSize: 12, fontWeight: 700 }} tickMargin={15} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text)', padding: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
                          itemStyle={{ fontWeight: '900', paddingTop: '4px' }}
                        />
                        {variables.map((v, i) => (
                          activeVars.includes(v.label) && (
                            <Line key={v.label} type="monotone" dataKey={v.label}
                              stroke={COLORS[i % COLORS.length]} strokeWidth={4} dot={false} activeDot={{ r: 8, strokeWidth: 0 }} name={v.name} />
                          )
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

            </section>
          </div>
        )}
      </div>

      {/* Modal: Variables de la estación */}
      {showStationVarsModal && spaceAqiConfig?.variables?.length && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
             onClick={() => setShowStationVarsModal(false)}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300"
               style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#67B7E81A', color: '#67B7E8' }}>
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black" style={{ color: 'var(--text)' }}>Variables de la estación</h3>
                  <p className="text-sm" style={{ color: 'var(--text2)' }}>Elige qué variables del espacio mide esta estación</p>
                </div>
              </div>
              <button onClick={() => setShowStationVarsModal(false)} className="p-2 rounded-lg hover:bg-black/5" style={{ color: 'var(--text2)' }}>
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              <ScrollHint />
              <p className="text-sm" style={{ color: 'var(--text2)' }}>Las variables marcadas participan en el AQI según la prioridad del espacio.</p>
              <div className="space-y-2">
                {spaceAqiConfig.variables.map((v, i) => {
                  const isSelected = stationVarsDraft.includes(v.variable_label)
                  return (
                    <label key={v.variable_label} className="flex items-center justify-between p-3 rounded-xl border transition-all hover:shadow-sm" style={{ borderColor: isSelected ? '#67B7E840' : 'var(--border)', background: isSelected ? '#67B7E80A' : 'var(--bg)' }}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={stationVarsDraft.includes(v.variable_label)}
                          onChange={() => toggleStationVarDraft(v.variable_label)}
                          className="w-5 h-5 rounded border-2 transition-all" style={{ accentColor: '#67B7E8', borderColor: 'var(--border)' }}
                        />
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black" style={{ background: '#67B7E81A', color: '#67B7E8' }}>{i + 1}</span>
                          <div>
                            <span className="font-semibold" style={{ color: 'var(--text)' }}>{v.station_key || v.variable_label}</span>
                            <span className="text-[10px] ml-2 opacity-60" style={{ color: 'var(--text2)' }}>prioridad {v.priority}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: isSelected ? '#67B7E81A' : 'var(--border)', color: isSelected ? '#67B7E8' : 'var(--text2)' }}>
                        {isSelected ? 'Asignada' : 'No asignada'}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setShowStationVarsModal(false)} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ color: 'var(--text2)' }}>Cancelar</button>
              <button onClick={saveStationVarsModal} disabled={savingStationVars} className="px-4 py-2 rounded-xl text-sm font-bold bg-[#67B7E8] text-white disabled:opacity-50">
                {savingStationVars ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

    {/* Modal: Vista rápida (elegir hasta 4 variables) */}
      {showQuickModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
             onClick={() => setShowQuickModal(false)}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300"
               style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#67B7E81A', color: '#67B7E8' }}>
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black" style={{ color: 'var(--text)' }}>Vista rápida</h3>
                  <p className="text-sm" style={{ color: 'var(--text2)' }}>Hasta 4 variables, en el orden que prefieras</p>
                </div>
              </div>
              <button onClick={() => setShowQuickModal(false)} className="p-2 rounded-lg hover:bg-black/5" style={{ color: 'var(--text2)' }}>
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              <ScrollHint />
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: 'var(--text2)' }}>Marca las que quieras al lado del AQI.</p>
                <span className="text-[11px] font-black px-2.5 py-1 rounded-full" style={{ background: quickDraft.length >= 4 ? '#F59E0B1A' : '#67B7E81A', color: quickDraft.length >= 4 ? '#F59E0B' : '#67B7E8' }}>
                  {quickDraft.length}/4
                </span>
              </div>
              <div className="space-y-2">
                {variables.map((v, i) => {
                  const idx = quickDraft.indexOf(v.label)
                  const isSelected = idx !== -1
                  const atLimit = quickDraft.length >= 4 && !isSelected
                  return (
                    <label key={v.label} className="flex items-center justify-between p-3 rounded-xl border transition-all hover:shadow-sm" style={{ borderColor: isSelected ? '#67B7E840' : 'var(--border)', background: isSelected ? '#67B7E80A' : 'var(--bg)', opacity: atLimit ? 0.45 : 1 }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={atLimit}
                          onChange={() => toggleQuickDraft(v.label)}
                          className="w-5 h-5 rounded border-2 transition-all" style={{ accentColor: '#67B7E8', borderColor: 'var(--border)' }}
                        />
                        <div className="min-w-0">
                          <span className="font-semibold block truncate" style={{ color: 'var(--text)' }}>{v.name}</span>
                          <span className="text-[10px] font-mono" style={{ color: 'var(--text2)' }}>{v.station_key || v.label} · {v.unit}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={(e) => { e.preventDefault(); reorderQuickDraft(v.label, -1) }}
                            disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-black/5 disabled:opacity-30" style={{ color: 'var(--text2)' }} title="Subir">
                            <ArrowUp size={13} />
                          </button>
                          <button type="button" onClick={(e) => { e.preventDefault(); reorderQuickDraft(v.label, 1) }}
                            disabled={idx === quickDraft.length - 1} className="p-1.5 rounded-lg hover:bg-black/5 disabled:opacity-30" style={{ color: 'var(--text2)' }} title="Bajar">
                            <ArrowDown size={13} />
                          </button>
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ml-1" style={{ background: '#67B7E81A', color: '#67B7E8' }}>{idx + 1}</span>
                        </div>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setShowQuickModal(false)} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ color: 'var(--text2)' }}>Cancelar</button>
              <button onClick={saveQuickModal} disabled={savingStationVars || quickDraft.length === 0} className="px-4 py-2 rounded-xl text-sm font-bold bg-[#67B7E8] text-white disabled:opacity-50">
                {savingStationVars ? 'Guardando...' : 'Guardar vista rápida'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar estación */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowEditModal(false)}>
          <div className="w-full max-w-lg rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#67B7E81A', color: '#67B7E8' }}>
                  <Pencil size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black" style={{ color: 'var(--text)' }}>Editar estación</h3>
                  <p className="text-sm" style={{ color: 'var(--text2)' }}>Nombre, ubicación y descripción</p>
                </div>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 rounded-lg hover:bg-black/5" style={{ color: 'var(--text2)' }}>
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
              <ScrollHint />
              {editError && (
                <div className="border rounded-xl px-3 py-2 text-xs" style={{ borderColor: '#F97316', color: '#FDBA74', background: 'rgba(249,115,22,0.1)' }}>
                  {editError}
                </div>
              )}
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text2)' }}>Nombre</span>
                <input value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border outline-none focus:border-[#67B7E8]" style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--bg)' }} />
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text2)' }}>Etiqueta (label)</span>
                <input value={editDraft.label} onChange={e => setEditDraft(d => ({ ...d, label: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border outline-none focus:border-[#67B7E8] font-mono text-sm" style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--bg)' }} />
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text2)' }}>Descripción</span>
                <textarea value={editDraft.description} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                  rows={3} className="w-full px-3 py-2.5 rounded-xl border outline-none focus:border-[#67B7E8] resize-none" style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--bg)' }} />
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text2)' }}>Ícono</span>
                <select value={editDraft.icon} onChange={e => setEditDraft(d => ({ ...d, icon: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border outline-none focus:border-[#67B7E8]" style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--bg)' }}>
                  {Object.keys(AVAILABLE_ICONS).map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text2)' }}>Etiquetas (separadas por coma)</span>
                <input value={editDraft.tagsText} onChange={e => setEditDraft(d => ({ ...d, tagsText: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border outline-none focus:border-[#67B7E8]" style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--bg)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text2)' }}>Latitud</span>
                  <input value={editDraft.lat} onChange={e => setEditDraft(d => ({ ...d, lat: e.target.value }))} inputMode="decimal"
                    className="w-full px-3 py-2.5 rounded-xl border outline-none focus:border-[#1D9E75] font-mono text-sm" style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--bg)' }} />
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text2)' }}>Longitud</span>
                  <input value={editDraft.lng} onChange={e => setEditDraft(d => ({ ...d, lng: e.target.value }))} inputMode="decimal"
                    className="w-full px-3 py-2.5 rounded-xl border outline-none focus:border-[#1D9E75] font-mono text-sm" style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--bg)' }} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ color: 'var(--text2)' }}>Cancelar</button>
              <button onClick={saveEditModal} disabled={savingEdit} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-[#67B7E8] text-white disabled:opacity-50 transition-all hover:scale-105">
                <Save size={15} /> {savingEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

    </ClienteLayout>
  )
}