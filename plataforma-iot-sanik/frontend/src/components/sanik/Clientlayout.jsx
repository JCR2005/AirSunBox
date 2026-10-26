import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Server, LogOut } from 'lucide-react'

const COLORS = {
  primary:    "#67B7E8",
  bgLight:    "#F0F7FC",
  text:       "#0A0F18",
  textMuted:  "#5A7080",
  border:     "#D6E8F5",
  navHover:   "rgba(103, 183, 232, 0.08)",
  navActive:  "rgba(103, 183, 232, 0.15)",
}

// Mismo logo SVG inline que en AdminLayout
const AirSunBoxLogo = ({ size = 110 }) => (
  <svg
    width={size}
    height={Math.round(size * 295 / 540)}
    viewBox="0 0 540 295"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g fill="none" stroke="#67B7E8" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="162" cy="145" r="72"/>
      <line x1="162" y1="65"  x2="162" y2="41"/>
      <line x1="162" y1="225" x2="162" y2="249"/>
      <line x1="82"  y1="145" x2="58"  y2="145"/>
      <line x1="111" y1="94"  x2="94"  y2="77"/>
      <line x1="111" y1="196" x2="94"  y2="213"/>
      <line x1="213" y1="196" x2="230" y2="213"/>
      <line x1="213" y1="94"  x2="230" y2="77"/>
      <line x1="130" y1="76"  x2="118" y2="54"/>
      <line x1="194" y1="76"  x2="206" y2="54"/>
      <line x1="130" y1="214" x2="118" y2="236"/>
      <line x1="194" y1="214" x2="206" y2="236"/>
      <path d="M237 118 C282 118,310 118,328 118 C348 118,358 100,346 93 C335 87,326 99,334 109"/>
      <path d="M234 145 C320 145,380 145,418 145 C454 145,464 116,445 109 C428 103,420 125,436 137"/>
      <path d="M237 172 C285 172,320 174,348 177 C376 181,385 205,366 211 C348 217,342 196,355 186"/>
      <path d="M447 160 C470 160,478 181,460 187 C444 193,439 174,450 166"/>
    </g>
    <text
      x="170" y="272"
      fill="#67B7E8"
      fontFamily="'Nunito', 'Varela Round', 'Trebuchet MS', Arial, sans-serif"
      fontWeight="800"
      fontSize="50"
    >AirSunBox</text>
  </svg>
)

export default function ClientLayout({ children, orgName = 'Mi Organización', userEmail = 'usuario@org.com' }) {
  const location = useLocation()
  const navigate = useNavigate()

  const MENU = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/devices',   icon: Server,          label: 'Dispositivos' },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg, #F0F7FC)' }}>

      {/* ── TOPBAR HORIZONTAL — mismo ADN que el sidebar de AdminLayout ── */}
      <header
        className="bg-white flex-shrink-0 flex items-center px-6 gap-4 shadow-sm z-10"
        style={{ borderBottom: `1px solid ${COLORS.border}`, height: 64 }}
      >
        {/* Logo */}
        <Link to="/dashboard" className="transition-transform hover:scale-105 flex-shrink-0">
          <AirSunBoxLogo size={108} />
        </Link>

        {/* Divisor visual */}
        <div className="h-7 w-px flex-shrink-0" style={{ background: COLORS.border }} />

        {/* Nav items */}
        <nav className="flex items-center gap-1">
          {MENU.map(({ path, icon: Icon, label }) => {
            const isActive =
              location.pathname === path ||
              location.pathname.startsWith(path + '/')
            return (
              <Link
                key={path}
                to={path}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all duration-200"
                style={{
                  background:  isActive ? COLORS.navActive  : 'transparent',
                  color:       isActive ? COLORS.primary    : COLORS.textMuted,
                  fontWeight:  isActive ? '700'             : '500',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = COLORS.navHover }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Burbuja "Panel Cliente · OrgName" — mismo estilo que "Panel Admin" del sidebar */}
        <span
          className="text-[11px] font-bold px-3 py-1.5 rounded-full flex-shrink-0"
          style={{
            background: COLORS.bgLight,
            color:       COLORS.primary,
            border:      `1px solid ${COLORS.border}`,
          }}
        >
          Panel Cliente&nbsp;·&nbsp;{orgName}
        </span>

        {/* Divisor */}
        <div className="h-7 w-px flex-shrink-0" style={{ background: COLORS.border }} />

        {/* Avatar + email */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-sm"
            style={{ background: COLORS.primary }}
          >
            {userEmail?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-xs font-bold truncate max-w-[140px]" style={{ color: COLORS.text }}>
              {userEmail}
            </p>
          </div>
        </div>

        {/* Cerrar sesión */}
        <button
          className="flex items-center gap-1.5 px-2 py-2 text-sm rounded-lg transition-colors hover:bg-red-50 hover:text-red-500"
          style={{ color: COLORS.textMuted }}
          title="Cerrar sesión"
        >
          <LogOut size={16} />
        </button>
      </header>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}