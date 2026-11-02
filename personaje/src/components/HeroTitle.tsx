import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'

/** Hasta dónde llega la influencia del puntero, en píxeles. */
const RADIO = 160
/** Cuánto crece la letra que tiene el puntero encima. */
const CRECE = 0.42
/** Cuánto se eleva, en píxeles. */
const SUBE = 26
/** Grados de inclinación en el pico. */
const GIRA = 9

/**
 * El titular partido en letras, con dos animaciones que no se pisan.
 *
 * Cada letra son **dos** `<span>` anidados. El de fuera lo anima la entrada de
 * la página; el de dentro, el puntero. Si compartieran elemento, el `transform`
 * de uno borraría el del otro y las letras se quedarían a medio camino en cuanto
 * el ratón cruzara durante la entrada. Es el mismo motivo por el que el skew del
 * titular vive en el `<h1>` y no en las letras.
 *
 * Sin `overflow: hidden` en las líneas: el contorno del tratamiento `.dbz` sale
 * fuera del glifo y una máscara se lo comería.
 *
 * El `<h1>` lleva el texto real en `aria-label`; las letras van bajo
 * `aria-hidden` porque, sueltas, un lector de pantalla las deletrea.
 */

function Letras({ word, className = '' }: { word: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`block ${className}`}>
      {word.split('').map((char, i) => (
        <span
          key={`${char}-${i}`}
          className="hero-char inline-block will-change-transform"
          // Los espacios en un `inline-block` colapsan y las palabras se pegan.
          style={char === ' ' ? { width: '0.28em' } : undefined}
        >
          <span className="hero-iman inline-block">{char === ' ' ? '\u00a0' : char}</span>
        </span>
      ))}
    </span>
  )
}

export function HeroTitle({ lineas }: { lineas: [string, string] }) {
  const root = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    if (!window.matchMedia('(pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const letras = gsap.utils.toArray<HTMLElement>('.hero-iman', el)

    /*
     * Magnetismo por proximidad, no un `stagger` fijo.
     *
     * Un stagger reproduce siempre la misma ola vaya donde vaya el ratón. Aquí
     * cada letra mira **su** distancia al puntero, así que la deformación viaja
     * con la mano: el titular deja de ser una animación que se reproduce y pasa
     * a ser algo que el visitante empuja. Es la diferencia entre mirar y tocar.
     *
     * La inclinación alterna de signo según la posición de la letra, y eso es lo
     * que hace que no haya dos letras haciendo lo mismo: la de la izquierda del
     * puntero cae hacia un lado y la de la derecha hacia el otro, como si algo
     * las apartara al pasar.
     *
     * Va con `quickTo`, que reutiliza un tween en vez de crear uno nuevo en cada
     * `pointermove`. A la frecuencia de ese evento, crear tweens es lo que
     * convierte el efecto en un atasco.
     */
    /*
     * Una sola magnitud animada por letra: la "fuerza" con la que el puntero
     * tira de ella, de 0 a 1. Las tres deformaciones —escala, elevación y
     * giro— se derivan de ella al vuelo.
     *
     * El primer intento fue un `quickTo` para cada propiedad, y no funciona:
     * tres tweens simultáneos sobre el mismo elemento recomponen cada uno el
     * `transform` por su cuenta y gana el último en escribir. El resultado era
     * `transform: translate(...)` a secas — las letras subían pero ni crecían ni
     * giraban. Con un único escritor el problema desaparece de raíz, y además es
     * más honesto: conceptualmente hay UN valor por letra, no tres.
     */
    const setters = letras.map((letra) => {
      const estado = { fuerza: 0 }
      // El signo sale de la posición de la letra en la palabra, no de su
      // distancia: así las de un lado caen hacia un lado y las del otro hacia el
      // contrario, y no hay dos haciendo lo mismo.
      let lado = 1

      const aplicar = gsap.quickTo(estado, 'fuerza', {
        duration: 0.45,
        ease: 'power3',
        onUpdate: () => {
          const f = estado.fuerza
          gsap.set(letra, {
            scale: 1 + f * CRECE,
            y: -f * SUBE,
            rotate: f * GIRA * lado,
          })
        },
      })

      return {
        letra,
        empujar: (fuerza: number, signo: number) => {
          lado = signo
          aplicar(fuerza)
        },
      }
    })

    const mover = (e: PointerEvent) => {
      for (const { letra, empujar } of setters) {
        const caja = letra.getBoundingClientRect()
        const cx = caja.left + caja.width / 2
        const cy = caja.top + caja.height / 2

        const distancia = Math.hypot(e.clientX - cx, e.clientY - cy)
        const fuerza = Math.max(0, 1 - distancia / RADIO)

        // Al cuadrado: la caída lineal reparte el efecto entre demasiadas letras
        // y el titular entero se hincha. Así el pico queda donde está el ratón.
        empujar(fuerza * fuerza, Math.sign(cx - e.clientX) || 1)
      }
    }

    const soltar = () => {
      for (const { empujar } of setters) empujar(0, 1)
    }

    el.addEventListener('pointermove', mover)
    el.addEventListener('pointerleave', soltar)

    return () => {
      el.removeEventListener('pointermove', mover)
      el.removeEventListener('pointerleave', soltar)
    }
  }, [])

  return (
    <h1
      ref={root}
      aria-label={lineas.join(' ')}
      className="dbz mt-5 font-display text-display uppercase text-saiyan"
    >
      <Letras word={lineas[0]} />
      {/* La segunda línea se achica si es larga ("SSJ4 Daima", "Androide 8"):
          a 13vw no cabría en un móvil. */}
      <Letras word={lineas[1]} className={`text-accent ${lineas[1].length > 7 ? 'text-[0.62em]' : ''}`} />
    </h1>
  )
}
