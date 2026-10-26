import { Link } from 'react-router-dom'
import { ArrowLeft, Check, KeyRound, Mail, ShieldCheck } from 'lucide-react'
import logoImg from '../../assets/logo2.svg'

export const RC = {
  primary: '#67B7E8',
  primaryDark: '#3A9BD6',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  bgLight: '#F8FAFC',
  green: '#2CB67D',
  red: '#E5484D',
}

const STEPS = [
  { title: 'Pedí el enlace', text: 'Con el correo de tu cuenta.', Icon: Mail },
  { title: 'Revisá tu correo', text: 'El enlace vale 60 minutos y sirve una vez.', Icon: ShieldCheck },
  { title: 'Elegí tu contraseña nueva', text: 'Cerramos tu sesión en todos los dispositivos.', Icon: KeyRound },
]

// Marco de las pantallas de recuperación de contraseña: mismo lenguaje que el
// login (panel de marca a la izquierda, formulario a la derecha) y el avance
// del proceso, que sí es una secuencia de pasos.
export default function RecoveryShell({ step = 1, children }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <aside
        className="hidden md:flex md:w-1/2 p-10 lg:p-20 flex-col justify-center"
        // Base sólida clara: el degradado es translúcido y el tema oscuro se veía debajo
        style={{ background: `radial-gradient(circle at -10% 50%, rgba(103,183,232,0.4) 0%, rgba(103,183,232,0.15) 45%, ${RC.bgLight} 85%), ${RC.bgLight}` }}
      >
        <div className="max-w-md">
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold leading-[1.08]" style={{ color: RC.text }}>
            Recuperá el acceso a tu cuenta
          </h1>
          <p className="mt-4 text-base" style={{ color: RC.textMuted }}>
            Tres pasos y volvés a ver tus estaciones. Nadie de AirSunBox te va a pedir tu contraseña.
          </p>

          <ol className="mt-12 space-y-0" aria-label="Pasos para recuperar la contraseña">
            {STEPS.map(({ title, text, Icon }, i) => {
              const n = i + 1
              const done = n < step
              const current = n === step
              return (
                <li key={title} className="relative flex gap-4 pb-8 last:pb-0" aria-current={current ? 'step' : undefined}>
                  {i < STEPS.length - 1 && (
                    <span className="absolute left-[19px] top-11 bottom-1 w-0.5 rounded-full"
                          style={{ background: done ? RC.green : 'rgba(100,116,139,0.18)' }} aria-hidden="true" />
                  )}
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      background: done ? RC.green : current ? RC.primary : 'rgba(255,255,255,0.7)',
                      color: done || current ? '#fff' : RC.textMuted,
                      boxShadow: current ? '0 6px 18px rgba(103,183,232,0.35)' : 'none',
                    }}
                  >
                    {done ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
                  </span>
                  <span className="pt-1">
                    <span className="block text-sm font-bold" style={{ color: current || done ? RC.text : RC.textMuted }}>{title}</span>
                    <span className="block text-sm mt-0.5" style={{ color: RC.textMuted }}>{text}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </aside>

      <main className="w-full md:w-1/2 bg-white flex flex-col items-center justify-center p-6 md:p-12 min-h-screen relative">
        <Link
          to="/"
          className="absolute top-6 right-6 flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border transition-colors hover:border-[#67B7E8] hover:text-[#67B7E8]"
          style={{ borderColor: RC.border, color: RC.textMuted }}
        >
          <ArrowLeft size={14} /> Volver al inicio
        </Link>

        <div className="w-full max-w-[400px]">
          <img src={logoImg} alt="AirSunBox" className="mx-auto mb-8" style={{ width: 150, height: 'auto' }} />
          {/* Paso actual en móvil, donde no se ve el panel de la izquierda */}
          <p className="md:hidden text-center text-xs font-semibold mb-3" style={{ color: RC.primary }}>
            Paso {Math.min(step, 3)} de 3
          </p>
          {children}
        </div>
      </main>
    </div>
  )
}

export function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export const primaryBtn = 'w-full text-white font-bold py-3.5 rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#67B7E8]/30'
export const primaryBtnStyle = { background: 'linear-gradient(to right, #3bb4ff, #80ceff)', boxShadow: '0 4px 14px rgba(103,183,232,0.3)' }
