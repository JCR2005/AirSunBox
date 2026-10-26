import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronsUpDown, User, ShieldCheck, Sun, Moon, LogOut } from 'lucide-react'
import useAuthStore from '../store/auth'
import useThemeStore from '../store/theme'

const ROLE_LABEL = {
  superadmin: 'Superadministrador',
  admin: 'Administrador',
  worker: 'Equipo AirSunBox',
  client: 'Cliente',
}

export function initialsOf(user) {
  const source = (user?.name || user?.email || '?').trim()
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

export function roleLabel(role) {
  return ROLE_LABEL[role] || 'Usuario'
}

// Tarjeta de usuario del pie del sidebar: al pulsarla abre un menú hacia
// arriba con el perfil, la seguridad, el tema y el cierre de sesión.
export default function UserMenu({ onNavigate }) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { dark, toggle } = useThemeStore()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const firstItemRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    firstItemRef.current?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (path) => {
    setOpen(false)
    onNavigate?.()
    navigate(path)
  }

  const handleLogout = () => {
    setOpen(false)
    logout()
    navigate('/login')
  }

  const itemClass = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-colors outline-none hover:bg-[rgba(103,183,232,0.10)] focus-visible:bg-[rgba(103,183,232,0.14)]'

  return (
    <div ref={rootRef} className="relative p-4">
      {open && (
        <div
          role="menu"
          aria-label="Opciones de la cuenta"
          className="absolute left-4 right-4 bottom-full mb-2 rounded-2xl border p-1.5 shadow-[0_12px_32px_rgba(15,31,24,0.14)] user-menu-pop"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <button ref={firstItemRef} role="menuitem" className={itemClass} style={{ color: 'var(--text)' }} onClick={() => go('/profile')}>
            <User size={16} style={{ color: 'var(--text2)' }} /> Mi perfil
          </button>
          <button role="menuitem" className={itemClass} style={{ color: 'var(--text)' }} onClick={() => go('/profile#seguridad')}>
            <ShieldCheck size={16} style={{ color: 'var(--text2)' }} /> Seguridad de la cuenta
          </button>
          <button role="menuitem" className={itemClass} style={{ color: 'var(--text)' }} onClick={toggle}>
            {dark ? <Sun size={16} style={{ color: 'var(--text2)' }} /> : <Moon size={16} style={{ color: 'var(--text2)' }} />}
            {dark ? 'Usar tema claro' : 'Usar tema oscuro'}
          </button>
          <div className="h-px my-1.5 mx-2" style={{ background: 'var(--border)' }} />
          <button role="menuitem" className={`${itemClass} hover:!bg-red-500/10 focus-visible:!bg-red-500/10`} style={{ color: '#E5484D' }} onClick={handleLogout}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      )}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors outline-none hover:border-[#67B7E8]/50 focus-visible:ring-2 focus-visible:ring-[#67B7E8]/40"
        style={{ background: open ? 'rgba(103,183,232,0.08)' : 'var(--bg)', borderColor: open ? 'rgba(103,183,232,0.5)' : 'var(--border)' }}
      >
        <span className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: '#67B7E8', color: '#fff' }}>
          {initialsOf(user)}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
            {user?.name || user?.email || 'Usuario'}
          </span>
          <span className="block text-xs mt-0.5 truncate" style={{ color: 'var(--text2)' }}>
            {roleLabel(user?.role)}
          </span>
        </span>
        <ChevronsUpDown size={16} className="shrink-0" style={{ color: 'var(--text2)' }} />
      </button>
    </div>
  )
}
