import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, Check, Copy, Download, Loader2, Mail } from 'lucide-react'
import useAuthStore from '../../store/auth'

const SKY = '#67B7E8'
const AMBER = '#E0A23B'
const RED = '#E5484D'

const POLICY_TEXT = {
  required_admins: 'Tu organización exige la verificación en dos pasos a los administradores.',
  required_all: 'Tu organización exige la verificación en dos pasos a todas las cuentas.',
}

const btnPrimary = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors bg-[#67B7E8] hover:bg-[#55A6D7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B7E8]/40 disabled:opacity-50 disabled:cursor-not-allowed'
const btnSecondary = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:border-[#67B7E8]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67B7E8]/40 disabled:opacity-50'

function CodeInput({ value, onChange, backup = false, disabled }) {
  return (
    <input
      inputMode={backup ? 'text' : 'numeric'}
      autoComplete="one-time-code"
      maxLength={backup ? 9 : 6}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(backup
        ? e.target.value.toUpperCase().replace(/[^0-9A-F-]/g, '').slice(0, 9)
        : e.target.value.replace(/\D/g, '').slice(0, 6))}
      placeholder={backup ? '123456 o A1B2-C3D4' : '000000'}
      aria-label={backup ? 'Código del correo o de respaldo' : 'Código de 6 dígitos'}
      className="w-full sm:w-56 px-4 py-2.5 rounded-xl border text-center text-lg tracking-[0.3em] font-semibold outline-none transition-colors focus:border-[#67B7E8] focus:ring-2 focus:ring-[#67B7E8]/25 placeholder:tracking-normal placeholder:text-sm placeholder:font-normal"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
    />
  )
}

// Códigos de respaldo: se muestran una sola vez, al activar.
function BackupCodesDialog({ codes, onClose }) {
  const [copied, setCopied] = useState(false)
  const copyAll = async () => {
    await navigator.clipboard.writeText(codes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const download = () => {
    const blob = new Blob([`Códigos de respaldo de AirSunBox\nCada código sirve una sola vez.\n\n${codes.join('\n')}\n`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'airsunbox-codigos-de-respaldo.txt'; a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="backup-title">
      <div className="w-full max-w-md rounded-3xl border p-6 sm:p-8 shadow-2xl user-menu-pop" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(103,183,232,0.14)', color: SKY }}>
          <ShieldCheck size={24} />
        </div>
        <h3 id="backup-title" className="mt-4 text-xl font-bold" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
          Verificación activada
        </h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--text2)' }}>
          Guarda estos códigos. Si un día no te llega el correo, cada uno te deja entrar una vez. No se vuelven a mostrar.
        </p>
        <ol className="mt-5 grid grid-cols-2 gap-2">
          {codes.map(code => (
            <li key={code} className="rounded-xl border py-2.5 text-center text-base font-semibold tracking-[0.12em] select-all"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {code}
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={copyAll} className={`${btnSecondary} flex-1`} style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}>
            {copied ? <Check size={16} style={{ color: '#2CB67D' }} /> : <Copy size={16} />} {copied ? 'Copiados' : 'Copiar todos'}
          </button>
          <button type="button" onClick={download} className={`${btnSecondary} flex-1`} style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}>
            <Download size={16} /> Descargar
          </button>
        </div>
        <button type="button" onClick={onClose} className={`${btnPrimary} w-full mt-2`}>Ya los guardé</button>
      </div>
    </div>
  )
}

export default function TwoFactorSection({ email }) {
  const { twoFactorStatus, backupCodes, twoFactorLoading, twoFactorError, fetch2faStatus, send2faCode, enable2fa, disable2fa } = useAuthStore()
  const [mode, setMode] = useState('idle')      // idle | enabling | disabling
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [showCodes, setShowCodes] = useState(false)

  useEffect(() => { fetch2faStatus() }, [fetch2faStatus])

  const enabled = !!twoFactorStatus?.enabled
  const policyText = POLICY_TEXT[twoFactorStatus?.policy]

  const reset = () => { setMode('idle'); setCode(''); setCodeSent(false); useAuthStore.setState({ twoFactorError: null }) }

  const sendCode = async () => {
    const r = await send2faCode()
    if (r.ok) setCodeSent(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    const r = mode === 'enabling' ? await enable2fa(code) : await disable2fa(code)
    if (r.ok) {
      if (mode === 'enabling') setShowCodes(true)
      reset()
    }
  }

  const codeReady = mode === 'enabling' ? code.length === 6 : (code.length === 6 || code.length === 9)

  return (
    <div className="py-5">
      {showCodes && backupCodes?.length > 0 && <BackupCodesDialog codes={backupCodes} onClose={() => setShowCodes(false)} />}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center"
             style={{ background: enabled ? 'rgba(103,183,232,0.12)' : 'rgba(224,162,59,0.14)', color: enabled ? SKY : AMBER }}>
          {enabled ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Verificación en dos pasos <span className="font-normal" style={{ color: enabled ? SKY : AMBER }}>({enabled ? 'activada' : 'desactivada'})</span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text2)' }}>
            {enabled
              ? `Al iniciar sesión te pedimos un código enviado a tu correo. Te quedan ${twoFactorStatus?.backupCodesLeft ?? 0} códigos de respaldo.`
              : 'Además de tu contraseña, al iniciar sesión te pediremos un código que llega a tu correo.'}
          </p>
          {policyText && <p className="text-sm mt-1" style={{ color: AMBER }}>{policyText}</p>}
        </div>
        {mode === 'idle' && (
          enabled
            ? <button type="button" onClick={() => setMode('disabling')} className={btnSecondary} style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}>Desactivar</button>
            : <button type="button" onClick={() => setMode('enabling')} className={btnPrimary}>Activar</button>
        )}
      </div>

      {mode !== 'idle' && (
        <form onSubmit={submit} className="mt-5 sm:ml-14 rounded-2xl border p-4 sm:p-5" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <ol className="space-y-5">
            <li className="flex gap-3">
              <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: codeSent ? '#2CB67D' : 'rgba(103,183,232,0.16)', color: codeSent ? '#fff' : SKY }}>
                {codeSent ? <Check size={14} /> : 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm" style={{ color: 'var(--text)' }}>
                  {codeSent
                    ? <>Enviamos un código a <strong>{email}</strong>. Vence en 10 minutos.</>
                    : <>Te enviaremos un código a <strong>{email || 'tu correo'}</strong>.</>}
                </p>
                <button type="button" onClick={sendCode} disabled={twoFactorLoading}
                        className="mt-2 inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:underline disabled:opacity-50" style={{ color: SKY }}>
                  {twoFactorLoading && !code ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  {codeSent ? 'Enviar otro código' : 'Enviar código'}
                </button>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(103,183,232,0.16)', color: SKY }}>2</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm" style={{ color: 'var(--text)' }}>
                  {mode === 'enabling' ? 'Escribe el código que te llegó.' : 'Escribe el código del correo o uno de tus códigos de respaldo.'}
                </p>
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <CodeInput value={code} onChange={setCode} backup={mode === 'disabling'} disabled={twoFactorLoading} />
                  <button type="submit" disabled={!codeReady || twoFactorLoading}
                          className={mode === 'enabling' ? btnPrimary : `${btnSecondary} hover:!border-red-400`}
                          style={mode === 'enabling' ? undefined : { borderColor: 'var(--border)', color: RED, background: 'var(--card)' }}>
                    {twoFactorLoading && code ? <Loader2 size={16} className="animate-spin" /> : null}
                    {mode === 'enabling' ? 'Activar verificación' : 'Desactivar verificación'}
                  </button>
                </div>
              </div>
            </li>
          </ol>

          {twoFactorError && (
            <p role="alert" className="mt-4 text-sm" style={{ color: RED }}>
              {twoFactorError === 'No se pudo enviar el código por email'
                ? 'No pudimos enviar el correo: el servicio de correo no está disponible. Inténtalo más tarde o avisa al administrador.'
                : twoFactorError}
            </p>
          )}

          <button type="button" onClick={reset} className="mt-4 text-sm font-medium hover:underline" style={{ color: 'var(--text2)' }}>
            Cancelar
          </button>
        </form>
      )}
    </div>
  )
}
