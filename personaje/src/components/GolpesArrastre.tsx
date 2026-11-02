import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { alGolpear } from '../lib/arrastre'

/**
 * Onomatopeyas de golpe. Todas son de impacto seco y corto — nada de retumbar
 * largo: el gesto dura un instante y el sonido tiene que durar lo mismo.
 *
 * Las de la página (ゴゴゴ, シュゥゥ) son atmósfera y se dibujan con el scroll;
 * estas son percusión y las dibuja la mano.
 */
const GOLPES = ['ドッ', 'バキッ', 'ドガッ', 'ズバッ', 'ゴッ', 'バシッ', 'ガキン', 'ドムッ']

/**
 * Cuántas puede haber a la vez.
 *
 * Se reciclan en círculo en vez de crear y destruir nodos: arrastrando fuerte
 * salen varias por segundo, y montar y desmontar elementos a ese ritmo provoca
 * recálculos de estilo justo mientras la escena 3D pelea por mantener los 60 fps.
 */
const POOL = 7

/** Margen para que ninguna nazca pegada al borde y salga cortada. */
const MARGEN = 90

/**
 * Onomatopeyas de manga al arrastrar la figura.
 *
 * El disparo no lo decide este componente: llega desde el propio gestor del
 * arrastre (ver `alGolpear` en lib/arrastre), que es quien ya sabe distinguir un
 * arrastre de un clic y un giro de un scroll. Aquí solo se dibuja.
 *
 * Va en z-[8]: por encima del degradado de legibilidad fijo del móvil (z-7) —si
 * fuera por debajo se verían apagadas justo en la mitad inferior, que es donde
 * más se arrastra— y por debajo del relato (z-10), porque son parte de la
 * escena, no del texto.
 */
export function GolpesArrastre() {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const nodos = gsap.utils.toArray<HTMLElement>('[data-golpe]', root.current)
    if (!nodos.length) return

    let siguiente = 0

    /*
     * Bolsa barajada, no azar puro.
     *
     * Con `Math.random()` cada golpe es independiente, así que en una tirada de
     * siete salen la misma palabra tres veces — y repetida no se lee como otro
     * golpe, se lee como que el efecto está roto. Con una bolsa se agotan las
     * ocho antes de que ninguna vuelva, que es lo que hace que parezca una
     * página de manga y no un bucle.
     */
    let bolsa: string[] = []

    const sacar = () => {
      if (!bolsa.length) bolsa = gsap.utils.shuffle([...GOLPES])
      return bolsa.pop()!
    }

    const dibujar = (x: number, y: number) => {
      const el = nodos[siguiente]
      siguiente = (siguiente + 1) % nodos.length

      el.textContent = sacar()

      const inclina = gsap.utils.random(-16, 16)

      gsap.set(el, {
        // Se dispersan alrededor del dedo, no debajo: encima del puntero
        // taparían justo lo que estás mirando.
        left: gsap.utils.clamp(MARGEN, window.innerWidth - MARGEN, x + gsap.utils.random(-70, 70)),
        top: gsap.utils.clamp(MARGEN, window.innerHeight - MARGEN, y + gsap.utils.random(-80, 40)),
        fontSize: `${gsap.utils.random(2.9, 5.8)}rem`,
        xPercent: -50,
        yPercent: -50,
        rotate: inclina,
        scale: 0.35,
        opacity: 0,
      })

      gsap
        .timeline({ overwrite: true })
        // Entrada de un solo frame largo y `power4.out`: en un manga el efecto
        // ya está dibujado cuando lo ves. Si entra suave parece un rótulo.
        .to(el, { scale: 1, opacity: 0.95, duration: 0.12, ease: 'power4.out' })
        // Un respiro quieta. Sin él entra y se va en el mismo gesto, y el ojo
        // registra un destello pero no llega a leer la palabra — que es justo
        // lo único que tenía que hacer.
        .to(el, { scale: 1.06, duration: 0.16, ease: 'none' })
        .to(el, {
          scale: 1.35,
          opacity: 0,
          y: -34,
          rotate: inclina * 1.4,
          duration: 0.55,
          ease: 'power2.out',
        })
    }

    alGolpear(dibujar)

    return () => {
      alGolpear(null)
      gsap.killTweensOf(nodos)
    }
  }, [])

  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-[8] overflow-hidden" aria-hidden="true">
      {Array.from({ length: POOL }, (_, i) => (
        <span key={i} data-golpe className="sfx absolute left-0 top-0 leading-none opacity-0" />
      ))}
    </div>
  )
}
