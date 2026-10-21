// VariableDetail.jsx - Frontend Completo
import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart, ReferenceArea } from 'recharts'
import ClienteLayout from '../components/sanik/ClienteLayout'
import { devices as devicesApi, dots as dotsApi, variables as variablesApi } from '../services/api' 

import { 
  ArrowLeft, Download, Trash2, Clock, Calendar, AlertCircle, ChevronLeft, ChevronRight, BarChart2, Check,
  FileText, FileSpreadsheet, ClipboardList
} from 'lucide-react'
import { exportStationRecordsPDF, exportStationRecordsExcel, exportStationWeeklyPDF } from '../utils/exportUtils'

// Modificadores estructurales de funciones matemáticas de Ubidots
const AGGREGATIONS = [
  { value: 'avg', label: 'Average' },
  { value: 'sum', label: 'Sum' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'count', label: 'Count' },
  { value: 'raw', label: 'Raw (Crudo)' }
]

// Intervalos válidos del Sample Period
const SAMPLE_PERIODS = [
  { value: '1 minute', label: '1 minute' },
  { value: '5 minutes', label: '5 minutes' },
  { value: '15 minutes', label: '15 minutes' },
  { value: '30 minutes', label: '30 minutes' },
  { value: '1 hour', label: '1 hour' },
  { value: '6 hours', label: '6 hours' }
]

