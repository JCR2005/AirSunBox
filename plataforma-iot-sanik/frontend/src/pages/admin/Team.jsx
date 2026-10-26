import { useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { Plus, Shield, User, Ban, X, Crown } from 'lucide-react'
import useAuthStore from '../../store/auth'

const MOCK_TEAM = [
  { id: '1', email: 'carlos@sanik.io', role: 'superadmin', status: 'active', createdAt: '2026-01-01' },
  { id: '2', email: 'juan@sanik.io', role: 'admin', status: 'active', createdAt: '2026-02-15' },
  { id: '3', email: 'maria@sanik.io', role: 'worker', status: 'suspended', createdAt: '2026-03-01' },
]

const INPUT = "w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1D9E75] transition-colors"

// Modal FUERA del componente padre
function NewMemberModal({ isCentral, onClose, onCreate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('worker')
  const inputStyle = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }

  const handleSubmit = (e) => {
    e.preventDefault()
    onCreate({ id: Date.now().toString(), email, role, status: 'active', createdAt: new Date().toISOString() })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl p-6 w-full max-w-md border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold" style={{ color: 'var(--text)' }}>Nuevo miembro</h2>
          <button onClick={onClose} style={{ color: 'var(--text2)' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--text2)' }}>Correo</label>
            <input className={INPUT} style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@sanik.io" required />
          </div>
          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--text2)' }}>Contraseña</label>
            <input className={INPUT} style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required />
          </div>
          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--text2)' }}>Rol</label>
            <select className={INPUT} style={inputStyle} value={role} onChange={e => setRole(e.target.value)}>
              <option value="worker">Trabajador</option>
              {isCentral && <option value="admin">Administrador</option>}
            </select>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2.5 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>Cancelar</button>
            <button type="submit" className="flex-1 bg-[#1D9E75] hover:bg-[#25C48F] text-white py-2.5 rounded-lg text-sm font-medium">Crear</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminTeam() {
  const { user } = useAuthStore()
  const [team, setTeam] = useState(MOCK_TEAM)
  const [showModal, setShowModal] = useState(false)
  const isCentral = user?.role === 'superadmin'

  const toggleStatus = (id) => setTeam(prev => prev.map(m => m.id === id ? { ...m, status: m.status === 'active' ? 'suspended' : 'active' } : m))
  const promote = (id) => setTeam(prev => prev.map(m => m.id === id ? { ...m, role: m.role === 'worker' ? 'admin' : 'worker' } : m))

  return (
    <AdminLayout>
      {showModal && (
        <NewMemberModal
          isCentral={isCentral}
          onClose={() => setShowModal(false)}
          onCreate={m => { setTeam(prev => [...prev, m]); setShowModal(false) }}
        />
      )}
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Equipo</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>{team.length} miembros del equipo Sanik</p>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[#1D9E75] hover:bg-[#25C48F] text-white px-4 py-2.5 rounded-lg text-sm font-medium">
            <Plus size={16} /> Nuevo miembro
          </button>
        </div>
        <div className="space-y-3">
          {team.map(m => (
            <div key={m.id} className={`border rounded-xl p-4 flex items-center gap-4 ${m.status === 'suspended' ? 'opacity-60' : ''}`}
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.role === 'admin' || m.role === 'superadmin' ? 'bg-[#A78BFA]/10' : 'bg-[#1D9E75]/10'}`}>
                {m.role === 'admin' || m.role === 'superadmin' ? <Shield size={18} className="text-[#A78BFA]" /> : <User size={18} className="text-[#1D9E75]" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{m.email}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === 'superadmin' ? 'bg-amber-500/10 text-amber-400' : m.role === 'admin' ? 'bg-[#A78BFA]/10 text-[#A78BFA]' : 'bg-[#1D9E75]/10 text-[#1D9E75]'}`}>
                    {m.role === 'superadmin' ? 'Super Admin' : m.role === 'admin' ? 'Admin' : 'Trabajador'}
                  </span>
                  {m.status === 'suspended' && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Suspendido</span>}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>Desde {new Date(m.createdAt).toLocaleDateString('es-GT')}</div>
              </div>
              {isCentral && m.role !== 'superadmin' && (
                <div className="flex gap-2">
                  <button onClick={() => promote(m.id)} className="p-2 rounded-lg transition-colors hover:bg-[#1E2E28]" style={{ color: 'var(--text2)' }} title="Cambiar rol"><Crown size={14} /></button>
                  <button onClick={() => toggleStatus(m.id)} className="p-2 rounded-lg transition-colors hover:text-amber-400 hover:bg-[#1E2E28]" style={{ color: 'var(--text2)' }}><Ban size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
