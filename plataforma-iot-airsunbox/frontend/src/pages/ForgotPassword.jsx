import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { auth } from '../services/api'
import { Mail, ArrowLeft, MailCheck, Clock, Inbox, RotateCcw } from 'lucide-react'
import RecoveryShell, { RC, Spinner, primaryBtn, primaryBtnStyle } from '../components/auth/RecoveryShell'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const RESEND_SECONDS = 60

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const send = async () => {
    setLoading(true)
    setError('')
    try {
      await auth.forgotPassword(email.trim())
      setSent(true)
      setCooldown(RESEND_SECONDS)
    } catch (err) {
      setError(err.message || 'No pudimos enviar el enlace. Intentá de nuevo en un momento.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const value = email.trim()
    if (!value) { setEmailError('Escribí el correo de tu cuenta.'); inputRef.current?.focus(); return }
    if (!EMAIL_RE.test(value)) { setEmailError('Ese correo no parece válido. Revisalo.'); inputRef.current?.focus(); return }
    send()
  }

  if (sent) {
    return (
      <RecoveryShell step={2}>
        <div className="text-center">
          <span className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'rgba(44,182,125,0.12)', color: RC.green }} aria-hidden="true">
            <MailCheck size={30} />
          </span>
          <h2 className="mt-6 font-display text-2xl font-extrabold" style={{ color: RC.text }}>Revisá tu correo</h2>
          <p className="mt-2 text-sm" style={{ color: RC.textMuted }}>
            Si <strong style={{ color: RC.text }}>{email.trim()}</strong> tiene una cuenta en AirSunBox, te enviamos un enlace para elegir una contraseña nueva.
          </p>
        </div>

        <ul className="mt-6 rounded-2xl border divide-y text-sm" style={{ borderColor: RC.border }}>
          {[
            { Icon: Clock, text: 'El enlace vale 60 minutos y sirve una sola vez.' },
            { Icon: Inbox, text: 'Si no lo ves, revisá Spam o Promociones.' },
          ].map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: RC.border, color: RC.textMuted }}>
              <Icon size={16} style={{ color: RC.primary }} className="shrink-0" /> {text}
            </li>
          ))}
        </ul>

        {error && <p role="alert" className="mt-4 text-sm font-medium text-center" style={{ color: RC.red }}>{error}</p>}

        <button
          type="button"
          onClick={send}
          disabled={cooldown > 0 || loading}
          className="mt-6 w-full py-3 rounded-xl text-sm font-bold border flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed"
          style={{ borderColor: RC.border, color: cooldown > 0 ? RC.textMuted : RC.text, background: '#fff' }}
        >
          {loading ? <Spinner /> : <RotateCcw size={15} />}
          {cooldown > 0 ? `Reenviar enlace en ${cooldown} s` : 'Reenviar enlace'}
        </button>

        <div className="mt-6 flex items-center justify-between text-sm">
          <button type="button" onClick={() => { setSent(false); setError('') }} className="font-semibold hover:underline" style={{ color: RC.textMuted }}>
            Usar otro correo
          </button>
          <Link to="/login" className="inline-flex items-center gap-1.5 font-bold hover:underline" style={{ color: RC.primary }}>
            <ArrowLeft size={14} /> Iniciar sesión
          </Link>
        </div>
      </RecoveryShell>
    )
  }

  return (
    <RecoveryShell step={1}>
      <h2 className="font-display text-2xl md:text-[1.7rem] font-extrabold text-center" style={{ color: RC.text }}>¿Olvidaste tu contraseña?</h2>
      <p className="mt-2 mb-8 text-sm text-center" style={{ color: RC.textMuted }}>
        Escribí el correo de tu cuenta y te enviamos un enlace para elegir una nueva.
      </p>

      {error && (
        <div role="alert" className="mb-5 rounded-xl border px-4 py-3 text-sm font-medium" style={{ background: 'rgba(229,72,77,0.06)', borderColor: 'rgba(229,72,77,0.25)', color: RC.red }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label htmlFor="forgot-email" className="text-sm font-semibold block mb-2" style={{ color: RC.text }}>Correo electrónico</label>
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: emailError ? RC.red : RC.textMuted }} aria-hidden="true" />
            <input
              id="forgot-email"
              ref={inputRef}
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={e => { setEmail(e.target.value); if (emailError) setEmailError('') }}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'forgot-email-error' : undefined}
              className="w-full bg-[#F8FAFC] border rounded-xl pl-11 pr-4 py-3.5 text-sm outline-none transition-all focus:bg-white focus:border-[#67B7E8] focus:ring-4 focus:ring-[#67B7E8]/20"
              style={{ borderColor: emailError ? RC.red : RC.border, color: RC.text }}
            />
          </div>
          {emailError && <p id="forgot-email-error" role="alert" className="mt-2 text-xs font-semibold" style={{ color: RC.red }}>{emailError}</p>}
        </div>

        <button type="submit" disabled={loading} className={primaryBtn} style={primaryBtnStyle}>
          {loading ? <><Spinner /> Enviando…</> : 'Enviar enlace'}
        </button>
      </form>

      <p className="text-center text-sm mt-8">
        <Link to="/login" className="inline-flex items-center gap-1.5 font-bold hover:underline" style={{ color: RC.primary }}>
          <ArrowLeft size={14} /> Volver a iniciar sesión
        </Link>
      </p>
    </RecoveryShell>
  )
}
