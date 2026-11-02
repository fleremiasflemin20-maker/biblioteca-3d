import { useLayoutEffect } from 'react'
import gsap from 'gsap'
import {
  DISTANCIA_GOLPE,
  PITCH_MAXIMO,
  SENSIBILIDAD_PITCH,
  SENSIBILIDAD_YAW,
  arrastre,
  golpear,
} from '../lib/arrastre'

/** Lo que NO debe iniciar un arrastre: si se pulsa aquí, manda el elemento. */
const INTERACTIVO = 'a, button, input, textarea, select, [role="button"]'

/** Píxeles que hay que mover antes de considerarlo un arrastre y no un clic. */
const UMBRAL = 4

/**
 * En táctil hay que ganarse el gesto: solo cuenta como giro si el dedo va
 * claramente más en horizontal que en vertical. Sin este margen, cualquier
 * scroll con un poco de diagonal giraría la figura.
 */
const SESGO_HORIZONTAL = 1.4

/**
 * Franja de los bordes laterales que se deja en paz, en píxeles. Ahí vive el
 * gesto de "volver atrás" del navegador, y disputárselo es una forma segura de
 * que la gente salga de la página sin querer.
 */
const BORDE = 26

/**
 * Arrastrar con el botón izquierdo para desviar la cámara.
 *
 * Escucha en `window` y no en el canvas a propósito. El canvas vive en el fondo
 * (z-0) y el relato va por encima con sus degradados de legibilidad, así que en
 * la mayor parte de la pantalla el evento nunca llegaría al lienzo. Filtrar por
 * "no es un botón ni un enlace" cubre el caso real —el visitante arrastra sobre
 * la figura o sobre el fondo— sin depender de dónde caiga la capa de texto.
 *
 * El umbral de 4 px es lo que separa un arrastre de un clic: sin él, pulsar el
 * selector de render movería la cámara un pelo en el mismo gesto, y cualquier
 * intento de seleccionar texto giraría la escena.
 *
 * En táctil también funciona, pero **solo el eje horizontal**. El vertical es el
 * scroll de la página y robárselo dejaría la web inutilizable; en cambio un
 * desplazamiento horizontal del dedo no hace nada en esta página, así que está
 * libre para girar la figura. Por eso en el móvil se gira pero no se inclina.
 */
export function ArrastreEscena() {
  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const tactil = !window.matchMedia('(pointer: fine)').matches

    let pulsando = false
    let arrastrando = false
    let xInicial = 0
    let yInicial = 0
    let xPrevia = 0
    let yPrevia = 0
    /** Distancia acumulada desde la última onomatopeya. */
    let recorrido = 0
    let vuelta: gsap.core.Tween | null = null

    const bajar = (e: PointerEvent) => {
      if (e.button !== 0) return
      if ((e.target as Element | null)?.closest?.(INTERACTIVO)) return
      if (tactil && (e.clientX < BORDE || e.clientX > window.innerWidth - BORDE)) return

      pulsando = true
      xInicial = xPrevia = e.clientX
      yInicial = yPrevia = e.clientY
    }

    const mover = (e: PointerEvent) => {
      if (!pulsando) return

      if (!arrastrando) {
        const dx = Math.abs(e.clientX - xInicial)
        const dy = Math.abs(e.clientY - yInicial)

        if (Math.hypot(dx, dy) < UMBRAL) return

        // En táctil, si el gesto no es claramente horizontal se descarta del
        // todo: es un scroll y hay que dejarlo pasar limpio. Y se descarta para
        // siempre, no hasta el siguiente frame, o a mitad de un scroll largo
        // acabaría capturándolo.
        if (tactil && dx < dy * SESGO_HORIZONTAL) {
          pulsando = false
          return
        }

        arrastrando = true
        arrastre.activo = true
        // Un golpe nada más agarrar: sin él el primer tramo del gesto no
        // responde y el efecto parece que llega tarde.
        recorrido = 0
        golpear(e.clientX, e.clientY)
        // Si venía volviendo a su sitio, se corta: manda la mano.
        vuelta?.kill()
        document.documentElement.classList.add('arrastrando')
      }

      arrastre.yaw -= (e.clientX - xPrevia) * SENSIBILIDAD_YAW

      // Nada de inclinación en táctil: el eje vertical es del scroll.
      if (!tactil) {
        arrastre.pitch = gsap.utils.clamp(
          -PITCH_MAXIMO,
          PITCH_MAXIMO,
          arrastre.pitch + (e.clientY - yPrevia) * SENSIBILIDAD_PITCH,
        )
      }

      recorrido += Math.hypot(e.clientX - xPrevia, e.clientY - yPrevia)
      if (recorrido >= DISTANCIA_GOLPE) {
        recorrido = 0
        golpear(e.clientX, e.clientY)
      }

      xPrevia = e.clientX
      yPrevia = e.clientY
    }

    const soltar = () => {
      pulsando = false
      if (!arrastrando) return

      arrastrando = false
      arrastre.activo = false
      document.documentElement.classList.remove('arrastrando')

      /*
       * La vuelta es lenta y con `power2.out`: arranca deprisa y frena al final.
       * Con una vuelta rápida el gesto se siente como un muelle que te quita el
       * control de las manos; así parece que la cámara "se recoloca" sola.
       */
      vuelta = gsap.to(arrastre, {
        yaw: 0,
        pitch: 0,
        duration: 2.4,
        ease: 'power2.out',
        overwrite: true,
      })
    }

    window.addEventListener('pointerdown', bajar)
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)

    return () => {
      window.removeEventListener('pointerdown', bajar)
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
      vuelta?.kill()
      arrastre.yaw = arrastre.pitch = 0
      arrastre.activo = false
      document.documentElement.classList.remove('arrastrando')
    }
  }, [])

  return null
}
