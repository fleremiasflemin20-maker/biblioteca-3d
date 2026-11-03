import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { SCENE_READY } from '../lib/intro'
import type { Estilo } from '../lib/estilo'

const OPCIONES: { valor: Estilo; etiqueta: string; tecnica: string }[] = [
  { valor: 'anime', etiqueta: 'Anime', tecnica: 'Cel shading + contorno' },
  { valor: 'real', etiqueta: 'Realista', tecnica: 'PBR con cuatro mapas' },
]

/**
 * El selector de render, como parte de la pieza y no como herramienta interna.
 *
 * Que la página traiga los dos modos es la demostración más directa de que no es
 * una plantilla, pero solo funciona si el visitante **se da cuenta de que puede
 * tocarlo**. De ahí tres decisiones:
 *
 * 1. Va abajo al centro. Es la única banda de la pantalla que está libre en los
 *    dos tamaños: arriba está la marquesina, a la derecha las siete bolas, y el
 *    texto de los capítulos ocupa los laterales.
 * 2. Lleva una pregunta encima. Dos botones sueltos se leen como estado ("está
 *    en anime"); una pregunta se lee como invitación ("elige").
 * 3. Debajo del modo activo se nombra la técnica. Para quien no sepa qué es un
 *    cel shading no molesta, y para quien sí lo sepa —que en un portfolio es
 *    justo a quien le hablas— dice que sabes cómo se llama lo que has hecho.
 *
 * Entra al terminar la animación del titular, con un retardo: si apareciera a la
 * vez, competiría con el nombre del personaje justo en el momento del golpe.
 */
export function EstiloSwitch({
  estilo,
  onChange,
}: {
  estilo: Estilo
  onChange: (estilo: Estilo) => void
}) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return

    // Todo el transform lo escribe GSAP, incluido el centrado horizontal. Con
    // `-translate-x-1/2` de Tailwind aquí, el primer tween lo sobrescribiría y
    // el selector saltaría media anchura a la derecha.
    gsap.set(el, { xPercent: -50, y: 24 })

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el, { opacity: 1, y: 0 })
      return
    }

    /*
     * Entra con `scene:ready`, pero con red de seguridad.
     *
     * Ese evento se emite UNA vez, cuando se va la pantalla de carga. Si se
     * emite antes de que este efecto monte el escuchador —o si no llega a
     * emitirse porque la escena falló—, el selector se queda invisible **para
     * siempre**, y con él la mitad de la pieza. Ya pasó.
     *
     * El temporizador cubre los dos casos. Gana el primero que llegue, y
     * `entrado` evita que el segundo repita la animación.
     */
    let entrado = false

    const entrar = () => {
      if (entrado) return
      entrado = true
      gsap.to(el, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' })
    }

    const porEvento = () => gsap.delayedCall(1.6, entrar)
    window.addEventListener(SCENE_READY, porEvento, { once: true })

    const respaldo = gsap.delayedCall(6, entrar)

    return () => {
      window.removeEventListener(SCENE_READY, porEvento)
      respaldo.kill()
    }
  }, [])

  const activa = OPCIONES.find((o) => o.valor === estilo)

  return (
    <div
      ref={root}
      className="fixed bottom-6 left-1/2 z-30 flex flex-col items-center gap-2 opacity-0"
    >
      <p className="text-caption uppercase text-paper/40">¿Cómo lo prefieres?</p>

      <div
        className="flex items-center gap-1 rounded-full border border-paper/15 bg-ink/85 p-1 backdrop-blur-sm"
        role="group"
        aria-label="Modo de render"
      >
        {OPCIONES.map(({ valor, etiqueta }) => {
          const seleccionada = estilo === valor

          return (
            <button
              key={valor}
              type="button"
              aria-pressed={seleccionada}
              onClick={() => onChange(valor)}
              className={`rounded-full px-5 py-2.5 text-caption uppercase transition-colors duration-200 ${
                seleccionada ? 'bg-accent text-paper' : 'text-paper/50 hover:text-paper'
              }`}
            >
              {etiqueta}
            </button>
          )
        })}
      </div>

      {/* aria-live: al cambiar de modo, un lector de pantalla anuncia la técnica
          nueva. Sin esto el cambio es invisible para quien no ve la escena. */}
      <p className="text-caption uppercase text-paper/30" aria-live="polite">
        {activa?.tecnica}
      </p>
    </div>
  )
}
