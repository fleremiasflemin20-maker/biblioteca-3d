import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Las cinco entradas. Cada titular de la página usa una distinta.
 *
 * No es variedad por capricho: cuatro titulares con la misma entrada se leen
 * como una plantilla repetida, y en una pieza cuyo argumento es «esto no es una
 * plantilla», eso es justo lo que no puede pasar. Además cada una encaja con lo
 * que dice su capítulo — la del combate golpea, la del traje se despliega.
 *
 * Todas van letra a letra con `stagger`, que es lo que las hace parecer una ola
 * atravesando el texto y no un bloque moviéndose.
 */
const ENTRADAS = {
  /** Caen desde arriba y rebotan. Para el titular que anuncia un hallazgo. */
  caida: {
    desde: { yPercent: -140, opacity: 0, rotate: -14 },
    hasta: { yPercent: 0, opacity: 1, rotate: 0, ease: 'back.out(2.2)', stagger: 0.04 },
  },

  /** Entran de lado inclinadas y se enderezan. Como algo que se despliega. */
  barrido: {
    desde: { xPercent: -70, opacity: 0, skewX: 28 },
    hasta: { xPercent: 0, opacity: 1, skewX: 0, ease: 'power4.out', stagger: 0.032 },
  },

  /** Llegan enormes y se contraen, abriéndose desde el centro. Es el impacto. */
  impacto: {
    desde: { scale: 2.8, opacity: 0 },
    hasta: {
      scale: 1,
      opacity: 1,
      ease: 'power4.out',
      stagger: { each: 0.035, from: 'center' as const },
    },
  },

  /**
   * Dos corrientes de letras, una desde arriba y otra desde abajo, que se
   * encuentran en la línea.
   *
   * Es la entrada del capítulo que cuenta una fusión, y por eso no es una ola
   * sino dos cosas convergiendo. El índice de cada letra decide su lado, así
   * que el efecto se dibuja solo con el texto que le pongas.
   */
  fusion: {
    desde: {
      yPercent: (i: number) => (i % 2 ? 165 : -165),
      rotate: (i: number) => (i % 2 ? 12 : -12),
      opacity: 0,
    },
    hasta: { yPercent: 0, rotate: 0, opacity: 1, ease: 'power4.out', stagger: 0.028 },
  },

  /** Voltean sobre su eje horizontal, como fichas que se dan la vuelta. */
  giro: {
    desde: { rotateX: -95, opacity: 0, transformOrigin: '50% 50% -0.4em' },
    hasta: { rotateX: 0, opacity: 1, ease: 'back.out(1.7)', stagger: 0.045 },
  },
} as const

export type Entrada = keyof typeof ENTRADAS

/**
 * Un titular de sección con dos animaciones que no se pisan.
 *
 * Cada letra son **dos** `<span>`: el de fuera lo anima la entrada por scroll, el
 * de dentro el puntero. Compartiendo elemento, el `transform` de uno borraría el
 * del otro y bastaría pasar el ratón mientras entra para dejar letras a medio
 * camino. Mismo patrón que en el titular del hero.
 *
 * El texto se parte en letras, así que para un lector de pantalla el titular
 * pasaría a ser una ristra de nodos sueltos que deletrea. Por eso las letras van
 * bajo `aria-hidden` y el texto real viaja en el `aria-label` del `<h2>`.
 */

function Letras({ texto }: { texto: string }) {
  return (
    <span className="block">
      {texto.split('').map((char, i) => (
        <span
          key={`${char}-${i}`}
          className="titulo-entrada inline-block will-change-transform"
          // Los espacios en un `inline-block` colapsan y las palabras se pegan.
          style={char === ' ' ? { width: '0.28em' } : undefined}
        >
          <span className="titulo-letra inline-block">{char === ' ' ? ' ' : char}</span>
        </span>
      ))}
    </span>
  )
}

export function TituloVivo({
  lineas,
  entrada = 'caida',
  className = '',
}: {
  lineas: string[]
  entrada?: Entrada
  className?: string
}) {
  const root = useRef<HTMLHeadingElement>(null)
  const corriendo = useRef(false)

  // ── Entrada por scroll ────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return

    const ctx = gsap.context(() => {
      const letras = el.querySelectorAll('.titulo-entrada')

      gsap.matchMedia().add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(letras, { opacity: 1, clearProps: 'transform' })
      })

      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        const { desde, hasta } = ENTRADAS[entrada]

        gsap.fromTo(letras, desde, {
          ...hasta,
          duration: 0.75,
          scrollTrigger: {
            trigger: el,
            start: 'top 82%',
            // `restart` al volver a entrar: si solo se reprodujera una vez,
            // quien sube y vuelve a bajar se encuentra el titular ya puesto y
            // se pierde justo lo que se ha trabajado.
            toggleActions: 'restart none none reverse',
          },
        })
      })
    }, el)

    return () => ctx.revert()
  }, [entrada])

  // ── Golpe al pasar el puntero ─────────────────────────────────────────────
  const golpear = () => {
    if (!root.current || corriendo.current) return
    if (!window.matchMedia('(pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    corriendo.current = true

    gsap.fromTo(
      root.current.querySelectorAll('.titulo-letra'),
      { yPercent: 0, scale: 1 },
      {
        yPercent: -22,
        scale: 1.12,
        duration: 0.28,
        ease: 'back.out(3)',
        stagger: 0.025,
        // Ida y vuelta en el mismo tween: con dos encadenados, mover el puntero
        // rápido dejaba letras arriba a mitad de camino.
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          corriendo.current = false
        },
      },
    )
  }

  return (
    <h2
      ref={root}
      onPointerEnter={golpear}
      aria-label={lineas.join(' ')}
      // `perspective` para que el volteo de la entrada `giro` tenga profundidad;
      // sin ella, rotar en X solo aplasta las letras.
      className={`dbz-sub font-display text-headline uppercase [perspective:900px] ${className}`}
    >
      <span aria-hidden="true">
        {lineas.map((linea) => (
          <Letras key={linea} texto={linea} />
        ))}
      </span>
    </h2>
  )
}
