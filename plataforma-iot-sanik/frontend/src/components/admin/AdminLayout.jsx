import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/auth'
import useThemeStore from '../../store/theme'
import { LayoutDashboard, Users, Cpu, Settings, LogOut, Shield, FileText, ChevronRight, Sun, Moon, Menu, X } from 'lucide-react'


import logoImg from "../../assets/logo2.svg";


const COLORS = {
  primary: "#67B7E8",
  primaryHover: "rgba(103, 183, 232, 0.1)",
  primaryActive: "rgba(103, 183, 232, 0.15)",
};


const AirSunBoxLogo = ({ size = 48 }) => (
  <img 
    src={logoImg} 
    alt="AirSunBox Logo" 
    style={{
      width: size,
      height: "auto", // Mantiene la proporción original automáticamente
      display: "block"
    }}
  />
);

const NAV = [
  { label: 'Dashboard',   icon: LayoutDashboard, path: '/admin', roles: ['superadmin', 'admin', 'worker'] },
  { label: 'Clientes',    icon: Users,           path: '/admin/clientes', roles: ['superadmin', 'admin'] },
  { label: 'Solicitudes', icon: FileText,        path: '/admin/solicitudes', roles: ['superadmin', 'admin', 'worker'] },
  { label: 'Variables',   icon: Settings,        path: '/admin/variables', roles: ['superadmin', 'admin'] },
  { label: 'Equipo',      icon: Shield,          path: '/admin/equipo', roles: ['superadmin'] },
]

export default function AdminLayout({ children }) {
  const location = useLocation()
  const navigate  = useNavigate()
  const { user, logout } = useAuthStore()
  const { dark, toggle } = useThemeStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }
  const isActive = (path) => path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path)

  // Filtrar navegación por rol
  const filteredNav = NAV.filter(item => item.roles.includes(user?.role))

  return (
    <div className="min-h-screen flex font-sans selection:bg-[#67B7E8] selection:text-white" style={{background:'var(--bg)'}}>

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Ahora con clases responsivas */}
      <aside 
        className={`w-[280px] flex flex-col fixed h-full z-50 transition-all duration-300 shadow-[4px_0_24px_rgba(0,0,0,0.02)] lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} 
        style={{background:'var(--card)'}}
      >

        {/* Header Logo */}
        <div className="pt-8 pb-6 px-8 flex flex-col items-start gap-2 relative">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* El logo de la barra de navegación ahora usa la imagen */}
          <AirSunBoxLogo size={150} />
        </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-md tracking-wide uppercase" style={{background: COLORS.primaryHover, color: COLORS.primary}}>
            Panel de Control
          </span>

          {/* Botón cerrar para móvil */}
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute right-4 top-8 p-2 text-[var(--text2)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto">
          {filteredNav.map(({ label, icon: Icon, path }) => {
            const active = isActive(path);
            return (
              <Link 
                key={path} 
                to={path}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all duration-200 group"
                style={{
                  background: active ? COLORS.primaryActive : 'transparent',
                  color: active ? COLORS.primary : 'var(--text2)',
                  fontWeight: active ? 600 : 500
                }}
              >
                <Icon 
                  size={18} 
                  strokeWidth={active ? 2.5 : 2} 
                  className={`transition-transform duration-200 ${!active && 'group-hover:scale-110'}`} 
                />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={14} strokeWidth={3} className="opacity-70" />}
              </Link>
            )
          })}
        </nav>

        {/* Footer de Usuario - Todo en una "tarjeta" integrada */}
        <div className="p-4">
          <div className="rounded-2xl p-4 flex flex-col gap-4 border" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm" style={{background: COLORS.primary, color: '#fff'}}>
                {user?.email?.[0]?.toUpperCase() || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate" style={{color:'var(--text)'}}>{user?.email || 'superadmin@sanik.io'}</div>
                <div className="text-xs font-medium mt-0.5" style={{color:'var(--text2)'}}>{user?.role || 'Superadmin'}</div>
              </div>
            </div>

            <div className="h-px w-full" style={{ background: 'var(--border)' }} />

            <div className="flex items-center justify-between gap-2">
              <button onClick={toggle} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{color:'var(--text2)'}}>
                {dark ? <Sun size={14} /> : <Moon size={14} />}
                {dark ? 'Claro' : 'Oscuro'}
              </button>

              <div className="w-px h-4" style={{ background: 'var(--border)' }} />

              <button onClick={handleLogout} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-red-500/10 hover:text-red-500" style={{color:'var(--text2)'}}>
                <LogOut size={14} />
                Salir
              </button>
            </div>

          </div>
        </div>
      </aside>

      {/* Contenedor Principal */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen lg:ml-[280px]" style={{background:'var(--bg)'}}>

        {/* Header móvil */}
        <header className="lg:hidden h-16 border-b flex items-center px-6 sticky top-0 z-30 backdrop-blur-md" style={{background:'var(--bg)dd', borderColor:'var(--border)'}}>
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-xl"
            style={{color:'var(--text2)'}}
          >
            <Menu size={24} />
          </button>
          <div className="ml-4 font-bold text-lg font-syne" style={{color:'var(--text)'}}>Sanik Admin</div>
        </header>

        <main className="flex-1 relative overflow-x-hidden p-4 md:p-6 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  )
}