import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Pencil, Wifi, WifiOff, Layers, Eye, EyeOff, Copy, Check, Bell, Camera,
  Trash2, RefreshCw, MapPin, X, Save, Cpu
} from 'lucide-react'
import { devices as devicesApi } from '../../services/api'
import MapPicker from '../MapPicker'

const ACCENT = '#67B7E8'
const MAX_PHOTO_CHARS = 680_000

// Los errores genéricos del servidor («Not Found», «Error del servidor») no
// le dicen nada al usuario: se reemplazan por uno que sí.
const friendly = (err, fallback) => {
  const m = err?.message || ''
  return !m || /^(not found|error del servidor|internal server error)$/i.test(m) ? fallback : m
}

// Reduce y comprime la foto en el navegador antes de subirla (JPEG, lado
// mayor ≤ 1280 px). Si aún pesa mucho, baja calidad y tamaño una vez más.
async function compressImage(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('No se pudo leer la imagen'))
      i.src = url
    })
    const encode = (maxSide, quality) => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/jpeg', quality)
    }
    let out = encode(1280, 0.82)
    if (out.length > MAX_PHOTO_CHARS) out = encode(1024, 0.65)
    if (out.length > MAX_PHOTO_CHARS) throw new Error('La foto es demasiado pesada aun comprimida. Probá con otra.')
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}