// Mapeado estructurado de los Quick Ranges
const QUICK_RANGES = [
  { id: 'last_1_hour', label: 'Last 1 hour' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last_24_hours', label: 'Last 24 hours' },
  { id: 'this_week', label: 'This week' },
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_30_days', label: 'Last 30 days' },
  { id: 'last_3_months', label: 'Last 3 months' },
  { id: 'last_6_months', label: 'Last 6 months' },
  { id: 'this_year', label: 'This year' }
]

// DICCIONARIO DE COLORES PARA EL ICA
const AQI_COLORS = {
  'Excelente': '#10B981',  // Verde
  'Buena': '#FBBF24',      // Amarillo
  'Precaución': '#F59E0B', // Naranja
  'Mala': '#EF4444',       // Rojo
  'Peligrosa': '#8B5CF6'   // Morado/Violeta
}

// Etiquetas y unidades de la matriz semanal (mismo diccionario que el PDF)
const WEEKLY_LABELS = {
  temperatura: 'Temp.', humedad: 'Humedad', co: 'CO', co2: 'CO₂', nh3: 'NH₃',
  h2s: 'H₂S', nox: 'NOx', o3: 'O₃', pm1: 'PM1', pm10: 'PM10', pm25: 'PM2.5', so2: 'SO₂'
}
const WEEKLY_UNITS = {
  temperatura: '°C', humedad: '%', co: 'ppm', co2: 'ppm', nh3: 'ppm',
  h2s: 'µg/m³', nox: 'ppb', o3: 'ppb', pm1: 'µg/m³', pm10: 'µg/m³', pm25: 'µg/m³', so2: 'ppb'
}
const WEEKLY_BAND_COLORS = {
  Excelente: '#166534', Buena: '#059669', 'Precaución': '#b45309', Moderada: '#b45309',
  Mala: '#b91c1c', 'Muy Mala': '#9f1239', Peligrosa: '#7f1d1d', Severa: '#581c87'
}

const weekLabel = iso => {
  const d = new Date(`${iso}T00:00:00`)
  if (isNaN(d.getTime())) return iso
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function VariableDetail() {
  const { deviceId, variableLabel } = useParams()
  const navigate = useNavigate()
  const dropdownRef = useRef(null)
  
  // Estados de carga del gráfico
  const [chartData, setChartData] = useState([])
  const [loadingChart, setLoadingChart] = useState(true)
  const [aggregation, setAggregation] = useState('avg') 
  const [samplePeriod, setSamplePeriod] = useState('1 minute') 
  const [deviceInfo, setDeviceInfo] = useState(null)

  // Estado para guardar los rangos (Excelente, Buena, etc.)
  const [ranges, setRanges] = useState([])

  // Estados del Menú Avanzado de Tiempo
  const [showTimeDropdown, setShowTimeDropdown] = useState(false)
  const [selectedRange, setSelectedRange] = useState('last_24_hours')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  
  // Filtro de tiempo definitivo aplicado
  const [activeTimeFilter, setActiveTimeFilter] = useState({
    range: 'last_24_hours', start: null, end: null, label: 'Last 24 hours'
  })

  // Estados de la tabla paginada de datos históricos
  const [tableData, setTableData] = useState([])
  const [loadingTable, setLoadingTable] = useState(true)
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Exportación de registros por estación (todas las variables del dispositivo)
  const [exportingRecords, setExportingRecords] = useState(null)
  const [recordsNotice, setRecordsNotice] = useState(null)

  // Vista: gráfica o resumen semanal (comparten el mismo filtro de fechas)
  const [chartView, setChartView] = useState('chart')
  const [weekly, setWeekly] = useState(null)
  const [loadingWeekly, setLoadingWeekly] = useState(false)
  
  const cleanVariable = String(variableLabel || '').toLowerCase()
  const isRawMode = aggregation === 'raw'

  // Manejador para cerrar el menú desplegable al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowTimeDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Hook de sincronización de datos para la gráfica y los rangos
  useEffect(() => {
    let active = true
    const loadChartData = async () => {
      setLoadingChart(true)
      try {
        if (!deviceInfo) {
          const dev = await devicesApi.get(deviceId).catch(() => null)
          if (active && dev) setDeviceInfo(dev)
        }

        // 1. Obtener los rangos de esta variable para pintar el fondo (colores)
        try {
          const rangesData = await variablesApi.getRanges(cleanVariable)
          if (active && rangesData) setRanges(rangesData)
        } catch (err) {
          console.warn("No se pudieron cargar los rangos, la gráfica se mostrará sin fondo de colores.", err)
        }

        // 2. Ejecutar petición de datos para la línea de la gráfica
        const result = await dotsApi.get(
          deviceId, cleanVariable, 
          activeTimeFilter.range || '', 
          aggregation, samplePeriod,
          undefined,
          activeTimeFilter.start, activeTimeFilter.end
        )

        if (active && Array.isArray(result)) {
          const formatted = result.map(d => ({
            ...d,
            displayTime: new Date(d.time).toLocaleString('es-GT', { 
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
            })
          }))
          setChartData(formatted)
        }
      } catch (err) {
        console.error("Error al procesar la telemetría gráfica:", err)
      } finally {
        if (active) setLoadingChart(false)
      }
    }
    loadChartData()
    return () => { active = false }
  }, [deviceId, variableLabel, aggregation, samplePeriod, activeTimeFilter])

  // Hook de sincronización para rellenar la tabla de logs crudos
  useEffect(() => {
    let active = true
    const loadTableData = async () => {
      setLoadingTable(true)
      try {
        const response = await dotsApi.getRaw(deviceId, cleanVariable, page, rowsPerPage)
        if (active && response && Array.isArray(response.results)) {
          setTotalRecords(response.total)
          setTotalPages(response.totalPages)
          
          const formatted = response.results.map(d => ({
            ...d,
            displayTime: new Date(d.time).toLocaleString('es-GT', { 
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
              hour12: false
            })
          }))
          setTableData(formatted)
        }
      } catch (err) {
        console.error("Error al poblar los datos de la tabla:", err)
      } finally {
        if (active) setLoadingTable(false)
      }
    }
    loadTableData()
    return () => { active = false }
  }, [deviceId, variableLabel, page, rowsPerPage])

  // El resumen semanal sigue el mismo filtro de fechas que la gráfica
  useEffect(() => {
    if (chartView !== 'weekly') return
    let active = true
    const loadWeekly = async () => {
      setLoadingWeekly(true)
      try {
        const { start, end } = resolveRange()
        const payload = await dotsApi.stationWeekly(deviceId, { start, end })
        if (active) setWeekly(payload)
      } catch (err) {
        console.error('Error al cargar el resumen semanal:', err)
        if (active) setWeekly(null)
      } finally {
        if (active) setLoadingWeekly(false)
      }
    }
    loadWeekly()
    return () => { active = false }
  }, [chartView, deviceId, activeTimeFilter])

  // Eliminar un registro de telemetría de forma permanente
  const handleDeletePoint = async (time) => {
    if (!window.confirm('¿Deseas remover este registro de telemetría de la base de datos?')) return
    setTableData(prev => prev.filter(item => item.time !== time))
  }

  // Confirmar y aplicar la selección de tiempo del Dropdown
  const handleApplyTimeFilter = () => {
    if (selectedRange === 'custom') {
      if (!customStartDate || !customEndDate) {
        alert("Por favor introduce los parámetros de fecha de inicio y fin.")
        return
      }
      setActiveTimeFilter({
        range: null,
        start: customStartDate,
        end: customEndDate,
        label: `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`
      })
    } else {
      const target = QUICK_RANGES.find(r => r.id === selectedRange)
      setActiveTimeFilter({
        range: selectedRange,
        start: null,
        end: null,
        label: target ? target.label : 'Rango Activo'
      })
    }
    setShowTimeDropdown(false)
  }

  // Exportar la vista de datos de la tabla actual a formato CSV
  const exportToCSV = () => {
    if (!tableData.length) return
    const headers = ['Fecha y Hora,Valor\n']
    const rows = tableData.map(r => `"${r.displayTime}",${r.value}`)
    const blob = new Blob([headers.concat(rows.join('\n'))], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `export_${variableLabel}_p${page}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Convierte el rango activo del filtro en fechas explícitas para el backend
  const resolveRange = () => {
    const { range, start, end } = activeTimeFilter

    // handleApplyTimeFilter guarda range: null cuando es custom, con fechas datetime-local
    if (start && end) {
      const from = new Date(start)
      const to = new Date(end)
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
        return { start: from.toISOString(), end: to.toISOString() }
      }
    }

    const now = new Date()
    const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate())
    let from
    switch (range) {
      case 'last_1_hour':   from = new Date(now.getTime() - 3600e3); break
      case 'today':         from = startOfDay(now); break
      case 'yesterday': {
        const y = new Date(now); y.setDate(y.getDate() - 1)
        from = startOfDay(y); break
      }
      case 'this_week': {
        const d = startOfDay(now)
        const weekday = (d.getDay() + 6) % 7
        from = new Date(d.getTime() - weekday * 86400e3); break
      }
      case 'last_7_days':   from = new Date(now.getTime() - 7 * 86400e3); break
      case 'this_month':    from = new Date(now.getFullYear(), now.getMonth(), 1); break
      case 'last_30_days':  from = new Date(now.getTime() - 30 * 86400e3); break
      case 'last_3_months': from = new Date(now.getTime() - 90 * 86400e3); break
      case 'last_6_months': from = new Date(now.getTime() - 180 * 86400e3); break
      case 'this_year':     from = new Date(now.getFullYear(), 0, 1); break
      default:              from = new Date(now.getTime() - 86400e3)
    }
    return { start: from.toISOString(), end: now.toISOString() }
  }

  // Registros de TODAS las variables de la estación, no solo la variable abierta
  const exportStationRecords = async (format) => {
    setRecordsNotice(null)
    setExportingRecords(format)
    try {
      const { start, end } = resolveRange()
      const payload = await dotsApi.stationRecords(deviceId, { start, end, limit: 2000 })

      if (!payload.variables?.length) {
        setRecordsNotice({ type: 'warn', text: 'No hay lecturas en el rango seleccionado.' })
        return
      }

      if (format === 'pdf') exportStationRecordsPDF(payload)
      else exportStationRecordsExcel(payload)

      setRecordsNotice({
        type: 'info',
        text: payload.coverage.truncated
          ? `PDF con ${payload.coverage.includedReadings.toLocaleString()} de ${payload.coverage.totalReadings.toLocaleString()} lecturas (tope de ${payload.coverage.limitPerVariable.toLocaleString()} por variable). Usá Excel para el volcado completo.`
          : `${payload.coverage.totalReadings.toLocaleString()} lecturas exportadas.`
      })
    } catch (err) {
      setRecordsNotice({ type: 'error', text: `No se pudo exportar: ${err.message}` })
    } finally {
      setExportingRecords(null)
    }
  }

  return (
    <ClienteLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Header Superior */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate(`/dispositivos`)} 
                className="p-2.5 rounded-xl border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-2xl font-black tracking-tight uppercase" style={{ color: 'var(--text)' }}>
                  {variableLabel}
                </h1>
                <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text2)' }}>
                  Dispositivo: <span style={{ color: 'var(--text)' }}>{deviceInfo?.name || 'Cargando...'}</span> | ID: <span className="font-mono text-[11px]">{deviceId}</span>
                </p>
              </div>
            </div>
          </div>

          {/* MENÚ DE FILTRADO SUPERIOR REESTRUCTURADO */}
          <div className="flex flex-col md:flex-row items-center gap-4 border rounded-2xl p-4 shadow-sm" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            
            {/* DROPDOWN AVANZADO DE RANGOS DE TIEMPO */}
            <div className="relative w-full md:w-auto" ref={dropdownRef}>
              <button
                onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                className="flex items-center justify-between w-full md:w-auto gap-3 px-4 py-2 border rounded-xl bg-var(--bg) font-black text-xs transition-all hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                <span className="flex items-center gap-2 text-var(--text2)">
                  <Calendar size={14} className="text-[#67B7E8]" />
                  {activeTimeFilter.label}
                </span>
                <ChevronLeft size={14} className="-rotate-90 text-gray-400" />
              </button>

              {/* PANEL FLOTANTE EN DOS COLUMNAS */}
              {showTimeDropdown && (
                <div className="absolute left-0 mt-2 w-[520px] bg-white dark:bg-[#111] border rounded-2xl shadow-2xl z-50 overflow-hidden grid grid-cols-2" style={{ borderColor: 'var(--border)' }}>
                  
                  {/* Columna A: Quick Ranges */}
                  <div className="p-3 border-r max-h-[380px] overflow-y-auto space-y-0.5" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-[10px] font-bold text-gray-400 uppercase px-2 mb-2 tracking-wider">Quick ranges</div>
                    {QUICK_RANGES.map(qr => (
                      <button
                        key={qr.id}
                        onClick={() => setSelectedRange(qr.id)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${selectedRange === qr.id ? 'bg-[#1D9E75]/10 text-[#1D9E75]' : 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'}`}
                      >
                        {qr.label}
                        {selectedRange === qr.id && <Check size={12} />}
                      </button>
                    ))}
                  </div>

                  {/* Columna B: Custom Range / Fechas Manuales */}
                  <div className="p-4 bg-gray-50/50 dark:bg-black/10 flex flex-col justify-between">
                    <div className="space-y-4">
                      <button
                        onClick={() => setSelectedRange('custom')}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${selectedRange === 'custom' ? 'bg-[#1D9E75]/10 text-[#1D9E75]' : 'text-gray-400 font-normal'}`}
                      >
                        <span>Custom range</span>
                        {selectedRange === 'custom' && <Check size={12} />}
                      </button>

                      <div className={`space-y-3 transition-all duration-200 ${selectedRange === 'custom' ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Start Date</label>
                          <input 
                            type="datetime-local" 
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="w-full text-xs p-2 border rounded-xl dark:bg-[#1a1a1a] dark:border-zinc-800 text-var(--text)"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">End Date</label>
                          <input 
                            type="datetime-local" 
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="w-full text-xs p-2 border rounded-xl dark:bg-[#1a1a1a] dark:border-zinc-800 text-var(--text)"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-zinc-800 mt-4">
                      <button 
                        onClick={() => setShowTimeDropdown(false)}
                        className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        CANCEL
                      </button>
                      <button 
                        onClick={handleApplyTimeFilter}
                        className="px-4 py-1.5 text-xs font-black bg-[#1D9E75] text-white rounded-xl shadow-md hover:bg-[#157858] transition-all"
                      >
                        UPDATE
                      </button>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* FUNCIÓN DE AGREGACIÓN */}
            <div className="flex items-center justify-between w-full md:w-auto gap-3 md:border-l md:pl-4" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 text-xs font-bold text-var(--text2)" style={{ color: 'var(--text2)' }}>
                <BarChart2 size={14} className="text-[#67B7E8]" />
                Aggregation
              </div>
              <select
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value)}
                className="bg-var(--bg) border rounded-xl px-3 py-1.5 font-black text-xs cursor-pointer focus:outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              >
                {AGGREGATIONS.map(agg => (
                  <option key={agg.value} value={agg.value}>{agg.label}</option>
                ))}
              </select>
            </div>

            {/* PERÍODO DE MUESTREO */}
            <div className={`flex items-center justify-between w-full md:w-auto gap-3 md:border-l md:pl-4 transition-all duration-300 ${isRawMode ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
              <div className="flex items-center gap-2 text-xs font-bold text-var(--text2)" style={{ color: 'var(--text2)' }}>
                <Clock size={14} className="text-[#67B7E8]" />
                Sample period
              </div>
              <select
                disabled={isRawMode}
                value={samplePeriod}
                onChange={(e) => setSamplePeriod(e.target.value)}
                className="bg-var(--bg) border rounded-xl px-3 py-1.5 font-black text-xs cursor-pointer focus:outline-none disabled:cursor-not-allowed"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              >
                {SAMPLE_PERIODS.map(sp => (
                  <option key={sp.value} value={sp.value}>{sp.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={exportToCSV}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-[#1D9E75] text-white shadow-sm hover:bg-[#157858] transition-all"
            >
              <Download size={14} /> Exportar (.CSV)
            </button>

            {/* REGISTROS DE LA ESTACIÓN: todas las variables, con fecha, duración y lugar */}
            <div className="w-full md:w-auto flex items-center gap-2">
              <button
                onClick={() => exportStationRecords('pdf')}
                disabled={exportingRecords !== null}
                title="Registros de todas las variables de la estación (tope 2,000 por variable)"
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-[#67B7E8] text-white shadow-sm hover:bg-[#52A8E0] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingRecords === 'pdf'
                  ? <><span className="animate-pulse">Generando…</span></>
                  : <><ClipboardList size={14} /> Registros (.PDF)</>}
              </button>
              <button
                onClick={() => exportStationRecords('xlsx')}
                disabled={exportingRecords !== null}
                title="Volcado completo de todas las variables de la estación, sin recorte"
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingRecords === 'xlsx'
                  ? <><span className="animate-pulse">Generando…</span></>
                  : <><FileSpreadsheet size={14} /> Registros (.XLSX)</>}
              </button>
            </div>
          </div>

          {recordsNotice && (
            <div
              className="flex items-start gap-2 rounded-2xl px-4 py-3 text-xs font-bold border"
              style={
                recordsNotice.type === 'error'
                  ? { background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.35)', color: '#b91c1c' }
                  : recordsNotice.type === 'warn'
                    ? { background: 'rgba(234,179,8,0.10)', borderColor: 'rgba(234,179,8,0.35)', color: '#a16207' }
                    : { background: 'rgba(103,183,232,0.10)', borderColor: 'rgba(103,183,232,0.35)', color: 'var(--text)' }
              }
            >
              {recordsNotice.type === 'error' ? <AlertCircle size={14} className="shrink-0 mt-px" /> : <FileText size={14} className="shrink-0 mt-px" />}
              <span>{recordsNotice.text}</span>
              <button
                onClick={() => setRecordsNotice(null)}
                className="ml-auto shrink-0 opacity-60 hover:opacity-100"
                aria-label="Cerrar aviso"
              >
                ×
              </button>
            </div>
          )}

          {/* SELECTOR DE VISTA: la misma serie, en curva o resumida por semana */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex gap-2 p-1 rounded-2xl w-fit" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <button
                onClick={() => setChartView('chart')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${chartView === 'chart' ? 'bg-[#67B7E8] text-white shadow-md' : 'text-gray-400 hover:bg-black/5'}`}
              >
                <BarChart2 size={15} /> Gráfica
              </button>
              <button
                onClick={() => setChartView('weekly')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${chartView === 'weekly' ? 'bg-[#67B7E8] text-white shadow-md' : 'text-gray-400 hover:bg-black/5'}`}
              >
                <ClipboardList size={15} /> Resumen semanal
              </button>
            </div>

            {chartView === 'weekly' && (
              <button
                onClick={() => {
                  if (!weekly?.variables?.length) return
                  setExportingRecords('weekly')
                  try { exportStationWeeklyPDF(weekly) } finally { setExportingRecords(null) }
                }}
                disabled={exportingRecords !== null || !weekly?.variables?.length}
                title={
                  weekly?.variables?.length
                    ? 'Descargar el resumen semanal en PDF horizontal'
                    : 'No hay lecturas en el rango seleccionado, no se puede generar'
                }
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-[#67B7E8] text-white shadow-sm hover:bg-[#52A8E0] transition-all disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {exportingRecords === 'weekly' ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generando...</>
                ) : (
                  <><FileText size={15} /> Generar PDF</>
                )}
              </button>
            )}
          </div>

          {chartView === 'chart' ? (
          /* AREA GRÁFICA RESPONSIVA CON FONDOS DE COLORES */
          <div className="border rounded-[2.5rem] p-6 shadow-sm relative min-h-[400px]" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            {loadingChart && (
              <div className="absolute inset-0 bg-white/60 dark:bg-black/60 rounded-[2.5rem] z-20 flex items-center justify-center backdrop-blur-sm">
                <div className="text-xs font-bold text-[#1D9E75] animate-pulse">
                  {isRawMode ? 'Consultando telemetría cruda...' : `Procesando agregación (${samplePeriod})...`}
                </div>
              </div>
            )}

            {!loadingChart && chartData.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <AlertCircle size={32} className="text-amber-500 mb-2 opacity-60" />
                <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>No se encontraron registros de telemetría en este rango temporal.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={380}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#1D9E75" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="displayTime" stroke="var(--text2)" tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} tickMargin={12} />
                  <YAxis stroke="var(--text2)" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} tickMargin={12} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, color: 'var(--text)' }}
                    itemStyle={{ fontWeight: '900' }}
                  />
                  
                  {/* MAGIA DE COLORES: Bandas de fondo según los rangos (ReferenceArea) */}
                  {ranges.map((r, idx) => {
                    const isInfinite = r.max_value === 999999
                    return (
                      <ReferenceArea 
                        key={idx} 
                        y1={r.min_value} 
                        y2={isInfinite ? undefined : r.max_value} 
                        fill={AQI_COLORS[r.category] || '#ccc'} 
                        fillOpacity={0.15} // Opacidad baja para no tapar la línea ni la cuadrícula
                        ifOverflow="hidden"
                      />
                    )
                  })}

                  <Area type="monotone" dataKey="value" stroke="#1D9E75" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" name={isRawMode ? "Valor Crudo" : "Valor Agregado"} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          ) : (
          /* RESUMEN SEMANAL: la misma serie resumida, semana contra semana */
          <div className="border rounded-[2.5rem] overflow-hidden shadow-sm" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="p-5 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <ClipboardList size={15} className="text-[#67B7E8]" />
                <h3 className="font-black text-xs uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                  Promedio semanal por variable
                </h3>
              </div>
              {weekly?.weeks?.length > 0 && (
                <span className="text-[11px] font-bold" style={{ color: 'var(--text2)' }}>
                  {weekly.weeks.length} semana{weekly.weeks.length === 1 ? '' : 's'} ·{' '}
                  {weekly.variables.reduce((a, v) => a + v.count, 0).toLocaleString()} lecturas
                </span>
              )}
            </div>

            {loadingWeekly ? (
              <div className="p-16 flex items-center justify-center">
                <div className="text-xs font-bold animate-pulse" style={{ color: 'var(--text2)' }}>
                  Calculando promedios semanales...
                </div>
              </div>
            ) : !weekly?.variables?.length ? (
              <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
                <AlertCircle size={30} className="text-amber-500 opacity-60" />
                <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                  No hay lecturas en el rango seleccionado
                </p>
                <p className="text-xs max-w-md" style={{ color: 'var(--text2)' }}>
                  Usa el filtro de rango de arriba y selecciona <strong>Rango personalizado</strong>
                  {' '}para abarcar las fechas donde la estación sí tiene datos registrados.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ background: 'var(--bg)' }}>
                      <th className="px-4 py-3 text-left font-black uppercase tracking-wider sticky left-0" style={{ color: 'var(--text2)', background: 'var(--bg)' }}>
                        Semana
                      </th>
                      {weekly.variables.map(v => (
                        <th key={v.variable} className="px-3 py-3 text-center font-black whitespace-nowrap">
                          <span style={{ color: 'var(--text)' }}>{WEEKLY_LABELS[v.variable] || v.variable}</span>
                          <span className="block text-[9px] font-bold normal-case" style={{ color: 'var(--text2)' }}>
                            {WEEKLY_UNITS[v.variable] || ''}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weekly.weeks.map((week, wi) => (
                      <tr key={week} style={{ background: wi % 2 === 1 ? 'var(--bg)' : 'transparent' }}>
                        <td className="px-4 py-2.5 font-black whitespace-nowrap sticky left-0" style={{ color: 'var(--text)', background: wi % 2 === 1 ? 'var(--bg)' : 'var(--card)' }}>
                          {weekLabel(week)}
                        </td>
                        {weekly.variables.map(v => {
                          const value = v.byWeek[week]
                          const band = value !== undefined
                            ? (v.ranges || []).find(r => r.min <= value && (r.max === null || r.max > value))
                            : null
                          return (
                            <td key={v.variable} className="px-3 py-2.5 text-center font-bold" style={{ color: value === undefined ? 'var(--text2)' : (band ? WEEKLY_BAND_COLORS[band.category] : 'var(--text)') }}>
                              {value === undefined ? '—' : Number(value).toFixed(2)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--bg)', borderTop: '2px solid var(--border)' }}>
                      <td className="px-4 py-3 font-black uppercase tracking-wider sticky left-0" style={{ color: 'var(--text)', background: 'var(--bg)' }}>
                        Promedio
                      </td>
                      {weekly.variables.map(v => (
                        <td key={v.variable} className="px-3 py-3 text-center font-black" style={{ color: 'var(--text)' }}>
                          {v.avg === null ? '—' : Number(v.avg).toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          )}

          {/* TABLA HISTÓRICA CON PAGINACIÓN OFFSET */}
          <div className="border rounded-3xl overflow-hidden shadow-sm" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-[#67B7E8]" />
                <h3 className="font-black text-xs uppercase tracking-wider" style={{ color: 'var(--text)' }}>Historial general de registros</h3>
              </div>
            </div>

            <div className="overflow-x-auto relative min-h-[220px]">
              {loadingTable && (
                <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-10 flex items-center justify-center">
                  <div className="text-xs font-bold text-[#1D9E75]">Ejecutando paginación...</div>
                </div>
              )}
              
              {tableData.length === 0 ? (
                <div className="p-8 text-center text-xs italic" style={{ color: 'var(--text2)' }}>No se encontraron lecturas</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[11px] font-black uppercase tracking-wider bg-black/[0.02] dark:bg-white/[0.02]" style={{ color: 'var(--text2)' }}>
                      <th className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>Fecha y Hora Exacta</th>
                      <th className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>Valor Crudo</th>
                      <th className="p-4 border-b text-center" style={{ borderColor: 'var(--border)' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {tableData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                        <td className="p-4 whitespace-nowrap font-mono text-xs">{row.displayTime}</td>
                        <td className="p-4 font-bold text-[#1D9E75]">{row.value}</td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => handleDeletePoint(row.time)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-md transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* CONTROLADORES DE PAGINACIÓN */}
            <div className="p-4 bg-black/[0.01] dark:bg-white/[0.01] border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
              <div className="flex items-center gap-2">
                <span>Filas por página:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10))
                    setPage(1)
                  }}
                  className="bg-var(--bg) border rounded-lg px-2 py-1 font-black cursor-pointer focus:outline-none text-var(--text)"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-[11px] ml-2 font-normal">
                  Mostrando {((page - 1) * rowsPerPage) + 1} - {Math.min(page * rowsPerPage, totalRecords)} de {totalRecords} puntos
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-2 border rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-3">Página {page} de {totalPages}</span>
                <button
                  disabled={page === totalPages || totalPages === 0}
                  onClick={() => setPage(p => p + 1)}
                  className="p-2 border rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>
    </ClienteLayout>
  )
}