import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Cpu, Bell, User, LogOut, Sun, Moon, Menu, X } from 'lucide-react'
import useAuthStore from '../../store/auth'
import useThemeStore from '../../store/theme'

const AirSunBoxLogo = ({ size = 180 }) => (
  <svg width={size} height={(size * 500) / 900} viewBox="0 0 900 500" xmlns="http://www.w3.org/2000/svg">
    <style>{`
      .blue-nav{ stroke:#67B7E8; fill:none; stroke-width:10; stroke-linecap:round; stroke-linejoin:round; }
      .text-nav{ fill:#67B7E8; font-family:Arial,sans-serif; font-size:72px; font-weight:bold; }
    `}</style>
    <circle className="blue-nav" cx="260" cy="220" r="110"/>
    <line className="blue-nav" x1="260" y1="60" x2="260" y2="10"/>
    <line className="blue-nav" x1="260" y1="380" x2="260" y2="430"/>
    <line className="blue-nav" x1="110" y1="220" x2="50" y2="220"/>
    <line className="blue-nav" x1="410" y1="220" x2="470" y2="220"/>
    <line className="blue-nav" x1="150" y1="110" x2="105" y2="65"/>
    <line className="blue-nav" x1="370" y1="330" x2="415" y2="375"/>
    <line className="blue-nav" x1="370" y1="110" x2="415" y2="65"/>
    <line className="blue-nav" x1="150" y1="330" x2="105" y2="375"/>
    <line className="blue-nav" x1="205" y1="80" x2="185" y2="35"/>
    <line className="blue-nav" x1="315" y1="80" x2="335" y2="35"/>
    <line className="blue-nav" x1="205" y1="360" x2="185" y2="405"/>
    <line className="blue-nav" x1="315" y1="360" x2="335" y2="405"/>
    <path className="blue-nav" d="M470 180 C540 180,560 180,600 180 C650 180,670 120,620 120 C585 120,575 150,590 160"/>
    <path className="blue-nav" d="M450 220 C560 220,620 220,720 220 C790 220,810 140,740 140 C700 140,690 180,715 190"/>
    <path className="blue-nav" d="M470 280 C560 280,620 280,680 280 C740 280,760 350,700 350 C660 350,655 310,680 300"/>
    <path className="blue-nav" d="M720 270 C780 270,790 270,810 270 C850 270,860 330,820 330 C790 330,785 300,800 290"/>
    <text className="text-nav" x="340" y="430">AirSunBox</text>
  </svg>
)

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, org, logout } = useAuthStore()
  const { dark, toggle } = useThemeStore()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const LINKS = [
    { path: '/dispositivos', label: 'Estaciones', icon: Cpu },
    { path: '/alerts',      label: 'Alertas',    icon: Bell },
    { path: '/profile',     label: 'Perfil',     icon: User }
  ]

  return (
    <header className="sticky top-0 z-50 border-b backdrop-blur-md" style={{ background: 'var(--bg)ee', borderColor: 'var(--border)' }}>
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* LOGO */}
        <Link to="/dispositivos" className="flex-1 flex justify-start">
          <AirSunBoxLogo size={180} />
        </Link>

        {/* MENU DESKTOP */}
        <nav className="hidden md:flex items-center gap-2">
          {LINKS.map((item) => {
            const Icon = item.icon
            const active = location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${active ? 'text-[#67B7E8] bg-[#67B7E8]/10' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'}`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* DERECHA */}
        <div className="flex-1 flex justify-end items-center gap-3">
          <button onClick={toggle} className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors" style={{ color: 'var(--text2)' }}>
            {dark ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} className="text-[#67B7E8]" />}
          </button>

          <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="w-8 h-8 rounded-lg bg-[#67B7E8]/10 flex items-center justify-center text-[#67B7E8]">
              <User size={18} />
            </div>
            <div className="leading-tight">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Cliente</div>
              <div className="text-sm font-bold truncate max-w-[100px]" style={{ color: 'var(--text)' }}>{org?.name || 'Sanik'}</div>
            </div>
          </div>

          <button onClick={handleLogout} className="p-2.5 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors hidden sm:block">
            <LogOut size={20} />
          </button>

          {/* Hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2.5 rounded-xl transition-colors" style={{ color: 'var(--text2)' }}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* MENU MOBILE */}
      {menuOpen && (
        <div className="md:hidden border-t p-4 space-y-2 bg-[var(--card)]">
          {LINKS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold text-[var(--text2)] hover:bg-gray-100 dark:hover:bg-white/5"
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          ))}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold text-red-500 hover:bg-red-500/10 transition-colors">
            <LogOut size={20} /> Cerrar Sesión
          </button>
        </div>
      )}
    </header>
  )
}
