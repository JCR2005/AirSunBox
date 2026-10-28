import { useState } from 'react'
import { Copy, Check, ChevronDown, Info } from 'lucide-react'

const ACCENT = '#67B7E8'

function CopyBtn({ text, id, copiedKey, onCopy, children = 'Copiar' }) {
  const done = copiedKey === id
  return (
    <button
      type="button"
      onClick={() => onCopy(text, id)}
      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
      style={{ color: done ? '#1D9E75' : 'var(--text2)' }}
    >
      {done ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> {children}</>}
    </button>
  )
}

function Step({ n, title, hint, children, last }) {
  return (
    <li className="relative pl-12">
      {!last && <span className="absolute left-[15px] top-9 bottom-0 w-px" style={{ background: 'var(--border)' }} aria-hidden="true" />}
      <span className="absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: ACCENT }}>{n}</span>
      <h3 className="text-base font-semibold pt-1" style={{ color: 'var(--text)' }}>{title}</h3>
      {hint && <p className="text-sm mt-0.5 max-w-2xl" style={{ color: 'var(--text2)' }}>{hint}</p>}
      <div className="mt-3 pb-8">{children}</div>
    </li>
  )
}

// Guía para conectar una estación: dirección, formato del JSON y código.
// `vars` trae la clave que envía la estación (station_key) de cada variable.
export default function EspConnect({ endpoint, hasToken, vars, json, sketch, inSpace, copiedKey, onCopy }) {
  const [showCode, setShowCode] = useState(false)
  const key = (v) => v.station_key || v.label

  return (
    <div className="rounded-3xl border p-6 md:p-8" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <h2 className="text-xl font-bold" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>Conectar la estación</h2>
      <p className="text-sm mt-1 mb-8 max-w-2xl" style={{ color: 'var(--text2)' }}>
        La estación envía sus lecturas con una petición HTTP POST en formato JSON. Estos son los datos exactos para programarla.
      </p>

      <ol>
        <Step n={1} title="Dirección de envío" hint="El token al final de la dirección identifica a esta estación. No lo compartas.">
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: ACCENT + '22', color: ACCENT }}>POST</span>
            <code className="text-xs md:text-sm flex-1 break-all" style={{ color: 'var(--text)' }}>{endpoint}</code>
            <CopyBtn text={endpoint} id="endpoint" copiedKey={copiedKey} onCopy={onCopy} />
          </div>
          {!hasToken && <p className="text-sm mt-2" style={{ color: '#B7791F' }}>Esta estación todavía no tiene token.</p>}
        </Step>

        <Step n={2} title="Qué datos enviar" hint="Un objeto JSON con una clave por variable y su valor numérico. La hora la pone el servidor al recibirlo.">
          {vars.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text2)' }}>La estación no tiene variables asignadas. Agregalas desde «Editar variables» del espacio.</p>
          ) : (
            <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-4">
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--bg)' }}>
                      <th className="text-left font-semibold px-4 py-2.5" style={{ color: 'var(--text2)' }}>Clave en el JSON</th>
                      <th className="text-left font-semibold px-4 py-2.5" style={{ color: 'var(--text2)' }}>Variable</th>
                      <th className="text-left font-semibold px-4 py-2.5" style={{ color: 'var(--text2)' }}>Unidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vars.map(v => (
                      <tr key={v.label} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-4 py-2.5"><code className="text-sm font-semibold" style={{ color: ACCENT }}>{key(v)}</code></td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--text)' }}>{v.name}</td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--text2)' }}>{v.unit || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-xl border" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between px-3 pt-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text2)' }}>Ejemplo</span>
                  <CopyBtn text={json} id="json" copiedKey={copiedKey} onCopy={onCopy} />
                </div>
                <pre className="text-sm font-mono px-4 pb-4 pt-1 overflow-x-auto" style={{ color: 'var(--text)' }}>{json}</pre>
              </div>
            </div>
          )}
          {inSpace && (
            <p className="flex items-start gap-2 text-sm mt-3" style={{ color: 'var(--text2)' }}>
              <Info size={15} className="shrink-0 mt-0.5" style={{ color: ACCENT }} />
              Las claves que no sean variables de este espacio se ignoran.
            </p>
          )}
        </Step>

        <Step n={3} title="Código de ejemplo" hint="Sketch para ESP32/ESP8266 en Arduino IDE. Completá tu WiFi y reemplazá los valores de ejemplo por las lecturas de tus sensores." last>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
              <button type="button" onClick={() => setShowCode(v => !v)} aria-expanded={showCode}
                      className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                <ChevronDown size={16} className={`transition-transform ${showCode ? 'rotate-180' : ''}`} />
                {showCode ? 'Ocultar código' : 'Ver código completo'}
              </button>
              <CopyBtn text={sketch} id="sketch" copiedKey={copiedKey} onCopy={onCopy}>Copiar código</CopyBtn>
            </div>
            <pre className={`text-xs font-mono px-4 py-3 overflow-x-auto ${showCode ? 'max-h-[520px]' : 'max-h-[180px]'} overflow-y-auto`}
                 style={{ color: 'var(--text)', background: 'var(--card)' }}>{sketch}</pre>
          </div>
        </Step>
      </ol>
    </div>
  )
}
