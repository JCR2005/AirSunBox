import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { LifeBuoy, CheckCircle, Clock, Cpu, Building2, MessageSquare } from 'lucide-react'
import { incidents as incidentsApi } from '../../services/api'
import { INCIDENT_STATUS } from '../ClientIncidents'

const cardStyle = { background: 'var(--card)', borderColor: 'var(--border)' }
const boxStyle = { background: 'var(--bg)' }
const INPUT = 'w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-[#67B7E8]/20 focus:border-[#67B7E8]'
const FILTROS = [
  { id: 'pendientes', label: 'Pendientes', match: i => i.status !== 'resolved' },
  { id: 'resueltas',  label: 'Resueltas',  match: i => i.status === 'resolved' },
  { id: 'todas',      label: 'Todas',      match: () => true },
]

export default function AdminIncidents() {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [filtro, setFiltro] = useState('pendientes')
  const [resolving, setResolving] = useState(null)   // id con el formulario abierto
  const [notes, setNotes] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setIncidents(await incidentsApi.list() || [])
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las incidencias')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const run = async (id, action) => {
    setBusyId(id)
    setError('')
    try {
      const updated = await action()
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i))
      setResolving(null)
      setNotes('')
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la incidencia')
    } finally {
      setBusyId(null)
    }
  }

  const pendientes = incidents.filter(i => i.status !== 'resolved').length
  const visibles = incidents.filter(FILTROS.find(f => f.id === filtro).match)

  return (
    <AdminLayout>
      <div className="p-4 lg:p-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--text)' }}>Incidencias</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
            {loading ? 'Cargando…' : `${pendientes} ${pendientes === 1 ? 'incidencia pendiente' : 'incidencias pendientes'}`}
          </p>
        </div>

        <div className="flex gap-2 mb-6" role="tablist" aria-label="Filtrar incidencias">
          {FILTROS.map(f => (
            <button key={f.id} role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
                    style={filtro === f.id
                      ? { background: 'rgba(103,183,232,0.15)', color: '#67B7E8', borderColor: 'transparent' }
                      : { color: 'var(--text2)', borderColor: 'var(--border)' }}>
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div role="alert" className="mb-6 rounded-xl px-5 py-4 text-sm font-medium flex items-center justify-between gap-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
            {error}
            <button onClick={load} className="font-bold underline">Reintentar</button>
          </div>
        )}

        {!loading && visibles.length === 0 && !error ? (
          <div className="text-center py-16 border rounded-2xl" style={{ ...cardStyle, color: 'var(--text2)' }}>
            <LifeBuoy size={32} className="mx-auto mb-3 opacity-30" />
            <p>{filtro === 'pendientes' ? 'No hay incidencias pendientes' : 'No hay incidencias'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibles.map(i => {
              const st = INCIDENT_STATUS[i.status] || { label: i.status, bg: 'bg-black/5', text: '' }
              const busy = busyId === i.id
              return (
                <div key={i.id} className="border rounded-2xl p-5" style={cardStyle}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                          <Building2 size={14} style={{ color: 'var(--text2)' }} /> {i.org_name}
                        </span>
                        <span className={`text-xs px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text2)' }}>
                        Reportada el {new Date(i.created_at).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}
                        {i.resolved_at && ` · resuelta el ${new Date(i.resolved_at).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}`}
                      </p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 mb-4">
                    <div className="rounded-xl p-3" style={boxStyle}>
                      <div className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text2)' }}><Cpu size={10} /> Estación</div>
                      <div className="text-sm" style={{ color: 'var(--text)' }}>{i.device_name || 'General (sin estación)'}</div>
                    </div>
                    <div className="rounded-xl p-3 sm:col-span-2" style={boxStyle}>
                      <div className="text-xs mb-1" style={{ color: 'var(--text2)' }}>Problema reportado</div>
                      <div className="text-sm whitespace-pre-line" style={{ color: 'var(--text)' }}>{i.reason}</div>
                    </div>
                  </div>

                  {i.notes && (
                    <div className="rounded-xl p-3 mb-2 text-sm flex gap-2" style={{ ...boxStyle, color: 'var(--text)' }}>
                      <MessageSquare size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--primary)' }} />
                      <span><span className="font-semibold">Resolución: </span>{i.notes}</span>
                    </div>
                  )}

                  {i.status !== 'resolved' && (resolving === i.id ? (
                    <form className="space-y-3 pt-2" onSubmit={e => { e.preventDefault(); run(i.id, () => incidentsApi.resolve(i.id, notes.trim() || undefined)) }}>
                      <label htmlFor={`notes-${i.id}`} className="text-xs font-semibold block" style={{ color: 'var(--text2)' }}>
                        ¿Qué se hizo? (el cliente verá esta respuesta)
                      </label>
                      <textarea id={`notes-${i.id}`} rows={3} maxLength={1000} className={INPUT} autoFocus
                                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                                value={notes} onChange={e => setNotes(e.target.value)}
                                placeholder="Ej.: se reemplazó el sensor de PM2.5 y la estación volvió a enviar datos" />
                      <div className="flex flex-wrap gap-2">
                        <button type="submit" disabled={busy} className="flex items-center gap-1.5 bg-[#1D9E75] hover:bg-[#178a65] text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
                          <CheckCircle size={14} /> {busy ? 'Guardando…' : 'Marcar como resuelta'}
                        </button>
                        <button type="button" onClick={() => { setResolving(null); setNotes('') }} className="border px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {i.status === 'open' && (
                        <button disabled={busy} onClick={() => run(i.id, () => incidentsApi.review(i.id))} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-[#60A5FA]/10 hover:bg-[#60A5FA]/20 text-[#60A5FA] px-3 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
                          <Clock size={14} /> Atender
                        </button>
                      )}
                      <button disabled={busy} onClick={() => { setResolving(i.id); setNotes('') }} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-[#1D9E75]/10 hover:bg-[#1D9E75]/20 text-[#1D9E75] px-3 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
                        <CheckCircle size={14} /> Resolver
                      </button>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
