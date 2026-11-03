import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Los dos recursos gráficos que más dicen «anime de acción»: las líneas de
 * concentración y el fotograma de impacto.
 *
 * **Líneas de concentración.** Convergen hacia el centro en los dos capítulos
 * de fuerza —el zoom al torso y la órbita— y van atadas al scroll, así que las
 * abre el usuario con el gesto. Giran un poco mientras entran: quietas parecen
 * una textura pegada encima, girando parecen presión.
 *
 * **Fotograma de impacto.** Un destello a pantalla completa en el golpe del ドン.
 * En el anime es un fotograma en blanco puro; aquí se queda a 0.5 de opacidad y
 * sube en 60 ms en vez de en uno. Un blanco pleno a pantalla completa es un
 * riesgo real para gente fotosensible, y esto es una web, no una emisión de
 * televisión que la gente vea a tres metros. Con `prefers-reduced-motion` no
 * llega a existir.
 *
 * Los dos son puramente decorativos: la capa entera va bajo `aria-hidden`.
 */

/** Opacidad máxima del destello. Muy por debajo del blanco pleno, a propósito. */
const DESTELLO = 0.5

export function ImpactoManga() {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const chapters = gsap.utils.toArray<HTMLElement>(document.querySelectorAll('.chapter'))

      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        // ── Líneas: entran, aprietan y se van, dos veces ────────────────────
        ;[2, 3].forEach((indice, i) => {
          const chapter = chapters[indice]
          const lineas = root.current?.querySelector<HTMLElement>(`[data-lineas="${i}"]`)
          if (!chapter || !lineas) return

          gsap
            .timeline({
              scrollTrigger: { trigger: chapter, start: 'top 85%', end: 'bottom 15%', scrub: 1 },
            })
            .fromTo(
              lineas,
              { opacity: 0, scale: 1.5, rotate: i ? 8 : -8 },
              { opacity: 0.5, scale: 1, rotate: 0, ease: 'none', duration: 0.55 },
            )
            .to(lineas, { opacity: 0, scale: 0.82, ease: 'none', duration: 0.45 })
        })

        // ── Destello: un golpe seco al entrar en el capítulo del ドン ────────
        const flash = root.current?.querySelector<HTMLElement>('[data-destello]')
        if (!flash || !chapters[3]) return

        const golpe = gsap
          .timeline({
            paused: true,
            // Blindaje: si el tween se interrumpe a mitad —cambio de pestaña,
            // recarga— el destello se quedaría clavado tapando la página.
            onComplete: () => gsap.set(flash, { opacity: 0 }),
            onInterrupt: () => gsap.set(flash, { opacity: 0 }),
          })
          .fromTo(flash, { opacity: 0 }, { opacity: DESTELLO, duration: 0.06, ease: 'none' })
          .to(flash, { opacity: 0, duration: 0.42, ease: 'power2.out' })

        ScrollTrigger.create({
          trigger: chapters[3],
          start: 'top 62%',
          // Solo bajando. Un impacto que se repite al subir deja de ser un
          // impacto y pasa a ser un intermitente.
          onEnter: () => golpe.restart(),
        })

        return () => {
          golpe.kill()
          gsap.set(flash, { opacity: 0 })
        }
      })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-[6] overflow-hidden" aria-hidden="true">
      {/* Los carriles se salen de la pantalla por los cuatro lados: si acabaran
          justo en el borde, se vería el corte recto del degradado cónico. */}
      {[0, 1].map((i) => (
        <div key={i} data-lineas={i} className="speed-lines absolute inset-[-25%] opacity-0" />
      ))}

      <div data-destello className="absolute inset-0 bg-paper opacity-0" />
    </div>
  )
}
