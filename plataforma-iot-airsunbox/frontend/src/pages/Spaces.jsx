import ScrollHint from '../components/ScrollHint'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ClienteLayout from '../components/airsunbox/ClienteLayout'
import EditSpaceModal from '../components/airsunbox/EditSpaceModal'
import { spaces as spacesApi } from '../services/api'
import {
  Plus, X, Check, ChevronDown, Pencil, ArrowRight,
  Layers, Server
} from 'lucide-react'
import { spaceIcon, generateLabel, SPACE_TYPES, SPACE_ICONS, SPACE_COLORS } from './spaceUtils'
import ColorPicker from '../components/airsunbox/ColorPicker'

const COLORS = { primary: '#67B7E8' }

export default function Spaces() {
  const navigate = useNavigate()

  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)

  const [creating, setCreating] = useState(false)   // modal nuevo espacio
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('aire')
  const [newCustomType, setNewCustomType] = useState('')
  const [newCustomIcon, setNewCustomIcon] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newColor, setNewColor] = useState('#67B7E8')

  const [editingSpace, setEditingSpace] = useState(null)   // modal editar espacio

  const loadSpaces = () => {
    spacesApi.list()
      .then(d => { setList(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadSpaces()
  }, [])

  const TYPE_ICONS = { aire: 'aire', agua: 'agua', suelo: 'suelo', ruido: 'ruido' }

  const createSpace = async () => {
    if (!newName.trim()) return
    const finalType = newType === 'otro' ? (newCustomType.trim() || 'otro') : newType
    const finalIcon = newCustomIcon || TYPE_ICONS[finalType] || 'otro'
    const s = await spacesApi.create({
      name: newName.trim(),
      slug: generateLabel(newName.trim()),
      type: finalType,
      icon: finalIcon,
      color: newColor || '#67B7E8',
      description: newDescription.trim()
    })
    setCreating(false)
    setNewName(''); setNewType('aire'); setNewCustomType(''); setNewCustomIcon(''); setNewDescription(''); setNewColor('#67B7E8')
    await loadSpaces()
    navigate(`/espacios/${s.id}`)
  }

  const onSaved = (updated) => {
    setEditingSpace(null)
    setList(prev => prev.map(sp => (sp.id === updated.id ? { ...sp, ...updated } : sp)))
  }

  return (
    <ClienteLayout>
      {editingSpace && (
        <EditSpaceModal
          space={editingSpace}
          onClose={() => setEditingSpace(null)}
          onSaved={onSaved}
        />
      )}
      <div className="min-h-full px-4 py-6 md:px-8 md:py-10 page-bg">
        <header className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-11 h-11 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(103,183,232,0.14)', color: COLORS.primary }} aria-hidden="true">
              <Layers size={22} strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-[1.9rem] md:text-[2.4rem] font-extrabold leading-[1.1]" style={{ color: 'var(--text)' }}>
                Espacios
              </h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--text2)' }}>
                {list.length
                  ? `${list.length} ${list.length === 1 ? 'espacio' : 'espacios'} · ${list.reduce((n, sp) => n + Number(sp.device_count || 0), 0)} estaciones en total`
                  : 'Agrupá tus estaciones y medí la calidad de cada lugar'}
              </p>
            </div>
          </div>
          {list.length > 0 && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors hover:bg-[#55A6D7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B7E8]/40"
              style={{ background: COLORS.primary }}
            >
              <Plus size={16} /> Nuevo espacio
            </button>
          )}
        </header>

        {/* ── Vista de lista ── */}
        {loading ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--text2)' }}>Cargando espacios…</div>
        ) : list.length === 0 ? (
          <section className="rounded-2xl border px-6 py-12 md:py-16 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <span className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'rgba(103,183,232,0.14)', color: COLORS.primary }} aria-hidden="true">
              <Layers size={26} strokeWidth={2} />
            </span>
            <h2 className="mt-5 font-display text-xl md:text-2xl font-extrabold" style={{ color: 'var(--text)' }}>Creá tu primer espacio</h2>
            <p className="mt-2 text-sm max-w-md mx-auto" style={{ color: 'var(--text2)' }}>
              Un espacio agrupa las estaciones de un lugar o de un tipo de medición, con sus propias variables y su índice de calidad.
            </p>
            <p className="mt-6 text-xs font-semibold" style={{ color: 'var(--text2)' }}>¿Qué querés monitorear?</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {SPACE_TYPES.map(t => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => { setNewType(t.v); if (t.v !== 'otro') setNewCustomIcon(t.v); setNewColor(t.color); setCreating(true) }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B7E8]/40"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.color = t.color }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' }}
                >
                  <t.icon size={16} style={{ color: t.color }} /> {t.label}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {list.map(s => {
              const color = s.color || COLORS.primary
              const typeLabel = SPACE_TYPES.find(t => t.v === s.type)?.label || (s.type ? s.type.charAt(0).toUpperCase() + s.type.slice(1) : 'Otro')
              const count = Number(s.device_count ?? 0)
              return (
                <div
                  key={s.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/espacios/${s.id}`)}
                  onKeyDown={e => { if (e.key === 'Enter') navigate(`/espacios/${s.id}`) }}
                  className="group rounded-2xl p-5 border cursor-pointer transition-colors flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B7E8]/40"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = color + '80' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <div className="flex items-start justify-between">
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: color + '1F', color }}>
                      {spaceIcon(s.icon, s.type, 20)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditingSpace(s) }}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-70 focus-visible:opacity-100 transition-opacity hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ color: 'var(--text2)' }}
                      aria-label={`Editar ${s.name}`}
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                  <h3 className="mt-4 text-base font-bold truncate" style={{ color: 'var(--text)' }}>{s.name}</h3>
                  <p className="mt-1 text-sm line-clamp-2 min-h-[2.5rem]" style={{ color: 'var(--text2)' }}>
                    {s.description || `Monitoreo de ${typeLabel.toLowerCase()}`}
                  </p>
                  <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm" style={{ borderColor: 'var(--border)' }}>
                    <span className="inline-flex items-center gap-2" style={{ color: 'var(--text2)' }}>
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: color + '1A', color }}>{typeLabel}</span>
                      <span className="inline-flex items-center gap-1"><Server size={13} /> {count} {count === 1 ? 'estación' : 'estaciones'}</span>
                    </span>
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" style={{ color }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Modal nuevo espacio ── */}
        {creating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <ScrollHint />
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Nuevo espacio</h3>
                <button onClick={() => setCreating(false)} style={{ color: 'var(--text2)' }}><X size={18} /></button>
              </div>
              <label className="text-xs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--text2)' }}>Nombre</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Ej: Calidad de agua"
                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none mb-1"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
              {newName.trim() && (
                <div className="flex items-center gap-1.5 mb-3 text-xs font-mono px-1" style={{ color: 'var(--text2)' }}>
                  <Check size={12} /> slug: {generateLabel(newName.trim())}
                </div>
              )}

              <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text2)' }}>Tipo de monitoreo</label>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {SPACE_TYPES.map(t => (
                  <button
                    key={t.v}
                    type="button"
                    onClick={() => { setNewType(t.v); if (t.v !== 'otro') setNewCustomIcon(t.v) }}
                    className="flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[11px] font-bold transition-all outline-none"
                    style={{
                      borderColor: newType === t.v ? t.color : 'var(--border)',
                      background: newType === t.v ? t.color + '18' : 'var(--bg)',
                      color: newType === t.v ? t.color : 'var(--text2)',
                      boxShadow: newType === t.v ? `0 0 0 2px ${t.color}40` : 'none'
                    }}
                  >
                    <t.icon size={18} />
                    {t.label}
                  </button>
                ))}
              </div>

              {newType === 'otro' && (
                <>
                  <label className="block mb-4">
                    <span className="text-xs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--text2)' }}>Nombre de tu tipo</span>
                    <input
                      value={newCustomType}
                      onChange={e => setNewCustomType(e.target.value)}
                      placeholder="Ej: Presión"
                      className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                    />
                  </label>

                  <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text2)' }}>Elegí un icono</label>
                  <div className="grid grid-cols-8 gap-2 mb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {SPACE_ICONS.map(ic => (
                      <button
                        key={ic.n}
                        type="button"
                        onClick={() => setNewCustomIcon(ic.n)}
                        className="flex items-center justify-center rounded-xl border py-3 transition-all outline-none"
                        style={{
                          borderColor: newCustomIcon === ic.n ? newColor : 'var(--border)',
                          background: newCustomIcon === ic.n ? newColor + '18' : 'var(--bg)',
                          color: newCustomIcon === ic.n ? newColor : 'var(--text2)',
                          boxShadow: newCustomIcon === ic.n ? `0 0 0 2px ${newColor}40` : 'none'
                        }}
                      >
                        <ic.Icon size={18} />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    tabIndex={-1}
                    className="block mx-auto animate-bounce transition-all mb-4"
                    style={{ color: 'var(--text2)', cursor: 'default' }}
                    title="Hay más iconos — deslizá"
                  >
                    <ChevronDown size={16} />
                  </button>
                </>
              )}

              <ColorPicker value={newColor} onChange={setNewColor} label="Color de espacio" />
              <br />
              <br />
              <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text2)' }}>Descripción (opcional)</label>
              <br />
              <textarea
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="Ej: Red de sensores subterráneos..."
                rows={3}
                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none mb-4 resize-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setCreating(false)} className="px-4 py-2.5 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>Cancelar</button>
                <button onClick={createSpace} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: newColor || '#67B7E8' }}>Crear</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ClienteLayout>
  )
}