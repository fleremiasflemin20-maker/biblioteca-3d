import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { scroll } from '../lib/scroll-state'

/**
 * Progreso al que se enciende cada bola.
 *
 * Las seis primeras caen en k/6, que con siete capítulos es exactamente el
 * principio de cada uno: así una bola se enciende **al entrar** en un capítulo y
 * el indicador cuenta algo real, en vez de ir marcando fracciones sueltas.
 *
 * La séptima se reserva para el final. Encenderla antes le quita el premio a
 * llegar abajo.
 */
const THRESHOLDS = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 0.965]

/** Estrellas de cada bola, de una a siete, como en el original. */
const STARS = [1, 2, 3, 4, 5, 6, 7]

/** Posiciones de las estrellas dentro de la bola, por número. */
const LAYOUT: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-3.2, 0],
    [3.2, 0],
  ],
  3: [
    [0, -3.4],
    [-3.4, 2.4],
    [3.4, 2.4],
  ],
  4: [
    [-3.2, -3.2],
    [3.2, -3.2],
    [-3.2, 3.2],
    [3.2, 3.2],
  ],
  5: [
    [-3.6, -3.6],
    [3.6, -3.6],
    [0, 0],
    [-3.6, 3.6],
    [3.6, 3.6],
  ],
  6: [
    [-3.6, -3.8],
    [3.6, -3.8],
    [-3.6, 0],
    [3.6, 0],
    [-3.6, 3.8],
    [3.6, 3.8],
  ],
  7: [
    [-3.8, -3.8],
    [0, -3.8],
    [3.8, -3.8],
    [0, 0],
    [-3.8, 3.8],
    [0, 3.8],
    [3.8, 3.8],
  ],
}

const STAR_PATH = 'M0,-2.5 L0.6,-0.8 2.4,-0.8 0.9,0.3 1.5,2 0,0.9 -1.5,2 -0.9,0.3 -2.4,-0.8 -0.6,-0.8 Z'

function Ball({ stars }: { stars: number }) {
  return (
    <svg viewBox="-12 -12 24 24" className="h-full w-full">
      <circle r="10.5" className="fill-[#F2A11B]" />
      {/* Brillo especular: sin él la bola parece un botón, no una esfera de cristal. */}
      <circle cx="-3.4" cy="-3.8" r="3.6" className="fill-white/45" />
      <circle r="10.5" className="fill-none stroke-ink/60" strokeWidth="1.4" />
      {LAYOUT[stars].map(([x, y], i) => (
        <path key={i} d={STAR_PATH} transform={`translate(${x} ${y})`} className="fill-[#D81E2A]" />
      ))}
    </svg>
  )
}

/**
 * Indicador de progreso: las siete bolas de dragón encendiéndose capítulo a
 * capítulo, y un fogonazo al completar la séptima.
 *
 * Lee el mismo valor amortiguado que la cámara desde el ticker de GSAP en vez de
 * montar su propio `requestAnimationFrame`: dos bucles de animación compitiendo
 * es la causa más habitual de micro-tirones.
 *
 * Es decorativo — el progreso real ya lo da la barra de scroll del navegador —,
 * así que va entero bajo `aria-hidden`.
 */
export function DragonBalls() {
  const root = useRef<HTMLDivElement>(null)
  const flash = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const balls = gsap.utils.toArray<HTMLElement>('[data-ball]', root.current)
    const lit = balls.map(() => false)
    let complete = false

    const light = (el: HTMLElement, on: boolean) => {
      gsap.to(el, {
        opacity: on ? 1 : 0.22,
        scale: on ? 1 : 0.78,
        filter: on ? 'saturate(1) brightness(1)' : 'saturate(0.15) brightness(0.5)',
        duration: 0.45,
        ease: on ? 'back.out(3)' : 'power2.out',
      })
    }

    const tick = () => {
      const p = scroll.progress

      balls.forEach((el, i) => {
        const on = p >= THRESHOLDS[i]
        if (on === lit[i]) return
        lit[i] = on
        light(el, on)
      })

      // El fogonazo salta una sola vez, al encender la séptima. Sin el guardia
      // se dispararía en cada frame mientras el scroll queda al final.
      if (lit[6] && !complete) {
        complete = true
        gsap
          .timeline()
          .to(flash.current, { opacity: 0.75, duration: 0.12, ease: 'none' })
          .to(balls, { scale: 1.35, duration: 0.18, ease: 'power2.out' }, '<')
          .to(flash.current, { opacity: 0, duration: 0.7, ease: 'power2.out' })
          .to(balls, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)' }, '<')
      } else if (!lit[6]) {
        complete = false
      }
    }

    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [])

  return (
    <>
      {/*
        El destello nace de las bolas y se disipa, en vez de teñir la pantalla
        entera.

        Antes era un rectángulo amarillo plano a toda pantalla: en el escritorio
        pasaba por un golpe de luz, pero grabado en un móvil se ve como si la
        página fallara — un fotograma completamente amarillo. Con un degradado
        radial centrado en la columna de bolas, el ojo lo lee como que **algo se
        ha encendido ahí**, que es lo que ocurre.
      */}
      <div
        ref={flash}
        className="destello-bolas pointer-events-none fixed inset-0 z-30 opacity-0 mix-blend-screen"
        aria-hidden="true"
      />

      <div
        ref={root}
        /* En vertical no hay columna lateral que valga: las siete bolas se
           ponen en fila justo bajo la marquesina, que es la única banda libre
           de la pantalla. */
        className="pointer-events-none fixed left-1/2 top-12 z-20 flex -translate-x-1/2 flex-row items-center gap-2.5 md:left-auto md:right-5 md:top-1/2 md:translate-x-0 md:-translate-y-1/2 md:flex-col md:gap-3"
        aria-hidden="true"
      >
        {STARS.map((stars) => (
          <div
            key={stars}
            data-ball
            className="h-5 w-5 opacity-20 drop-shadow-[0_0_6px_rgba(242,161,27,0.55)] lg:h-6 lg:w-6"
          >
            <Ball stars={stars} />
          </div>
        ))}
      </div>
    </>
  )
}
