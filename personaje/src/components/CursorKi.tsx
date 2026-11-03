import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { arrastre } from '../lib/arrastre'

/**
 * El puntero: un núcleo que va pegado al ratón y un anillo que lo persigue con
 * retardo.
 *
 * El retardo es todo el efecto. Los dos elementos siguen el mismo punto, pero el
 * núcleo llega en 60 ms y el anillo en 500: al mover el ratón el anillo se queda
 * atrás y se estira detrás, y al parar lo alcanza. Con los dos a la misma
 * velocidad esto es un círculo pegado al cursor y no dice nada.
 *
 * Va con `quickTo` y no con `gsap.to`: reutiliza un único tween por propiedad en
 * vez de crear uno nuevo en cada `pointermove`, que a la frecuencia a la que
 * dispara ese evento es la diferencia entre un cursor fluido y uno que se
 * atasca.
 *
 * Sobre lo interactivo el anillo crece y se rellena. Eso no es adorno: al
 * ocultar el cursor del sistema se pierde la flecha que se convierte en mano, y
 * sin una señal equivalente el visitante deja de saber qué se puede pulsar.
 *
 * Nada de esto existe en táctil ni con `prefers-reduced-motion`: no hay puntero
 * al que seguir, y un elemento persiguiendo al dedo es ruido.
 */

/** Lo que se considera pulsable y hace crecer el anillo. */
const INTERACTIVO = 'a, button, [role="button"]'

export function CursorKi() {
  const nucleo = useRef<HTMLDivElement>(null)
  const anillo = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const fino = window.matchMedia('(pointer: fine)')
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!fino.matches || quieto.matches) return

    const n = nucleo.current
    const a = anillo.current
    if (!n || !a) return

    document.documentElement.classList.add('cursor-propio')

    const nx = gsap.quickTo(n, 'x', { duration: 0.06, ease: 'power3' })
    const ny = gsap.quickTo(n, 'y', { duration: 0.06, ease: 'power3' })
    const ax = gsap.quickTo(a, 'x', { duration: 0.5, ease: 'power3' })
    const ay = gsap.quickTo(a, 'y', { duration: 0.5, ease: 'power3' })

    let visible = false

    const mover = (e: PointerEvent) => {
      if (!visible) {
        visible = true
        gsap.to([n, a], { opacity: 1, duration: 0.3 })
      }

      nx(e.clientX)
      ny(e.clientY)
      ax(e.clientX)
      ay(e.clientY)

      // `closest` y no `matches`: el puntero suele estar sobre el texto de
      // dentro del botón, no sobre el botón.
      const sobreAlgo = (e.target as Element | null)?.closest?.(INTERACTIVO)

      // Tres estados, y el de agarre manda sobre el de pulsable: mientras
      // arrastras la cámara, saber que estás arrastrando importa más que saber
      // que debajo había algo pulsable.
      const agarrando = arrastre.activo

      gsap.to(a, {
        scale: agarrando ? 0.55 : sobreAlgo ? 1.9 : 1,
        backgroundColor: agarrando
          ? 'rgba(255,222,0,0.9)'
          : sobreAlgo
            ? 'rgba(228,0,43,0.25)'
            : 'rgba(228,0,43,0)',
        borderColor: agarrando
          ? 'rgba(255,222,0,1)'
          : sobreAlgo
            ? 'rgba(255,222,0,0.9)'
            : 'rgba(245,244,241,0.45)',
        duration: agarrando ? 0.12 : 0.28,
        ease: 'power3.out',
      })
    }

    const salir = () => {
      visible = false
      gsap.to([n, a], { opacity: 0, duration: 0.25 })
    }

    window.addEventListener('pointermove', mover)
    document.addEventListener('pointerleave', salir)

    return () => {
      window.removeEventListener('pointermove', mover)
      document.removeEventListener('pointerleave', salir)
      document.documentElement.classList.remove('cursor-propio')
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] hidden md:block" aria-hidden="true">
      <div
        ref={anillo}
        className="absolute -left-4 -top-4 h-8 w-8 rounded-full border opacity-0"
        style={{ borderColor: 'rgba(245,244,241,0.45)' }}
      />
      <div ref={nucleo} className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-saiyan opacity-0" />
    </div>
  )
}
