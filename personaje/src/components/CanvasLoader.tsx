import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import gsap from 'gsap'
import { ELEGIDA } from '../lib/figura'
import { triangulos } from '../../../src/lib/catalogo'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { announceSceneReady } from '../lib/intro'

/**
 * Pantalla de carga. Vive en el DOM, no dentro del Canvas: un `<Html>` como
 * fallback de Suspense se monta *dentro* de la escena y hereda su cámara y su
 * dpr, así que el texto baila mientras carga. Fuera es tipografía normal, nítida
 * y con el mismo aspecto en cualquier dispositivo.
 *
 * `useProgress` es un store de zustand alimentado por el LoadingManager de
 * three, y funciona igual dentro que fuera del Canvas.
 */
export function CanvasLoader() {
  const { progress, active } = useProgress()
  const [gone, setGone] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const shown = useRef(0)

  // El porcentaje real da saltos (un 0 → 68 → 100 con tres archivos). Se
  // interpola hacia el valor real para que el contador suba de forma continua.
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const tween = gsap.to(shown, {
      current: progress,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: () => setDisplay(Math.round(shown.current)),
    })
    return () => {
      tween.kill()
    }
  }, [progress])

  useEffect(() => {
    document.documentElement.classList.toggle('is-loading', !gone)
  }, [gone])

  useEffect(() => {
    if (active || progress < 100 || !root.current) return

    const tl = gsap.timeline({
      delay: 0.25,
      onComplete: () => {
        setGone(true)
        // Las medidas del scroll se calcularon con la página aún montándose.
        ScrollTrigger.refresh()
        // La entrada del héroe empieza aquí, no al montar: con la pantalla de
        // carga encima, las letras se animarían para nadie.
        announceSceneReady()
      },
    })

    tl.to(root.current.querySelectorAll('[data-fade]'), {
      opacity: 0,
      y: -12,
      duration: 0.45,
      ease: 'power2.in',
      stagger: 0.05,
    }).to(root.current, { autoAlpha: 0, duration: 0.7, ease: 'power2.inOut' }, '-=0.15')

    return () => {
      tl.kill()
    }
  }, [active, progress])

  if (gone) return null

  return (
    <div
      ref={root}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink"
      role="status"
      aria-live="polite"
    >
      <p data-fade className="text-caption uppercase text-saiyan/70">
        {ELEGIDA?.personaje.cargando ?? 'Cargando'}
      </p>

      <p data-fade className="dbz mt-6 font-display text-[clamp(4rem,16vw,11rem)] leading-none text-saiyan">
        {display}
        <span className="text-accent">%</span>
      </p>

      <div data-fade className="mt-8 h-px w-[min(60vw,28rem)] overflow-hidden bg-paper/15">
        <div
          className="h-full bg-saiyan transition-[width] duration-300 ease-out"
          style={{ width: `${display}%` }}
        />
      </div>

      <p data-fade className="mt-6 text-caption uppercase text-paper/30">
        {ELEGIDA ? `${ELEGIDA.modelo.nombre} · ${triangulos(ELEGIDA.modelo.triangulos)} triángulos` : ''}
      </p>
    </div>
  )
}
