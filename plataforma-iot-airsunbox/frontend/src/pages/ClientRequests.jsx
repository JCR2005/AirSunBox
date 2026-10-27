import { useEffect, useState } from 'react'
import ClienteLayout from '../components/airsunbox/ClienteLayout'
import { requests as requestsApi } from '../services/api'
import { FileText, Plus, X, MapPin, Package, CheckCircle } from 'lucide-react'

const STATUS = {
  pending:   { label: 'Pendiente',   bg: 'bg-amber-500/10',  text: 'text-amber-500', help: 'El equipo AirSunBox todavía no la revisó.' },
  in_review: { label: 'En revisión', bg: 'bg-[#60A5FA]/10',  text: 'text-[#60A5FA]', help: 'El equipo la está evaluando.' },
  approved:  { label: 'Aprobada',    bg: 'bg-[#1D9E75]/10',  text: 'text-[#1D9E75]', help: 'Te contactaremos para la instalación.' },
  rejected:  { label: 'Rechazada',   bg: 'bg-red-500/10',    text: 'text-red-500',   help: 'Escribinos si querés más detalles.' },
}
const MAX_CANTIDAD = 50
const INPUT = 'w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-[#67B7E8]/20 focus:border-[#67B7E8]'
const inputStyle = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }
const cardStyle = { background: 'var(--card)', borderColor: 'var(--border)' }

function NewRequestModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ deviceName: '', location: '', quantity: 1, note: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({ ...er, [k]: '' })) }

  const submit = async (e) => {
    e.preventDefault()
    const qty = Number(form.quantity)
    const errs = {}
    if (!form.deviceName.trim()) errs.deviceName = 'Indicá qué estación necesitás.'
    if (!form.location.trim()) errs.location = 'Indicá dónde se instalaría.'
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_CANTIDAD) errs.quantity = `Entre 1 y ${MAX_CANTIDAD}.`
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    setError('')
    try {
      const created = await requestsApi.create({
        deviceName: form.deviceName.trim(),
        location: form.location.trim(),
        quantity: qty,
        note: form.note.trim() || undefined
      })
      onCreated(created)
    } catch (err) {
      setError(err.message || 'No se pudo enviar la solicitud')
    } finally {
      setSaving(false)
    }
  }

  const campo = (k, label, props = {}) => (
    <div>
      <label htmlFor={`sol-${k}`} className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text2)' }}>{label}</label>
      <input id={`sol-${k}`} className={INPUT} style={{ ...inputStyle, borderColor: errors[k] ? '#EF4444' : 'var(--border)' }}
             value={form[k]} onChange={set(k)} aria-invalid={!!errors[k]} {...props} />
      {errors[k] && <p className="text-xs font-medium text-red-500 mt-1">{errors[k]}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="sol-titulo">
      <div className="rounded-2xl p-6 w-full max-w-lg border" style={cardStyle}>
        <div className="flex items-center justify-between mb-5">
          <h2 id="sol-titulo" className="font-bold text-lg" style={{ color: 'var(--text)' }}>Nueva solicitud</h2>
          <button onClick={onClose} style={{ color: 'var(--text2)' }} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <form onSubmit={submit} noValidate className="space-y-4">
          {campo('deviceName', 'Estación que necesitás *', { placeholder: 'Ej.: Estación de calidad del aire' })}
          {campo('location', 'Ubicación de instalación *', { placeholder: 'Ej.: Parque Central, zona 1' })}
          {campo('quantity', 'Cantidad *', { type: 'number', min: 1, max: MAX_CANTIDAD })}
          <div>
            <label htmlFor="sol-note" className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text2)' }}>Nota (opcional)</label>
            <textarea id="sol-note" rows={3} className={INPUT} style={inputStyle} value={form.note} onChange={set('note')}
                      placeholder="Para qué la necesitás o cualquier detalle útil" />
          </div>
          {error && <p role="alert" className="text-sm font-medium text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border rounded-xl py-3 text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-[#67B7E8] hover:bg-[#52A8E0] text-white rounded-xl py-3 text-sm font-bold disabled:opacity-60">
              {saving ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ClientRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [sent, setSent] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setRequests(await requestsApi.list() || [])
    } catch (err) {
      setError(err.message || 'No se pudieron cargar tus solicitudes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <ClienteLayout>
      {showModal && (
        <NewRequestModal
          onClose={() => setShowModal(false)}
          onCreated={(r) => { setRequests(prev => [r, ...prev]); setShowModal(false); setSent(true) }}
        />
      )}
      <div className="p-6 lg:p-10">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <FileText size={24} style={{ color: 'var(--primary)' }} /> Solicitudes
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
              Pedí nuevas estaciones al equipo AirSunBox y seguí el estado de cada pedido.
            </p>
          </div>
          <button onClick={() => { setSent(false); setShowModal(true) }}
                  className="flex items-center gap-2 bg-[#67B7E8] hover:bg-[#52A8E0] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#67B7E8]/20">
            <Plus size={18} /> Nueva solicitud
          </button>
        </div>

        {sent && (
          <div role="status" className="mb-6 rounded-xl px-5 py-4 text-sm font-medium flex items-center gap-3" style={{ background: 'rgba(29,158,117,0.1)', color: '#1D9E75' }}>
            <CheckCircle size={18} /> Solicitud enviada. El equipo AirSunBox la revisará y verás aquí su estado.
          </div>
        )}

        {error && (
          <div role="alert" className="mb-6 rounded-xl px-5 py-4 text-sm font-medium flex items-center justify-between gap-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
            {error}
            <button onClick={load} className="font-bold underline">Reintentar</button>
          </div>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--text2)' }}>Cargando…</p>
        ) : requests.length === 0 && !error ? (
          <div className="text-center py-16 border rounded-2xl" style={{ ...cardStyle, color: 'var(--text2)' }}>
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold" style={{ color: 'var(--text)' }}>Todavía no hiciste solicitudes</p>
            <p className="text-sm mt-1">Usá «Nueva solicitud» para pedir una estación.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(r => {
              const st = STATUS[r.status] || { label: r.status, bg: 'bg-black/5', text: '', help: '' }
              return (
                <div key={r.id} className="border rounded-2xl p-5" style={cardStyle}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                        <Package size={16} style={{ color: 'var(--primary)' }} />
                        {r.device_name || 'Estación'}{r.quantity > 1 ? ` (×${r.quantity})` : ''}
                      </div>
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text2)' }}>
                        <MapPin size={12} /> {r.location || '—'} · {new Date(r.created_at).toLocaleDateString('es-GT')}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${st.bg} ${st.text}`}>{st.label}</span>
                  </div>
                  {r.note && <p className="text-sm mb-2" style={{ color: 'var(--text)' }}>{r.note}</p>}
                  <p className="text-xs" style={{ color: 'var(--text2)' }}>{st.help}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ClienteLayout>
  )
}
