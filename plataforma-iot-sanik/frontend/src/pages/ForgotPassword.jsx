import { useState } from 'react'
import { Link } from 'react-router-dom'
import { auth } from '../services/api'
import { Mail, ArrowLeft, MailCheck } from 'lucide-react'

import logoImg from "../assets/logo2.svg";

const COLORS = {
  primary: "#67B7E8",
  accent: "#2BA8A0",
  bgLight: "#F0F7FC",
  text: "#0A0F18",
  textMuted: "#5A7080",
  border: "#D6E8F5",
  card: "#FFFFFF",
  featureBg: "rgba(103, 183, 232, 0.1)"
};

const AirSunBoxLogo = ({ size = 48 }) => (
  <img
    src={logoImg}
    alt="AirSunBox Logo"
    style={{ width: size, height: "auto", display: "block" }}
  />
);

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await auth.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message || 'No se pudo procesar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
        background: `radial-gradient(circle at -10% 50%, rgba(103, 183, 232, 0.4) 0%, rgba(103, 183, 232, 0.15) 45%, ${COLORS.bgLight} 85%)`
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 md:p-10 border" style={{ borderColor: COLORS.border }}>
        <div className="mb-6 flex justify-center">
          <AirSunBoxLogo size={140} />
        </div>

        <h2 className="text-xl md:text-2xl font-bold mb-2 text-center" style={{ color: COLORS.text, fontFamily: "'Syne', sans-serif" }}>
          Recuperar contraseña
        </h2>
        <p className="text-sm text-center mb-8" style={{ color: COLORS.textMuted }}>
          {sent
            ? 'Revisá tu bandeja de entrada.'
            : 'Ingresá tu correo y te enviaremos un enlace para restablecerla.'}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3.5 mb-4">
            {error}
          </div>
        )}

        {sent ? (
          <div className="text-center py-6">
            <div
              className="mx-auto mb-4 p-4 rounded-2xl w-fit"
              style={{ backgroundColor: 'rgba(43, 168, 160, 0.1)', color: COLORS.accent }}
            >
              <MailCheck size={40} />
            </div>
            <p className="text-sm mb-6" style={{ color: COLORS.textMuted }}>
              Si el correo <b>{email.trim()}</b> está registrado, vas a recibir un enlace
              válido por <b>60 minutos</b>. Revisá también la carpeta de spam.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: COLORS.textMuted }}>
                Correo electrónico*
              </label>
              <div className="relative group">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-[#67B7E8]" style={{ color: COLORS.textMuted }} />
                <input
                  type="email"
                  placeholder="admin@AirSunBox.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#F8FAFC] border rounded-xl pl-11 pr-4 py-3.5 text-sm outline-none transition-all duration-300 focus:bg-white focus:ring-4"
                  style={{
                    borderColor: COLORS.border,
                    color: COLORS.text,
                    '--tw-ring-color': 'rgba(103, 183, 232, 0.2)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = COLORS.primary}
                  onBlur={(e) => e.target.style.borderColor = COLORS.border}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-bold py-3.5 rounded-xl transition-all duration-300 mt-2 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(to right, #3bb4ffff , #80ceffff)`, boxShadow: '0 4px 14px rgba(103, 183, 232, 0.3)' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Enviando...</span>
                </>
              ) : 'Enviar enlace'}
            </button>
          </form>
        )}

        <p className="text-center text-sm mt-6" style={{ color: COLORS.textMuted }}>
          <Link to="/login" className="inline-flex items-center gap-1.5 font-bold hover:underline" style={{ color: COLORS.primary }}>
            <ArrowLeft size={14} />
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  )
}