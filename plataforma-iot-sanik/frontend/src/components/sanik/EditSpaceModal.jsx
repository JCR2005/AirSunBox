import { useState } from 'react'
import { X, Check, ChevronDown } from 'lucide-react'
import { spaces as spacesApi } from '../../services/api'
import { generateLabel, SPACE_TYPES, SPACE_ICONS, SPACE_COLORS } from '../../pages/spaceUtils'
import ColorPicker from '../sanik/ColorPicker'

const INPUT = "w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#67B7E8]/20 focus:border-[#67B7E8]"
const inputStyle = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }
const ACTIVE_TYPES = ['aire', 'agua', 'suelo', 'ruido', 'otro']
const DEFAULT_COLOR = '#67B7E8'

export default function EditSpaceModal({ space, onClose, onSaved }) {
  const isCustom = !ACTIVE_TYPES.includes(space.type)
  const [name, setName] = useState(space.name || '')
  const [description, setDescription] = useState(space.description || '')
  const [type, setType] = useState(isCustom ? 'otro' : space.type)
  const [customType, setCustomType] = useState(isCustom ? space.type : '')
  const [icon, setIcon] = useState(space.icon || '')
  const [color, setColor] = useState(space.color || DEFAULT_COLOR)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const finalType = type === 'otro' ? (customType.trim() || 'otro') : type

  const save = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError('')
    try {
      const updated = await spacesApi.update(space.id, {
        name: name.trim(),
        description: description.trim(),
        type: finalType,
        icon: icon || 'map-pin',
        color
      })
      onSaved(updated)
    } catch (err) {
      setError(err.message || 'No se pudo guardar el espacio')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Editar espacio</h3>
          <button onClick={onClose} style={{ color: 'var(--text2)' }}><X size={18} /></button>
        </div>

        {/* Slug (auto-generado, solo lectura) */}
        <div className="flex items-center gap-1.5 mb-4 px-1 text-xs font-mono" style={{ color: 'var(--text2)' }}>
          <Check size={12} /> slug: {generateLabel(name.trim() || space.slug)}
        </div>

        <label className="text-xs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--text2)' }}>Nombre</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className={INPUT + " mb-3 w-full"}
          style={inputStyle}
        />

        <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text2)' }}>Tipo de monitoreo</label>
        <div className="grid grid-cols-5 gap-2 mb-3">
          {SPACE_TYPES.map(t => (
            <button
              key={t.v}
              type="button"
              onClick={() => setType(t.v)}
              className="flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-[11px] font-bold transition-all outline-none"
              style={{
                borderColor: type === t.v ? t.color : 'var(--border)',
                background: type === t.v ? t.color + '18' : 'var(--bg)',
                color: type === t.v ? t.color : 'var(--text2)',
                boxShadow: type === t.v ? `0 0 0 2px ${t.color}40` : 'none'
              }}
            >
              <t.icon size={17} />
              {t.label}
            </button>
          ))}
        </div>

        {type === 'otro' && (
          <label className="block mb-3">
            <span className="text-xs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--text2)' }}>Nombre de tu tipo</span>
            <input
              value={customType}
              onChange={e => setCustomType(e.target.value)}
              placeholder="Ej: Presión"
              className={INPUT + " w-full"}
              style={inputStyle}
            />
          </label>
        )}

        {type === 'otro' && (
          <>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text2)' }}>Elegí un icono</label>
            <div className="grid grid-cols-8 gap-2 mb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ maxHeight: 200, overflowY: 'auto' }}>
              {SPACE_ICONS.map(ic => (
                <button
                  key={ic.n}
                  type="button"
                  onClick={() => setIcon(ic.n)}
                  className="flex items-center justify-center rounded-xl border py-3 transition-all outline-none"
                  style={{
                    borderColor: icon === ic.n ? color : 'var(--border)',
                    background: icon === ic.n ? color + '18' : 'var(--bg)',
                    color: icon === ic.n ? color : 'var(--text2)',
                    boxShadow: icon === ic.n ? `0 0 0 2px ${color}40` : 'none'
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

        <ColorPicker value={color} onChange={setColor} label="Color de espacio" />

        <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text2)' }}>Descripción (opcional)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Cuéntanos qué monitorea este espacio..."
          rows={3}
          className={INPUT + " mb-4 w-full resize-none"}
          style={inputStyle}
        />

        {error && <p className="text-xs font-semibold mb-4" style={{ color: '#EF4444' }}>{error}</p>}

        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>Cancelar</button>
          <button onClick={save} disabled={saving} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: color || DEFAULT_COLOR }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}