import { useEffect, useState } from 'react'
import ClienteLayout from '../components/airsunbox/ClienteLayout'
import { incidents as incidentsApi, devices as devicesApi } from '../services/api'
import { LifeBuoy, Plus, X, Cpu, CheckCircle, MessageSquare } from 'lucide-react'

export const INCIDENT_STATUS = {
  open:      { label: 'Abierta',     bg: 'bg-amber-500/10', text: 'text-amber-500', help: 'El equipo AirSunBox todavía no la atendió.' },
  in_review: { label: 'En atención', bg: 'bg-[#60A5FA]/10', text: 'text-[#60A5FA]', help: 'El equipo está trabajando en ella.' },
  resolved:  { label: 'Resuelta',    bg: 'bg-[#1D9E75]/10', text: 'text-[#1D9E75]', help: '' },
}
const MIN_DETALLE = 5
const MAX_DETALLE = 1000
const INPUT = 'w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-[#67B7E8]/20 focus:border-[#67B7E8]'
const inputStyle = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }
const cardStyle = { background: 'var(--card)', borderColor: 'var(--border)' }

function NewIncidentModal({ stations, onClose, onCreated }) {
  const [deviceId, setDeviceId] = useState('')
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const text = reason.trim()
    if (text.length < MIN_DETALLE) {
      setReasonError('Contanos qué pasa con un poco más de detalle.')
      return
    }
    setSaving(true)
    setError('')
    try {
      onCreated(await incidentsApi.create({ deviceId: deviceId || undefined, reason: text }))
    } catch (err) {
      setError(err.message || 'No se pudo reportar la incidencia')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="inc-titulo">
      <div className="rounded-2xl p-6 w-full max-w-lg border" style={cardStyle}>
        <div className="flex items-center justify-between mb-5">
          <h2 id="inc-titulo" className="font-bold text-lg" style={{ color: 'var(--text)' }}>Reportar incidencia</h2>
          <button onClick={onClose} style={{ color: 'var(--text2)' }} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <label htmlFor="inc-device" className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text2)' }}>Estación afectada</label>
            <select id="inc-device" className={INPUT} style={inputStyle} value={deviceId} onChange={e => setDeviceId(e.target.value)}>
              <option value="">Ninguna en particular (problema general)</option>
              {stations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>
              Si elegís una estación, quedará «en revisión» hasta que el equipo resuelva la incidencia.
            </p>
          </div>
          <div>
            <label htmlFor="inc-reason" className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text2)' }}>¿Qué está pasando? *</label>
            <textarea id="inc-reason" rows={4} maxLength={MAX_DETALLE} className={INPUT}
                      style={{ ...inputStyle, borderColor: reasonError ? '#EF4444' : 'var(--border)' }}
                      value={reason} aria-invalid={!!reasonError}
                      onChange={e => { setReason(e.target.value); setReasonError('') }}
                      placeholder="Ej.: la estación dejó de enviar datos desde ayer en la tarde" />
            {reasonError && <p className="text-xs font-medium text-red-500 mt-1">{reasonError}</p>}
          </div>
          {error && <p role="alert" className="text-sm font-medium text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border rounded-xl py-3 text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-[#67B7E8] hover:bg-[#52A8E0] text-white rounded-xl py-3 text-sm font-bold disabled:opacity-60">
              {saving ? 'Enviando…' : 'Reportar incidencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ClientIncidents() {
  const [incidents, setIncidents] = useState([])
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [sent, setSent] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [list, devs] = await Promise.all([incidentsApi.list(), devicesApi.list().catch(() => [])])
      setIncidents(list || [])
      setStations(devs || [])
    } catch (err) {
      setError(err.message || 'No se pudieron cargar tus incidencias')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <ClienteLayout>
      {showModal && (
        <NewIncidentModal
          stations={stations}
          onClose={() => setShowModal(false)}
          onCreated={(i) => { setIncidents(prev => [i, ...prev]); setShowModal(false); setSent(true) }}
        />
      )}
      <div className="p-6 lg:p-10">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <LifeBuoy size={24} style={{ color: 'var(--primary)' }} /> Incidencias
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
              Avisá al equipo AirSunBox si una estación falla o algo no funciona, y seguí cómo avanza.
            </p>
          </div>
          <button onClick={() => { setSent(false); setShowModal(true) }}
                  className="flex items-center gap-2 bg-[#67B7E8] hover:bg-[#52A8E0] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#67B7E8]/20">
            <Plus size={18} /> Reportar incidencia
          </button>
        </div>

        {sent && (
          <div role="status" className="mb-6 rounded-xl px-5 py-4 text-sm font-medium flex items-center gap-3" style={{ background: 'rgba(29,158,117,0.1)', color: '#1D9E75' }}>
            <CheckCircle size={18} /> Incidencia reportada. El equipo AirSunBox la atenderá y verás aquí su estado.
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
        ) : incidents.length === 0 && !error ? (
          <div className="text-center py-16 border rounded-2xl" style={{ ...cardStyle, color: 'var(--text2)' }}>
            <LifeBuoy size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold" style={{ color: 'var(--text)' }}>No tenés incidencias reportadas</p>
            <p className="text-sm mt-1">Si algo falla, usá «Reportar incidencia».</p>
          </div>
        ) : (
          <div className="space-y-4">
            {incidents.map(i => {
              const st = INCIDENT_STATUS[i.status] || { label: i.status, bg: 'bg-black/5', text: '', help: '' }
              return (
                <div key={i.id} className="border rounded-2xl p-5" style={cardStyle}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                        {i.device_id ? <Cpu size={16} style={{ color: 'var(--primary)' }} /> : <LifeBuoy size={16} style={{ color: 'var(--primary)' }} />}
                        {i.device_name || 'Incidencia general'}
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>
                        Reportada el {new Date(i.created_at).toLocaleDateString('es-GT')}
                        {i.resolved_at && ` · resuelta el ${new Date(i.resolved_at).toLocaleDateString('es-GT')}`}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${st.bg} ${st.text}`}>{st.label}</span>
                  </div>
                  <p className="text-sm mb-2 whitespace-pre-line" style={{ color: 'var(--text)' }}>{i.reason}</p>
                  {i.notes ? (
                    <div className="rounded-xl p-3 mt-3 text-sm flex gap-2" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
                      <MessageSquare size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--primary)' }} />
                      <span><span className="font-semibold">Respuesta del equipo: </span>{i.notes}</span>
                    </div>
                  ) : st.help && (
                    <p className="text-xs" style={{ color: 'var(--text2)' }}>{st.help}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ClienteLayout>
  )
}
