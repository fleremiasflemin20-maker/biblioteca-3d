import { useCallback, useEffect, useState } from 'react'
import { CATALOGO, CATEGORIAS, rutaPortada } from '../lib/catalogo'
import { sfx, vibrar } from '../lib/consola'

/**
 * Pantalla de título, como al encender una consola: el logo, un desfile de
 * figuras y "Pulsa START". Sale una vez por visita (sessionStorage) y se
 * quita con cualquier tecla, clic, toque o botón del mando.
 */
const LLAVE = 'inicio-visto'
// En el desfile solo personajes: las piezas técnicas no lucen como retrato.
const FIGURAS: string[] = ['dragon-ball-z', 'caballeros-del-zodiaco', 'siete-pecados', 'your-name', 'anime', 'manga', 'seres-flemin', 'munecos']

export function useInicio() {
  const [ver, setVer] = useState(() => {
    try {
      return !sessionStorage.getItem(LLAVE) && !location.hash
    } catch {
      return false
    }
  })
  const cerrar = useCallback(() => {
    try {
      sessionStorage.setItem(LLAVE, '1')
    } catch {
      /* modo privado */
    }
    setVer(false)
  }, [])
  return { ver, cerrar }
}

export function Inicio({ onEntrar }: { onEntrar: () => void }) {
  const [saliendo, setSaliendo] = useState(false)
  // Dos filas de retratos que desfilan en sentidos opuestos detrás del logo.
  const [filas] = useState(() => {
    const con = CATALOGO.filter((m) => m.portada && !m.sinTextura && FIGURAS.includes(m.categoria))
    const mezcla = [...con].sort(() => Math.random() - 0.5).slice(0, 28)
    return [mezcla.slice(0, 14), mezcla.slice(14)]
  })
  const secciones = CATEGORIAS.filter((c) => c.id !== 'todo' && CATALOGO.some((m) => m.categoria === c.id)).length

  const entrar = useCallback(() => {
    if (saliendo) return
    setSaliendo(true)
    sfx.inicio()
    vibrar(true)
    setTimeout(onEntrar, 650)
  }, [saliendo, onEntrar])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      e.preventDefault()
      entrar()
    }
    window.addEventListener('keydown', tecla)
    // Cualquier botón del mando cuenta como START.
    let raf = 0
    const ciclo = () => {
      raf = requestAnimationFrame(ciclo)
      const p = 'getGamepads' in navigator ? [...navigator.getGamepads()].find(Boolean) : null
      if (p?.buttons.some((b) => b.pressed)) entrar()
    }
    raf = requestAnimationFrame(ciclo)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      cancelAnimationFrame(raf)
      document.documentElement.style.overflow = ''
    }
  }, [entrar])

  return (
    <div
      className={`inicio fixed inset-0 z-[80] flex cursor-pointer select-none flex-col items-center justify-center overflow-hidden bg-[#07050d] text-white ${saliendo ? 'inicio-sale' : ''}`}
      onPointerDown={entrar}
      role="button"
      aria-label="Pulsa para entrar a la biblioteca"
    >
      <div aria-hidden className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_45%,#3b1a6e_0%,#140a2a_55%,#07050d_100%)]" />
        <div className="rayos absolute left-1/2 top-[45%] h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2 opacity-[0.12]" style={{ background: 'repeating-conic-gradient(from 0deg, #FFC23D 0deg 2deg, transparent 2deg 12deg)', maskImage: 'radial-gradient(circle, black 0%, transparent 40%)', WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 40%)' }} />
        {filas.map((fila, k) => (
          <div key={k} className={`absolute inset-x-0 flex w-max gap-4 opacity-30 ${k ? 'desfile-inverso bottom-[7%]' : 'desfile top-[7%]'}`}>
            {[...fila, ...fila].map((m, j) => (
              <img key={`${m.id}-${j}`} src={rutaPortada(m)} alt="" draggable={false} className="h-[18svh] w-[18svh] object-contain" />
            ))}
          </div>
        ))}
        <div className="haces absolute inset-x-[15%] bottom-0 top-[25%]" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-40" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_50%,transparent_50%,rgba(0,0,0,0.85))]" />
      </div>

      <div aria-hidden className="hud-esquinas pointer-events-none absolute inset-3">
        <i /><i /><i /><i />
      </div>

      <div className="relative flex flex-col items-center px-4 text-center">
        <p className="inicio-entra font-chakra text-[12px] font-semibold uppercase tracking-[0.5em] text-[#FFC23D] sm:text-[13px]">Fleremiasflemin presenta</p>
        <h1 className="inicio-logo mt-3 font-flemin text-[clamp(3rem,11vw,8.5rem)] leading-[0.9]">
          <span className="logo-brillo">Biblioteca</span>
          <span className="block bg-gradient-to-r from-[#FFC23D] via-[#FF6A13] to-[#FF2D8A] bg-clip-text text-transparent [filter:drop-shadow(0_6px_0_#1a1033)] [text-shadow:none]">3D</span>
        </h1>
        <p className="inicio-entra mt-4 font-chakra text-[13px] uppercase tracking-[0.3em] text-white/60" style={{ animationDelay: '0.5s' }}>
          {CATALOGO.length} figuras · {secciones} secciones
        </p>
        <p className="inicio-entra rareza mt-3 bg-gradient-to-r from-[#8A3CFF] to-[#FF2D8A] px-4 py-1 font-chakra text-[11px] font-bold uppercase tracking-[0.35em]" style={{ animationDelay: '0.7s' }}>
          Edición coleccionista
        </p>
        <p className="parpadeo mt-14 font-chakra text-[clamp(1rem,2.4vw,1.4rem)] font-bold uppercase tracking-[0.4em] text-white">Pulsa start</p>
        <p className="mt-2 font-chakra text-[11px] uppercase tracking-[0.25em] text-white/40">Cualquier tecla · clic · botón del mando</p>
      </div>

      <p className="absolute bottom-4 font-chakra text-[10.5px] uppercase tracking-[0.25em] text-white/35">© 2026 Flemin Studio · Quito, EC</p>
    </div>
  )
}
