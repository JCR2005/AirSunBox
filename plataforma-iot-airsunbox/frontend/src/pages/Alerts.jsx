import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import ClienteLayout from '../components/airsunbox/ClienteLayout'
import { alerts as alertsApi, devices as devicesApi, spaces as spacesApi } from '../services/api'
import { variableLevels } from '../components/station/ReadingTile'
import useAuthStore from '../store/auth'
import {
  Bell, Plus, Trash2, X, History, Gauge, Activity, ArrowLeft, Mail, Send, Webhook,
  RefreshCw, Check, AlertCircle, ChevronDown, Cpu, Layers
} from 'lucide-react'

const ACCENT = '#67B7E8'
const CONDITIONS = { '>': 'mayor que', '>=': 'igual o mayor que', '<': 'menor que', '<=': 'igual o menor que', '=': 'igual a' }
const COOLDOWN_OPTIONS = [
  { value: 0, label: 'Solo cuando empieza' },
  { value: 30, label: 'Cada 30 min mientras siga' },
  { value: 60, label: 'Cada hora mientras siga' },
  { value: 180, label: 'Cada 3 horas mientras siga' },
]
// Niveles estándar del AQI, para estaciones sin índice propio de espacio
const STANDARD_LEVELS = [
  { name: 'Excelente', color: '#10B981', score_lo: 0 }, { name: 'Buena', color: '#34D399', score_lo: 21 },
  { name: 'Precaución', color: '#F59E0B', score_lo: 41 }, { name: 'Mala', color: '#F97316', score_lo: 61 },
  { name: 'Peligrosa', color: '#EF4444', score_lo: 81 },
]
const DEFAULT_MESSAGE = 'Alerta AirSunBox · {estacion} ({espacio}): {variable} = {valor} {unidad} · {hora}'
const PLACEHOLDERS = ['estacion', 'espacio', 'variable', 'valor', 'unidad', 'aqi', 'categoria', 'hora']
const CHANNEL_META = {
  email: { label: 'Correo', icon: Mail },
  telegram: { label: 'Telegram', icon: Send },
  webhook: { label: 'Webhook', icon: Webhook },
}

const fmt = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('es-GT', { maximumFractionDigits: 1 }))
const when = (t) => new Date(t).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })
const INPUT = 'w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#67B7E8]/25 focus:border-[#67B7E8]'
const inputStyle = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }

const channelsOf = (a) => [
  a.email_to || (a.channel === 'email' && a.destination) ? 'email' : null,
  a.telegram_bot_token && a.telegram_chat_id ? 'telegram' : null,
  a.webhook_url ? 'webhook' : null,
].filter(Boolean)

function ChannelChips({ list }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {list.map(ch => {
        const { icon: Icon, label } = CHANNEL_META[ch]
        return (
          <span key={ch} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md" style={{ background: 'var(--bg)', color: 'var(--text2)' }}>
            <Icon size={12} /> {label}
          </span>
        )
      })}
    </span>
  )
}

