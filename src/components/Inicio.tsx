import { useCallback, useEffect, useState } from 'react'
import { CATALOGO, CATEGORIAS } from '../lib/catalogo'
import { audioListo, despertarAudio, sfx, vibrar } from '../lib/consola'
import { TituloFlemin } from './TituloFlemin'
import { PilaComics } from './PilaComics'

/**
 * Pantalla de título, como al encender una consola: el logo sobre un montón
 * de cómics y mangas con nuestras figuras, y "¡Pulsa START!". Sale una vez por visita (sessionStorage) y se
 * quita con cualquier tecla, clic, toque o botón del mando.
 */
const LLAVE = 'inicio-visto'

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
  // Si el navegador tenía el audio bloqueado, el primer START despierta el
  // sonido y repite la entrada del título con sus efectos; el segundo entra.
  const [bloqueado] = useState(() => !audioListo())
  const [repeticion, setRepeticion] = useState(0)
  const secciones = CATEGORIAS.filter((c) => c.id !== 'todo' && CATALOGO.some((m) => m.categoria === c.id)).length

  const entrar = useCallback(() => {
    if (saliendo) return
    if (bloqueado && repeticion === 0) {
      despertarAudio()
      setRepeticion(1)
      return
    }
    setSaliendo(true)
    sfx.inicio()
    vibrar(true)
    setTimeout(onEntrar, 650)
  }, [saliendo, onEntrar, bloqueado, repeticion])

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
      {/* Un montón de cómics y mangas revueltos con nuestras figuras en las tapas. */}
      <PilaComics />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* Sombra central para que el título se lea sobre la pila, y trama de imprenta encima. */}
        <div className="absolute inset-0 bg-[radial-gradient(52%_46%_at_50%_50%,rgba(7,5,13,0.94)_0%,rgba(7,5,13,0.82)_50%,rgba(7,5,13,0.1)_100%)]" />
        <div className="absolute inset-0 opacity-[0.18] [background:radial-gradient(circle,#000_1.2px,transparent_1.6px)_0_0/7px_7px]" />
        <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_50%,transparent_60%,rgba(0,0,0,0.7))]" />
      </div>

      <div aria-hidden className="hud-esquinas pointer-events-none absolute inset-3">
        <i /><i /><i /><i />
      </div>

      <div className="relative flex flex-col items-center px-4 text-center">
        <p className="inicio-entra cartela-comic -rotate-2 px-3 py-1 font-comic text-[15px] uppercase tracking-[0.18em] sm:text-[17px]">Fleremiasflemin presenta…</p>
        <h1 className="sr-only">Biblioteca Flemin 3D</h1>
        <TituloFlemin
          key={repeticion}
          respaldo={
            <p aria-hidden className="inicio-logo mt-3 font-flemin text-[clamp(3rem,11vw,8.5rem)] leading-[0.9]">
              <span className="logo-brillo">Biblioteca Flemin</span>
              <span className="block bg-gradient-to-r from-[#FFC23D] via-[#FF6A13] to-[#FF2D8A] bg-clip-text text-transparent [filter:drop-shadow(0_6px_0_#1a1033)] [text-shadow:none]">3D</span>
            </p>
          }
        />
        <p className="inicio-entra mt-4 font-chakra text-[13px] uppercase tracking-[0.3em] text-white/60" style={{ animationDelay: '0.5s' }}>
          {CATALOGO.length} figuras · {secciones} secciones
        </p>
        <p className="inicio-entra rareza mt-3 bg-gradient-to-r from-[#8A3CFF] to-[#FF2D8A] px-4 py-1 font-chakra text-[11px] font-bold uppercase tracking-[0.35em]" style={{ animationDelay: '0.7s' }}>
          Edición coleccionista
        </p>
        <p className="boom-start mt-12 font-comic text-[clamp(1.5rem,3.4vw,2.3rem)] uppercase leading-none tracking-[0.08em]">¡Pulsa start!</p>
        <p className="mt-2 font-chakra text-[11px] uppercase tracking-[0.25em] text-white/70 [text-shadow:0_1px_4px_#000]">{bloqueado && repeticion === 0 ? 'Pulsa para ver el título con sonido' : 'Cualquier tecla · clic · botón del mando'}</p>
      </div>

      <p className="absolute bottom-4 bg-black/60 px-2 py-0.5 font-chakra text-[10.5px] uppercase tracking-[0.25em] text-white/60">© 2026 Flemin Studio · Quito, EC</p>
    </div>
  )
}
