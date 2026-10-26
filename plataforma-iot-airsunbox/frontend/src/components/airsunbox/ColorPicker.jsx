import { useState } from 'react'
import { Eye, EyeOff, Palette, Minus } from 'lucide-react'

const PRESET_COLORS = [
  '#67B7E8', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#6366F1',
  '#14B8A6', '#F43F5E', '#A855F7', '#0EA5E9', '#22C55E'
]

export default function ColorPicker({ value, onChange, label = 'Color', presets = PRESET_COLORS }) {
  const [showCustom, setShowCustom] = useState(false)
  const [customColor, setCustomColor] = useState(value)

  const handlePresetClick = (c) => {
    setShowCustom(false)
    onChange(c)
  }

  const handleCustomChange = (e) => {
    const c = e.target.value
    setCustomColor(c)
    onChange(c)
  }

  const handleCustomInput = (e) => {
    const c = e.target.value
    if (/^#[0-9A-Fa-f]{6}$/.test(c)) {
      setCustomColor(c)
      onChange(c)
    }
  }

  const toggleCustom = () => setShowCustom(!showCustom)

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text2)' }}>
        {label}
      </label>
      <div className="flex flex-wrap gap-2 mb-3">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => handlePresetClick(c)}
            className="w-8 h-8 rounded-full transition-all outline-none flex items-center justify-center"
            style={{
              background: c,
              border: '2px solid transparent',
              boxShadow: '0 0 0 1px var(--border)',
              transform: 'scale(1)',
              transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            {value === c && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" className="w-5 h-5"><polyline points="20 6 9 17 4 12"/></svg>}
          </button>
        ))}
        <button
          type="button"
          onClick={toggleCustom}
          className="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all"
          style={{
            borderColor: 'var(--border)',
            background: showCustom ? customColor : 'var(--bg)',
            color: 'var(--text2)'
          }}
          aria-label="Color personalizado"
        >
          {showCustom ? (
            <Eye size={16} color="white" />
          ) : (
            <Palette size={16} />
          )}
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 p-2 rounded-xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-lg border flex-shrink-0" style={{ background: customColor, borderColor: 'var(--border)' }} />
          <input
            type="color"
            value={customColor}
            onChange={handleCustomChange}
            className="flex-1 h-8 rounded-lg border outline-none cursor-pointer"
            style={{ background: 'transparent', borderColor: 'var(--border)', appearance: 'none', WebkitAppearance: 'none' }}
          />
          <input
            type="text"
            value={customColor}
            onChange={handleCustomInput}
            placeholder="#RRGGBB"
            className="w-20 h-8 px-2 text-sm font-mono rounded-lg border outline-none"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
            maxLength={7}
          />
          <button
            type="button"
            onClick={() => { setShowCustom(false); onChange(value) }}
            className="p-2 rounded-lg hover:bg-black/5 transition-colors"
            style={{ color: 'var(--text2)' }}
            title="Cancelar"
          >
            <Minus size={16} />
          </button>
        </div>
      )}
    </div>
  )
}