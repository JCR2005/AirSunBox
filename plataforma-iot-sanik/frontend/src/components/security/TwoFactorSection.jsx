import { useState, useEffect } from 'react'
import { Shield, ShieldCheck, ShieldAlert, AlertCircle, Check, Copy, Download, X, Loader2, Eye, EyeOff } from 'lucide-react'
import useAuthStore from '../../store/auth'

export default function TwoFactorSection() {
  const { 
    org, 
    twoFactorStatus, 
    backupCodes, 
    twoFactorLoading, 
    twoFactorError,
    fetch2faStatus, 
    enable2fa, 
    disable2fa 
  } = useAuthStore()

  const [step, setStep] = useState('idle')
  const [otpCode, setOtpCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState(-1)

  useEffect(() => {
    fetch2faStatus()
  }, [fetch2faStatus])

  const handleEnable = async (e) => {
    e.preventDefault()
    if (!otpCode || otpCode.length !== 6) return
    const result = await enable2fa(otpCode)
    if (result.ok) {
      setShowBackupCodes(true)
      setStep('backup')
    }
  }

  const handleDisable = async (e) => {
    e.preventDefault()
    if (!disableCode) return
    const result = await disable2fa(disableCode)
    if (result.ok) {
      setStep('enabled')
      setDisableCode('')
    }
  }

  const copyCode = (code, index) => {
    navigator.clipboard.writeText(code)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(-1), 2000)
  }

  const downloadCodes = () => {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sanik-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const policyLabels = {
    optional: { label: 'Opcional', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' },
    required_admins: { label: 'Requerido para admins', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400' },
    required_all: { label: 'Requerido para todos', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' }
  }

  const isEnabled = twoFactorStatus?.enabled ?? false
  const policy = twoFactorStatus?.policy || 'optional'
  const isRequired = policy !== 'optional'
  const policyInfo = policyLabels[policy] || policyLabels.optional

  if (step === 'backup') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700 animate-in slide-in-from-bottom-4 duration-300">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
              <ShieldCheck size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>¡2FA Activado!</h3>
            <p className="text-sm" style={{ color: 'var(--text2)' }}>
              Guarda tus códigos de respaldo ahora. <strong>No se mostrarán de nuevo.</strong>
            </p>
          </div>

          <div className="space-y-2 mb-6 max-h-64 overflow-y-auto pr-2" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            {backupCodes.map((code, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl border" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                <code className="font-mono text-lg font-bold tracking-widest text-center flex-1" style={{ color: 'var(--text)', letterSpacing: '0.15em' }}>
                  {backupCodes[i]}
                </code>
                <button
                  onClick={() => copyCode(backupCodes[i], i)}
                  className="p-2 rounded-lg transition-colors"
                  style={{ background: 'var(--bg)', color: 'var(--text2)', borderColor: 'var(--border)' }}
                >
                  {copiedIndex === i ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadCodes}
              className="flex-1 py-3 px-4 rounded-xl font-bold border transition-colors"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <Download size={18} className="inline mr-2" /> Descargar
            </button>
            <button
              onClick={() => { setShowBackupCodes(false); setStep('idle'); }}
              className="flex-1 py-3 px-4 rounded-xl font-bold transition-colors"
              style={{ background: 'var(--primary)', color: 'white' }}
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {!isEnabled && (
        <div className="rounded-3xl p-8 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316' }}>
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Autenticación de dos factores</h3>
                <p className="text-sm" style={{ color: 'var(--text2)' }}>Añade una capa extra de seguridad a tu cuenta</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${policyInfo.bg} ${policyInfo.text}`}>
              {policyInfo.label}
            </span>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl p-4" style={{ background: 'var(--bg)', borderColor: 'var(--border)', borderWidth: '1px', borderStyle: 'solid' }}>
              <h4 className="font-bold mb-2" style={{ color: 'var(--text)' }}>¿Cómo funciona?</h4>
              <ul className="text-sm space-y-2" style={{ color: 'var(--text2)' }}>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--primary)' }}></span> Al iniciar sesión, recibirás un código de 6 dígitos por email</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--primary)' }}></span> Ingresa el código para acceder</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--primary)' }}></span> Recibirás 8 códigos de respaldo (guárdalos seguros)</li>
              </ul>
            </div>

            <form onSubmit={handleEnable} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>Código de 6 dígitos recibido por email</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full px-4 py-3 rounded-xl border text-center text-2xl tracking-widest font-mono transition-colors"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  autoComplete="one-time-code"
                  required
                  disabled={twoFactorLoading}
                />
              </div>
              <button
                type="submit"
                disabled={twoFactorLoading || otpCode.length !== 6}
                className="w-full py-3 px-6 rounded-xl font-bold transition-colors"
                style={{ background: 'var(--primary)', color: 'white', opacity: (twoFactorLoading || otpCode.length !== 6) ? 0.6 : 1 }}
              >
                {twoFactorLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Activando...
                  </span>
                ) : (
                  'Activar 2FA'
                )}
              </button>
            </form>

            {twoFactorError && (
              <div className="p-3 rounded-xl text-sm flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', borderWidth: '1px', borderStyle: 'solid' }}>
                <AlertCircle size={16} /> {twoFactorError}
              </div>
            )}

            {isRequired && (
              <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', borderWidth: '1px', borderStyle: 'solid' }}>
                <p className="text-sm flex items-center gap-2" style={{ color: '#EF4444' }}>
                  <Shield size={16} />
                  <strong>Política de organización:</strong> {policyInfo.label}. Debes activar 2FA para acceder.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-3xl p-8 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>2FA Activado</h3>
              <p className="text-sm" style={{ color: 'var(--text2)' }}>Tu cuenta tiene protección adicional</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${policyInfo.bg} ${policyInfo.text}`}>
            {policyInfo.label}
          </span>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl p-4" style={{ background: 'var(--bg)', borderColor: 'var(--border)', borderWidth: '1px', borderStyle: 'solid' }}>
            <h4 className="font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <Shield size={16} /> Tu cuenta está protegida
            </h4>
            <ul className="text-sm space-y-2" style={{ color: 'var(--text2)' }}>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }}></span> Código OTP por email al iniciar sesión</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }}></span> {backupCodes.length} códigos de respaldo guardados</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }}></span> Bloqueo tras 3 intentos fallidos (15 min)</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('disabling')}
              className="flex-1 py-3 px-6 rounded-xl font-bold border transition-colors"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Desactivar 2FA
            </button>
            <button
              onClick={() => setShowBackupCodes(true)}
              className="flex-1 py-3 px-6 rounded-xl font-bold transition-colors"
              style={{ background: 'var(--primary)', color: 'white' }}
            >
              Ver códigos de respaldo
            </button>
          </div>

          {twoFactorError && (
            <div className="p-3 rounded-xl text-sm flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', borderWidth: '1px', borderStyle: 'solid' }}>
              <AlertCircle size={16} /> {twoFactorError}
            </div>
          )}

          {step === 'disabling' && (
            <form onSubmit={handleDisable} className="mt-6 space-y-4 animate-in slide-in-from-top-2">
              <div className="rounded-xl p-4 border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }}>
                <h4 className="font-bold mb-2 flex items-center gap-2" style={{ color: '#EF4444' }}>
                  <ShieldAlert size={16} /> Desactivar 2FA
                </h4>
                <p className="text-sm mb-4" style={{ color: 'var(--text2)' }}>
                  Ingresa un código OTP de tu email <strong>o</strong> uno de tus códigos de respaldo para confirmar.
                </p>
                <input
                  type="text"
                  maxLength={11}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.toUpperCase().replace(/[^0-9A-F-]/g, '').slice(0, 11))}
                  placeholder="123456 o ABCD-EF12"
                  className="w-full px-4 py-3 rounded-xl border text-center text-lg tracking-widest font-mono transition-colors"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  required
                  disabled={twoFactorLoading}
                />
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setStep('enabled')}
                    className="flex-1 py-3 px-4 rounded-xl font-bold border transition-colors"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={twoFactorLoading || !disableCode}
                    className="flex-1 py-3 px-6 rounded-xl font-bold transition-colors"
                    style={{ background: '#EF4444', color: 'white', opacity: twoFactorLoading ? 0.6 : 1 }}
                  >
                    {twoFactorLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> Desactivando...
                      </span>
                    ) : (
                      'Desactivar 2FA'
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}