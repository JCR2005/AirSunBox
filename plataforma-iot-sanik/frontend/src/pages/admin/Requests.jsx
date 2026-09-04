import { useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { FileText, CheckCircle, X, Clock, MapPin, Package } from 'lucide-react'

const MOCK_REQUESTS = [
  { id: '1', org: 'Municipalidad Xela', contact: 'admin@xela.gob.gt', type: 'new_device', deviceName: 'Estación Sur', location: 'Quetzaltenango, Zona Sur', quantity: 1, note: 'Para monitoreo en zona residencial', status: 'pending', createdAt: '2026-05-25T10:00:00Z', paymentPhoto: null },
  { id: '2', org: 'CUNOC', contact: 'investigacion@cunoc.edu.gt', type: 'new_device', deviceName: 'Estación Campus', location: 'Campus CUNOC, Xela', quantity: 2, note: 'Ampliar red de monitoreo', status: 'in_review', createdAt: '2026-05-20T14:00:00Z', paymentPhoto: null },
]

export default function AdminRequests() {
  const [requests, setRequests] = useState(MOCK_REQUESTS)

  const updateStatus = (id, status) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const statusConfig = {
    pending:   { label: 'Pendiente',   bg: 'bg-amber-500/10',   text: 'text-amber-400' },
    in_review: { label: 'En revisión', bg: 'bg-[#60A5FA]/10',   text: 'text-[#60A5FA]' },
    approved:  { label: 'Aprobada',    bg: 'bg-[#1D9E75]/10',   text: 'text-[#1D9E75]' },
    rejected:  { label: 'Rechazada',   bg: 'bg-red-500/10',     text: 'text-red-400' },
  }

  return (
    <AdminLayout>
      <div className="p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Solicitudes</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>{requests.filter(r => r.status === 'pending').length} solicitudes pendientes</p>
        </div>


        {requests.length === 0 ? (
          <div className="text-center text-[#8FA899] py-16 bg-[#121A16] border border-[#1E2E28] rounded-2xl">
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            <p>No hay solicitudes</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(r => {
              const sc = statusConfig[r.status]
              return (
                <div key={r.id} className="bg-[#121A16] border border-[#1E2E28] rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-white font-semibold">{r.org}</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span>
                      </div>
                      <p className="text-[#8FA899] text-xs">{r.contact} · {new Date(r.createdAt).toLocaleDateString('es-GT')}</p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 mb-4">
                    <div className="bg-[#0A0F0D] rounded-xl p-3">
                      <div className="text-[#8FA899] text-xs mb-1 flex items-center gap-1"><Package size={10} /> Dispositivo</div>
                      <div className="text-white text-sm">{r.deviceName}</div>
                      <div className="text-[#8FA899] text-xs mt-0.5">Cantidad: {r.quantity}</div>
                    </div>
                    <div className="bg-[#0A0F0D] rounded-xl p-3">
                      <div className="text-[#8FA899] text-xs mb-1 flex items-center gap-1"><MapPin size={10} /> Ubicación</div>
                      <div className="text-white text-sm">{r.location}</div>
                    </div>
                    <div className="bg-[#0A0F0D] rounded-xl p-3">
                      <div className="text-[#8FA899] text-xs mb-1">Nota</div>
                      <div className="text-white text-sm">{r.note || '—'}</div>
                    </div>
                  </div>

                  {r.status === 'pending' || r.status === 'in_review' ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button onClick={() => updateStatus(r.id, 'approved')} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-[#1D9E75]/10 hover:bg-[#1D9E75]/20 text-[#1D9E75] px-3 py-2.5 rounded-xl text-sm font-bold transition-all">
                        <CheckCircle size={14} /> Aprobar
                      </button>
                      <button onClick={() => updateStatus(r.id, 'in_review')} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-[#60A5FA]/10 hover:bg-[#60A5FA]/20 text-[#60A5FA] px-3 py-2.5 rounded-xl text-sm font-bold transition-all">
                        <Clock size={14} /> En revisión
                      </button>
                      <button onClick={() => updateStatus(r.id, 'rejected')} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2.5 rounded-xl text-sm font-bold transition-all">
                        <X size={14} /> Rechazar
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
