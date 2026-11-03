import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Los signos: los emblemas de las escuelas de Dragon Ball y los kanji gigantes
 * de fondo.
 *
 * Van aparte de las onomatopeyas porque se comportan al revés. Una onomatopeya
 * es un sonido: nace y muere con el gesto del scroll, y por eso va con `scrub`.
 * Un emblema es una marca: se estampa de golpe al llegar y se queda mientras su
 * capítulo esté en pantalla. Con `scrub` se "des-estamparía" al retroceder un
 * píxel, que es justo lo que no hace un sello.
 *
 * Los kanji de fondo sí son scroll puro: se desplazan despacio, como textura.
 */

type Emblem = {
  char: string
  /**
   * Si aparece también en vertical. En 375 px, dos emblemas por capítulo más la
   * onomatopeya, las siete bolas y la marquesina se amontonan encima de la
   * figura en cada transición. En vertical se queda uno por capítulo.
   */
  movil?: boolean
  /** Capítulo (0-5) en el que aparece. */
  chapter: number
  /** Posición y tamaño. */
  className: string
  rotate: number
  /** rojo = el de los emblemas de trazo rojo; hueso = los de trazo negro. */
  tone: 'rojo' | 'hueso'
}

/*
 * Repartidos por los seis capítulos en lados alternos, para que la página
 * respire y ninguno
 * caiga sobre el texto ni sobre la columna de bolas de dragón (que vive pegada
 * al borde derecho, a media altura). Los tamaños varían a propósito: doce
 * discos iguales se leerían como un patrón, no como sellos.
 */
const EMBLEMS: Emblem[] = [
  // ── 1 · Plano general ──────────────────────────────────────────────────
  // 亀 (kame) — Escuela de la Tortuga. El del gi de Goku.
  { movil: true, char: '亀', chapter: 0, className: 'right-[7vw] bottom-[13vh] w-[clamp(3.4rem,6.5vw,5.5rem)] text-[clamp(2rem,3.9vw,3.3rem)]', rotate: -8, tone: 'hueso' },

  // ── 2 · Anatomía ───────────────────────────────────────────────────────
  // 魔 (ma) — el de Piccolo.
  { char: '魔', chapter: 1, className: 'left-[8vw] bottom-[17vh] w-[clamp(3.2rem,6vw,5rem)] text-[clamp(1.9rem,3.6vw,3rem)]', rotate: -5, tone: 'hueso' },
  // 神 (kami) — el de Kami-sama.
  { movil: true, char: '神', chapter: 1, className: 'right-[13vw] top-[15vh] w-[clamp(2.8rem,5vw,4.2rem)] text-[clamp(1.6rem,3vw,2.5rem)]', rotate: 9, tone: 'rojo' },

  // ── 3 · Materiales ─────────────────────────────────────────────────────
  // 悟 (go) — el de Goku adulto.
  { movil: true, char: '悟', chapter: 2, className: 'right-[9vw] bottom-[15vh] w-[clamp(3.4rem,6.4vw,5.4rem)] text-[clamp(2rem,3.8vw,3.2rem)]', rotate: 7, tone: 'hueso' },
  // 武 (bu) — artes marciales; el del abuelo Gohan.
  { char: '武', chapter: 2, className: 'left-[7vw] top-[14vh] w-[clamp(2.7rem,4.8vw,4rem)] text-[clamp(1.6rem,2.9vw,2.4rem)]', rotate: -7, tone: 'rojo' },

  // ── 4 · Recorrido ──────────────────────────────────────────────────────
  // 天 (ten) — el de Ten Shin Han.
  { char: '天', chapter: 3, className: 'left-[9vw] bottom-[19vh] w-[clamp(3.1rem,5.8vw,4.8rem)] text-[clamp(1.8rem,3.5vw,2.9rem)]', rotate: 5, tone: 'rojo' },
  // 鶴 (tsuru) — Escuela de la Grulla, la rival de la Tortuga.
  { movil: true, char: '鶴', chapter: 3, className: 'right-[12vw] top-[13vh] w-[clamp(2.9rem,5.2vw,4.4rem)] text-[clamp(1.7rem,3.1vw,2.6rem)]', rotate: -9, tone: 'hueso' },
  // 孫 (son) — el apellido, el que lleva Goku de niño. Vive aquí y no en el
  // plano general porque allí el titular ocupa toda la mitad izquierda y se lo
  // comía; el hero se queda solo con el 亀, que es el que hay que ver.
  { char: '孫', chapter: 3, className: 'left-[17vw] top-[15vh] w-[clamp(2.6rem,4.6vw,3.8rem)] text-[clamp(1.5rem,2.7vw,2.3rem)]', rotate: 6, tone: 'rojo' },

  // ── 5 · Ficha técnica ──────────────────────────────────────────────────
  // 飯 (han) — el de Gohan.
  { movil: true, char: '飯', chapter: 4, className: 'right-[10vw] top-[17vh] w-[clamp(3rem,5.6vw,4.6rem)] text-[clamp(1.8rem,3.3vw,2.8rem)]', rotate: 8, tone: 'hueso' },
  // 楽 (raku) — el de Yamcha.
  { char: '楽', chapter: 4, className: 'left-[8vw] bottom-[15vh] w-[clamp(2.7rem,4.9vw,4.1rem)] text-[clamp(1.6rem,2.9vw,2.4rem)]', rotate: -6, tone: 'rojo' },

  // ── 6 · Cierre ─────────────────────────────────────────────────────────
  // 殺 (satsu) — el de Tao Pai Pai.
  { char: '殺', chapter: 5, className: 'left-[10vw] top-[15vh] w-[clamp(2.8rem,5vw,4.2rem)] text-[clamp(1.6rem,3vw,2.5rem)]', rotate: 6, tone: 'rojo' },
  // 牛 (ushi) — el de Ox-Satan.
  { movil: true, char: '牛', chapter: 5, className: 'right-[8vw] bottom-[17vh] w-[clamp(3.3rem,6.2vw,5.2rem)] text-[clamp(2rem,3.7vw,3.1rem)]', rotate: -8, tone: 'hueso' },
]