function Section({ n, title, children }) {
  return (
    <fieldset>
      <legend className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
        <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-white" style={{ background: ACCENT }}>{n}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  )
}

// ── Crear alerta ─────────────────────────────────
function NewAlertModal({ device, spaceName, variables, lastValues, aqiCategories, spaceConfig, onClose, onCreated }) {
  const user = useAuthStore(s => s.user)
  const [target, setTarget] = useState('aqi')            // 'aqi' | label de variable
  const [condition, setCondition] = useState('>=')
  const [threshold, setThreshold] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [channels, setChannels] = useState({ email: true, telegram: false, webhook: false })
  const [emailTo, setEmailTo] = useState(user?.email || '')
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [showMessage, setShowMessage] = useState(false)
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const isAqi = target === 'aqi'
  const variable = variables.find(v => v.label === target)
  const unit = isAqi ? '' : (variable?.unit || '')
  const current = isAqi ? null : lastValues[target]

  // Atajos: niveles del índice (AQI) o de la variable en el espacio
  const presets = useMemo(() => {
    if (isAqi) {
      return (aqiCategories || []).slice(1).map(c => ({ name: c.name, color: c.color, value: Number(c.score_lo) }))
    }
    const levels = variableLevels(spaceConfig, target)
    return (levels || []).slice(1).map(l => ({ name: l.name, color: l.color, value: l.lo }))
  }, [isAqi, target, aqiCategories, spaceConfig])

  useEffect(() => {
    // Al cambiar qué se vigila, proponer el primer nivel «malo» si existe
    setCondition('>=')
    setThreshold(presets[1]?.value ?? presets[0]?.value ?? '')
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  const activePreset = presets.find(p => condition === '>=' && Number(threshold) === p.value)
  const targetName = isAqi ? 'la calidad del aire (AQI)' : (variable?.name || 'la variable')
  const chosen = Object.entries(channels).filter(([, on]) => on).map(([k]) => k)
  const summary = threshold === '' ? null
    : activePreset
      ? `cuando ${targetName} llegue a ${activePreset.name} o peor`
      : `cuando ${targetName} sea ${CONDITIONS[condition]} ${fmt(threshold)}${unit ? ` ${unit}` : ''}`

  const preview = message
    .replace('{estacion}', device?.name || 'Estación')
    .replace('{espacio}', spaceName || '—')
    .replace('{variable}', isAqi ? 'AQI' : (variable?.name || ''))
    .replace('{valor}', fmt(threshold))
    .replace('{unidad}', unit)
    .replace('{aqi}', isAqi ? fmt(threshold) : '—')
    .replace('{categoria}', activePreset?.name || '—')
    .replace('{hora}', new Date().toLocaleString('es-GT'))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (threshold === '' || Number.isNaN(Number(threshold))) return setError('Indicá el valor a partir del cual avisar.')
    if (!chosen.length) return setError('Elegí al menos un canal de aviso.')
    if (channels.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo.trim())) return setError('Escribí un correo válido.')
    if (channels.telegram && (!botToken.trim() || !chatId.trim())) return setError('Para Telegram hacen falta el token del bot y el chat.')
    if (channels.webhook && !/^https:\/\//.test(webhookUrl.trim())) return setError('La dirección del webhook debe empezar con https://')
    setSaving(true)
    try {
      const alert = await alertsApi.create({
        deviceId: device.id,
        variable: isAqi ? 'aqi' : target,
        condition,
        threshold: Number(threshold),
        cooldownMinutes: Number(cooldown) || 0,
        message: message.trim() || DEFAULT_MESSAGE,
        channel: chosen.join('+'),
        emailTo: channels.email ? emailTo.trim() : undefined,
        webhookUrl: channels.webhook ? webhookUrl.trim() : undefined,
        botToken: channels.telegram ? botToken.trim() : undefined,
        chatId: channels.telegram ? chatId.trim() : undefined,
      })
      onCreated({ ...alert, variable_name: variable?.name, variable_unit: variable?.unit })
    } catch (err) {
      setError(err.message || 'No se pudo crear la alerta')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="app-shell font-sans fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="alerta-titulo"
           className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl"
           style={{ background: 'var(--card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 id="alerta-titulo" className="text-lg font-bold" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Nueva alerta</h2>
            <p className="text-sm" style={{ color: 'var(--text2)' }}>{device?.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text2)' }}><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          <Section n={1} title="¿Qué querés vigilar?">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup">
              {[{ label: 'aqi', name: 'Calidad del aire', sub: 'Índice AQI', icon: Gauge }, ...variables.map(v => ({ label: v.label, name: v.name, sub: lastValues[v.label] != null ? `Ahora ${fmt(lastValues[v.label])} ${v.unit || ''}` : (v.unit || 'Sin lecturas'), icon: Activity }))].map(opt => {
                const on = target === opt.label
                const I = opt.icon
                return (
                  <button key={opt.label} type="button" role="radio" aria-checked={on} onClick={() => setTarget(opt.label)}
                          className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors"
                          style={on ? { borderColor: ACCENT, background: ACCENT + '14' } : { borderColor: 'var(--border)', background: 'var(--bg)' }}>
                    <I size={16} className="mt-0.5 shrink-0" style={{ color: on ? ACCENT : 'var(--text2)' }} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold truncate first-letter:uppercase" style={{ color: 'var(--text)' }}>{opt.name}</span>
                      <span className="block text-xs truncate" style={{ color: 'var(--text2)' }}>{opt.sub}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Section>

          <Section n={2} title="¿Cuándo avisar?">
            {presets.length > 0 && (
              <>
                <p className="text-xs mb-2" style={{ color: 'var(--text2)' }}>Cuando llegue a este nivel o peor:</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {presets.map(p => {
                    const on = activePreset?.name === p.name
                    return (
                      <button key={p.name} type="button" onClick={() => { setCondition('>='); setThreshold(p.value) }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors"
                              style={on ? { background: p.color, borderColor: p.color, color: '#fff' } : { borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}>
                        {!on && <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />} {p.name}
                        <span className="text-xs font-normal opacity-80">≥ {fmt(p.value)}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs mb-2" style={{ color: 'var(--text2)' }}>O un valor propio:</p>
              </>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="al-cond" className="sr-only">Condición</label>
              <select id="al-cond" value={condition} onChange={e => setCondition(e.target.value)} className={`${INPUT} w-auto`} style={inputStyle}>
                {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
              </select>
              <div className="relative">
                <label htmlFor="al-umbral" className="sr-only">Valor</label>
                <input id="al-umbral" type="number" step="any" value={threshold} onChange={e => setThreshold(e.target.value)}
                       className={`${INPUT} w-36 pr-12 tabular-nums`} style={inputStyle} placeholder="Valor" />
                {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text2)' }}>{unit}</span>}
              </div>
              {current != null && <span className="text-xs" style={{ color: 'var(--text2)' }}>Valor actual: {fmt(current)} {unit}</span>}
            </div>
          </Section>

          <Section n={3} title="¿Cómo te avisamos?">
            <div className="space-y-2">
              {[
                { k: 'email', label: 'Correo', icon: Mail, body: (
                  <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="correo@ejemplo.com" aria-label="Correo de destino" className={INPUT} style={inputStyle} />
                ) },
                { k: 'telegram', label: 'Telegram', icon: Send, body: (
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input value={botToken} onChange={e => setBotToken(e.target.value)} placeholder="Token del bot" aria-label="Token del bot de Telegram" className={INPUT} style={inputStyle} autoComplete="off" />
                    <input value={chatId} onChange={e => setChatId(e.target.value)} placeholder="ID del chat o grupo" aria-label="ID del chat de Telegram" className={INPUT} style={inputStyle} />
                  </div>
                ) },
                { k: 'webhook', label: 'Webhook', icon: Webhook, body: (
                  <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://tu-servicio.com/alertas" aria-label="Dirección del webhook" className={INPUT} style={inputStyle} />
                ) },
              ].map(({ k, label, icon: I, body }) => (
                <div key={k} className="rounded-xl border" style={{ borderColor: channels[k] ? ACCENT + '80' : 'var(--border)', background: 'var(--bg)' }}>
                  <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer">
                    <input type="checkbox" checked={channels[k]} onChange={e => setChannels(c => ({ ...c, [k]: e.target.checked }))} className="w-4 h-4 accent-[#67B7E8]" />
                    <I size={16} style={{ color: channels[k] ? ACCENT : 'var(--text2)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</span>
                  </label>
                  {channels[k] && <div className="px-3 pb-3">{body}</div>}
                </div>
              ))}
            </div>
          </Section>

          <Section n={4} title="Frecuencia y mensaje">
            <label htmlFor="al-cool" className="block text-xs mb-1.5" style={{ color: 'var(--text2)' }}>Si la condición sigue activa, volver a avisar</label>
            <select id="al-cool" value={cooldown} onChange={e => setCooldown(Number(e.target.value))} className={INPUT} style={inputStyle}>
              {COOLDOWN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button type="button" onClick={() => setShowMessage(v => !v)} aria-expanded={showMessage}
                    className="mt-3 flex items-center gap-1.5 text-sm font-semibold" style={{ color: ACCENT }}>
              <ChevronDown size={15} className={`transition-transform ${showMessage ? 'rotate-180' : ''}`} /> Personalizar mensaje
            </button>
            {showMessage && (
              <div className="mt-2">
                <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} aria-label="Mensaje de la alerta" className={INPUT} style={inputStyle} />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PLACEHOLDERS.map(p => (
                    <button key={p} type="button" onClick={() => setMessage(m => `${m}{${p}}`)}
                            className="text-xs font-mono px-2 py-1 rounded-md border" style={{ borderColor: 'var(--border)', color: ACCENT, background: 'var(--card)' }}>
                      {`{${p}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 rounded-xl px-3 py-2.5 text-sm" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
              <span className="block text-xs mb-1" style={{ color: 'var(--text2)' }}>Así llega el aviso</span>
              {preview}
            </div>
          </Section>
        </form>

        <div className="px-6 py-4 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
          {error && <p role="alert" className="flex items-center gap-2 text-sm" style={{ color: '#E5484D' }}><AlertCircle size={15} /> {error}</p>}
          {summary && !error && (
            <p className="text-sm" style={{ color: 'var(--text2)' }}>
              Te avisaremos {chosen.length ? `por ${chosen.map(c => CHANNEL_META[c].label.toLowerCase()).join(' y ')} ` : ''}{summary}.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ color: 'var(--text2)' }}>Cancelar</button>
            <button type="button" onClick={submit} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: ACCENT }}>
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Bell size={15} />} {saving ? 'Creando…' : 'Crear alerta'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Una regla de alerta ──────────────────────────
function AlertRule({ alert, presetName, onToggle, onDelete, onTest }) {
  const [confirming, setConfirming] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const isAqi = alert.variable === 'aqi'
  const name = isAqi ? 'Calidad del aire (AQI)' : (alert.variable_name || alert.variable)
  const unit = isAqi ? '' : (alert.variable_unit || '')
  const list = channelsOf(alert)

  const test = async () => {
    setTesting(true); setTestResult(null)
    try {
      const r = await onTest(alert.id)
      const failed = r.results.filter(x => !x.ok)
      setTestResult(failed.length
        ? { ok: false, text: `Falló: ${failed.map(f => `${CHANNEL_META[f.channel]?.label || f.channel}${f.error ? ` (${f.error})` : ''}`).join(', ')}` }
        : { ok: true, text: `Prueba enviada por ${r.results.map(x => CHANNEL_META[x.channel]?.label.toLowerCase() || x.channel).join(' y ')}` })
    } catch (e) {
      setTestResult({ ok: false, text: e.message || 'No se pudo enviar la prueba' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <li className="rounded-2xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)', opacity: alert.active ? 1 : 0.65 }}>
      <div className="flex items-start gap-4">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT + '1A', color: ACCENT }}>
          {isAqi ? <Gauge size={18} /> : <Activity size={18} />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-base" style={{ color: 'var(--text)' }}>
            Avisar cuando <span className="font-semibold">{name}</span> {presetName
              ? <>llegue a <span className="font-semibold">{presetName}</span> o peor</>
              : <>sea <span className="font-semibold">{CONDITIONS[alert.condition] || alert.condition} {fmt(alert.threshold)}{unit ? ` ${unit}` : ''}</span></>}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2">
            <ChannelChips list={list} />
            <span className="text-xs" style={{ color: 'var(--text2)' }}>
              {Number(alert.cooldown_minutes) > 0 ? `Repite cada ${alert.cooldown_minutes} min` : 'Avisa una vez por episodio'}
            </span>
            <span className="text-xs" style={{ color: 'var(--text2)' }}>
              {alert.trigger_count > 0 ? `Se disparó ${alert.trigger_count} ${alert.trigger_count === 1 ? 'vez' : 'veces'}${alert.last_triggered_at ? `, la última el ${when(alert.last_triggered_at)}` : ''}` : 'Todavía no se disparó'}
            </span>
          </div>
        </div>
        <button type="button" role="switch" aria-checked={alert.active} aria-label={alert.active ? 'Pausar alerta' : 'Activar alerta'} onClick={() => onToggle(alert)}
                className="relative w-11 h-6 rounded-full shrink-0 transition-colors" style={{ background: alert.active ? ACCENT : 'var(--border)' }}>
          <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-[left]" style={{ left: alert.active ? 22 : 2 }} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <button type="button" onClick={test} disabled={testing || !list.length}
                className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40" style={{ color: ACCENT }}>
          {testing ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />} Enviar prueba
        </button>
        {confirming ? (
          <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            ¿Eliminar esta alerta?
            <button type="button" onClick={() => onDelete(alert.id)} className="font-semibold px-2.5 py-1 rounded-lg text-white" style={{ background: '#E5484D' }}>Eliminar</button>
            <button type="button" onClick={() => setConfirming(false)} className="font-semibold px-2 py-1" style={{ color: 'var(--text2)' }}>Cancelar</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming(true)}
                  className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors hover:bg-red-500/10" style={{ color: '#E5484D' }}>
            <Trash2 size={14} /> Eliminar
          </button>
        )}
        {testResult && (
          <span role="status" className="flex items-center gap-1.5 text-sm ml-auto" style={{ color: testResult.ok ? '#1D9E75' : '#E5484D' }}>
            {testResult.ok ? <Check size={14} /> : <AlertCircle size={14} />} {testResult.text}
          </span>
        )}
      </div>
    </li>
  )
}

export default function Alerts() {
  const { deviceId } = useParams()
  const navigate = useNavigate()

  const [devices, setDevices] = useState(null)
  const [device, setDevice] = useState(null)
  const [variables, setVariables] = useState([])
  const [lastValues, setLastValues] = useState({})
  const [aqiCategories, setAqiCategories] = useState([])
  const [spaceConfig, setSpaceConfig] = useState(null)
  const [spaceName, setSpaceName] = useState('')
  const [alertList, setAlertList] = useState(null)
  const [logs, setLogs] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!deviceId) devicesApi.list().then(d => setDevices(d || [])).catch(() => setDevices([]))
  }, [deviceId])

  useEffect(() => {
    if (!deviceId) return
    setAlertList(null)
    devicesApi.get(deviceId).then(d => {
      setDevice(d)
      if (d?.space_id) spacesApi.config(d.space_id).then(c => { setSpaceConfig(c.aqiConfig); setSpaceName(c.name || '') }).catch(() => {})
    }).catch(() => setError('No se pudo cargar la estación'))
    devicesApi.variables(deviceId).then(v => setVariables(v || [])).catch(() => {})
    devicesApi.lastValues(deviceId).then(lv => {
      const m = {}; (lv || []).forEach(x => { m[x.label] = x.last_value }); setLastValues(m)
    }).catch(() => {})
    devicesApi.aqi(deviceId).then(r => { if (r?.categories?.length) setAqiCategories(r.categories) }).catch(() => {})
    alertsApi.list(deviceId).then(a => setAlertList(a || [])).catch(() => setAlertList([]))
    alertsApi.logs(deviceId).then(l => setLogs(l || [])).catch(() => {})
  }, [deviceId])

  const aqiLevels = aqiCategories.length ? aqiCategories
    : spaceConfig?.categories?.length ? [...spaceConfig.categories].sort((a, b) => a.cat_order - b.cat_order)
    : STANDARD_LEVELS

  const varName = (label) => label === 'aqi' ? 'AQI' : (variables.find(v => v.label === label)?.name || label)

  const presetName = (a) => {
    if (a.condition !== '>=') return null
    if (a.variable === 'aqi') return aqiLevels.find(c => Number(c.score_lo) === Number(a.threshold) && Number(c.score_lo) > 0)?.name || null
    return variableLevels(spaceConfig, a.variable)?.find(l => l.lo === Number(a.threshold) && l.lo > 0)?.name || null
  }

  const toggle = async (alert) => {
    try {
      const updated = await alertsApi.toggle(alert.id, !alert.active)
      setAlertList(prev => prev.map(a => a.id === alert.id ? { ...a, active: updated.active } : a))
    } catch (e) { setError(e.message || 'No se pudo cambiar la alerta') }
  }
  const remove = async (id) => {
    try {
      await alertsApi.delete(id)
      setAlertList(prev => prev.filter(a => a.id !== id))
    } catch (e) { setError(e.message || 'No se pudo eliminar la alerta') }
  }

  return (
    <ClienteLayout>
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-[1400px]">
        {!deviceId ? (
          <>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Alertas</h1>
            <p className="text-sm mt-1 mb-6" style={{ color: 'var(--text2)' }}>Elegí una estación para ver o crear sus alertas.</p>
            {devices === null ? (
              <p className="text-sm" style={{ color: 'var(--text2)' }}>Cargando estaciones…</p>
            ) : devices.length === 0 ? (
              <div className="rounded-3xl border p-10 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <Bell size={28} className="mx-auto mb-3" style={{ color: ACCENT }} />
                <p className="font-semibold" style={{ color: 'var(--text)' }}>Todavía no tenés estaciones</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>Las alertas se configuran por estación.</p>
              </div>
            ) : (
              <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
                {devices.map(d => (
                  <li key={d.id}>
                    <button type="button" onClick={() => navigate(`/alerts/${d.id}`)}
                            className="w-full flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors hover:border-[#67B7E8]"
                            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT + '1A', color: ACCENT }}><Cpu size={18} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{d.name}</span>
                        <span className="flex items-center gap-1 text-xs truncate" style={{ color: 'var(--text2)' }}>
                          {d.space_name ? <><Layers size={11} /> {d.space_name}</> : 'Sin espacio'}
                        </span>
                      </span>
                      <span className="w-2 h-2 rounded-full shrink-0" title={d.status === 'online' ? 'En línea' : 'Sin señal'} style={{ background: d.status === 'online' ? '#1D9E75' : 'var(--border)' }} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3 min-w-0">
                <Link to={`/devices/${deviceId}`} aria-label="Volver a la estación" className="p-2 -ml-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text2)' }}>
                  <ArrowLeft size={18} />
                </Link>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold truncate" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Alertas</h1>
                  <p className="text-sm truncate" style={{ color: 'var(--text2)' }}>{device?.name}{spaceName ? ` · ${spaceName}` : ''}</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowModal(true)} disabled={!device}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: ACCENT }}>
                <Plus size={17} /> Nueva alerta
              </button>
            </div>

            {error && <p role="alert" className="mb-4 flex items-center gap-2 text-sm" style={{ color: '#E5484D' }}><AlertCircle size={15} /> {error}</p>}

            <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
              <section aria-labelledby="reglas">
                <h2 id="reglas" className="sr-only">Reglas de alerta</h2>
                {alertList === null ? (
                  <p className="text-sm" style={{ color: 'var(--text2)' }}>Cargando alertas…</p>
                ) : alertList.length === 0 ? (
                  <div className="rounded-3xl border p-10 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <Bell size={28} className="mx-auto mb-3" style={{ color: ACCENT }} />
                    <p className="font-semibold" style={{ color: 'var(--text)' }}>Esta estación no tiene alertas</p>
                    <p className="text-sm mt-1 max-w-sm mx-auto" style={{ color: 'var(--text2)' }}>Creá una para recibir un aviso por correo, Telegram o webhook cuando una lectura cruce el valor que elijas.</p>
                    <button type="button" onClick={() => setShowModal(true)} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: ACCENT }}>
                      <Plus size={15} /> Crear la primera
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {alertList.map(a => (
                      <AlertRule key={a.id} alert={a} presetName={presetName(a)} onToggle={toggle} onDelete={remove} onTest={alertsApi.test} />
                    ))}
                  </ul>
                )}
              </section>

              <aside className="rounded-3xl border p-5 xl:sticky xl:top-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }} aria-labelledby="historial">
                <h2 id="historial" className="flex items-center gap-2 text-base font-bold mb-3" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
                  <History size={16} style={{ color: ACCENT }} /> Últimos avisos
                </h2>
                {!logs.length ? (
                  <p className="text-sm" style={{ color: 'var(--text2)' }}>Todavía no se envió ningún aviso desde esta estación.</p>
                ) : (
                  <ol className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                    {logs.map(log => (
                      <li key={log.id} className="border-l-2 pl-3" style={{ borderColor: ACCENT }}>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          {log.variable === 'aqi' ? `AQI ${fmt(log.aqi)}${log.category ? ` · ${log.category}` : ''}` : `${varName(log.variable)} = ${fmt(log.value)}`}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text2)' }}>
                          {when(log.created_at)}{log.channel && log.channel !== 'none' ? ` · ${log.channel}` : ''}
                        </p>
                        {log.status === 'failed' && <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>No se pudo enviar</p>}
                        {log.status === 'partial' && <p className="text-xs font-semibold" style={{ color: '#B7791F' }}>Algunos canales fallaron</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </aside>
            </div>
          </>
        )}

        {showModal && device && (
          <NewAlertModal
            device={device}
            spaceName={spaceName}
            variables={variables}
            lastValues={lastValues}
            aqiCategories={aqiLevels}
            spaceConfig={spaceConfig}
            onClose={() => setShowModal(false)}
            onCreated={(a) => { setAlertList(prev => [a, ...(prev || [])]); setShowModal(false) }}
          />
        )}
      </div>
    </ClienteLayout>
  )
}
