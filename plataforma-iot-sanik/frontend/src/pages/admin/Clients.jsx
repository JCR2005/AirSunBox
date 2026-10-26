import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { Search, Plus, X, ChevronRight, Building2 } from 'lucide-react'
import { organizations as orgsApi } from '../../services/api'

const MOCK_CLIENTS = [
  { id: '1', name: 'Municipalidad Xela', slug: 'municipalidad-xela', plan: 'Pro', devices: 3, activeDevices: 2, email: 'admin@xela.gob.gt', phone: '77612345', location: 'Quetzaltenango', status: 'active', paidUntil: '2026-06-01', createdAt: '2026-01-15' },
  { id: '2', name: 'CUNOC', slug: 'cunoc', plan: 'Empresarial', devices: 2, activeDevices: 2, email: 'investigacion@cunoc.edu.gt', phone: '77612346', location: 'Quetzaltenango', status: 'active', paidUntil: '2026-07-01', createdAt: '2026-02-01' },
  { id: '3', name: 'Empresa Industrial S.A.', slug: 'empresa-industrial', plan: 'Pro', devices: 1, activeDevices: 1, email: 'admin@industrial.com', phone: '55123456', location: 'Xela, Zona Industrial', status: 'suspended', paidUntil: '2026-04-01', createdAt: '2026-03-10' },
]

// Estilos consistentes con el nuevo diseño
const COLORS = { primary: "#67B7E8", primaryHover: "#55A6D7" }
const INPUT = "w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[#67B7E8]/20 focus:border-[#67B7E8]"
const inputStyle = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }

