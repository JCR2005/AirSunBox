import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { KeyRound, Mail, Check, Loader2, Pencil } from 'lucide-react'
import ClienteLayout from '../components/airsunbox/ClienteLayout'
import AdminLayout from '../components/admin/AdminLayout'
import TwoFactorSection from '../components/security/TwoFactorSection'
import { initialsOf, roleLabel } from '../components/UserMenu'
import useAuthStore from '../store/auth'
import { auth } from '../services/api'

const INTERNAL_ROLES = ['superadmin', 'admin', 'worker']
const SKY = '#67B7E8'
const AMBER = '#E0A23B'

// Avatar rodeado por el anillo de protección: cerrado cuando la cuenta tiene
// verificación en dos pasos, abierto (con el hueco hacia abajo) cuando no.
function ProtectionAvatar({ user, protectedAccount }) {
  const r = 54
  const c = 2 * Math.PI * r
  const filled = protectedAccount ? 1 : 0.62
  return (
    <div className="relative w-[132px] h-[132px] shrink-0">
      <svg viewBox="0 0 132 132" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle
          cx="66" cy="66" r={r} fill="none"
          stroke={protectedAccount ? SKY : AMBER}
          strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${c * filled} ${c * (1 - filled) + 0.001}`}
          // Centra el arco arriba: el hueco queda abajo cuando falta el 2FA
          strokeDashoffset={protectedAccount ? 0 : (c * filled) / 2}
          className="protection-ring"
        />
      </svg>
      <div
        className="absolute inset-[18px] rounded-full flex items-center justify-center text-3xl font-bold"
        style={{ background: 'rgba(103,183,232,0.14)', color: SKY, fontFamily: "'Syne', sans-serif" }}
      >
        {initialsOf(user)}
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-6 py-4 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <dt className="text-sm" style={{ color: 'var(--text2)' }}>{label}</dt>
      <dd className="text-sm font-medium break-words" style={{ color: 'var(--text)' }}>{children}</dd>
    </div>
  )
}

function PasswordRow({ email }) {
  const [state, setState] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  const send = async () => {
    setState('sending'); setError('')
    try {
      await auth.forgotPassword(email)
      setState('sent')
    } catch (e) {
      setError(e.message); setState('error')
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-5">
      <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center" style={{ background: 'rgba(103,183,232,0.12)', color: SKY }}>
        <KeyRound size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Contraseña</div>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text2)' }}>
          {state === 'sent'
            ? <>Enviamos un enlace a <strong style={{ color: 'var(--text)' }}>{email}</strong>. Vence en 10 minutos y sirve una sola vez.</>
            : 'Para cambiarla te enviamos un enlace a tu correo.'}
        </p>
        {state === 'error' && <p className="text-sm mt-1" style={{ color: '#E5484D' }}>{error}</p>}
      </div>
      <button
        type="button"
        onClick={send}
        disabled={state === 'sending' || !email}
        className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:border-[#67B7E8]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B7E8]/40 disabled:opacity-60"
        style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}
      >
        {state === 'sending' ? <Loader2 size={16} className="animate-spin" /> : state === 'sent' ? <Check size={16} style={{ color: '#2CB67D' }} /> : <Mail size={16} />}
        {state === 'sent' ? 'Reenviar enlace' : 'Enviar enlace'}
      </button>
    </div>
  )
}

const FIELD = 'w-full border rounded-xl px-3 py-2 text-sm font-normal outline-none transition-all focus:ring-2 focus:ring-[#67B7E8]/20 focus:border-[#67B7E8]'
const fieldStyle = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }

// Nombre y teléfono editables; el resto de la cuenta lo gestiona AirSunBox.
function AccountEditor({ me, currentName, onCancel, onSaved }) {
  const [name, setName] = useState(currentName || '')
  const [phone, setPhone] = useState(me?.phone || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Escribí tu nombre.'); return }
    if (phone.trim() && !/^\+?[0-9\s()-]{7,30}$/.test(phone.trim())) {
      setError('Teléfono inválido: usá solo números, espacios, guiones o +.'); return
    }
    setSaving(true); setError('')
    try {
      onSaved(await auth.updateMe({ name: name.trim(), phone: phone.trim() || null }))
    } catch (err) {
      setError(err.message || 'No se pudieron guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <Row label={<label htmlFor="perfil-nombre">Nombre</label>}>
        <input id="perfil-nombre" className={FIELD} style={fieldStyle} value={name} maxLength={120}
               autoFocus autoComplete="name" onChange={e => { setName(e.target.value); setError('') }} />
      </Row>
      <Row label={<label htmlFor="perfil-telefono">Teléfono</label>}>
        <input id="perfil-telefono" className={FIELD} style={fieldStyle} value={phone} maxLength={30}
               type="tel" autoComplete="tel" placeholder="Ej.: +502 5555 1234"
               onChange={e => { setPhone(e.target.value); setError('') }} />
      </Row>
      {error && <p role="alert" className="text-sm pt-3" style={{ color: '#E5484D' }}>{error}</p>}
      <div className="flex gap-2 justify-end py-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-[#67B7E8] hover:bg-[#52A8E0] disabled:opacity-60">
          {saving && <Loader2 size={14} className="animate-spin" />} Guardar cambios
        </button>
      </div>
    </form>
  )
}

export default function Profile() {
  const { user, org, twoFactorStatus, updateUser } = useAuthStore()
  const location = useLocation()
  const [me, setMe] = useState(null)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // El estado del 2FA lo carga TwoFactorSection
    auth.me().then(setMe).catch(() => {})
  }, [])

  // El menú de usuario abre /profile#seguridad directo en esta sección
  useEffect(() => {
    if (location.hash === '#seguridad') {
      document.getElementById('seguridad')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash, me])

  const Layout = INTERNAL_ROLES.includes(user?.role) ? AdminLayout : ClienteLayout
  const email = me?.email || user?.email
  const name = me?.name || user?.name
  const protectedAccount = !!twoFactorStatus?.enabled
  const since = me?.created_at
    ? new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(me.created_at))
    : '—'

  return (
    <Layout>
      <div className="px-4 py-8 sm:px-8 lg:px-12 lg:py-12 max-w-3xl mx-auto">

        {/* Identidad */}
        <section className="flex flex-col sm:flex-row items-center sm:items-center gap-6 sm:gap-8 text-center sm:text-left">
          <ProtectionAvatar user={{ name, email }} protectedAccount={protectedAccount} />
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight break-words" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
              {name || email || 'Tu cuenta'}
            </h1>
            <p className="text-base mt-1 break-all" style={{ color: 'var(--text2)' }}>{email}</p>
            <p className="text-sm mt-3 inline-flex items-center gap-2" style={{ color: protectedAccount ? SKY : AMBER }}>
              <span className="w-2 h-2 rounded-full" style={{ background: protectedAccount ? SKY : AMBER }} />
              {protectedAccount
                ? 'Cuenta protegida con verificación en dos pasos'
                : 'Falta activar la verificación en dos pasos'}
            </p>
          </div>
        </section>

        {/* Cuenta */}
        <section className="mt-12">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Cuenta</h2>
            {!editing && me && (
              <button type="button" onClick={() => { setEditing(true); setSaved(false) }}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors hover:bg-[#67B7E8]/10"
                      style={{ color: SKY }}>
                <Pencil size={14} /> Editar
              </button>
            )}
          </div>
          {saved && (
            <p role="status" className="mt-2 text-sm inline-flex items-center gap-1.5" style={{ color: SKY }}>
              <Check size={14} /> Cambios guardados
            </p>
          )}
          <dl className="mt-2 rounded-2xl border px-5 sm:px-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            {editing ? (
              <AccountEditor
                me={me}
                currentName={name}
                onCancel={() => setEditing(false)}
                onSaved={(updated) => {
                  setMe(updated); setEditing(false); setSaved(true)
                  updateUser({ name: updated.name })
                }}
              />
            ) : (
              <>
                <Row label="Nombre">{name || 'Sin nombre registrado'}</Row>
                <Row label="Teléfono">{me?.phone || 'Sin teléfono registrado'}</Row>
              </>
            )}
            <Row label="Correo">{email}</Row>
            <Row label="Rol">{roleLabel(user?.role)}</Row>
            <Row label="Organización">{me?.org_name || org?.name || 'Sin organización'}</Row>
            <Row label="Plan"><span className="capitalize">{me?.plan || org?.plan || 'Free'}</span></Row>
            <Row label="Miembro desde">{since}</Row>
          </dl>
        </section>

        {/* Seguridad */}
        <section id="seguridad" className="mt-12 scroll-mt-8">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Seguridad</h2>
          <div className="mt-2 rounded-2xl border px-5 sm:px-6 divide-y" style={{ background: 'var(--card)', borderColor: 'var(--border)', '--tw-divide-opacity': 1 }}>
            <TwoFactorSection email={email} />
            <div style={{ borderColor: 'var(--border)' }}>
              <PasswordRow email={email} />
            </div>
          </div>
        </section>

      </div>
    </Layout>
  )
}
