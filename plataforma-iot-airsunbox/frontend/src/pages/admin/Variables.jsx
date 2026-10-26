import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { variables as varsApi } from '../../services/api'
import { 
  Plus, Trash2, X, ChevronDown, Cpu, AlignLeft, AlertTriangle,
  Thermometer, Droplets, Wind, Cloud, Sun, Flame, Activity,
  Battery, Settings, Database, Monitor, Heart, FlaskConical, Globe, Zap, Gauge 
} from 'lucide-react'

const ICONS = { 
  Thermometer, Droplets, Wind, Cloud, Sun, Flame, Activity, 
  Battery, Settings, Database, Monitor, Heart, Flask: FlaskConical, Globe, Zap, Gauge 
}

const UNITS = [
  '°C', '% HR', '%', 'ppm', 'ppb', 'µg/m³', 'ADC', 'hPa', 'lx', 'V'
]

const INPUT = "w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1D9E75] transition-colors"

// ─── 1. MODAL PARA CREAR VARIABLES ──────────────────────────────────────────
function NewVariableModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [unit, setUnit] = useState(UNITS[0]) 
  const [dataType, setDataType] = useState('float')
  const [icon, setIcon] = useState('Activity')
  const [sensorModel, setSensorModel] = useState('') 
  const [description, setDescription] = useState('') 
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const [showIconPicker, setShowIconPicker] = useState(false)
  const s = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    let finalDescription = description.trim()
    if (sensorModel.trim()) {
      finalDescription = finalDescription 
        ? `Modelo: ${sensorModel.trim()} | ${finalDescription}` 
        : `Modelo: ${sensorModel.trim()}`
    }

    try {
      const data = await varsApi.create({ 
        name, 
        label, 
        unit, 
        data_type: dataType, 
        icon, 
        description: finalDescription 
      })
      onCreate(data)
      onClose()
    } catch (err) { 
      setError(err.message) 
    } finally { 
      setLoading(false) 
    }
  }

  const SelectedIcon = ICONS[icon] || Activity

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl p-6 w-full max-w-lg border shadow-2xl" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Nueva variable global</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ color: 'var(--text2)' }}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-xs p-3 rounded-lg bg-red-500/10 text-red-500 font-medium">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text2)' }}>Nombre para mostrar</label>
              <input className={INPUT} style={s} value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Temperatura" required />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text2)' }}>Label técnico (ID)</label>
              <input className={`${INPUT} font-mono`} style={s} value={label} onChange={e => setLabel(e.target.value.toLowerCase().replace(/\s+/g, '_'))} placeholder="ej. temperatura" required />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text2)' }}>Unidad de medida</label>
              <select className={INPUT} style={s} value={unit} onChange={e => setUnit(e.target.value)} required>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text2)' }}>Tipo de dato</label>
              <select className={INPUT} style={s} value={dataType} onChange={e => setDataType(e.target.value)} required>
                <option value="float">Decimal (float)</option>
                <option value="int">Entero (int)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text2)' }}>Ícono visual</label>
              <button 
                type="button" 
                onClick={() => setShowIconPicker(!showIconPicker)}
                className={`${INPUT} flex items-center justify-between`} 
                style={s}
              >
                <div className="flex items-center gap-2">
                  <SelectedIcon size={18} className="text-[#1D9E75]" />
                  <span className="truncate">{icon}</span>
                </div>
                <ChevronDown size={16} style={{ color: 'var(--text2)' }} />
              </button>

              {showIconPicker && (
                <div 
                  className="absolute top-full left-0 mt-2 w-full p-2 border rounded-xl shadow-xl z-10 grid grid-cols-4 gap-1 h-48 overflow-y-auto" 
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  {Object.keys(ICONS).map(iconKey => {
                    const CurrentIcon = ICONS[iconKey]
                    const isSelected = icon === iconKey
                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => { setIcon(iconKey); setShowIconPicker(false) }}
                        className={`p-2.5 flex justify-center items-center rounded-lg transition-colors ${
                          isSelected ? 'bg-[#1D9E75] text-white' : 'hover:bg-[#1D9E75]/10 hover:text-[#1D9E75]'
                        }`}
                        title={iconKey}
                        style={{ color: isSelected ? '#fff' : 'var(--text2)' }}
                      >
                        <CurrentIcon size={20} />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text2)' }}>Sensor asociado (Opcional)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Cpu size={16} style={{ color: 'var(--text2)' }} />
                </div>
                <input 
                  className={`${INPUT} pl-9`} 
                  style={s} 
                  value={sensorModel} 
                  onChange={e => setSensorModel(e.target.value)} 
                  placeholder="Ej. DHT11" 
                />
              </div>
            </div>
          </div>
          
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text2)' }}>Descripción de la variable (Opcional)</label>
            <div className="relative">
              <div className="absolute top-3 left-3 flex items-start pointer-events-none">
                <AlignLeft size={16} style={{ color: 'var(--text2)' }} />
              </div>
              <textarea 
                className={`${INPUT} pl-9 resize-none`} 
                rows="2"
                style={s} 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Ej. Mide la concentración de gases..." 
              />
            </div>
          </div>
          
          <div className="flex gap-3 pt-4 border-t mt-6" style={{ borderColor: 'var(--border)' }}>
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 bg-[#1D9E75] hover:bg-[#25C48F] text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
              {loading ? 'Guardando...' : 'Crear Variable'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// ─── 2. MODAL ELEGANTE PARA ELIMINAR VARIABLES ──────────────────────────────
function DeleteVariableModal({ variable, onClose, onConfirm, isDeleting, error }) {
  if (!variable) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl p-6 w-full max-w-sm border shadow-2xl text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={28} className="text-red-500" />
        </div>
        
        <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text)' }}>¿Eliminar variable?</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
          Estás a punto de eliminar la variable <span className="font-bold" style={{ color: 'var(--text)' }}>"{variable.name}"</span>. Esta acción no se puede deshacer y podría afectar a los dispositivos que la usan.
        </p>

        {error && (
          <div className="text-xs p-3 rounded-lg bg-red-500/10 text-red-500 font-medium mb-4 text-left">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button 
            onClick={onClose} 
            disabled={isDeleting}
            className="flex-1 border rounded-lg py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors" 
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm} 
            disabled={isDeleting}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2"
          >
            {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ─── 3. COMPONENTE PRINCIPAL ────────────────────────────────────────────────
export default function AdminVariables() {
  const [variables, setVariables] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Estados de Modales
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [variableToDelete, setVariableToDelete] = useState(null)
  
  // Estado de borrado
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const data = await varsApi.list()
        setVariables(data)
      } catch (err) { 
        console.error("Error cargando el catálogo:", err) 
      } finally { 
        setLoading(false) 
      }
    }
    fetchCatalog()
  }, [])

  // NUEVA FUNCIÓN DE ELIMINADO VINCULADA AL MODAL
  const confirmDelete = async () => {
    if (!variableToDelete) return
    setIsDeleting(true)
    setDeleteError('')

    try {
      await varsApi.delete(variableToDelete.label)
      setVariables(prev => prev.filter(v => v.label !== variableToDelete.label))
      setVariableToDelete(null)
    } catch (err) { 
      setDeleteError(err.message || 'Error al intentar eliminar.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AdminLayout>
      {/* Modales Flotantes */}
      {showCreateModal && <NewVariableModal onClose={() => setShowCreateModal(false)} onCreate={(newVar) => setVariables(prev => [...prev, newVar].sort((a,b) => a.name.localeCompare(b.name)))} />}
      
      <DeleteVariableModal 
        variable={variableToDelete} 
        isOpen={!!variableToDelete} 
        onClose={() => { setVariableToDelete(null); setDeleteError(''); }} 
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
        error={deleteError}
      />

      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Catálogo Maestro de Variables</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>Definición global de métricas</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-[#1D9E75] hover:bg-[#25C48F] text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg shadow-[#1D9E75]/20 transition-colors">
            <Plus size={16} /> Nueva variable
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-center py-12" style={{ color: 'var(--text2)' }}>Conectando a la base de datos...</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {variables.map(v => {
              const Icon = ICONS[v.icon] || Activity
              
              let sensorText = null;
              let descText = v.description;

              if (descText) {
                if (descText.startsWith('Modelo: ')) {
                  const parts = descText.split(' | ');
                  sensorText = parts[0].replace('Modelo: ', '');
                  descText = parts.slice(1).join(' | ');
                } else if (descText.startsWith('Sensor ')) {
                  sensorText = descText.replace('Sensor ', '');
                  descText = null; 
                }
              }

              return (
                <div key={v.label} className="border rounded-xl p-4 flex items-start gap-4 group hover:border-[#1D9E75]/50 transition-colors" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="w-12 h-12 rounded-xl bg-[#1D9E75]/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={22} className="text-[#1D9E75]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold" style={{ color: 'var(--text)' }}>{v.name}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#1D9E75]/10 text-[#1D9E75]">{v.unit}</span>
                      </div>
                      
                      {/* ESTE BOTÓN AHORA ABRE EL MODAL EN LUGAR DEL WINDOW.CONFIRM */}
                      <button onClick={() => setVariableToDelete(v)} className="p-1.5 rounded-lg text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all flex-shrink-0" title="Eliminar variable">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="text-xs font-mono mt-1 opacity-70" style={{ color: 'var(--text2)' }}>ID: {v.label} • Tipo: {v.data_type || 'float'}</div>
                    
                    {sensorText && (
                      <div className="text-xs mt-2 mb-1 flex items-center gap-1.5 font-medium truncate" style={{ color: 'var(--text)' }}>
                        <Cpu size={14} className="text-[#1D9E75]" />
                        <span>{sensorText}</span>
                      </div>
                    )}
                    
                    {descText && (
                      <div className="text-sm mt-2 p-2 rounded-lg bg-black/5 dark:bg-white/5 line-clamp-2" style={{ color: 'var(--text2)' }}>
                        {descText}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
