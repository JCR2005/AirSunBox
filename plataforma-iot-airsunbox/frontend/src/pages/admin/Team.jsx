import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { Plus, Shield, User, Ban, X, Crown, RotateCcw } from 'lucide-react'
import useAuthStore from '../../store/auth'
import { team as teamApi } from '../../services/api'

const INPUT = "w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1D9E75] transition-colors"
const MIN_PASSWORD = 8

// Modal FUERA del componente padre
function NewMemberModal({ isCentral, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('worker')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputStyle = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) { setError(`La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`); return }
    setSaving(true)
    setError('')
    try {
      const created = await teamApi.create({ email: email.trim(), password, role, name: name.trim() || undefined })
      // El alta devuelve id, email, rol y nombre; el resto es lo que el servidor asigna
      onCreated({ status: 'active', created_at: new Date().toISOString(), ...created })
    } catch (err) {
      setError(err.message || 'No se pudo crear el miembro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl p-6 w-full max-w-md border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold" style={{ color: 'var(--text)' }}>Nuevo miembro</h2>
          <button onClick={onClose} style={{ color: 'var(--text2)' }} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--text2)' }}>Nombre</label>
            <input className={INPUT} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--text2)' }}>Correo</label>
            <input className={INPUT} style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@airsunbox.com" required />
          </div>
          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--text2)' }}>Contraseña</label>
            <input className={INPUT} style={inputStyle} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={`Mínimo ${MIN_PASSWORD} caracteres`} required />
          </div>
          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--text2)' }}>Rol</label>
            <select className={INPUT} style={inputStyle} value={role} onChange={e => setRole(e.target.value)}>
              <option value="worker">Trabajador</option>
              {isCentral && <option value="admin">Administrador</option>}
              {isCentral && <option value="superadmin">Superadministrador</option>}
            </select>
          </div>
          {error && <p role="alert" className="text-sm font-medium text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2.5 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-[#1D9E75] hover:bg-[#25C48F] text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
              {saving ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminTeam() {
  const { user } = useAuthStore()
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const isCentral = user?.role === 'superadmin'
  const canCreate = isCentral || user?.role === 'admin'

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setTeam(await teamApi.list() || [])
    } catch (err) {
      setError(err.message || 'No se pudo cargar el equipo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Mismas reglas que el servidor: nadie se cambia a sí mismo, y a los
  // administradores y superadmins solo los maneja un superadmin.
  const canManage = (m) => m.id !== user?.id && (isCentral || m.role === 'worker')

  const update = async (m, data) => {
    setBusyId(m.id)
    setError('')
    try {
      const updated = await teamApi.update(m.id, data)
      setTeam(prev => prev.map(x => x.id === m.id ? { ...x, ...updated } : x))
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el miembro')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout>
      {showModal && (
        <NewMemberModal
          isCentral={isCentral}
          onClose={() => setShowModal(false)}
          onCreated={m => { setTeam(prev => [...prev, m]); setShowModal(false) }}
        />
      )}
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--text)' }}>Equipo</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
              {loading ? 'Cargando…' : `${team.length} ${team.length === 1 ? 'miembro' : 'miembros'} del equipo AirSunBox`}
            </p>
          </div>
          {canCreate && (
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[#1D9E75] hover:bg-[#25C48F] text-white px-4 py-2.5 rounded-lg text-sm font-medium">
              <Plus size={16} /> Nuevo miembro
            </button>
          )}
        </div>

        {error && (
          <div role="alert" className="mb-6 rounded-xl px-5 py-4 text-sm font-medium flex items-center justify-between gap-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
            {error}
            <button onClick={load} className="font-bold underline">Reintentar</button>
          </div>
        )}

        <div className="space-y-3">
          {team.map(m => {
            const isAdmin = m.role === 'admin' || m.role === 'superadmin'
            const busy = busyId === m.id
            return (
              <div key={m.id} className={`border rounded-xl p-4 flex items-center gap-4 ${m.status === 'suspended' ? 'opacity-60' : ''}`}
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAdmin ? 'bg-[#A78BFA]/10' : 'bg-[#1D9E75]/10'}`}>
                  {isAdmin ? <Shield size={18} className="text-[#A78BFA]" /> : <User size={18} className="text-[#1D9E75]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{m.name || m.email}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === 'superadmin' ? 'bg-amber-500/10 text-amber-500' : m.role === 'admin' ? 'bg-[#A78BFA]/10 text-[#A78BFA]' : 'bg-[#1D9E75]/10 text-[#1D9E75]'}`}>
                      {m.role === 'superadmin' ? 'Super Admin' : m.role === 'admin' ? 'Admin' : 'Trabajador'}
                    </span>
                    {m.status === 'suspended' && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">Suspendido</span>}
                    {m.id === user?.id && <span className="text-xs" style={{ color: 'var(--text2)' }}>(vos)</span>}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                    {m.name ? `${m.email} · ` : ''}Desde {new Date(m.created_at).toLocaleDateString('es-GT')}
                  </div>
                </div>
                {canManage(m) && (
                  <div className="flex gap-2">
                    {isCentral && (
                      <label className="flex items-center gap-1.5" title="Cambiar rol">
                        <Crown size={14} style={{ color: 'var(--text2)' }} />
                        <span className="sr-only">Rol de {m.name || m.email}</span>
                        <select disabled={busy} value={m.role}
                          onChange={e => {
                            const role = e.target.value
                            if (role === 'superadmin' && !window.confirm(`¿Dar control total de AirSunBox a ${m.name || m.email}? Podrá gestionar todo el equipo, incluidos otros superadmins.`)) return
                            update(m, { role })
                          }}
                          className="text-xs rounded-lg border px-2 py-1.5 disabled:opacity-50"
                          style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                          <option value="worker">Trabajador</option>
                          <option value="admin">Administrador</option>
                          <option value="superadmin">Superadministrador</option>
                        </select>
                      </label>
                    )}
                    <button disabled={busy} onClick={() => update(m, { status: m.status === 'active' ? 'suspended' : 'active' })}
                      className="p-2 rounded-lg transition-colors hover:text-amber-500 hover:bg-black/5 disabled:opacity-50" style={{ color: 'var(--text2)' }}
                      title={m.status === 'active' ? 'Suspender' : 'Reactivar'}>
                      {m.status === 'active' ? <Ban size={14} /> : <RotateCcw size={14} />}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </AdminLayout>
  )
}
