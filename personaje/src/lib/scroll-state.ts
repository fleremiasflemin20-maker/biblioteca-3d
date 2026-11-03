import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Puente entre el scroll del DOM y el bucle de render de R3F.
 *
 * Es un objeto mutable a propósito: si el progreso del scroll fuera estado de
 * React, cada píxel de scroll dispararía un render del árbol entero. GSAP
 * escribe aquí y `useFrame` lee de aquí; React no se entera de nada.
 */
export const scroll = { progress: 0 }

/**
 * Cuánto tarda la cámara en alcanzar al scroll, en segundos.
 *
 * Con rueda de ratón un segundo entero es lo correcto: la rueda entrega saltos
 * gruesos y discontinuos, y ese retardo es justo lo que los convierte en un
 * movimiento fluido.
 *
 * Con el dedo el problema es el contrario. El dedo ya da una señal continua, así
 * que el retardo no suaviza nada — solo hace que al levantar el dedo la cámara
 * siga viajando un segundo más por su cuenta. Se siente como si la página se
 * disparara sola después de soltar, y acaba parándose donde le toca en vez de
 * donde la dejaste.
 */
const PERSECUCION = matchMedia('(pointer: coarse)').matches ? 0.4 : 1

/**
 * Una sola línea de tiempo maestra para toda la película.
 */
export function createScrollTimeline(story: HTMLElement) {
  return gsap.to(scroll, {
    progress: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: story,
      start: 'top top',
      end: 'bottom bottom',
      scrub: PERSECUCION,
      invalidateOnRefresh: true,
    },
  })
}