/** Kanji de fondo: enormes, huecos y con parallax. */
const MARKS = [
  { char: '龍', chapter: 1, className: 'left-[-2vw] top-[8vh] text-[clamp(14rem,34vw,30rem)]', drift: -140 },
  { char: '四', chapter: 3, className: 'right-[-3vw] bottom-[6vh] text-[clamp(12rem,30vw,26rem)]', drift: 120 },
] as const

const TONE = {
  rojo: 'text-accent',
  hueso: 'text-paper/70',
} as const

export function MangaMarks() {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Igual que en las onomatopeyas: dentro de un `gsap.context` los
      // selectores de texto se resuelven contra el root de este componente, y
      // los capítulos están fuera. Hay que buscarlos en el documento.
      const chapters = gsap.utils.toArray<HTMLElement>(document.querySelectorAll('.chapter'))

      const mm = gsap.matchMedia()

      mm.add(
        {
          ancha: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
          estrecha: '(max-width: 767px) and (prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const estrecha = context.conditions?.estrecha === true

        EMBLEMS.forEach(({ chapter, rotate, movil }, i) => {
          const el = root.current?.querySelector<HTMLElement>(`[data-emblem="${i}"]`)
          if (!el || !chapters[chapter]) return
          if (estrecha && !movil) {
            gsap.set(el, { opacity: 0 })
            return
          }

          gsap.fromTo(
            el,
            { opacity: 0, scale: 2, rotate: rotate - 12 },
            {
              opacity: 1,
              scale: 1,
              rotate,
              // Corto y seco: un sello se estampa, no aterriza.
              duration: 0.4,
              ease: 'power4.out',
              scrollTrigger: {
                trigger: chapters[chapter],
                start: 'top 62%',
                end: 'bottom 38%',
                // play / reverse / play / reverse: se estampa al entrar y se
                // retira al salir, en los dos sentidos. Sin el reverse de
                // salida se van acumulando y al final hay doce a la vez.
                toggleActions: 'play reverse play reverse',
              },
            },
          )
        })

        // Los kanji gigantes salen de móvil: a 30vw ocupan media pantalla y en
        // vertical no hay margen que les deje sitio sin tapar el texto.
        if (estrecha) return

        MARKS.forEach(({ chapter, drift }, i) => {
          const el = root.current?.querySelector<HTMLElement>(`[data-mark="${i}"]`)
          if (!el || !chapters[chapter]) return

          gsap
            .timeline({
              scrollTrigger: {
                trigger: chapters[chapter],
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1,
              },
            })
            .fromTo(el, { y: -drift, opacity: 0 }, { y: 0, opacity: 1, ease: 'none', duration: 0.45 })
            .to(el, { y: drift, opacity: 0, ease: 'none', duration: 0.55 })
        })
        },
      )

      mm.add('(prefers-reduced-motion: reduce)', () => {
        // Sin movimiento los emblemas se quedan puestos; los kanji de fondo, no:
        // apilados sin desplazamiento se solapan con el texto.
        gsap.set('[data-emblem]', { opacity: 1, scale: 1 })
        gsap.set('[data-mark]', { opacity: 0 })
      })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-[4] overflow-hidden" aria-hidden="true">
      {MARKS.map(({ char, className }, i) => (
        <span key={char} data-mark={i} className={`kanji-mark absolute opacity-0 ${className}`}>
          {char}
        </span>
      ))}

      {EMBLEMS.map(({ char, className, tone }, i) => (
        <span
          key={`${char}-${i}`}
          data-emblem={i}
          className={`emblem absolute opacity-0 ${TONE[tone]} ${className}`}
        >
          {char}
        </span>
      ))}
    </div>
  )
}
