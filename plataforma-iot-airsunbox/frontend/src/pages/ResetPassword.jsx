import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { auth } from '../services/api'
import { Lock, Eye, EyeOff, ArrowLeft, ShieldCheck, Check, X, LogOut, LinkIcon } from 'lucide-react'
import useAuthStore from '../store/auth'
import RecoveryShell, { RC, Spinner, primaryBtn, primaryBtnStyle } from '../components/auth/RecoveryShell'

const MIN = 8
const RULES = [
  { id: 'len', label: `Al menos ${MIN} caracteres`, test: p => p.length >= MIN, required: true },
  { id: 'case', label: 'Mayúsculas y minúsculas', test: p => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { id: 'num', label: 'Un número o símbolo', test: p => /[\d\W_]/.test(p) },
]
const LEVELS = [
  { label: 'Muy débil', color: RC.red },
  { label: 'Débil', color: '#F59E0B' },
  { label: 'Aceptable', color: '#E0A23B' },
  { label: 'Fuerte', color: RC.green },
]

function PasswordField({ id, label, value, onChange, show, onToggle, invalid, describedBy, inputRef, autoComplete }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold block mb-2" style={{ color: RC.text }}>{label}</label>
      <div className="relative">
        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: invalid ? RC.red : RC.textMuted }} aria-hidden="true" />
        <input
          id={id}
          ref={inputRef}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          aria-invalid={!!invalid}
          aria-describedby={describedBy}
          className="w-full bg-[#F8FAFC] border rounded-xl pl-11 pr-12 py-3.5 text-sm outline-none transition-all focus:bg-white focus:border-[#67B7E8] focus:ring-4 focus:ring-[#67B7E8]/20"
          style={{ borderColor: invalid ? RC.red : RC.border, color: RC.text }}
        />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-black/5"
                style={{ color: RC.textMuted }} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  )
}

