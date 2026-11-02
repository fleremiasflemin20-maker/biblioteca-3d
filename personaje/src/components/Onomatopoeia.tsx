import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Las onomatopeyas van en una capa propia entre el canvas (z-0) y el relato
 * (z-10): pertenecen a la escena, no al texto. Si fueran por encima competirían
 * con el titular; por debajo del canvas no se verían.
 *
 * Los índices son posiciones en el DOM: si se añade o se quita un capítulo en
 * OverlayContent hay que correrlos, o cada sonido suena en la escena de al lado.
 *
 * Cada una se engancha al capítulo que le toca con `scrub`, así que el sonido
 * lo dibuja el usuario con el scroll — es lo que las hace parecer parte de la
 * viñeta y no un adorno animándose por su cuenta.
 */
export function Onomatopoeia() {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        // Los capítulos se buscan en el documento, no por selector: dentro de un
        // `gsap.context` los strings se resuelven **dentro del root**, y el root
        // de aquí es esta capa. Con `.chapter` como texto la lista sale vacía y
        // las líneas de tiempo no llegan a crearse, en silencio.
        const chapters = gsap.utils.toArray<HTMLElement>(document.querySelectorAll('.chapter'))

        // ゴゴゴ · el retumbar del zoom. Sube despacio durante todo el capítulo.
        if (chapters[3]) {
          gsap
            .timeline({
              scrollTrigger: { trigger: chapters[3], start: 'top bottom', end: 'bottom top', scrub: 1 },
            })
            .fromTo(
              '[data-sfx="rumble"]',
              { yPercent: 45, opacity: 0, scale: 0.85 },
              { yPercent: -45, opacity: 0.85, scale: 1.05, ease: 'none', duration: 0.6 },
            )
            .to('[data-sfx="rumble"]', { opacity: 0, ease: 'none', duration: 0.4 })
        }

        // ドン · el impacto de la órbita. Entra de golpe en el primer tercio y
        // se queda vibrando: por eso la entrada dura 0.18 y la salida 0.5.
        if (chapters[4]) {
          gsap
            .timeline({
              scrollTrigger: { trigger: chapters[4], start: 'top 70%', end: 'bottom top', scrub: 1 },
            })
            .fromTo(
              '[data-sfx="impact"]',
              { scale: 0.35, opacity: 0, rotate: -14 },
              { scale: 1, opacity: 0.92, rotate: -7, ease: 'power4.out', duration: 0.18 },
            )
            .to('[data-sfx="impact"]', { scale: 1.12, ease: 'none', duration: 0.32 })
            .to('[data-sfx="impact"]', { opacity: 0, scale: 1.35, ease: 'none', duration: 0.5 })
        }

        // キィィン · el zumbido agudo de la energía al empezar. Muy tenue: es lo
        // primero que se ve tras el titular y no puede robarle protagonismo.
        if (chapters[2]) {
          gsap
            .timeline({
              scrollTrigger: { trigger: chapters[2], start: 'top bottom', end: 'bottom top', scrub: 1 },
            })
            .fromTo(
              '[data-sfx="whine"]',
              { yPercent: 30, opacity: 0, scale: 0.9 },
              { yPercent: -10, opacity: 0.55, scale: 1, ease: 'none', duration: 0.55 },
            )
            .to('[data-sfx="whine"]', { opacity: 0, yPercent: -40, ease: 'none', duration: 0.45 })
        }

        // ズドン · el segundo impacto, en la ficha técnica. Entra por el lado
        // contrario al ドン para que no se lean como el mismo golpe repetido.
        if (chapters[5]) {
          gsap
            .timeline({
              scrollTrigger: { trigger: chapters[5], start: 'top 65%', end: 'bottom top', scrub: 1 },
            })
            .fromTo(
              '[data-sfx="boom"]',
              { scale: 0.5, opacity: 0, rotate: 10 },
              { scale: 1, opacity: 0.85, rotate: 5, ease: 'power4.out', duration: 0.2 },
            )
            .to('[data-sfx="boom"]', { scale: 1.1, ease: 'none', duration: 0.35 })
            .to('[data-sfx="boom"]', { opacity: 0, scale: 1.28, ease: 'none', duration: 0.45 })
        }

        // シュゥゥ · el aire escapando en el cierre.
        if (chapters[5]) {
          gsap
            .timeline({
              scrollTrigger: { trigger: chapters[5], start: 'top bottom', end: 'bottom top', scrub: 1 },
            })
            .fromTo(
              '[data-sfx="hiss"]',
              { xPercent: 25, opacity: 0 },
              { xPercent: -10, opacity: 0.7, ease: 'none', duration: 0.6 },
            )
            .to('[data-sfx="hiss"]', { xPercent: -30, opacity: 0, ease: 'none', duration: 0.4 })
        }
      })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-[5] overflow-hidden" aria-hidden="true">
      {/*
        Cada una se coloca en el lado LIBRE de su capítulo. El degradado de
        legibilidad del capítulo vive dentro del relato, que está en un contexto
        de apilado por encima de esta capa: una onomatopeya puesta del lado del
        texto queda enterrada bajo el degradado por mucho z-index que tenga.
        Capítulo 3 lleva el texto a la izquierda, el 4 a la derecha, el 5 abajo.
      */}
      <span
        data-sfx="rumble"
        // Nada de `-translate-y-1/2`: GSAP escribe el `transform` entero y se
        // llevaría por delante la corrección del centrado. El centrado se hace
        // con `top`.
        className="sfx absolute right-[11vw] top-[22%] text-[clamp(3rem,9vw,8rem)] leading-[0.95] opacity-0 [writing-mode:vertical-rl]"
      >
        ゴゴゴゴ
      </span>

      <span
        data-sfx="impact"
        className="sfx absolute left-[6vw] top-[34%] text-[clamp(5rem,18vw,15rem)] leading-none opacity-0"
      >
        ドン
      </span>

      <span
        data-sfx="hiss"
        className="sfx absolute left-[6vw] top-[58%] text-[clamp(2.5rem,7vw,6rem)] leading-none opacity-0"
      >
        シュゥゥ
      </span>

      <span
        data-sfx="whine"
        className="sfx absolute left-[7vw] top-[18%] text-[clamp(1.8rem,4.5vw,3.5rem)] leading-none opacity-0 [writing-mode:vertical-rl]"
      >
        キィィン
      </span>

      <span
        data-sfx="boom"
        className="sfx absolute right-[10vw] top-[52%] text-[clamp(3rem,11vw,9rem)] leading-none opacity-0"
      >
        ズドン
      </span>
    </div>
  )
}
