import { Link } from 'react-router-dom'
import useThemeStore from '../../store/theme'
import { Sun, Moon } from 'lucide-react'
import logoImg from "../../assets/logo2.svg";

const AirSunBoxLogo = ({ size = 48 }) => (
  <img 
    src={logoImg} 
    alt="AirSunBox Logo" 
    style={{
      width: size,
      height: "auto",
      display: "block"
    }}
  />
);

export default function PublicLayout({ children }) {
  const { dark, toggle } = useThemeStore()

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-[#67B7E8] selection:text-white" style={{background:'var(--bg)'}}>
      <header className="h-20 border-b flex items-center justify-between px-6 lg:px-12 sticky top-0 z-50 backdrop-blur-md shadow-sm" style={{background:'var(--bg)ee', borderColor:'var(--border)'}}>
        <div className="flex items-center gap-4">
          <Link to="/">
            <AirSunBoxLogo size={140} />
          </Link>
          <div className="hidden sm:block h-6 w-px bg-[var(--border)] mx-2" />
          <span className="hidden sm:block text-xs font-bold px-2.5 py-1 rounded-md tracking-wide" style={{background: 'rgba(103, 183, 232, 0.1)', color: '#67B7E8'}}>
            REPORTES GLOBALES
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={toggle} className="p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{color:'var(--text2)'}}>
            {dark ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} className="text-[#67B7E8]" />}
          </button>
          <Link 
            to="/login"
            className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all bg-[#67B7E8] text-white hover:bg-[#52A8E0] shadow-lg shadow-[#67B7E8]/20"
          >
            Acceso Clientes
          </Link>
        </div>
      </header>

      <main className="flex-1 relative overflow-x-hidden">
        {children}
      </main>

      <footer className="py-8 px-6 border-t text-center text-xs font-medium" style={{borderColor: 'var(--border)', color: 'var(--text2)'}}>
        © {new Date().getFullYear()} Sanik - Plataforma de Monitoreo Ambiental. Todos los derechos reservados.
      </footer>
    </div>
  )
}
