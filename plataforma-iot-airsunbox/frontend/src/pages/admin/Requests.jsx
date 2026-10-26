import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { FileText, CheckCircle, X, Clock, MapPin, Package, Receipt } from 'lucide-react'
import { requests as requestsApi } from '../../services/api'

const statusConfig = {
  pending:   { label: 'Pendiente',   bg: 'bg-amber-500/10',   text: 'text-amber-500' },
  in_review: { label: 'En revisión', bg: 'bg-[#60A5FA]/10',   text: 'text-[#60A5FA]' },
  approved:  { label: 'Aprobada',    bg: 'bg-[#1D9E75]/10',   text: 'text-[#1D9E75]' },
  rejected:  { label: 'Rechazada',   bg: 'bg-red-500/10',     text: 'text-red-500' },
}

// El comprobante lo sube el cliente: solo se enlaza si es una URL http(s) o
// una imagen embebida, nunca un esquema como javascript:
const safeReceipt = (url) => /^(https?:\/\/|data:image\/)/i.test(url || '') ? url : null

const cardStyle = { background: 'var(--card)', borderColor: 'var(--border)' }
const boxStyle = { background: 'var(--bg)' }

export default function AdminRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setRequests(await requestsApi.list() || [])
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las solicitudes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const updateStatus = async (id, status) => {
    setBusyId(id)
    setError('')
    try {
      const updated = await requestsApi.updateStatus(id, status)
      setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r))
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la solicitud')
    } finally {
      setBusyId(null)
    }
  }

  const pending = requests.filter(r => r.status === 'pending').length

  return (
    <AdminLayout>
      <div className="p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--text)' }}>Solicitudes</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
            {loading ? 'Cargando…' : `${pending} ${pending === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}`}
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-6 rounded-xl px-5 py-4 text-sm font-medium flex items-center justify-between gap-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
            {error}
            <button onClick={load} className="font-bold underline">Reintentar</button>
          </div>
        )}

        {!loading && requests.length === 0 && !error ? (
          <div className="text-center py-16 border rounded-2xl" style={{ ...cardStyle, color: 'var(--text2)' }}>
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            <p>No hay solicitudes</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(r => {
              const sc = statusConfig[r.status] || { label: r.status, bg: 'bg-black/5', text: '' }
              const busy = busyId === r.id
              return (
                <div key={r.id} className="border rounded-2xl p-5" style={cardStyle}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold" style={{ color: 'var(--text)' }}>{r.org_name}</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text2)' }}>{new Date(r.created_at).toLocaleDateString('es-GT')}</p>
                    </div>
                    {safeReceipt(r.payment_photo) && (
                      <a href={safeReceipt(r.payment_photo)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-[#67B7E8] hover:underline">
                        <Receipt size={14} /> Comprobante
                      </a>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 mb-4">
                    <div className="rounded-xl p-3" style={boxStyle}>
                      <div className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text2)' }}><Package size={10} /> Dispositivo</div>
                      <div className="text-sm" style={{ color: 'var(--text)' }}>{r.device_name || '—'}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>Cantidad: {r.quantity}</div>
                    </div>
                    <div className="rounded-xl p-3" style={boxStyle}>
                      <div className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text2)' }}><MapPin size={10} /> Ubicación</div>
                      <div className="text-sm" style={{ color: 'var(--text)' }}>{r.location || '—'}</div>
                    </div>
                    <div className="rounded-xl p-3" style={boxStyle}>
                      <div className="text-xs mb-1" style={{ color: 'var(--text2)' }}>Nota</div>
                      <div className="text-sm" style={{ color: 'var(--text)' }}>{r.note || '—'}</div>
                    </div>
                  </div>

                  {(r.status === 'pending' || r.status === 'in_review') && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button disabled={busy} onClick={() => updateStatus(r.id, 'approved')} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-[#1D9E75]/10 hover:bg-[#1D9E75]/20 text-[#1D9E75] px-3 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
                        <CheckCircle size={14} /> Aprobar
                      </button>
                      {r.status === 'pending' && (
                        <button disabled={busy} onClick={() => updateStatus(r.id, 'in_review')} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-[#60A5FA]/10 hover:bg-[#60A5FA]/20 text-[#60A5FA] px-3 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
                          <Clock size={14} /> En revisión
                        </button>
                      )}
                      <button disabled={busy} onClick={() => updateStatus(r.id, 'rejected')} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
                        <X size={14} /> Rechazar
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
