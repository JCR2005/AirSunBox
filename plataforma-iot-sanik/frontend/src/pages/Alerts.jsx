import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import ClienteLayout from '../components/sanik/ClienteLayout'
import { alerts as alertsApi, devices as devicesApi } from '../services/api'
import {
  Bell, Plus, Trash2, ToggleLeft, ToggleRight, X, History,
  Gauge, Activity, ChevronDown, ChevronUp, ArrowLeft
} from 'lucide-react'

const CONDITIONS = [
  { value: '>', label: 'Mayor que' },
  { value: '<', label: 'Menor que' },
  { value: '=', label: 'Igual a' }
]

const COOLDOWN_OPTIONS = [
  { value: 0, label: 'Solo al activarse' },
  { value: 30, label: 'Cada 30 min' },
  { value: 60, label: 'Cada 1 hora' },
  { value: 120, label: 'Cada 2 horas' },
  { value: 180, label: 'Cada 3 horas' }
]

const CLASSIC_PRESETS = [
  { name: 'Excelente', value: 0 },
  { name: 'Buena', value: 21 },
  { name: 'Precaución', value: 41 },
  { name: 'Mala', value: 61 },
  { name: 'Peligrosa', value: 81 }
]

const AQI_COLORS = { excelente: '#10B981', buena: '#34D399', precaución: '#F59E0B', mala: '#F97316', peligrosa: '#EF4444' }

const aqiColor = (cat) => {
  const c = (cat || '').toLowerCase()
  for (const k of Object.keys(AQI_COLORS)) if (c.includes(k)) return AQI_COLORS[k]
  return '#9CA3AF'
}

const DEFAULT_MESSAGE = 'ALERTA Sanik · La estación {estacion} ({espacio}) reportó {variable} = {valor} · {hora}'

