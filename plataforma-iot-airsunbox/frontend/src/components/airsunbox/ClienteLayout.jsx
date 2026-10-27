import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import useAuthStore from '../../store/auth'
import UserMenu from '../UserMenu'
import { LayoutDashboard, Cpu, FileText, ChevronRight, Bell, Menu, X, Layers } from 'lucide-react'


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

const CLIENT_NAV = [
  { label: 'Dashboard',    icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Estaciones',   icon: Cpu,             path: '/dispositivos' },
  { label: 'Espacios',     icon: Layers,          path: '/espacios' },
  { label: 'Reportes',     icon: FileText,        path: '/reportes' },
  { label: 'Alertas',      icon: Bell,            path: '/alerts' },
  { label: 'Solicitudes',  icon: FileText,        path: '/solicitudes' },
]

export default function ClienteLayout({ children }) {
  const location = useLocation()

  const { org } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isActive = (path) => path === '/dashboard'
    ? location.pathname === '/dashboard'
    : location.pathname.startsWith(path)

  const displayLabel = org?.name ? org.name.toUpperCase() : 'PANEL CLIENTE'

  return (
    <div className="app-shell min-h-screen flex font-sans selection:bg-[#67B7E8] selection:text-white" style={{background:'var(--bg)'}}>

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar con el ancho y sombra de AdminLayout */}
      <aside 
        className={`w-[280px] flex flex-col fixed h-full z-50 transition-all duration-300 shadow-[4px_0_24px_rgba(0,0,0,0.02)] lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} 
        style={{background:'var(--card)'}}
      >

        {/* Header Logo Animado */}
        <div className="pt-8 pb-6 px-8 flex flex-col items-start gap-2 relative">
           <div className="logo-float-admin">
              <AirSunBoxLogo size={160} />
            </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-md tracking-wide" style={{background: COLORS.primaryHover, color: COLORS.primary}}>
            {displayLabel}
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
          {/* Independientes (B): gestionan por Espacios (devices dentro de cada espacio).
              Dependientes (A): gestionan Estaciones directas, sin apartado de Espacios. */}
          {/* B (independiente): espacios y sin solicitudes; A (dependiente): estaciones y solicitudes */}
          {(org?.type === 'B'
            ? CLIENT_NAV.filter(i => i.path !== '/dispositivos' && i.path !== '/solicitudes')
            : CLIENT_NAV.filter(i => i.path !== '/espacios')).map(({ label, icon: Icon, path }) => {
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

        <UserMenu onNavigate={() => setSidebarOpen(false)} />
      </aside>

      {/* Contenedor Principal ajustado al nuevo ancho */}
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
          <div className="ml-4 font-bold text-lg" style={{color:'var(--text)', fontFamily: 'Syne'}}>AirSunBox</div>
        </header>

        <main className="flex-1 relative overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}