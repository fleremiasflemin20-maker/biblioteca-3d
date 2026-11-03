import { lazy, Suspense, useCallback, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { OverlayContent } from './components/OverlayContent'
import { CanvasLoader } from './components/CanvasLoader'
import { DragonBalls } from './components/DragonBalls'
import { Onomatopoeia } from './components/Onomatopoeia'
import { MangaMarks } from './components/MangaMarks'
import { ImpactoManga } from './components/ImpactoManga'
import { initSmoothScroll, refreshOnAssetsLoaded } from './lib/smooth-scroll'
import { createScrollTimeline } from './lib/scroll-state'
import { SCENE_READY } from './lib/intro'
import { armHeroIntro, playHeroIntro, skipHeroIntro } from './lib/hero-intro'
import { SceneFallback } from './components/SceneFallback'
import { ScrimMovil } from './components/ScrimMovil'
import { EstiloSwitch } from './components/EstiloSwitch'
import { CursorKi } from './components/CursorKi'
import { ArrastreEscena } from './components/ArrastreEscena'
import { GolpesArrastre } from './components/GolpesArrastre'
import { estiloInicial, recordarEstilo, type Estilo } from './lib/estilo'
import { ComoSeHizo } from './components/ComoSeHizo'
import type { Etapa } from './lib/etapa'
import { ELEGIDA } from './lib/figura'
import { Elegir } from './components/Elegir'

gsap.registerPlugin(ScrollTrigger)

/**
 * three + drei son ~1 MB sin comprimir. En su propio chunk, el HTML, el CSS y
 * el relato pintan mientras el motor 3D todavía viaja, y el `preload` del .glb
 * del index.html hace que la malla llegue en paralelo, no después.
 */
const Scene = lazy(() => import('./components/Scene').then((m) => ({ default: m.Scene })))

export default function App() {
  return ELEGIDA ? <Historia /> : <Elegir />
}

function Historia() {
  const story = useRef<HTMLDivElement>(null)

  // El estilo es el único estado de React de toda la página. Puede serlo porque
  // cambia cuando alguien pulsa el interruptor, no en cada frame: aquí sí
  // interesa que React reconstruya los materiales.
  const [estilo, setEstilo] = useState<Estilo>(estiloInicial)

  const cambiarEstilo = useCallback((siguiente: Estilo) => {
    setEstilo(siguiente)
    recordarEstilo(siguiente)
  }, [])

  /*
   * La etapa del "cómo se hizo". Igual que el estilo, puede ser estado de React
   * porque cambia cuando alguien pulsa, no en cada frame.
   *
   * Se guarda aparte de `abierto` para que cerrar el panel devuelva siempre la
   * escena acabada: si al cerrar se quedara la malla de alambre puesta, quien
   * curiosea un momento acabaría creyendo que ha roto la página.
   */
  const [etapa, setEtapa] = useState<Etapa>('final')
  const [comoSeHizo, setComoSeHizo] = useState(false)

  const abrirComoSeHizo = useCallback((v: boolean) => {
    setComoSeHizo(v)
    setEtapa(v ? 'malla' : 'final')
  }, [])

  useLayoutEffect(() => {
    const stopScroll = initSmoothScroll()
    const stopRefresh = refreshOnAssetsLoaded()

    const ctx = gsap.context(() => {
      // La línea de tiempo maestra: un único scrub que alimenta a la cámara.
      createScrollTimeline(story.current!)

      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // El héroe arranca oculto y entra cuando la pantalla de carga se va.
        armHeroIntro()
        window.addEventListener(SCENE_READY, playHeroIntro, { once: true })

        // La entrada dura dos segundos y solo se ve una vez: sin poder
        // relanzarla desde consola, afinarla es recargar a ciegas.
        if (import.meta.env.DEV) {
          Object.assign(window, {
            // Devuelve la línea de tiempo: `__intro().pause(0.4)` congela la
            // entrada a mitad de vuelo para poder mirarla con calma.
            __intro: () => {
              armHeroIntro()
              return playHeroIntro()
            },
          })
        }

        // Cada capítulo entra y sale con su propio trigger. Van sueltos de la
        // línea maestra a propósito: el texto tiene que aparecer cuando su
        // sección está en pantalla, no en un momento fijo de la película.
        gsap.utils.toArray<HTMLElement>('.chapter').forEach((chapter) => {
          const copy = chapter.querySelector('.copy')
          if (!copy) return

          gsap
            .timeline({
              scrollTrigger: { trigger: chapter, start: 'top 78%', end: 'bottom 22%', scrub: true },
            })
            // fromTo, no from: con `from` un elemento que además tenga una
            // transición CSS en opacity se puede quedar invisible para siempre.
            .fromTo(copy, { opacity: 0, y: 48 }, { opacity: 1, y: 0, ease: 'none', duration: 1 })
            .to(copy, { opacity: 1, duration: 1.4 })
            .to(copy, { opacity: 0, y: -48, ease: 'none', duration: 1 })
        })

        return () => window.removeEventListener(SCENE_READY, playHeroIntro)
      })

      mm.add('(prefers-reduced-motion: reduce)', () => {
        // Sin movimiento la página sigue completa: el texto está siempre visible
        // y la cámara se limita a seguir el scroll, que es gesto del usuario.
        gsap.set('.copy', { opacity: 1, y: 0 })
        skipHeroIntro()
      })
    })

    return () => {
      ctx.revert()
      stopScroll()
      stopRefresh()
    }
  }, [])

  return (
    <>
      <CanvasLoader />
      <SceneFallback>
        <Suspense fallback={null}>
          <Scene estilo={estilo} etapa={etapa} />
        </Suspense>
      </SceneFallback>
      <ArrastreEscena />
      <GolpesArrastre />
      <ScrimMovil />
      <CursorKi />
      {!comoSeHizo && <EstiloSwitch estilo={estilo} onChange={cambiarEstilo} />}
      <ComoSeHizo
        etapa={etapa}
        abierto={comoSeHizo}
        onEtapa={setEtapa}
        onAbrir={abrirComoSeHizo}
      />
      <MangaMarks />
      <ImpactoManga />
      <Onomatopoeia />
      <DragonBalls />
      <main>
        <OverlayContent ref={story} />
      </main>
    </>
  )
}
