import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import MapPicker from '../../components/MapPicker'
import { 
  ArrowLeft, Plus, Wifi, WifiOff, Clock, CreditCard, 
  Ban, CheckCircle, MapPin, X, ChevronRight, 
  Building2, Key, Receipt, Smartphone, User, Check 
} from 'lucide-react'
import { devices as devicesApi, organizations as orgsApi } from '../../services/api'


const EMPTY_CLIENT = {
  id: '', name: '', email: '', phone: '', location: '',
  plan: 'free', status: 'active', paidUntil: null,
  nit: '', contactName: '', notes: '',
  devices: [], payments: []
}

const COLORS = { primary: "#67B7E8", primaryHover: "#55A6D7" }
const INPUT = "w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[#67B7E8]/20 focus:border-[#67B7E8]"
const inputStyle = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }


function CredentialsCard({ clientId }) {
  const [revealed, setRevealed] = useState(null) 
  const [showPrompt, setShowPrompt] = useState(false)
  const [showConfirmReset, setShowConfirmReset] = useState(false) 
  const [adminPassword, setAdminPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const handleReveal = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await orgsApi.revealCredentials(clientId, adminPassword)
      setRevealed(data)
      setShowPrompt(false)
      setAdminPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setResetLoading(true)
    setError('')
    try {
      const data = await orgsApi.resetPassword(clientId)
      setRevealed({
        email: data.email,
        password: data.password
      })
      setShowConfirmReset(false) 
    } catch (err) {
      setError(err.message)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="rounded-3xl p-6 border shadow-sm transition-all duration-300" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--text2)' }}>
        <Key size={16} /> Credenciales de acceso
      </h3>
      
      {error && <p className="text-xs text-red-500 font-medium mb-3">{error}</p>}

      {!revealed && (
        <div>
          <p className="text-xs mb-4" style={{ color: 'var(--text2)' }}>
            Las credenciales están protegidas. Ingresá tu contraseña de Administrador para visualizarlas.
          </p>
          {!showPrompt ? (
            <button 
              onClick={() => setShowPrompt(true)}
              className="w-full text-center bg-[#67B7E8]/10 hover:bg-[#67B7E8]/20 text-[#67B7E8] text-xs font-bold py-3 rounded-xl transition-all"
            >
              Revelar Correo y Contraseña
            </button>
          ) : (
            <form onSubmit={handleReveal} className="space-y-3">
              <input 
                type="password" 
                placeholder="Tu contraseña de Admin" 
                className={INPUT}
                style={inputStyle}
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                required
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowPrompt(false); setError('') }} className="flex-1 text-xs py-2 rounded-lg" style={{ color: 'var(--text2)' }}>Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 bg-[#67B7E8] text-white text-xs font-bold py-2 rounded-lg">{loading ? 'Verificando...' : 'Confirmar'}</button>
              </div>
            </form>
          )}
        </div>
      )}

      {revealed && !showConfirmReset && (
        <div className="space-y-3">
          <div className="rounded-xl p-3 border" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
            <label className="text-[10px] uppercase font-bold tracking-wider block" style={{ color: 'var(--text2)' }}>Usuario / Correo</label>
            <span className="text-xs font-mono font-bold select-all" style={{ color: 'var(--text)' }}>{revealed.email}</span>
          </div>
          
          <div className="rounded-xl p-3 border border-emerald-500/30 flex items-center justify-between" style={{ background: 'rgba(16,185,129,0.05)' }}>
            <div className="flex-1 min-w-0">
              <label className="text-[10px] uppercase font-bold tracking-wider block" style={{ color: 'var(--text2)' }}>Contraseña del cliente</label>
              <span className="text-xs font-mono font-bold text-emerald-500 select-all block break-words">{revealed.password}</span>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 shrink-0">Visible</span>
          </div>

          {revealed.password === 'Contraseña ya modificada por el cliente' && (
            <button 
              type="button"
              onClick={() => setShowConfirmReset(true)}
              className="w-full text-center bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-bold py-2.5 rounded-xl transition-all mt-2"
            >
              Generar nueva contraseña
            </button>
          )}

          <button onClick={() => setRevealed(null)} className="w-full text-center text-[11px] font-medium mt-2" style={{ color: 'var(--text2)' }}>Ocultar credenciales</button>
        </div>
      )}

      {revealed && showConfirmReset && (
        <div className="rounded-2xl p-4 border border-amber-500/20 bg-amber-500/[0.02] space-y-4 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 shrink-0 mt-0.5">
              <Ban size={16} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider">¿Estás completamente seguro?</h4>
              <p className="text-[11px] leading-relaxed mt-1" style={{ color: 'var(--text2)' }}>
                La contraseña actual del cliente dejará de funcionar de inmediato. Esta acción no se puede deshacer.
              </p>
            </div>
          </div>
          
          <div className="flex gap-2 pt-1">
            <button 
              type="button" 
              onClick={() => setShowConfirmReset(false)} 
              className="flex-1 text-xs py-2 rounded-xl font-medium border transition-colors hover:bg-black/5 dark:hover:bg-white/5" 
              style={{ color: 'var(--text)', borderColor: 'var(--border)' }}
            >
              No, cancelar
            </button>
            <button 
              type="button" 
              disabled={resetLoading}
              onClick={handleResetPassword} 
              className="flex-1 bg-amber-500 text-white text-xs font-bold py-2 rounded-xl transition-all shadow-sm shadow-amber-500/20 hover:bg-amber-600"
            >
              {resetLoading ? 'Procesando...' : 'Sí, restablecer'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AddDeviceModal({ clientId, onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', label: '', lat: '', lng: '' })
  const [catalog, setCatalog] = useState([]) 
  const [selectedVariables, setSelectedVariables] = useState([]) 
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false) // Estado para el aviso de éxito

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const data = await devicesApi.catalog()
        setCatalog(data)
        setSelectedVariables(data.map(v => v.label))
      } catch (err) {
        console.error('Error cargando catálogo maestro:', err)
      }
    }
    fetchCatalog()
  }, [])

  const generateLabel = (text) => {
    return text
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
      .replace(/[^a-z0-9]+/g, '-') 
      .replace(/(^-|-$)+/g, ''); 
  }

  const handleToggleVariable = (label) => {
    if (selectedVariables.includes(label)) {
      setSelectedVariables(selectedVariables.filter(x => x !== label))
    } else {
      setSelectedVariables([...selectedVariables, label])
    }
  }

  const handleSelectAll = () => {
    if (selectedVariables.length === catalog.length) {
      setSelectedVariables([]) 
    } else {
      setSelectedVariables(catalog.map(v => v.label)) 
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = {
        orgId: clientId,
        name: form.name,
        label: form.label,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        selectedVariables
      }
      const device = await devicesApi.create(payload)
      
      // Muestra la vista de éxito
      setSuccess(true)
      
      // Espera 1.5s para dar feedback y refresca la lista
      setTimeout(() => {
        onAdd({
          id: device.id,
          name: device.name,
          label: device.label,
          // Corregido aquí también para priorizar 'pending'
          status: device.status === 'online' ? 'active' : (device.status || 'pending'),
          lat: device.lat,
          lng: device.lng,
          lastSeen: device.last_seen || null,
          serial: device.serial || device.label || `SNK-${String(device.id).slice(0, 3)}`,
          token: device.token
        })
        onClose()
      }, 1500)

    } catch (err) {
      setError(err.message || 'No se pudo crear el dispositivo')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-[24px] p-8 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        
        {success ? (
          /* Vista limpia de confirmación exitosa */
          <div className="flex flex-col items-center justify-center py-10 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-[#2BA8A0]/10 text-[#2BA8A0] rounded-full flex items-center justify-center mb-4 shadow-sm shadow-[#2BA8A0]/10">
              <Check size={32} strokeWidth={3} className="animate-in fade-in zoom-in duration-500 delay-100" />
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-2" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
              ¡Estación enlazada!
            </h3>
            <p className="text-sm max-w-[280px]" style={{ color: 'var(--text2)' }}>
              El dispositivo <strong>{form.name}</strong> se ha registrado correctamente en el sistema.
            </p>
          </div>
        ) : (
          /* Formulario estándar */
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Nuevo dispositivo</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text2)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                  {error}
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>Nombre del dispositivo</label>
                <input 
                  type="text" 
                  value={form.name} 
                  onChange={e => {
                    const newName = e.target.value;
                    setForm({
                      ...form, 
                      name: newName, 
                      label: generateLabel(newName) 
                    })
                  }} 
                  placeholder="Ej. Estación Central" 
                  className={INPUT} 
                  style={inputStyle} 
                  required 
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>Identificador único (Label/ID)</label>
                <input 
                  type="text" 
                  value={form.label} 
                  onChange={e => setForm({...form, label: e.target.value})} 
                  placeholder="Ej. estacion-central" 
                  className={INPUT} 
                  style={inputStyle} 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>Latitud</label>
                  <input type="number" step="any" value={form.lat} onChange={e => setForm({...form, lat: e.target.value})} placeholder="14.8347" className={INPUT} style={inputStyle} />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>Longitud</label>
                  <input type="number" step="any" value={form.lng} onChange={e => setForm({...form, lng: e.target.value})} placeholder="-91.5181" className={INPUT} style={inputStyle} />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>Ubicación en mapa</label>
                <MapPicker
                  lat={form.lat ? parseFloat(form.lat) : null}
                  lng={form.lng ? parseFloat(form.lng) : null}
                  onChange={({ lat, lng }) => setForm(prev => ({ ...prev, lat: lat.toFixed(6), lng: lng.toFixed(6) }))}
                  height={140}
                />
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold tracking-tight" style={{ color: 'var(--text)' }}>Variables a medir</label>
                  <button 
                    type="button" 
                    onClick={handleSelectAll} 
                    className="text-[11px] font-bold px-2 py-1 rounded bg-black/5 dark:bg-white/5 hover:opacity-80 transition-all"
                    style={{ color: COLORS.primary }}
                  >
                    {selectedVariables.length === catalog.length ? 'Desmarcar todas' : 'Seleccionar todas'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 border rounded-xl p-3 max-h-[160px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                  {catalog.map(v => {
                    const isSelected = selectedVariables.includes(v.label)
                    return (
                      <button
                        key={v.label}
                        type="button"
                        onClick={() => handleToggleVariable(v.label)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-semibold transition-all border ${
                          isSelected 
                            ? 'border-[#2BA8A0] bg-[#2BA8A0]/5 text-[#2BA8A0]' 
                            : 'border-transparent opacity-70'
                        }`}
                        style={!isSelected ? { color: 'var(--text)', background: 'var(--card)' } : {}}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#2BA8A0] border-[#2BA8A0]' : 'border-neutral-400'}`}>
                          {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className="truncate">{v.name} <span className="opacity-50 text-[10px]">({v.unit})</span></span>
                      </button>
                    )
                  })}
                  {catalog.length === 0 && (
                    <p className="text-center text-[11px] py-4 col-span-2" style={{ color: 'var(--text2)' }}>Cargando catálogo maestro...</p>
                  )}
                </div>
              </div>

              <div className="bg-[#2BA8A0]/10 rounded-xl p-4 text-xs font-medium text-[#2BA8A0]">
                El estado inicial será <strong>Pendiente</strong> hasta que reporte señal física.
              </div>
              
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 rounded-xl py-3 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text2)' }}>Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 text-white py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5" style={{ background: COLORS.primary, boxShadow: `0 4px 12px ${COLORS.primary}40` }}>{loading ? 'Creando...' : 'Crear'}</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function AdminClientDetail() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(EMPTY_CLIENT)
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [tab, setTab] = useState('devices')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [isEditing, setIsEditing] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '', email: '', phone: '', location: '', plan: 'free',
    contactName: '', nit: '', notes: ''
  })

  const statusConfig = {
    active:  { label: 'Activo',    bg: 'bg-[#2BA8A0]/10',    text: 'text-[#2BA8A0]' },
    pending: { label: 'Pendiente', bg: 'bg-amber-500/10',    text: 'text-amber-500' },
    offline: { label: 'Sin señal', bg: 'bg-red-500/10',       text: 'text-red-500' },
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const [org, devices] = await Promise.all([
          orgsApi.get(clientId),
          devicesApi.list(clientId)
        ])

        if (!active) return

        const currentClient = {
          id: org.id,
          name: org.name,
          email: org.email || '',
          phone: org.phone || '',
          location: org.location || '',
          plan: org.plan || 'free',
          status: org.status || 'active',
          paidUntil: org.paid_until || org.paidUntil || null,
          nit: org.nit || 'No registrado',
          contactName: org.contact_name || org.contactName || 'No registrado',
          notes: org.notes || '',
          devices: (devices || []).map(d => {
          // Determinamos el estado real basado en si alguna vez ha reportado señal
          let realStatus = 'pending';
          
          if (d.status === 'online') {
            realStatus = 'active';
          } else if (d.last_seen || d.lastSeen) {
            // Si tiene una fecha de última vez visto pero d.status no es 'online', entonces sí está caído (offline)
            realStatus = 'offline';
          } else {
            // Si no tiene fecha de última vez visto ni estatus online, es totalmente nuevo
            realStatus = 'pending';
          }

          return {
            id: d.id,
            name: d.name,
            label: d.label,
            status: realStatus, // <── Inyectamos el estado corregido aquí
            lat: d.lat,
            lng: d.lng,
            lastSeen: d.last_seen || d.lastSeen || null,
            serial: d.serial || d.label || `SNK-${String(d.id).slice(0, 3)}`,
            token: d.token
          };
        }),
          payments: []
        }

        setClient(currentClient)
        
        setEditForm({
          name: currentClient.name,
          email: currentClient.email,
          phone: currentClient.phone,
          location: currentClient.location,
          plan: currentClient.plan,
          contactName: currentClient.contactName === 'No registrado' ? '' : currentClient.contactName,
          nit: currentClient.nit === 'No registrado' ? '' : currentClient.nit,
          notes: currentClient.notes
        })

      } catch (err) {
        if (active) setLoadError(err.message || 'No se pudo cargar el cliente')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [clientId])

  const handleSaveChanges = async (e) => {
    e.preventDefault()
    setSaveLoading(true)
    setLoadError('')
    try {
      const data = await orgsApi.update(clientId, editForm)

      setClient(prev => ({
        ...prev,
        name: data.name,
        email: data.email,
        phone: data.phone,
        location: data.location,
        plan: data.plan,
        contactName: data.contact_name || data.contactName || editForm.contactName || 'No registrado',
        nit: data.nit || editForm.nit || 'No registrado',
        notes: data.notes || editForm.notes
      }))
      setIsEditing(false)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setSaveLoading(false)
    }
  }

  const planColor = { free: 'var(--text2)', pro: '#2BA8A0', enterprise: '#A78BFA' }

  return (
    <AdminLayout>
      {showAddDevice && (
        <AddDeviceModal
          clientId={clientId}
          onClose={() => setShowAddDevice(false)}
          onAdd={d => { setClient(prev => ({ ...prev, devices: [...prev.devices, d] })) }}
        />
      )}

      <div className="min-h-full py-4 lg:py-10 page-bg">
        
        <button onClick={() => navigate('/admin/clientes')} className="flex items-center gap-2 text-sm font-semibold mb-6 transition-colors hover:opacity-80 px-4 lg:px-0" style={{ color: 'var(--text2)' }}>
          <ArrowLeft size={16} /> Volver a clientes
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 pb-8 border-b px-4 lg:px-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm flex-shrink-0" style={{ background: 'rgba(103,183,232,0.15)', color: '#67B7E8' }}>
              {loading ? '...' : client.name[0]?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
                  {loading ? 'Cargando...' : client.name}
                </h1>
                <div className="flex gap-2 w-full sm:w-auto">
                  <span className={`text-xs font-bold px-3 py-1 rounded-lg ${client.status === 'active' ? 'bg-[#2BA8A0]/10 text-[#2BA8A0]' : 'bg-red-500/10 text-red-500'}`}>
                    {client.status === 'active' ? 'Activo' : 'Suspendido'}
                  </span>
                  <span className="text-xs font-bold px-3 py-1 rounded-lg capitalize" style={{ background: `${planColor[client.plan?.toLowerCase()] || 'var(--text2)'}15`, color: planColor[client.plan?.toLowerCase()] || 'var(--text2)' }}>
                    Plan {client.plan}
                  </span>
                </div>
              </div>
              <p className="text-sm mt-1.5" style={{ color: 'var(--text2)' }}>{client.location || 'Sin ubicación registrada'}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)} 
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 border rounded-xl px-5 py-3 text-sm font-bold transition-all hover:bg-black/5 dark:hover:bg-white/5" 
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                Editar Datos
              </button>
            ) : (
              <button 
                onClick={() => { setIsEditing(false); setLoadError('') }} 
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 border rounded-xl px-5 py-3 text-sm font-bold transition-all border-red-500/30 text-red-500 hover:bg-red-500/5"
              >
                Cancelar Edición
              </button>
            )}

            <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 border rounded-xl px-4 py-3 text-sm font-bold transition-all hover:bg-red-500/5" style={{ borderColor: 'var(--border)', color: '#EF4444' }}>
              <Ban size={16} /> <span className="hidden sm:inline">Suspender Cliente</span><span className="sm:hidden">Suspender</span>
            </button>
            <button onClick={() => setShowAddDevice(true)} className="w-full lg:w-auto flex items-center justify-center gap-2 text-white px-5 py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5" style={{ background: COLORS.primary, boxShadow: `0 4px 12px ${COLORS.primary}40` }}>
              <Plus size={16} strokeWidth={2.5} /> Enlazar Estación
            </button>
          </div>
        </div>

        {loadError && (
          <div className="mb-6 mx-4 lg:mx-0 rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
            {loadError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-4 lg:px-0">
          
          <div className="lg:col-span-1 space-y-6">
            
            {!isEditing ? (
              <div className="rounded-3xl p-6 border shadow-sm" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--text2)' }}>
                  <Receipt size={16} /> Datos de la cuenta
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs block font-medium" style={{ color: 'var(--text2)' }}>Nombre de la Org / Empresa</label>
                    <span className="text-sm font-semibold mt-1 block" style={{ color: 'var(--text)' }}>{client.name}</span>
                  </div>
                  <div>
                    <label className="text-xs block font-medium" style={{ color: 'var(--text2)' }}>Contacto Principal</label>
                    <span className="text-sm font-semibold flex items-center gap-1.5 mt-1" style={{ color: 'var(--text)' }}>
                      <User size={14} className="opacity-60" /> {client.contactName}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs block font-medium" style={{ color: 'var(--text2)' }}>Correo de Notificación</label>
                    <span className="text-sm font-mono mt-1 block select-all" style={{ color: 'var(--text)' }}>{client.email || 'No registrado'}</span>
                  </div>
                  <div>
                    <label className="text-xs block font-medium" style={{ color: 'var(--text2)' }}>NIT de Facturación</label>
                    <span className="text-sm font-mono font-bold mt-1 block" style={{ color: 'var(--text)' }}>{client.nit}</span>
                  </div>
                  <div>
                    <label className="text-xs block font-medium" style={{ color: 'var(--text2)' }}>Teléfono</label>
                    <span className="text-sm font-medium mt-1 block" style={{ color: 'var(--text)' }}>{client.phone || 'No registrado'}</span>
                  </div>
                  {client.notes && (
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <label className="text-xs block font-medium" style={{ color: 'var(--text2)' }}>Notas Internas</label>
                      <p className="text-xs mt-1 italic leading-relaxed" style={{ color: 'var(--text2)' }}>"{client.notes}"</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveChanges} className="rounded-3xl p-6 border shadow-sm space-y-4" style={{ background: 'var(--card)', borderColor: 'rgba(245,158,11,0.2)' }}>
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-500 flex items-center gap-2">
                  <Building2 size={16} /> Modificar Cuenta
                </h3>
                
                <div>
                  <label className="text-xs block font-medium mb-1.5" style={{ color: 'var(--text)' }}>Nombre Organización</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className={INPUT} style={inputStyle} required />
                </div>
                <div>
                  <label className="text-xs block font-medium mb-1.5" style={{ color: 'var(--text)' }}>Contacto Principal</label>
                  <input type="text" value={editForm.contactName} onChange={e => setEditForm({...editForm, contactName: e.target.value})} className={INPUT} style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs block font-medium mb-1.5" style={{ color: 'var(--text)' }}>Correo Electrónico</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className={INPUT} style={inputStyle} required />
                </div>
                <div>
                  <label className="text-xs block font-medium mb-1.5" style={{ color: 'var(--text)' }}>NIT</label>
                  <input type="text" value={editForm.nit} onChange={e => setEditForm({...editForm, nit: e.target.value})} className={INPUT} style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs block font-medium mb-1.5" style={{ color: 'var(--text)' }}>Teléfono</label>
                  <input type="text" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className={INPUT} style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs block font-medium mb-1.5" style={{ color: 'var(--text)' }}>Ubicación</label>
                  <input type="text" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} className={INPUT} style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs block font-medium mb-1.5" style={{ color: 'var(--text)' }}>Plan del Sistema</label>
                  <select value={editForm.plan} onChange={e => setEditForm({...editForm, plan: e.target.value})} className={INPUT} style={inputStyle}>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  disabled={saveLoading}
                  className="w-full text-white py-3 rounded-xl text-sm font-bold transition-all bg-amber-500 hover:bg-amber-600"
                >
                  {saveLoading ? 'Guardando cambios...' : 'Guardar Datos'}
                </button>
              </form>
            )}

            <CredentialsCard clientId={clientId} />

          </div>

          <div className="lg:col-span-2 space-y-6">
            
            <div className="flex gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
              {[
                { id: 'devices', label: 'Estaciones Enlazadas', icon: <Smartphone size={16} /> },
                { id: 'payments', label: 'Historial de Pagos', icon: <CreditCard size={16} /> }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all -mb-[1px] border-b-2"
                  style={{ 
                    borderColor: tab === t.id ? COLORS.primary : 'transparent',
                    color: tab === t.id ? 'var(--text)' : 'var(--text2)'
                  }}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'devices' && (
              <div className="space-y-4">
                {client.devices.map(d => {
                  const sc = statusConfig[d.status] || statusConfig.pending
                  
                  return (
                    <div 
                      key={d.id} 
                      onClick={() => navigate(`/admin/clientes/${clientId}/dispositivo/${d.id}`)}
                      className="rounded-2xl p-5 border shadow-sm transition-all hover:bg-black/[0.02] dark:hover:bg-white/[0.02] hover:shadow-md flex items-center justify-between gap-4 cursor-pointer group" 
                      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="text-sm font-bold group-hover:text-[#67B7E8] transition-colors" style={{ color: 'var(--text)' }}>
                            {d.name}
                          </span>
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${sc.bg} ${sc.text}`}>
                            {sc.label}
                          </span>
                          <span className="text-xs font-mono px-2 py-0.5 bg-black/5 dark:bg-white/5 rounded-md" style={{ color: 'var(--text2)' }}>
                            {d.serial}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium" style={{ color: 'var(--text2)' }}>
                          {d.lat && <span className="flex items-center gap-1"><MapPin size={12} />{d.lat?.toFixed(4)}, {d.lng?.toFixed(4)}</span>}
                          {d.lastSeen && <span className="flex items-center gap-1"><Clock size={12} />Visto: {new Date(d.lastSeen).toLocaleString('es-GT')}</span>}
                          <span className="font-mono bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded">Token: {String(d.token || d.id).slice(0,8)}...</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl transition-all group-hover:translate-x-1 group-hover:text-[#67B7E8]" style={{ color: 'var(--text2)' }}>
                          <ChevronRight size={18} />
                        </div>
                      </div>
                    </div>
                  )
                })}

                {client.devices.length === 0 && (
                  <div className="text-center py-12 rounded-3xl border border-dashed" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>No hay estaciones enlazadas</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>Hacé clic en "Enlazar Estación" para agregar la primera.</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'payments' && (
              <div className="rounded-3xl border shadow-sm overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px] lg:min-w-full">
                    <thead>
                      <tr className="border-b bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: 'var(--border)' }}>
                        {['Fecha de Cobro','Monto Facturado','Estado','Comentarios',''].map(h => (
                          <th key={h} className="text-xs font-bold px-6 py-4 uppercase tracking-wider" style={{ color: 'var(--text2)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {client.payments.map(p => (
                        <tr key={p.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                          <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--text)' }}>{new Date(p.date).toLocaleDateString('es-GT')}</td>
                          <td className="px-6 py-4 text-sm font-bold" style={{ color: 'var(--text)' }}>Q{p.amount}</td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${p.status === 'paid' ? 'bg-[#2BA8A0]/10 text-[#2BA8A0]' : 'bg-amber-500/10 text-amber-500'}`}>
                              {p.status === 'paid' ? 'Pagado' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs" style={{ color: 'var(--text2)' }}>{p.note || '—'}</td>
                          <td className="px-6 py-4 text-right">
                            {p.status === 'pending' && (
                              <button onClick={() => setClient(prev => ({ ...prev, payments: prev.payments.map(x => x.id === p.id ? { ...x, status: 'paid' } : x) }))} className="flex items-center gap-1 bg-[#2BA8A0]/10 hover:bg-[#2BA8A0]/20 text-[#2BA8A0] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                                <CheckCircle size={12} /> Validar pago
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {client.payments.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-sm" style={{ color: 'var(--text2)' }}>
                            No hay registros de transacciones para este cliente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </AdminLayout>
  )
}