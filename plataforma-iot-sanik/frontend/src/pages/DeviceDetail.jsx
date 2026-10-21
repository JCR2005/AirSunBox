import { useEffect, useState, useRef, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import ClienteLayout from '../components/sanik/ClienteLayout'
import { devices as devicesApi, dots as dotsApi, spaces as spacesApi } from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { exportStationWeeklyPDF } from '../utils/exportUtils'
import MapPicker from '../components/MapPicker'

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
function generateEspSketch(vars, host, token, deviceLabel) {
  const declarations = vars.map(v => `float ${v.label};   // ${v.name} (${v.unit || 'sin unidad'})`).join('\n')
  const reads = vars.map((v, i) => {
    const u = (v.unit || '').toLowerCase()
    const start = u.includes('°c') ? '25.0' : u.includes('ppb') ? '300.0' : u.includes('%') ? '60.0' : '1.0'
    return `  ${v.label} = ${start};   // TODO: reemplaza por la lectura de tu sensor (${v.name})`
  }).join('\n')
  const fmtEntries = vars.map((v, i) => `    "${v.label}":%g${i < vars.length - 1 ? ',' : ''}`).join('\n')
  const fmtArgs = vars.map(v => `    ${v.label}`).join(',\n')

  return `// ============================================================
// ESTACIÓN: ${deviceLabel || ''} — POST /api/dots/<TOKEN>
// Estructura de la petición HTTP que envía las variables
// ============================================================
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>

#define WIFI_SSID "TU_WIFI"
#define WIFI_PASS "TU_PASS"

// Cambia la URL por la de tu servidor (o túnel tipo loca.lt)
// Usa el token de ESTA estación
const char* API_URL = "http://${host}:3000/api/dots/${token}";

// --------------------------------------------------
// VARIABLES QUE TRABAJA LA ESTACIÓN
// --------------------------------------------------
${declarations}

// --------------------------------------------------
// WIFI
// --------------------------------------------------
void connectWiFi() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 20) {
    delay(500); Serial.print("."); intentos++;
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " WiFi OK" : " ERROR WiFi");
}

// --------------------------------------------------
// POST (estructura de la petición)
// --------------------------------------------------
bool sendDataHTTP() {
  WiFiClient client;
  HTTPClient http;

  if (!http.begin(client, API_URL)) return false;
  http.addHeader("Content-Type", "application/json");

  char payload[512]; // ajusta si son muchas variables

  snprintf(
    payload,
    sizeof(payload),
    "{"
${fmtEntries}
    "}",
${fmtArgs}
  );

  int httpCode = http.POST(payload);
  http.end();
  return (httpCode >= 200 && httpCode < 300);
}

void setup() { connectWiFi(); }

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
${reads}
  if (sendDataHTTP()) Serial.println("POST OK");
  delay(5000);
}`
}

const AVAILABLE_ICONS = {
  'map-pin': MapPin, 'thermometer': Thermometer, 'droplets': Droplets,
  'wind': Wind, 'sun': Sun, 'cloud': Cloud, 'cloud-lightning': CloudLightning,
  'cpu': Cpu, 'gauge': Gauge, 'battery': Battery, 'zap': Zap,
  'factory': Factory, 'waves': Waves, 'flame': Flame, 'trees': Trees,
  'shield': Shield, 'activity': Activity
}

function SensorKPI({ name, unit, value, iconName, color = '#67B7E8' }) {
  const IconComponent = AVAILABLE_ICONS[iconName?.toLowerCase()] || Activity
  return (
    <div className="border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full group" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${color}00, ${color}, ${color}00)` }} />
      <div className="p-5 flex flex-col items-center text-center relative">
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: color + '18', color }}>
          <span className={`w-1.5 h-1.5 rounded-full ${value != null ? 'animate-pulse' : ''}`} style={{ background: color }} />
        </div>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{ background: color + '15', color }}>
          <IconComponent size={22} />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text2)' }}>{name}</span>
        <div className="text-3xl font-black" style={{ color: 'var(--text)' }}>
          {value != null ? Number(value).toFixed(1) : <span className="animate-pulse">—</span>}
          <span className="text-lg font-medium ml-1" style={{ color }}>{unit}</span>
        </div>
      </div>
    </div>
  )
}

// Mini sparkline (última hora) para las variables de la vista rápida
function Sparkline({ points, color, height = 34 }) {
  if (!points || points.length < 2) return null
  const w = 120
  const vals = points.map(p => Number(p))
  const mn = Math.min(...vals)
  const mx = Math.max(...vals)
  const range = mx - mn || 1
  const pts = vals.map((v, i) =>
    `${(i / (vals.length - 1)) * w},${(height - 4) - ((v - mn) / range) * (height - 6)}`
  ).join(' ')
  const pathPts = pts
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <polyline
        points={pathPts}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  )
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
  const [showEsp32, setShowEsp32] = useState(false)
  const [showMeta, setShowMeta] = useState(true)
  const [showGps, setShowGps] = useState(false)
  const [showHard, setShowHard] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editDraft, setEditDraft] = useState({ name: '', label: '', description: '', icon: 'map-pin', tagsText: '', lat: '', lng: '', serial: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')
  const [sparks, setSparks] = useState({})
  const [showToken, setShowToken] = useState(false)
  const [copiedKey, setCopiedKey] = useState(null)
  const [nowTick, setNowTick] = useState(Date.now()) 

  const getAqiColor = (category) => {
    if (!category) return '#9CA3AF'
    const cat = category.toLowerCase()
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

  // Sparklines (última hora) para las variables de la vista rápida
  const quickKey = quickViewVars.map(v => v.label).join(',')
  useEffect(() => {
    if (!deviceId || !quickKey) return
    let ok = true
    dotsApi.getMultiple(deviceId, quickKey.split(','), '1h').then(res => {
      if (!ok) return
      const out = {}
      for (const [label, pts] of Object.entries(res || {})) {
        if (!Array.isArray(pts) || !pts.length) continue
        const every = Math.max(1, Math.ceil(pts.length / 28))
        out[label] = pts.filter((_, i) => i % every === 0).map(p => p.value)
      }
      setSparks(out)
    }).catch(() => {})
    return () => { ok = false }
  }, [deviceId, quickKey])

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
  const latValue = device?.lat != null ? parseFloat(device.lat) : null
  const lngValue = device?.lng != null ? parseFloat(device.lng) : null
  const hasValidGPS = latValue != null && lngValue != null && !isNaN(latValue) && !isNaN(lngValue)

  const temp = lastValues['temperatura'] ?? lastValues['Temperatura'] ?? lastValues['temperature'] ?? null
  const hum = lastValues['humedad'] ?? lastValues['Humedad'] ?? lastValues['humidity'] ?? null
  const co2 = lastValues['co2'] ?? lastValues['CO2'] ?? null
  const co = lastValues['co'] ?? lastValues['CO'] ?? null

  const varTempObj = variables.find(v => ['temperatura', 'temperature'].includes(v.label?.toLowerCase()))
  const varHumObj = variables.find(v => ['humedad', 'humidity'].includes(v.label?.toLowerCase()))
  const varCo2Obj = variables.find(v => ['co2'].includes(v.label?.toLowerCase()))
  const varCoObj = variables.find(v => ['co'].includes(v.label?.toLowerCase()))

  const TempIcon = AVAILABLE_ICONS[varTempObj?.icon?.toLowerCase()] || Thermometer
  const HumIcon = AVAILABLE_ICONS[varHumObj?.icon?.toLowerCase()] || Droplets
  const Co2Icon = AVAILABLE_ICONS[varCo2Obj?.icon?.toLowerCase()] || Cloud
  const CoIcon = AVAILABLE_ICONS[varCoObj?.icon?.toLowerCase()] || Flame

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
      lng: device?.lng ?? '',
      serial: device?.serial || ''
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
        tags,
        serial: editDraft.serial.trim() || undefined
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
  const brokerHostSafe = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  const dotToken = device?.token || '<TOKEN_DE_LA_ESTACION>'
  const dotEndpoint = `http://${brokerHostSafe}:3000/api/dots/${dotToken}`
  const sampleVars = quickViewVars.length ? quickViewVars : variables.slice(0, 4)
  const esp32Json = JSON.stringify(Object.fromEntries(sampleVars.map(v => [v.label, 0])), null, 2)
  const esp32Sketch = generateEspSketch(sampleVars, brokerHostSafe, dotToken, device?.label)

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
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

            <div className="space-y-6 lg:sticky lg:top-8 z-10">
              <aside className="rounded-3xl border p-4 shadow-lg" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => navigate(device?.space_id ? `/espacios/${device.space_id}` : '/dispositivos')}
                    className="p-2 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"
                    style={{ color: 'var(--text2)', border: '1px solid var(--border)' }}
                    title={device?.space_id ? 'Volver al espacio' : 'Volver a dispositivos'}
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-0.5">
                      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#67B7E81A', color: '#67B7E8' }}>
                        <DynamicIcon size={17} />
                      </span>
                      <h1 className="text-lg font-black truncate" style={{ color: 'var(--text)' }}>{device?.name}</h1>
                    </div>
                    <span className="text-xs block truncate pl-[46px]" style={{ color: 'var(--text2)' }}>{device?.label}</span>
                  </div>
                  <button
                    onClick={openEditModal}
                    className="p-2 rounded-xl transition-all hover:scale-105 flex-shrink-0"
                    style={{ color: 'var(--text2)', border: '1px solid var(--border)', background: '#67B7E80A' }}
                    title="Editar estación"
                  >
                    <Pencil size={15} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${device?.status === 'online' ? 'bg-[#1D9E75]/10 text-[#1D9E75]' : 'bg-[#DFF1FF] text-[#2E8ED3]'}`}>
                    {device?.status === 'online' ? <Wifi size={10} /> : <WifiOff size={10} />}
                    {device?.status === 'online'
                      ? `En línea ${agoText(device?.last_seen) ? '· ' + agoText(device?.last_seen) : ''}`
                      : 'Sin señal'}
                  </span>
                  {device?.space_id && spaceInfo?.name && (
                    <Link
                      to={`/espacios/${device.space_id}`}
                      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-semibold transition-all hover:scale-105"
                      style={{ background: (spaceColor || '#67B7E8') + '1A', color: spaceColor || '#67B7E8' }}
                    >
                      <Layers size={10} /> {spaceInfo.name}
                    </Link>
                  )}
                </div>

                <div className="rounded-2xl p-4 border space-y-3 shadow-sm" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <KeyRound size={12} className="text-[#67B7E8]" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Token de la estación</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] flex-1 truncate" title={device?.token} style={{ color: 'var(--text)' }}>
                      {showToken ? (device?.token || 'SIN TOKEN') : (device?.token ? '•'.repeat(16) : 'SIN TOKEN')}
                    </span>
                    <button onClick={() => setShowToken(v => !v)} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0" title="Mostrar / Ocultar token">
                      {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button onClick={() => copyText(device?.token || '', 'token')} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0" title="Copiar token">
                      {copiedKey === 'token' ? <Check size={12} className="text-[#1D9E75]" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <div className="pt-2 border-t grid grid-cols-2 gap-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="col-span-2">
                      <div className="text-[10px] font-black uppercase tracking-widest mb-1">ID</div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] flex-1 truncate" title={device?.id} style={{ color: 'var(--text)' }}>{device?.id}</span>
                        <button onClick={() => copyText(device?.id, 'id')} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0" title="Copiar ID">
                          {copiedKey === 'id' ? <Check size={12} className="text-[#1D9E75]" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                    <div title={device?.last_seen ? new Date(device.last_seen).toLocaleString('es-GT') : ''}>
                      <div className="text-[10px] font-black uppercase tracking-widest mb-1">Última actividad</div>
                      <div className="truncate" style={{ color: 'var(--text)' }}>{device?.last_seen ? agoText(device.last_seen) || 'ahora' : '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest mb-1">Ubicación</div>
                      <div className="truncate" style={{ color: 'var(--text)' }}>{hasValidGPS ? `${latValue.toFixed(4)}, ${lngValue.toFixed(4)}` : '—'}</div>
                    </div>
                  </div>
                </div>

                <Link to={`/alerts/${deviceId}`}
                  className="flex items-center justify-center gap-2 mt-6 border px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
                  <Bell size={14} /> Alertas
                </Link>
              </aside>

              <div className="border rounded-3xl shadow-lg overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <button
                  onClick={() => setShowMeta(v => !v)}
                  className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#67B7E81A', color: '#67B7E8' }}>
                      <Info size={14} />
                    </span>
                    <h3 className="font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--text)' }}>Metadatos</h3>
                  </div>
                  <ChevronDown size={16} className={`transition-transform duration-300 ${showMeta ? 'rotate-180' : ''}`} style={{ color: 'var(--text2)' }} />
                </button>
                {showMeta && (
                <div className="px-4 pb-4 space-y-3 border-t pt-3 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ borderColor: 'var(--border)' }}>
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
                )}
              </div>

              <div className="border rounded-3xl shadow-lg overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <button
                  onClick={() => setShowGps(v => !v)}
                  className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#1D9E751A', color: '#1D9E75' }}>
                      <MapPin size={14} />
                    </span>
                    <h3 className="font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--text)' }}>Ubicación GPS</h3>
                  </div>
                  <ChevronDown size={16} className={`transition-transform duration-300 ${showGps ? 'rotate-180' : ''}`} style={{ color: 'var(--text2)' }} />
                </button>
                {showGps && (
                <div className="px-4 pb-4 flex flex-col border-t pt-3 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ borderColor: 'var(--border)' }}>
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
                )}
              </div>

              <div className="border rounded-3xl shadow-lg overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <button
                  onClick={() => setShowHard(v => !v)}
                  className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#67B7E81A', color: '#67B7E8' }}>
                      <Cpu size={14} />
                    </span>
                    <h3 className="font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--text)' }}>Datos del Hardware</h3>
                  </div>
                  <ChevronDown size={16} className={`transition-transform duration-300 ${showHard ? 'rotate-180' : ''}`} style={{ color: 'var(--text2)' }} />
                </button>
                {showHard && (
                <div className="px-4 pb-4 border-t pt-3 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ borderColor: 'var(--border)' }}>
                <div className="space-y-4">
                  
                  <div className="flex items-center justify-center border border-dashed rounded-xl h-[110px]" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}>
                    <span className="text-[13px] text-slate-500 font-medium">Sin foto del equipo</span>
                  </div>

                  {/* Número de serie */}
                  <div>
                    <span className="block text-[12px] font-bold mb-1.5 text-slate-700 dark:text-slate-300">Número de Serie</span>
                    <div className="inline-block px-3 py-1.5 border rounded-lg text-xs font-mono font-medium bg-green-50/50 dark:bg-green-900/20 text-slate-800 dark:text-slate-200" style={{ borderColor: '#E2E8F0' }}>
                      {device?.serial || 'SN-NO-ASIGNADO'}
                    </div>
                  </div>

</div>

                </div>
                )}
              </div>

              <div className="border rounded-3xl overflow-hidden shadow-lg" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <button
                  onClick={() => setShowEsp32(v => !v)}
                  className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#67B7E81A', color: '#67B7E8' }}>
                      <Cpu size={18} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-black text-sm truncate" style={{ color: 'var(--text)' }}>Integración ESP32</h3>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text2)' }}>POST con el token y las variables</p>
                    </div>
                  </div>
                  <ChevronDown size={18} className={`transition-transform duration-300 flex-shrink-0 ${showEsp32 ? 'rotate-180' : ''}`} style={{ color: 'var(--text2)' }} />
                </button>
                {showEsp32 && (
                  <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                    {device?.space_id && (
                      <p className="text-[11px] px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: '#67B7E81A', color: '#67B7E8' }}>
                        <Info size={12} className="flex-shrink-0" /> Solo acepta las variables privadas de su espacio.
                      </p>
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>Endpoint (POST)</span>
                        <button onClick={() => copyText(dotEndpoint, 'endpoint')} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text2)' }}>
                          {copiedKey === 'endpoint' ? <><Check size={11} className="text-[#1D9E75]" /> Copiado</> : <><Copy size={11} /> Copiar</>}
                        </button>
                      </div>
                      <div className="font-mono text-[11px] px-3 py-2 rounded-xl border break-all" style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--bg)' }}>{dotEndpoint}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>JSON de ejemplo (payload)</span>
                        <button onClick={() => copyText(esp32Json, 'json')} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text2)' }}>
                          {copiedKey === 'json' ? <><Check size={11} className="text-[#1D9E75]" /> Copiado</> : <><Copy size={11} /> Copiar</>}
                        </button>
                      </div>
                      <pre className="text-[11px] px-3 py-2 rounded-xl border overflow-x-auto font-mono" style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--bg)' }}>{esp32Json}</pre>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>Código ESP8266/ESP32 (POST)</span>
                        <button onClick={() => copyText(esp32Sketch, 'sketch')} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text2)' }}>
                          {copiedKey === 'sketch' ? <><Check size={11} className="text-[#1D9E75]" /> Copiado</> : <><Copy size={11} /> Copiar todo</>}
                        </button>
                      </div>
                      <pre className="text-[11px] px-3 py-2 rounded-xl border overflow-x-auto font-mono max-h-[360px] overflow-y-auto" style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--bg)' }}>{esp32Sketch}</pre>
                      <p className="text-[10px] mt-1.5" style={{ color: 'var(--text2)' }}>
                        Pega en tu Arduino IDE, pon tu WiFi y reemplaza los valores TODO por tus sensores. El POST solo incluye: <span className="font-mono">{sampleVars.map(v => v.label).join(', ')}</span>.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              </div>

            <section className="flex flex-col min-h-[calc(100vh-4rem)]">

              <div className="flex-1 flex flex-col justify-center min-h-[calc(100vh-4rem)] pt-2">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 w-full items-center">
                  
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

                    <div className="flex items-center justify-center gap-1.5 mt-3 w-full">
                      {aqiData.dominantPollutant && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ color: 'var(--text2)', border: '1px solid var(--border)' }}>
                          Contaminante dominante: <span className="text-[#67B7E8]">{aqiData.dominantPollutant}</span>
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

                  {device?.space_id && variables.length > 0 ? (
                    <div className="border rounded-[3rem] p-8 flex flex-col justify-center shadow-lg min-h-[450px]" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                      <div className="flex justify-end mb-2 relative z-20">
                        <button
                          onClick={openQuickModal}
                          className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full transition-all hover:scale-105"
                          style={{ color: 'var(--text2)', border: '1px solid var(--border)' }}
                          title="Elegir qué variables se ven aquí (hasta 4)"
                        >
                          <SlidersHorizontal size={11} /> Cambiar variables
                        </button>
                      </div>
                      <div className="relative">
                        <div className="grid grid-cols-2 gap-5 w-full h-full items-stretch">
                          {quickViewVars.map((v, i) => {
                            const value = lastValues[v.label]
                            const IconComponent = AVAILABLE_ICONS[v.icon?.toLowerCase()] || Activity
                            const col = COLORS[i % COLORS.length]
                            return (
                              <div key={v.label} className="rounded-[1.75rem] px-5 py-6 border flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:scale-[1.04] hover:shadow-lg" style={{ background: `linear-gradient(145deg, ${col}14, transparent 70%)`, borderColor: `${col}33` }}>
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/5 h-px" style={{ background: `linear-gradient(90deg, transparent, ${col}, transparent)` }} />
                                <div className="flex items-center justify-center gap-2 mb-3">
                                  <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: col + '1A', color: col }}>
                                    <IconComponent size={15} />
                                  </span>
                                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text2)' }}>{v.name}</span>
                                </div>
                                <div className="leading-none" style={{ color: 'var(--text)' }}>
                                  <span className="text-4xl xl:text-5xl font-black tracking-tighter">
                                    {value != null ? Number(value).toFixed(1) : '--'}
                                  </span>
                                  <span className="text-lg xl:text-xl font-semibold ml-1.5" style={{ color: col }}>{v.unit}</span>
                                </div>
                                <div className={`w-full mt-3 ${value != null ? '' : 'opacity-20'}`}>
                                  <Sparkline points={sparks[v.label]} color={col} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {!quickHasData && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-[3rem] bg-white/40 dark:bg-black/40 backdrop-blur-[1px]">
                            <span className="text-xs font-bold px-4 py-2 rounded-full animate-pulse" style={{ background: 'var(--card)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                              Esperando datos de la estación...
                            </span>
                          </div>
                        )}
                      </div>
                      {variables.length > quickViewVars.length && (
                        <div className="flex justify-center mt-6">
                          <button
                            onClick={() => { setActiveView('variables'); scrollToDetails() }}
                            className="text-xs font-bold px-3 py-1.5 rounded-full hover:scale-105 transition-all" style={{ color: 'var(--text2)', border: '1px solid var(--border)' }}>
                            +{variables.length - quickViewVars.length} más en Métricas Detalladas
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border rounded-[3rem] p-8 flex flex-col justify-center shadow-sm min-h-[450px]" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                      <div className="grid grid-cols-2 gap-y-12 gap-x-4 w-full h-full items-center">
                        
                        <div className="text-center transition-transform duration-300 hover:scale-105">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <TempIcon size={24} className="text-rose-500" />
                            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text2)' }}>Temperatura</span>
                          </div>
                          <div className="text-5xl xl:text-6xl font-black tracking-tighter" style={{ color: 'var(--text)' }}>
                            {temp != null ? Number(temp).toFixed(1) : '--'}
                            <span className="text-2xl xl:text-3xl font-medium ml-1 text-rose-500/80">°C</span>
                          </div>
                        </div>
                        
                        <div className="text-center transition-transform duration-300 hover:scale-105">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <HumIcon size={24} className="text-blue-500" />
                            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text2)' }}>Humedad</span>
                          </div>
                          <div className="text-5xl xl:text-6xl font-black tracking-tighter" style={{ color: 'var(--text)' }}>
                            {hum != null ? Number(hum).toFixed(1) : '--'}
                            <span className="text-2xl xl:text-3xl font-medium ml-1 text-blue-500/80">%</span>
                          </div>
                        </div>

                        <div className="col-span-2 w-full h-px max-w-[80%] mx-auto" style={{ background: 'var(--border)' }}></div>

                        <div className="text-center transition-transform duration-300 hover:scale-105">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <Co2Icon size={24} className="text-[#8B5CF6]" />
                            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text2)' }}>Dióxido de Carbono</span>
                          </div>
                          <div className="text-5xl xl:text-6xl font-black tracking-tighter" style={{ color: 'var(--text)' }}>
                            {co2 != null ? Number(co2).toFixed(0) : '--'}
                            <span className="text-2xl xl:text-3xl font-medium ml-1 text-[#8B5CF6]/80">ppm</span>
                          </div>
                        </div>

                        <div className="text-center transition-transform duration-300 hover:scale-105">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <CoIcon size={24} className="text-orange-500" />
                            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text2)' }}>Monóxido</span>
                          </div>
                          <div className="text-5xl xl:text-6xl font-black tracking-tighter" style={{ color: 'var(--text)' }}>
                            {co != null ? Number(co).toFixed(1) : '--'}
                            <span className="text-2xl xl:text-3xl font-medium ml-1 text-orange-500/80">ppm</span>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                </div>
                <button
                  onClick={scrollToDetails}
                  className="self-center flex flex-col items-center gap-1 mt-auto mb-8 group cursor-pointer"
                  style={{ color: 'var(--text2)' }}
                >
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] group-hover:scale-105 transition-all">Ver métricas</span>
                  <ChevronDown size={22} className="animate-bounce transition-colors group-hover:text-[#67B7E8]" />
                </button>
              </div>

              <div id="detalles-view" className="flex justify-center mb-8 scroll-mt-8">
                <div className="inline-flex p-2 rounded-[2rem] shadow-lg" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => { setActiveView('variables'); scrollToDetails(); }}
                    className={`flex items-center gap-2 px-8 sm:px-10 py-4 rounded-3xl text-sm font-black tracking-wide transition-all duration-300 ${activeView === 'variables' ? 'bg-[#1D9E75] text-white shadow-lg scale-105' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                    style={activeView !== 'variables' ? { color: 'var(--text2)' } : {}}
                  >
                    <Gauge size={17} /> Métricas Detalladas
                  </button>
                  <button
                    onClick={() => { setActiveView('grafica'); scrollToDetails(); }}
                    className={`flex items-center gap-2 px-8 sm:px-10 py-4 rounded-3xl text-sm font-black tracking-wide transition-all duration-300 ${activeView === 'grafica' ? 'bg-[#1D9E75] text-white shadow-lg scale-105' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                    style={activeView !== 'grafica' ? { color: 'var(--text2)' } : {}}
                  >
                    <Activity size={17} /> Gráfica Histórica
                  </button>
                </div>
              </div>

              <div className="pb-12">
                {activeView === 'variables' ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Enlace al detalle de la variable */}
                    {variables.map((v, i) => (
                      <Link 
                        to={`/variableDetail/${deviceId}/${v.label}`} 
                        key={v.label} 
                        className="block"
                      >
                        <SensorKPI 
                          name={v.name} 
                          unit={v.unit} 
                          value={lastValues[v.label]} 
                          iconName={v.icon} 
                          color={COLORS[i % COLORS.length]} 
                        />
                      </Link>
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
                            <span className="font-semibold" style={{ color: 'var(--text)' }}>{v.variable_label}</span>
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
                          <span className="text-[10px] font-mono" style={{ color: 'var(--text2)' }}>{v.label} · {v.unit}</span>
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
                  <p className="text-sm" style={{ color: 'var(--text2)' }}>Nombre, ubicación, metadatos y hardware</p>
                </div>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 rounded-lg hover:bg-black/5" style={{ color: 'var(--text2)' }}>
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
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
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text2)' }}>Número de serie</span>
                  <input value={editDraft.serial} onChange={e => setEditDraft(d => ({ ...d, serial: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border outline-none focus:border-[#67B7E8] font-mono text-sm" style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--bg)' }} />
                </div>
                <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text2)' }}>
                  <KeyRound size={13} className="text-[#67B7E8]" />
                  <span className="text-[11px] font-semibold">La posición en el mapa usa estas coordenadas</span>
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