// Estado final o de error, con un ícono, título, texto y una acción
function Outcome({ tone, Icon, title, children, action }) {
  const color = tone === 'ok' ? RC.green : RC.red
  return (
    <div className="text-center">
      <span className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: color + '1F', color }} aria-hidden="true">
        <Icon size={30} />
      </span>
      <h2 className="mt-6 font-display text-2xl font-extrabold" style={{ color: RC.text }}>{title}</h2>
      <div className="mt-2 text-sm" style={{ color: RC.textMuted }}>{children}</div>
      <div className="mt-8">{action}</div>
    </div>
  )
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [linkProblem, setLinkProblem] = useState(!token)
  const [checking, setChecking] = useState(!!token)
  const [done, setDone] = useState(false)
  const [countdown, setCountdown] = useState(6)
  const passRef = useRef(null)

  const passed = useMemo(() => RULES.map(r => r.test(password)), [password])
  const score = password ? passed.filter(Boolean).length + (password.length >= 12 ? 1 : 0) : 0
  const level = LEVELS[Math.min(Math.max(score - 1, 0), 3)]
  const longEnough = password.length >= MIN
  const matches = confirm.length > 0 && confirm === password
  const mismatch = confirm.length > 0 && confirm !== password

  // Revisa el enlace al abrir la página: si ya se usó o venció, no tiene
  // sentido mostrar el formulario. Si la revisión falla por red, se muestra
  // igual y el servidor lo valida al guardar.
  useEffect(() => {
    if (!token) return
    let alive = true
    auth.checkResetToken(token)
      .then(r => { if (alive && !r?.valid) setLinkProblem(true) })
      .catch(() => {})
      .finally(() => { if (alive) setChecking(false) })
    return () => { alive = false }
  }, [token])

  useEffect(() => {
    if (!done) return
    if (countdown <= 0) { navigate('/login?contrasena=actualizada', { replace: true }); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [done, countdown, navigate])

  const handleSubmit = (e) => {
    e.preventDefault()
    setTouched(true)
    setError('')
    if (!longEnough || !matches) { passRef.current?.focus(); return }
    setConfirming(true)
  }

  const doReset = async () => {
    setLoading(true)
    setError('')
    try {
      await auth.resetPassword(token, password)
      // El servidor ya invalidó las sesiones de otros dispositivos; aquí se
      // cierra también la de este navegador
      useAuthStore.getState().logout()
      setConfirming(false)
      setDone(true)
    } catch (err) {
      setConfirming(false)
      if (/inválido|expir/i.test(err.message || '')) setLinkProblem(true)
      else setError(err.message || 'No pudimos guardar la contraseña. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <RecoveryShell step={4}>
        <Outcome
          tone="ok" Icon={ShieldCheck} title="Contraseña actualizada"
          action={
            <Link to="/login?contrasena=actualizada" replace className={primaryBtn} style={primaryBtnStyle}>
              Iniciar sesión
            </Link>
          }
        >
          <p>Cerramos tu sesión en todos los dispositivos. Entrá con tu contraseña nueva.</p>
          <p className="mt-3 text-xs" aria-live="polite">Te llevamos al inicio de sesión en {countdown} s…</p>
        </Outcome>
      </RecoveryShell>
    )
  }

  if (checking) {
    return (
      <RecoveryShell step={3}>
        <div className="flex flex-col items-center gap-3 py-10 text-sm" style={{ color: RC.textMuted }} aria-live="polite">
          <span style={{ color: RC.primary }}><Spinner /></span>
          Revisando el enlace…
        </div>
      </RecoveryShell>
    )
  }

  if (linkProblem) {
    return (
      <RecoveryShell step={2}>
        <Outcome
          tone="error" Icon={LinkIcon}
          title={token ? 'Este enlace ya no sirve' : 'El enlace está incompleto'}
          action={
            <Link to="/forgot-password" className={primaryBtn} style={primaryBtnStyle}>Pedir un enlace nuevo</Link>
          }
        >
          {token
            ? 'Venció (dura 10 minutos) o ya se usó. Pedí uno nuevo y usá el último que te llegue.'
            : 'Abrilo desde el botón del correo o copiá el enlace completo, sin cortarlo.'}
        </Outcome>
        <p className="text-center text-sm mt-6">
          <Link to="/login" className="inline-flex items-center gap-1.5 font-bold hover:underline" style={{ color: RC.primary }}>
            <ArrowLeft size={14} /> Volver a iniciar sesión
          </Link>
        </p>
      </RecoveryShell>
    )
  }

  return (
    <RecoveryShell step={3}>
      <h2 className="font-display text-2xl md:text-[1.7rem] font-extrabold text-center" style={{ color: RC.text }}>Elegí tu contraseña nueva</h2>
      <p className="mt-2 mb-8 text-sm text-center" style={{ color: RC.textMuted }}>
        Usá una que no uses en otros sitios.
      </p>

      {error && (
        <div role="alert" className="mb-5 rounded-xl border px-4 py-3 text-sm font-medium" style={{ background: 'rgba(229,72,77,0.06)', borderColor: 'rgba(229,72,77,0.25)', color: RC.red }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <PasswordField
            id="new-password" label="Contraseña nueva" value={password} inputRef={passRef} autoComplete="new-password"
            onChange={e => setPassword(e.target.value)} show={show} onToggle={() => setShow(s => !s)}
            invalid={touched && !longEnough} describedBy="password-rules"
          />
          {/* Medidor de seguridad */}
          <div className="mt-3" aria-live="polite">
            <div className="flex gap-1.5" aria-hidden="true">
              {[0, 1, 2, 3].map(i => (
                <span key={i} className="h-1.5 flex-1 rounded-full transition-colors duration-300"
                      style={{ background: password && i < Math.max(score, 1) ? level.color : RC.border }} />
              ))}
            </div>
            {password && <p className="mt-1.5 text-xs font-semibold" style={{ color: level.color }}>{level.label}</p>}
          </div>
          <ul id="password-rules" className="mt-3 space-y-1.5">
            {RULES.map((r, i) => (
              <li key={r.id} className="flex items-center gap-2 text-xs" style={{ color: passed[i] ? RC.green : (touched && r.required ? RC.red : RC.textMuted) }}>
                {passed[i] ? <Check size={14} strokeWidth={3} /> : <span className="w-3.5 h-3.5 rounded-full border-2 inline-block" style={{ borderColor: 'currentColor' }} />}
                {r.label}{r.required ? '' : ' (recomendado)'}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <PasswordField
            id="confirm-password" label="Repetí la contraseña" value={confirm} autoComplete="new-password"
            onChange={e => setConfirm(e.target.value)} show={show} onToggle={() => setShow(s => !s)}
            invalid={mismatch || (touched && !matches)} describedBy="confirm-status"
          />
          <p id="confirm-status" className="mt-2 text-xs font-semibold flex items-center gap-1.5 min-h-[1rem]" aria-live="polite"
             style={{ color: matches ? RC.green : RC.red }}>
            {matches && <><Check size={14} strokeWidth={3} /> Las contraseñas coinciden</>}
            {mismatch && <><X size={14} strokeWidth={3} /> No coinciden todavía</>}
            {!confirm && touched && 'Repetí la contraseña para confirmarla.'}
          </p>
        </div>

        <button type="submit" disabled={loading} className={primaryBtn} style={primaryBtnStyle}>
          Guardar contraseña
        </button>
      </form>

      <p className="text-center text-sm mt-8">
        <Link to="/login" className="inline-flex items-center gap-1.5 font-bold hover:underline" style={{ color: RC.primary }}>
          <ArrowLeft size={14} /> Volver a iniciar sesión
        </Link>
      </p>

      {/* Confirmación: el cambio cierra la sesión en todos los dispositivos */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl user-menu-pop">
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(103,183,232,0.14)', color: RC.primary }} aria-hidden="true">
              <LogOut size={22} />
            </span>
            <h3 id="confirm-title" className="mt-4 font-display text-xl font-extrabold" style={{ color: RC.text }}>¿Cambiar tu contraseña?</h3>
            <p className="mt-2 text-sm" style={{ color: RC.textMuted }}>
              Vamos a cerrar tu sesión en <strong style={{ color: RC.text }}>todos tus dispositivos</strong>. Después entrás con la contraseña nueva.
            </p>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} disabled={loading}
                      className="flex-1 py-3 rounded-xl text-sm font-bold border" style={{ borderColor: RC.border, color: RC.text }}>
                Cancelar
              </button>
              <button type="button" onClick={doReset} disabled={loading} autoFocus
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2" style={{ background: RC.primary }}>
                {loading ? <><Spinner /> Guardando…</> : 'Sí, cambiar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RecoveryShell>
  )
}
