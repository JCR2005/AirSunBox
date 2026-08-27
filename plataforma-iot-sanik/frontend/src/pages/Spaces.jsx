import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ClienteLayout from '../components/sanik/ClienteLayout'
import EditSpaceModal from '../components/sanik/EditSpaceModal'
import { spaces as spacesApi } from '../services/api'
import {
  Plus, X, Check, ChevronDown, Pencil, ArrowRight,
  Layers, Server
} from 'lucide-react'
import { spaceIcon, generateLabel, SPACE_TYPES, SPACE_ICONS, SPACE_COLORS } from './spaceUtils'
import ColorPicker from '../components/sanik/ColorPicker'

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
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1 font-syne" style={{ color: 'var(--text)' }}>
              Espacios
            </h1>
            <p className="text-xs md:text-sm" style={{ color: 'var(--text2)' }}>
              Gestioná tus espacios y el índice de calidad de cada uno
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: '#67B7E8' }}
          >
            <Plus size={16} /> Nuevo espacio
          </button>
        </div>

        {/* ── Vista de lista ── */}
        {loading ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--text2)' }}>Cargando...</div>
        ) : list.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
            <Layers size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Aún no tenés espacios</p>
            <button
              onClick={() => setCreating(true)}
              className="mt-5 inline-flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
              style={{ background: '#67B7E8' }}
            >
              <Plus size={15} /> Crear el primero
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map(s => (
              <div
                key={s.id}
                onClick={() => navigate(`/espacios/${s.id}`)}
                className="group rounded-2xl p-5 border cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: (s.color || '#67B7E8') + '1F', color: s.color || '#67B7E8' }}>
                    {spaceIcon(s.icon, s.type, 18)}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditingSpace(s) }}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-60 transition-opacity hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ color: 'var(--text2)' }}
                    title="Editar espacio"
                  >
                    <Pencil size={15} />
                  </button>
                </div>
                <h3 className="font-bold text-sm mb-1" style={{ color: 'var(--text)' }}>{s.name}</h3>
                <span className="text-xs font-mono uppercase" style={{ color: s.color || '#67B7E8' }}>{s.slug}</span>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[11px]" style={{ color: 'var(--text2)' }}>{s.type}</p>
                  <span className="text-[11px] font-semibold flex items-center gap-1" style={{ color: 'var(--text2)' }}>
                    <Server size={11} /> {s.device_count ?? 0} {s.device_count === 1 ? 'estación' : 'estaciones'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold mt-3 group-hover:gap-2 transition-all" style={{ color: s.color || '#67B7E8' }}>
                  Ver espacio <ArrowRight size={11} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Modal nuevo espacio ── */}
        {creating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
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