export default function Alerts() {
  const { deviceId } = useParams()
  const navigate = useNavigate()

  const [devices, setDevices] = useState([])
  const [device, setDevice] = useState(null)
  const [variables, setVariables] = useState([])
  const [alertList, setAlertList] = useState([])
  const [logs, setLogs] = useState([])
  const [showLogs, setShowLogs] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    type: 'aqi',
    variable: '',
    condition: '>',
    threshold: 50,
    cooldownMinutes: 0,
    useEmail: false,
    emailTo: '',
    useWebhook: false,
    webhookUrl: '',
    useTelegram: false,
    botToken: '',
    chatId: '',
    message: DEFAULT_MESSAGE
  })

  // ── Sin estación: listar estaciones del cliente para elegir ──
  useEffect(() => {
    if (!deviceId) {
      devicesApi.list().then(setDevices).catch(() => {})
    }
  }, [deviceId])

  // ── Cargar datos de la estación ──
  useEffect(() => {
    if (!deviceId) return
    devicesApi.get(deviceId).then(setDevice).catch(() => {})
    devicesApi.variables(deviceId)
      .then(vars => {
        setVariables(vars)
        setForm(f => ({ ...f, variable: vars?.find(v => ['temperatura', 'temperature'].includes(v.label?.toLowerCase()))?.label || vars?.[0]?.label || '' }))
      })
      .catch(() => {})
    alertsApi.list(deviceId).then(setAlertList).catch(() => {})
    alertsApi.logs(deviceId).then(setLogs).catch(() => {})
  }, [deviceId])

  const handleCreate = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        deviceId,
        variable: form.type === 'aqi' ? 'aqi' : form.variable,
        condition: form.condition,
        threshold: Number(form.threshold),
        cooldownMinutes: Number(form.cooldownMinutes) || 0,
        message: form.message?.trim() || DEFAULT_MESSAGE,
        emailTo: form.useEmail ? (form.emailTo?.trim() || null) : null,
        webhookUrl: form.useWebhook ? (form.webhookUrl?.trim() || null) : null,
        channel: form.useEmail && form.useWebhook
          ? 'both'
          : (form.useEmail ? 'email' : (form.useWebhook ? 'webhook' : (form.useTelegram ? 'telegram' : ''))),
        emailTo: form.useEmail ? (form.emailTo?.trim() || null) : null,
        webhookUrl: form.useWebhook ? (form.webhookUrl?.trim() || null) : null,
        botToken: form.useTelegram ? (form.botToken?.trim() || null) : null,
        chatId: form.useTelegram ? (form.chatId?.trim() || null) : null
      }
      const alert = await alertsApi.create(payload)
      setAlertList(prev => [alert, ...prev])
      setShowModal(false)
      setForm({
        type: 'aqi', variable: form.variable, condition: '>', threshold: 50,
        cooldownMinutes: 0, useEmail: false, emailTo: '', useWebhook: false,
        webhookUrl: '', useTelegram: false, botToken: '', chatId: '', message: DEFAULT_MESSAGE
      })
    } catch (err) {
      console.error('No se pudo crear la alerta:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (alert) => {
    const updated = await alertsApi.toggle(alert.id, !alert.active)
    setAlertList(prev => prev.map(a => a.id === alert.id ? { ...a, active: updated.active } : a))
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta alerta?')) return
    await alertsApi.delete(id)
    setAlertList(prev => prev.filter(a => a.id !== id))
  }

  const insertPlaceholder = (key) => {
    setForm(f => ({ ...f, message: `${f.message || ''}{${key}}` }))
  }

  const typeIcon = (v) => v === 'aqi'
    ? <Gauge size={20} className="text-[#1D9E75]" />
    : <Activity size={20} className="text-[#67B7E8]" />

  const formatTrigger = (a) => {
    if (!a.last_triggered_at && a.trigger_count === 0) return 'Nunca'
    const d = new Date(a.last_triggered_at)
    const rel = isNaN(d.getTime()) ? '' : ` · ${d.toLocaleString('es-GT')}`
    return `${a.trigger_count} ${a.trigger_count === 1 ? 'vez' : 'veces'}${rel}`
  }

  return (
    <ClienteLayout>
      <div className="p-6 lg:p-10">

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <Bell size={24} style={{ color: 'var(--primary)' }} /> Alertas
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
              {deviceId ? `Configuración para ${device?.name || 'la estación'}` : 'Elegí una estación para gestionar sus alertas'}
            </p>
          </div>
          {deviceId && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLogs(s => !s)}
                className="flex items-center gap-2 border px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text2)' }}>
                {showLogs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                <History size={16} /> Historial
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-[#67B7E8] hover:bg-[#52A8E0] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#67B7E8]/20">
                <Plus size={18} /> Nueva alerta
              </button>
            </div>
          )}
        </div>

        {/* ── Sin estación: selector ── */}
        {!deviceId ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {devices.map(d => (
                <button
                  key={d.id}
                  onClick={() => navigate(`/alerts/${d.id}`)}
                  className="group rounded-2xl p-5 border text-left transition-all hover:shadow-md hover:-translate-y-0.5"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#67B7E8]/10 text-[#67B7E8]">
                      <Bell size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>{d.name}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--text2)' }}>{d.space_name || 'Sin espacio'}</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#67B7E8] group-hover:underline">Gestionar alertas →</span>
                </button>
              ))}
            </div>
            {!devices.length && (
              <div className="rounded-3xl p-12 text-center border border-dashed" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <Bell size={48} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--text)' }} />
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>No tenés estaciones</h3>
                <p className="text-sm" style={{ color: 'var(--text2)' }}>Creá una estación en Dispositivos para poder configurarle alertas.</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {device && (
              <div className="flex items-center gap-3 mb-6">
                <Link to={`/devices/${deviceId}`} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text2)' }}>
                  <ArrowLeft size={16} />
                </Link>
                <div>
                  <div className="font-bold" style={{ color: 'var(--text)' }}>{device.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text2)' }}>{device.label}</div>
                </div>
              </div>
            )}

            {/* historial */}
            {showLogs && (
              <div className="mb-8 border rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <h3 className="font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <History size={14} className="text-[#67B7E8]" /> Historial de disparos
                </h3>
                {!logs.length ? (
                  <p className="text-sm italic" style={{ color: 'var(--text2)' }}>Aún no hay disparos registrados.</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {logs.map(log => (
                      <div key={log.id} className="border rounded-xl px-4 py-3 text-xs" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="font-bold" style={{ color: 'var(--text)' }}>
                            {log.variable === 'aqi'
                              ? <><Gauge size={12} className="inline mr-1 text-[#1D9E75]" /> AQI {log.aqi ?? '--'} · {log.category || '—'}</>
                              : <><Activity size={12} className="inline mr-1 text-[#67B7E8]" /> {log.variable} = {log.value}</>}
                          </span>
                          <span style={{ color: 'var(--text2)' }}>{new Date(log.created_at).toLocaleString('es-GT')}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-line" style={{ color: 'var(--text2)' }}>{log.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {alertList.length === 0 ? (
              <div className="rounded-3xl p-12 text-center border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <Bell size={48} className="mx-auto mb-4 opacity-10" style={{ color: 'var(--text)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text2)' }}>No hay alertas configuradas para esta estación</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {alertList.map(alert => (
                  <div
                    key={alert.id}
                    className={`group rounded-2xl p-5 border flex items-start gap-4 transition-all hover:shadow-md ${alert.active ? 'opacity-100' : 'opacity-60 grayscale'}`}
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: alert.variable === 'aqi' ? 'rgba(29,158,117,0.1)' : 'rgba(103,183,232,0.1)' }}>
                      {typeIcon(alert.variable)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                          {alert.variable === 'aqi' ? 'AQI de la estación' : alert.variable.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md"
                          style={{ background: alert.variable === 'aqi' ? 'rgba(29,158,117,0.1)' : 'rgba(103,183,232,0.1)', color: alert.variable === 'aqi' ? '#1D9E75' : '#67B7E8' }}>
                          {alert.variable === 'aqi' ? 'Índice' : 'Variable'}
                        </span>
                      </div>
                      <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text2)' }}>
                        {alert.variable === 'aqi'
                          ? <>Se alerta cuando el AQI sea {CONDITIONS.find(c => c.value === alert.condition)?.label.toLowerCase()} {alert.threshold}</>
                          : <>Se alerta cuando sea {CONDITIONS.find(c => c.value === alert.condition)?.label.toLowerCase()} {alert.threshold}</>}
                        {alert.cooldown_minutes > 0 && ` · re-notifica cada ${alert.cooldown_minutes} min`}
                      </div>
                      {alert.message && (
                        <p className="text-xs mt-1 whitespace-pre-line opacity-80" style={{ color: 'var(--text2)' }}>
                          “{alert.message}”
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {alert.email_to && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#67B7E8]/10 text-[#67B7E8]">📧 Email</span>}
                        {alert.webhook_url && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#8B5CF6]/10 text-[#8B5CF6]">Webhook</span>}
                        <span className="text-[11px]" style={{ color: 'var(--text2)' }}>Disparó: {formatTrigger(alert)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggle(alert)} className="p-1 rounded-lg transition-colors">
                        {alert.active
                          ? <ToggleRight size={28} style={{ color: 'var(--primary)' }} />
                          : <ToggleLeft size={28} style={{ color: 'var(--text2)' }} />}
                      </button>
                      <button onClick={() => handleDelete(alert.id)} className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Modal Nueva alerta ── */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="rounded-3xl p-8 w-full max-w-xl border shadow-2xl max-h-[92vh] overflow-y-auto" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-xl" style={{ color: 'var(--text)' }}>Nueva alerta</h2>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text2)' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-5">

                {/* Tipo */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text2)' }}>Tipo de alerta</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { t: 'aqi', label: 'AQI de la estación', icon: <Gauge size={18} /> },
                      { t: 'variable', label: 'Por variable', icon: <Activity size={18} /> }
                    ].map(opt => (
                      <button key={opt.t} type="button" onClick={() => setForm(f => ({ ...f, type: opt.t }))}
                        className={`flex items-center justify-center gap-2 border rounded-xl px-4 py-3 text-sm font-bold transition-all ${form.type === opt.t ? 'text-white shadow-lg scale-105' : ''}`}
                        style={form.type === opt.t
                          ? { background: '#1D9E75', borderColor: '#1D9E75' }
                          : { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text2)' }}>
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Variable o AQI */}
                {form.type === 'variable' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text2)' }}>Variable</label>
                      <select
                        value={form.variable}
                        onChange={e => setForm({ ...form, variable: e.target.value })}
                        required
                        className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#67B7E8]/20"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                        {variables.map(v => <option key={v.label} value={v.label}>{v.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text2)' }}>Condición</label>
                      <select
                        value={form.condition}
                        onChange={e => setForm({ ...form, condition: e.target.value })}
                        className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#67B7E8]/20"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                        {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text2)' }}>Valor umbral</label>
                      <input
                        value={form.threshold}
                        onChange={e => setForm({ ...form, threshold: e.target.value })}
                        type="number" step="any" required
                        className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#67B7E8]/20"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text2)' }}>
                      Umbral de AQI: <span className="normal-case">{Number(form.threshold) > 0 ? `debe ser mayor a ${form.threshold}` : 'cualquier valor de AQI'}</span>
                    </label>
                    <input
                      type="range" min="0" max="100" step="1"
                      value={form.threshold}
                      onChange={e => setForm({ ...form, threshold: e.target.value })}
                      className="w-full accent-[#1D9E75]"
                      style={{ color: 'var(--text)' }} />
                    <div className="flex justify-between text-[10px] font-bold mt-1" style={{ color: 'var(--text2)' }}>
                      <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {CLASSIC_PRESETS.map(p => (
                        <button key={p.name} type="button" onClick={() => setForm({ ...form, threshold: p.value })}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${Number(form.threshold) === p.value ? 'text-white' : ''}`}
                          style={Number(form.threshold) === p.value
                            ? { background: aqiColor(p.name), borderColor: aqiColor(p.name) }
                            : { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text2)' }}>
                          {p.name}
                        </button>
                      ))}
                      <span className="text-[11px]" style={{ color: 'var(--text2)' }}>o arrastrá la barra</span>
                    </div>
                  </div>
                )}

                {/* Frecuencia */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text2)' }}>
                    Re-notificación <span className="normal-case font-medium">(mientras la condición siga activa)</span>
                  </label>
                  <select
                    value={Number(form.cooldownMinutes)}
                    onChange={e => setForm({ ...form, cooldownMinutes: Number(e.target.value) })}
                    className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#67B7E8]/20"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                    {COOLDOWN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                {/* Canales */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text2)' }}>Canales de envío</label>
                  <div className="grid grid-cols-1 gap-3">
                    <label className="flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                      <input type="checkbox" checked={form.useEmail} onChange={e => setForm({ ...form, useEmail: e.target.checked })} className="accent-[#67B7E8]" />
                      <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>Email</span>
                      {form.useEmail && (
                        <input
                          value={form.emailTo}
                          onChange={e => setForm({ ...form, emailTo: e.target.value })}
                          placeholder="correo@destino.com" type="email"
                          className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none"
                          style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                      )}
                    </label>
                    <label className="flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                      <input type="checkbox" checked={form.useWebhook} onChange={e => setForm({ ...form, useWebhook: e.target.checked })} className="accent-[#8B5CF6]" />
                      <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>Webhook</span>
                      {form.useWebhook && (
                        <input
                          value={form.webhookUrl}
                          onChange={e => setForm({ ...form, webhookUrl: e.target.value })}
                          placeholder="https://api.tuweb.com/hook"
                          className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none"
                          style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                      )}
                    </label>
                    <label className="flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                      <input type="checkbox" checked={form.useTelegram} onChange={e => setForm({ ...form, useTelegram: e.target.checked })} className="accent-[#1D9E75]" />
                      <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>Telegram</span>
                      {form.useTelegram && (
                        <span className="flex-1 grid grid-cols-2 gap-2">
                          <input
                            value={form.botToken}
                            onChange={e => setForm({ ...form, botToken: e.target.value })}
                            placeholder="bot token (del cliente)"
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                          <input
                            value={form.chatId}
                            onChange={e => setForm({ ...form, chatId: e.target.value })}
                            placeholder="chat id / grupo"
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                        </span>
                      )}
                    </label>
                  </div>
                </div>

                {/* Mensaje */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text2)' }}>Mensaje</label>
                  <textarea
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    rows={4}
                    className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#67B7E8]/20"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-[11px] font-bold" style={{ color: 'var(--text2)' }}>Insertar:</span>
                    {['estacion', 'espacio', 'variable', 'valor', 'aqi', 'categoria', 'hora'].map(k => (
                      <button key={k} type="button" onClick={() => insertPlaceholder(k)}
                        className="text-[11px] font-mono px-2 py-1 rounded-lg border hover:scale-105 transition-all"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: '#67B7E8' }}>
                        {'{' + k + '}'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 rounded-xl py-3 text-sm font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--text2)' }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={loading || (form.type === 'variable' && !form.variable)}
                    className="flex-1 bg-[#67B7E8] hover:bg-[#52A8E0] text-white py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
                    {loading ? 'Guardando...' : 'Crear Alerta'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ClienteLayout>
  )
}