function agoText(ts) {
  if (!ts) return null
  const s = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000))
  if (s < 60) return 'hace un momento'
  const m = Math.round(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

function CopyButton({ text, label, copiedKey, id, onCopy }) {
  const done = copiedKey === id
  return (
    <button
      type="button"
      onClick={() => onCopy(text, id)}
      disabled={!text}
      aria-label={`Copiar ${label}`}
      title={`Copiar ${label}`}
      className="p-1.5 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30"
      style={{ color: done ? '#1D9E75' : 'var(--text2)' }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

function Row({ label, children, empty }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-sm shrink-0" style={{ color: 'var(--text2)' }}>{label}</dt>
      <dd className="text-sm text-right min-w-0 break-words" style={{ color: empty ? 'var(--text2)' : 'var(--text)', fontWeight: empty ? 400 : 500 }}>
        {children}
      </dd>
    </div>
  )
}

function Section({ title, action, children }) {
  return (
    <section className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold" style={{ color: 'var(--text2)' }}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

// ── Foto del equipo ──────────────────────────────
function PhotoPlate({ deviceId, name, icon: Icon }) {
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    let ok = true
    devicesApi.photo(deviceId)
      .then(r => { if (ok) setImage(r?.image || null) })
      .catch(() => {})
      .finally(() => { if (ok) setLoading(false) })
    return () => { ok = false }
  }, [deviceId])

  const upload = async (file) => {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError('Elegí una imagen JPG, PNG o WebP.'); return }
    setBusy(true); setError('')
    try {
      const data = await compressImage(file)
      await devicesApi.setPhoto(deviceId, data)
      setImage(data)
    } catch (e) {
      setError(friendly(e, 'No se pudo subir la foto. Intentá de nuevo en un momento.'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async () => {
    setBusy(true); setError('')
    try {
      await devicesApi.setPhoto(deviceId, null)
      setImage(null)
    } catch (e) {
      setError(friendly(e, 'No se pudo quitar la foto. Intentá de nuevo en un momento.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
             onChange={e => upload(e.target.files?.[0])} />
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-3xl" style={{ background: 'var(--bg)' }}>
        {image ? (
          <>
            <img src={image} alt={`Foto del equipo ${name || ''}`} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 p-3" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.45), transparent)' }}>
              <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/90 text-gray-800 hover:bg-white transition-colors disabled:opacity-60">
                {busy ? <RefreshCw size={13} className="animate-spin" /> : <Camera size={13} />} Cambiar foto
              </button>
              <button type="button" onClick={remove} disabled={busy} aria-label="Quitar foto" title="Quitar foto"
                      className="p-1.5 rounded-lg bg-white/90 text-red-600 hover:bg-white transition-colors disabled:opacity-60">
                <Trash2 size={14} />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy || loading}
            className="group w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#67B7E8]"
            style={{ backgroundImage: `radial-gradient(circle at 50% 40%, ${ACCENT}1F, transparent 60%)` }}
          >
            <span className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105" style={{ background: 'var(--card)', color: ACCENT, boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
              {busy ? <RefreshCw size={24} className="animate-spin" /> : <Icon size={26} />}
            </span>
            <span>
              <span className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {loading ? 'Cargando foto…' : 'Agregar foto del equipo'}
              </span>
              {!loading && <span className="block text-xs mt-0.5" style={{ color: 'var(--text2)' }}>Ayuda a reconocer la estación en campo</span>}
            </span>
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-xs px-5 pt-2" style={{ color: '#E5484D' }}>{error}</p>}
    </div>
  )
}

// ── Modal de la ficha técnica ────────────────────
const FIELD = 'w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#67B7E8]/25 focus:border-[#67B7E8]'
const fieldStyle = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }

function SpecModal({ device, onClose, onSaved }) {
  const hw = device?.hardware || {}
  const [draft, setDraft] = useState({
    serial: device?.serial || '',
    model: hw.model || '',
    firmware: hw.firmware || '',
    installed_at: hw.installed_at || '',
    sensors: hw.sensors || '',
    notes: hw.notes || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => { setDraft(d => ({ ...d, [k]: e.target.value })); setError('') }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const { serial, ...hardware } = draft
      const updated = await devicesApi.spec(device.id, { serial: serial.trim() || null, hardware })
      onSaved(updated)
    } catch (err) {
      setError(friendly(err, 'No se pudo guardar la ficha. Intentá de nuevo en un momento.'))
    } finally {
      setSaving(false)
    }
  }

  const field = (k, label, props = {}) => (
    <div>
      <label htmlFor={`ficha-${k}`} className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>{label}</label>
      <input id={`ficha-${k}`} value={draft[k]} onChange={set(k)} className={FIELD} style={fieldStyle} {...props} />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="ficha-titulo"
           className="w-full max-w-lg rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200"
           style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 id="ficha-titulo" className="text-lg font-bold" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Ficha del equipo</h2>
            <p className="text-sm" style={{ color: 'var(--text2)' }}>Datos del hardware instalado en {device?.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text2)' }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={save} className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {error && <p role="alert" className="text-sm rounded-xl px-3 py-2" style={{ background: 'rgba(229,72,77,0.08)', color: '#E5484D' }}>{error}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            {field('serial', 'Número de serie', { placeholder: 'Ej.: ASB-2026-0012', className: `${FIELD} font-mono`, maxLength: 80, autoComplete: 'off' })}
            {field('model', 'Placa / modelo', { placeholder: 'Ej.: ESP32 DevKit v1', maxLength: 120 })}
            {field('firmware', 'Versión de firmware', { placeholder: 'Ej.: 1.2.0', maxLength: 60 })}
            {field('installed_at', 'Fecha de instalación', { type: 'date' })}
          </div>
          {field('sensors', 'Sensores', { placeholder: 'Ej.: PMS5003 (partículas), DHT22 (temperatura y humedad)', maxLength: 400 })}
          <div>
            <label htmlFor="ficha-notes" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>Notas de mantenimiento</label>
            <textarea id="ficha-notes" rows={3} value={draft.notes} onChange={set('notes')} maxLength={1000}
                      placeholder="Ej.: filtro cambiado en septiembre; alimentación solar 20 W"
                      className={`${FIELD} resize-none`} style={fieldStyle} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ color: 'var(--text2)' }}>Cancelar</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-all hover:brightness-105" style={{ background: ACCENT }}>
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />} {saving ? 'Guardando…' : 'Guardar ficha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Ficha de la estación (columna lateral) ───────
export default function StationSheet({ device, icon, spaceInfo, spaceColor, onBack, onEdit, onDeviceChange, copiedKey, onCopy }) {
  const [showToken, setShowToken] = useState(false)
  const [showSpec, setShowSpec] = useState(false)
  const online = device?.status === 'online'
  const hw = device?.hardware || {}
  const lat = device?.lat != null ? parseFloat(device.lat) : null
  const lng = device?.lng != null ? parseFloat(device.lng) : null
  const hasGps = lat != null && lng != null && !isNaN(lat) && !isNaN(lng)
  const installed = hw.installed_at
    ? new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(hw.installed_at))
    : null
  const hasSpec = device?.serial || hw.model || hw.firmware || hw.installed_at || hw.sensors || hw.notes

  return (
    <aside className="rounded-3xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
      <PhotoPlate deviceId={device.id} name={device.name} icon={icon} />

      {/* Identidad */}
      <div className="px-5 pt-4 pb-4">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onBack} aria-label={device?.space_id ? 'Volver al espacio' : 'Volver a estaciones'}
                  className="p-2 -ml-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 shrink-0" style={{ color: 'var(--text2)' }}>
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight break-words" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>{device?.name}</h1>
            <p className="text-sm truncate" style={{ color: 'var(--text2)' }}>{device?.label}</p>
          </div>
          <button type="button" onClick={onEdit} aria-label="Editar estación" title="Editar nombre, ubicación y descripción"
                  className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 shrink-0" style={{ color: 'var(--text2)' }}>
            <Pencil size={16} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={online ? { background: 'rgba(29,158,117,0.12)', color: '#1D9E75' } : { background: 'rgba(245,158,11,0.12)', color: '#B7791F' }}>
            {online ? <Wifi size={12} /> : <WifiOff size={12} />}
            {online ? `En línea · ${agoText(device?.last_seen) || 'ahora'}` : device?.last_seen ? `Sin señal desde ${agoText(device.last_seen)}` : 'Nunca envió datos'}
          </span>
          {device?.space_id && spaceInfo?.name && (
            <Link to={`/espacios/${device.space_id}`}
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-opacity hover:opacity-80"
                  style={{ background: (spaceColor || ACCENT) + '1F', color: spaceColor || ACCENT }}>
              <Layers size={12} /> {spaceInfo.name}
            </Link>
          )}
        </div>
      </div>

      {/* Conexión */}
      <Section title="Conexión">
        <dl>
          <div className="py-2.5">
            <dt className="text-sm mb-1" style={{ color: 'var(--text2)' }}>Token de la estación</dt>
            <dd className="flex items-center gap-1 rounded-lg px-2.5 py-1.5" style={{ background: 'var(--bg)' }}>
              <span className="font-mono text-xs flex-1 truncate" style={{ color: 'var(--text)' }}>
                {device?.token ? (showToken ? device.token : '•'.repeat(24)) : 'Sin token'}
              </span>
              <button type="button" onClick={() => setShowToken(v => !v)} aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
                      className="p-1.5 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'var(--text2)' }}>
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <CopyButton text={device?.token} label="token" id="token" copiedKey={copiedKey} onCopy={onCopy} />
            </dd>
          </div>
          <Row label="ID">
            <span className="inline-flex items-center gap-1">
              <span className="font-mono text-xs truncate max-w-[150px]" title={device?.id}>{device?.id}</span>
              <CopyButton text={device?.id} label="ID" id="id" copiedKey={copiedKey} onCopy={onCopy} />
            </span>
          </Row>
          <Row label="Última lectura" empty={!device?.last_seen}>
            {device?.last_seen ? new Date(device.last_seen).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' }) : 'Todavía no'}
          </Row>
        </dl>
      </Section>

      {/* Equipo */}
      <Section title="Equipo" action={
        <button type="button" onClick={() => setShowSpec(true)} className="text-xs font-semibold px-2 py-1 -mr-2 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ color: ACCENT }}>
          {hasSpec ? 'Editar' : 'Completar'}
        </button>
      }>
        {hasSpec ? (
          <dl>
            <Row label="Número de serie" empty={!device?.serial}>
              {device?.serial ? <span className="font-mono text-xs">{device.serial}</span> : 'Sin registrar'}
            </Row>
            <Row label="Placa" empty={!hw.model}>{hw.model || 'Sin registrar'}</Row>
            <Row label="Firmware" empty={!hw.firmware}>{hw.firmware || 'Sin registrar'}</Row>
            <Row label="Instalada" empty={!installed}>{installed || 'Sin registrar'}</Row>
            {hw.sensors && <Row label="Sensores">{hw.sensors}</Row>}
            {hw.notes && (
              <div className="py-2.5">
                <dt className="text-sm mb-1" style={{ color: 'var(--text2)' }}>Notas</dt>
                <dd className="text-sm whitespace-pre-line" style={{ color: 'var(--text)' }}>{hw.notes}</dd>
              </div>
            )}
          </dl>
        ) : (
          <button type="button" onClick={() => setShowSpec(true)}
                  className="w-full mt-1 flex items-center gap-3 rounded-xl border border-dashed px-3 py-3 text-left transition-colors hover:border-[#67B7E8]"
                  style={{ borderColor: 'var(--border)' }}>
            <Cpu size={18} style={{ color: ACCENT }} className="shrink-0" />
            <span className="text-sm" style={{ color: 'var(--text2)' }}>
              Registrá el número de serie, la placa y los sensores para tenerlos a mano en mantenimiento.
            </span>
          </button>
        )}
      </Section>

      {/* Ubicación */}
      <Section title="Ubicación">
        {hasGps ? (
          <>
            <div className="relative z-0 mt-1">
              <MapPicker lat={lat} lng={lng} height={170} />
            </div>
          </>
        ) : (
          <button type="button" onClick={onEdit} className="w-full mt-1 flex items-center gap-3 rounded-xl border border-dashed px-3 py-3 text-left transition-colors hover:border-[#67B7E8]" style={{ borderColor: 'var(--border)' }}>
            <MapPin size={18} style={{ color: ACCENT }} className="shrink-0" />
            <span className="text-sm" style={{ color: 'var(--text2)' }}>Sin coordenadas. Agregalas para ubicar la estación en el mapa.</span>
          </button>
        )}
      </Section>

      {/* Descripción y etiquetas */}
      {(device?.description || device?.tags?.length > 0) && (
        <Section title="Descripción">
          {device?.description && <p className="text-sm mt-1 whitespace-pre-line" style={{ color: 'var(--text)' }}>{device.description}</p>}
          {device?.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {device.tags.map((t, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-md" style={{ background: ACCENT + '1A', color: ACCENT }}>{t}</span>
              ))}
            </div>
          )}
        </Section>
      )}

      <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <Link to={`/alerts/${device.id}`}
              className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:border-[#67B7E8] hover:text-[#67B7E8]"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          <Bell size={15} /> Alertas de esta estación
        </Link>
      </div>

      {showSpec && (
        <SpecModal
          device={device}
          onClose={() => setShowSpec(false)}
          onSaved={(updated) => { onDeviceChange({ serial: updated?.serial ?? null, hardware: updated?.hardware || {} }); setShowSpec(false) }}
        />
      )}
    </aside>
  )
}
