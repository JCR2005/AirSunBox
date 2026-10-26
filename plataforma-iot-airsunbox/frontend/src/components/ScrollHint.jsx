import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

// Flecha que salta al pie de un contenedor con scroll cuando queda contenido
// por ver (la barra de scroll está oculta en toda la app). Se coloca como
// PRIMER hijo del contenedor que hace scroll; no ocupa espacio:
//
//   <div className="max-h-[90vh] overflow-y-auto">
//     <ScrollHint />
//     ...
//
// `bg` es el color del fondo del contenedor, para el degradado.
export default function ScrollHint({ bg = 'var(--card)' }) {
  const ref = useRef(null)
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ top: 0, padBottom: 0 })

  useEffect(() => {
    const el = ref.current?.parentElement
    if (!el) return
    const update = () => {
      const more = el.scrollHeight - el.clientHeight > 8
      setShow(more && el.scrollTop + el.clientHeight < el.scrollHeight - 8)
      // sticky se mide desde el borde interior del padding del contenedor
      const cs = getComputedStyle(el)
      const padTop = parseFloat(cs.paddingTop) || 0
      const padBottom = parseFloat(cs.paddingBottom) || 0
      setPos({ top: el.clientHeight - padTop - padBottom, padBottom })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    const mo = new MutationObserver(update)
    mo.observe(el, { childList: true, subtree: true, attributes: true })
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      ro.disconnect()
      mo.disconnect()
    }
  }, [])

  const scrollDown = () => {
    const el = ref.current?.parentElement
    el?.scrollBy({ top: Math.round(el.clientHeight * 0.6), behavior: 'smooth' })
  }

  // Sticky arriba con desplazamiento = alto visible: queda pegado al pie
  // del área visible mientras se hace scroll, sin ocupar espacio.
  return (
    <div ref={ref} aria-hidden="true" className="sticky z-20 h-0 pointer-events-none" style={{ top: pos.top }}>
      <div
        className="absolute left-0 right-0 h-14 flex items-end justify-center transition-opacity duration-200"
        style={{ bottom: -pos.padBottom, opacity: show ? 1 : 0, background: `linear-gradient(to top, ${bg} 40%, transparent)` }}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={scrollDown}
          className="mb-1 rounded-full p-0.5"
          style={{ pointerEvents: show ? 'auto' : 'none' }}
        >
          <ChevronDown size={22} className="animate-bounce" style={{ color: '#67B7E8' }} />
        </button>
      </div>
    </div>
  )
}