function CreateClientModal({ onClose, onCreate }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ 
    orgName: '', 
    contactName: '', 
    nit: '', 
    email: '', 
    phone: '', 
    location: '', 
    plan: 'free',
    notes: '',
    type: 'A'
  })

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = {
        orgName: form.orgName,
        contactName: form.contactName || undefined,
        nit: form.nit || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        location: form.location || undefined,
        plan: form.plan,
        notes: form.notes || undefined,
        type: form.type
      }
      const res = await orgsApi.create(payload)
      const created = res?.org || res?.organization || res
      onCreate(created)
    } catch (err) {
      setError(err.message || 'No se pudo crear el cliente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
      <div className="rounded-[24px] p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Nuevo cliente</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>Registrá una nueva organización y su contacto principal.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ color: 'var(--text2)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>
                Tipo de cliente
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, type: 'A' }))}
                  className="text-left rounded-2xl border p-4 transition-all"
                  style={form.type === 'A'
                    ? { background: '#67B7E8', borderColor: '#67B7E8', color: 'white', boxShadow: '0 4px 12px rgba(103,183,232,0.4)' }
                    : { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text2)' }}
                >
                  <div className="text-sm font-bold mb-0.5">Dependiente</div>
                  <div className="text-[11px] opacity-75 leading-snug">Gestionado por Sanik. Ve sus estaciones directamente.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, type: 'B' }))}
                  className="text-left rounded-2xl border p-4 transition-all"
                  style={form.type === 'B'
                    ? { background: '#2BA8A0', borderColor: '#2BA8A0', color: 'white', boxShadow: '0 4px 12px rgba(43,168,160,0.4)' }
                    : { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text2)' }}
                >
                  <div className="text-sm font-bold mb-0.5">Independiente</div>
                  <div className="text-[11px] opacity-75 leading-snug">Self-service. Gestiona espacios con sus dispositivos.</div>
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>
                Nombre de la organización* <span style={{ color: '#EF4444' }}>*</span>
              </label>            
              <input className={INPUT} style={inputStyle} value={form.orgName} onChange={set('orgName')} placeholder="Ej. Municipalidad de Xela" required />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>
                Nombre del contacto principal* <span style={{ color: 'var(--text2)', fontWeight: 'normal' }}>(Opcional)</span>
              </label>            
              <input className={INPUT} style={inputStyle} value={form.contactName} onChange={set('contactName')} placeholder="Ej. Juan Pérez" />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>
                Correo electrónico* <span style={{ color: 'var(--text2)', fontWeight: 'normal' }}>(Opcional)</span>
              </label>
              <input className={INPUT} style={inputStyle} type="email" value={form.email} onChange={set('email')} placeholder="admin@org.com" />
            </div>
            
            <div>
              <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>
                Teléfono <span style={{ color: 'var(--text2)', fontWeight: 'normal' }}>(Opcional)</span>
              </label>
              <input
                className={INPUT} style={inputStyle}
                value={form.phone}
                onChange={e => {
                  const d = e.target.value.replace(/\D/g, '').slice(0, 8)
                  setForm(prev => ({ ...prev, phone: d.length > 4 ? `${d.slice(0,4)}-${d.slice(4)}` : d }))
                }}
                placeholder="7761-2345"
                maxLength={9}
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>
                NIT <span style={{ color: 'var(--text2)', fontWeight: 'normal' }}>(Opcional)</span>
              </label>
              <input className={INPUT} style={inputStyle} value={form.nit} onChange={set('nit')} placeholder="Ej. 1234567-8" />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>
                Ubicación <span style={{ color: 'var(--text2)', fontWeight: 'normal' }}>(Opcional)</span>
              </label>
              <input className={INPUT} style={inputStyle} value={form.location} onChange={set('location')} placeholder="Quetzaltenango, Guatemala" />
            </div>
          </div>
        
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>Plan inicial</label>
            <select className={INPUT} style={inputStyle} value={form.plan} onChange={set('plan')}>
              <option value="free">Gratuito — Q0/mes</option>
              <option value="pro">Pro — Q299/mes</option>
              <option value="enterprise">Empresarial — Personalizado</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text)' }}>
              Notas internas <span style={{ color: 'var(--text2)', fontWeight: 'normal' }}>(Opcional)</span>
            </label>
            <textarea 
              className={`${INPUT} resize-none`} 
              style={{ ...inputStyle, minHeight: '80px' }} 
              value={form.notes} 
              onChange={set('notes')} 
              placeholder="Detalles de facturación, requerimientos de instalación..." 
              rows={3}
            />
          </div>
           
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl py-3 text-sm font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text2)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 text-white py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 hover:-translate-y-0.5" style={{ background: COLORS.primary, boxShadow: `0 4px 12px ${COLORS.primary}40` }}>
              {loading ? 'Creando...' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminClients() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [tab, setTab] = useState('todas')
  const [busy, setBusy] = useState(null)
  
  // ESTADO NUEVO: Para manejar la notificación de éxito
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const data = await orgsApi.list()
        const mapped = (data || []).map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan ? org.plan[0].toUpperCase() + org.plan.slice(1) : '—',
          devices: org.device_count ?? org.devices ?? 0,
          activeDevices: org.active_devices ?? org.activeDevices ?? 0,
          email: org.email || '',
          phone: org.phone || '',
          location: org.location || '',
          status: org.status || 'active',
          paidUntil: org.paid_until || org.paidUntil || null,
          createdAt: org.created_at || org.createdAt || null,
          type: org.type || null,
          category: org.category || (org.type === 'B' ? 'independiente' : 'dependiente'),
          bCategory: org.b_category || 'estandar',
          paymentExempt: !!org.payment_exempt,
          spaceCount: org.space_count ?? 0,
          accountType: org.account_type || 'organizacion'
        }))
        if (active) setClients(mapped)
      } catch (err) {
        if (active) {
          setLoadError(err.message || 'No se pudieron cargar los clientes')
          setClients(MOCK_CLIENTS)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [])

  const filtered = clients.filter(c => {
    if (tab === 'dependientes' && c.category !== 'dependiente') return false
    if (tab === 'independientes' && c.category !== 'independiente') return false
    return (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
           (c.email || '').toLowerCase().includes(search.toLowerCase())
  })

  const flash = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const onToggleExempt = async (c) => {
    const next = !c.paymentExempt
    setBusy(`exempt:${c.id}`)
    try {
      await orgsApi.setPaymentExempt(c.id, next)
      setClients(prev => prev.map(x => x.id === c.id ? { ...x, paymentExempt: next } : x))
      flash(next ? 'Organización exonerada de pago' : 'Exoneración removida')
    } catch (err) {
      setLoadError(err.message || 'No se pudo actualizar')
      setTimeout(() => setLoadError(''), 4000)
    } finally {
      setBusy(null)
    }
  }

  const onSetBType = async (c, bCategory) => {
    setBusy(`bcategory:${c.id}`)
    try {
      await orgsApi.setBCategory(c.id, bCategory)
      setClients(prev => prev.map(x => x.id === c.id ? { ...x, bCategory } : x))
      flash('Categoría de plan actualizada')
    } catch (err) {
      setLoadError(err.message || 'No se pudo actualizar')
      setTimeout(() => setLoadError(''), 4000)
    } finally {
      setBusy(null)
    }
  }

  const planColor = { free: 'var(--text2)', pro: '#2BA8A0', empresarial: '#A78BFA', enterprise: '#A78BFA' }
  const statusBadge = { active: 'bg-[#2BA8A0]/10 text-[#2BA8A0]', suspended: 'bg-red-500/10 text-red-500', pending: 'bg-amber-500/10 text-amber-500' }
  const statusLabel = { active: 'Activo', suspended: 'Suspendido', pending: 'Pendiente' }

  return (
    <AdminLayout>
      {/* ALERTA DE ÉXITO FLOTANTE (Toast) */}
      {successMsg && (
        <div className="fixed bottom-10 right-10 z-50 animate-bounce">
          <div className="bg-[#1D9E75] text-white px-6 py-3 rounded-2xl shadow-xl font-medium text-sm flex items-center gap-3">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            {successMsg}
          </div>
        </div>
      )}

      {showModal && (
        <CreateClientModal
          onClose={() => setShowModal(false)}
          onCreate={c => {
            const normalized = {
              id: c.id, name: c.name, slug: c.slug,
              plan: c.plan ? c.plan[0].toUpperCase() + c.plan.slice(1) : '—',
              devices: c.device_count ?? c.devices ?? 0,
              activeDevices: c.active_devices ?? c.activeDevices ?? 0,
              email: c.email || '', phone: c.phone || '', location: c.location || '',
              status: c.status || 'active', paidUntil: c.paid_until || c.paidUntil || null,
              createdAt: c.created_at || c.createdAt || new Date().toISOString(),
              type: c.type || 'A',
              category: c.category || 'dependiente',
              bCategory: c.b_category || 'estandar',
              paymentExempt: !!c.payment_exempt,
              spaceCount: c.space_count ?? 0,
              accountType: c.account_type || 'organizacion'
            }
            setClients(prev => [normalized, ...prev])
            setShowModal(false)
            
            // LÍNEAS NUEVAS: Mostrar el mensajito por 3 segundos
            setSuccessMsg('¡Cliente registrado exitosamente!')
            setTimeout(() => setSuccessMsg(''), 3000)
          }}
        />
      )}
      
      <div 
        className="min-h-full py-4 lg:py-6 page-bg"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
              Gestión de Clientes
            </h1>
            <p className="text-base mt-2" style={{ color: 'var(--text2)' }}>
              {loading ? 'Sincronizando con la base de datos...' : `Tenés ${clients.length} organizaciones operando actualmente.`}
            </p>
          </div>
          <button 
            onClick={() => setShowModal(true)} 
            className="flex items-center justify-center gap-2 text-white px-5 py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
            style={{ background: COLORS.primary, boxShadow: `0 4px 12px ${COLORS.primary}40` }}
          >
            <Plus size={18} strokeWidth={2.5} /> Registrar cliente
          </button>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl px-5 py-4 text-sm font-medium flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
            <Building2 size={18} />
            {loadError} — Mostrando datos de prueba.
          </div>
        )}

        {/* Tabs por clasificación */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          {[
            { key: 'todas', label: 'Todas', count: clients.length },
            { key: 'dependientes', label: 'Dependientes', count: clients.filter(c => c.category === 'dependiente').length },
            { key: 'independientes', label: 'Independientes', count: clients.filter(c => c.category === 'independiente').length }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={tab === t.key
                ? { background: COLORS.primary, color: '#fff', boxShadow: `0 4px 12px ${COLORS.primary}40` }
                : { color: 'var(--text2)', border: '1px solid var(--border)', background: 'transparent' }}
            >
              {t.label} <span className="opacity-75 font-semibold">({t.count})</span>
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="relative mb-8 group">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-[#67B7E8]" style={{ color: 'var(--text2)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar organización..."
            className="w-full max-w-xl border rounded-2xl pl-12 pr-4 py-3.5 text-sm outline-none transition-all focus:ring-4 focus:ring-[#67B7E8]/10 focus:border-[#67B7E8]"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)', boxShadow: '0 2px 10px rgba(0,0,0,0.01)' }}
          />
        </div>

        {/* Tabla de Clientes - Mobile Scroll */}
        <div className="rounded-3xl shadow-sm border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px] lg:min-w-full">
              <thead>
                <tr className="border-b bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: 'var(--border)' }}>
                  {['Organización', 'Plan actual', 'Dispositivos', 'Categoría', 'Estado', 'Suscripción hasta', ''].map(h => (
                    <th key={h} className="text-xs font-bold px-6 py-4 uppercase tracking-wider" style={{ color: 'var(--text2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr 
                    key={c.id} 
                    onClick={() => navigate(`/admin/clientes/${c.id}`)}
                    className="border-b last:border-0 cursor-pointer transition-all hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-base shadow-sm flex-shrink-0" style={{ background: 'rgba(103,183,232,0.15)', color: '#67B7E8' }}>
                          {c.name[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate max-w-[150px] lg:max-w-none" style={{ color: 'var(--text)' }}>{c.name}</div>
                          <div className="text-xs font-medium mt-0.5 truncate max-w-[150px] lg:max-w-none" style={{ color: 'var(--text2)' }}>{c.email || 'Sin correo registrado'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-bold px-3 py-1.5 rounded-lg" style={{ background: `${planColor[c.plan?.toLowerCase()] || 'var(--text2)'}15`, color: planColor[c.plan?.toLowerCase()] || 'var(--text2)' }}>
                        {c.plan}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                          {Number(c.devices) === 0 ? 'Sin dispositivos' : `${c.activeDevices} de ${c.devices}`}
                        </span>
                        {Number(c.devices) > 0 && (
                          <span className="text-xs font-medium" style={{ color: 'var(--text2)' }}>
                            En línea
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5 min-w-[150px]">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg w-fit ${c.category === 'independiente' ? 'bg-[#2BA8A0]/10 text-[#2BA8A0]' : 'bg-[#67B7E8]/10 text-[#67B7E8]'}`}>
                          {c.category === 'independiente' ? 'Independiente' : 'Dependiente'}
                        </span>
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--text2)' }}>
                          {c.accountType === 'individual' ? 'Individual' : 'Organización'}
                        </span>
                        {c.category === 'independiente' && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <select
                              value={c.bCategory}
                              disabled={busy === `bcategory:${c.id}`}
                              onDoubleClick={e => e.stopPropagation()}
                              onClick={e => e.stopPropagation()}
                              onChange={e => onSetBType(c, e.target.value)}
                              className="text-xs font-semibold rounded-lg px-2 py-1 outline-none border cursor-pointer"
                              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                            >
                              <option value="estandar">Estándar</option>
                              <option value="especial">Especial</option>
                            </select>
                            <label
                              className="flex items-center gap-1.5 cursor-pointer select-none"
                              onClick={e => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={c.paymentExempt}
                                disabled={busy === `exempt:${c.id}`}
                                onChange={() => onToggleExempt(c)}
                                className="w-3.5 h-3.5 rounded border-gray-300"
                              />
                              <span className="text-[11px] font-semibold" style={{ color: 'var(--text2)' }}>Exento</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${statusBadge[c.status]}`}>
                        {statusLabel[c.status]}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm font-medium" style={{ color: 'var(--text2)' }}>
                      {c.paidUntil ? new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(c.paidUntil)) : 'Ilimitado'}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="inline-flex p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <ChevronRight size={18} style={{ color: 'var(--text2)' }} />
                      </div>
                    </td>
                  </tr>
                ))}
                
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3" style={{ background: 'var(--border)' }}>
                        <Search size={20} style={{ color: 'var(--text2)' }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>No se encontraron resultados</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>Intenta con otro término de búsqueda.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}