import { forwardRef, type ReactNode } from 'react'
import { HeroTitle } from './HeroTitle'
import { TituloVivo } from './TituloVivo'
import { AUTOR, REDES } from '../lib/autor'
import { ELEGIDA } from '../lib/figura'
import type { Capitulo } from '../lib/personajes'
import { enlaceCompra, precio } from '../../../src/lib/catalogo'

/** Degradado bajo el texto: sin él, el blanco sobre la figura no llega a 4.5:1. */
type Scrim = 'left' | 'right' | 'bottom' | 'none'

const SCRIM: Record<Scrim, string> = {
  left: 'bg-gradient-to-r from-ink via-ink/70 to-transparent',
  right: 'bg-gradient-to-l from-ink via-ink/70 to-transparent',
  bottom: 'bg-gradient-to-t from-ink via-ink/60 to-transparent',
  none: '',
}

// En móvil todo se alinea a la izquierda: el texto justificado a la derecha en
// 375 px se lee peor y no gana nada, porque no hay figura a un lado de la que
// apartarse.
const ALIGN = {
  left: 'items-start text-left',
  right: 'items-start text-left md:items-end md:text-right',
  center: 'items-start text-left md:items-center md:text-center',
} as const

/**
 * Dónde se coloca el BLOQUE de texto dentro de la sección. Es otra cosa que
 * alinear el texto dentro del bloque, y confundirlas costaba caro:
 *
 * la sección apila en columna, así que el eje transversal es el horizontal. Sin
 * decirle nada, un hijo con `max-w-6xl` se queda pegado a la izquierda. El
 * resultado era que los capítulos "de la derecha" alineaban su texto a la
 * derecha **de un bloque que seguía estando en la mitad izquierda**: el texto
 * caía sobre la figura y quedaban 560 px muertos al otro lado.
 */
const ALIGN_BLOQUE = {
  left: '',
  right: 'md:items-end',
  center: 'md:items-center',
} as const

function Chapter({
  children,
  align = 'left',
  scrim = 'left',
  className = '',
}: {
  children: ReactNode
  align?: keyof typeof ALIGN
  scrim?: Scrim
  className?: string
}) {
  return (
    /*
     * En vertical todos los capítulos anclan el texto abajo: la figura se queda
     * en la mitad de arriba (ver `lift` en quality.ts) y no se pisan.
     *
     * El `pb` generoso reserva la banda inferior para el selector de render, que
     * vive abajo al centro. Sin ella los titulares grandes le pasan por debajo y
     * se cruzan las dos cosas — con `justify-center` el relleno inferior no
     * descentra el texto, lo sube, que es justo lo que hace falta.
     */
    <section
      className={`chapter scene flex flex-col justify-end pb-36 md:justify-center md:pb-28 px-6 md:px-12 lg:px-20 ${ALIGN_BLOQUE[align]} ${className}`}
    >
      {/*
        Solo el de escritorio. En vertical el degradado es uno solo y fijo al
        viewport (ver ScrimMovil): apilar uno por sección dejaba un corte duro
        de negro a transparente en cada frontera.
      */}
      {scrim !== 'none' && (
        <div
          className={`pointer-events-none absolute inset-0 -z-10 hidden md:block ${SCRIM[scrim]}`}
          aria-hidden="true"
        />
      )}
      <div className={`copy flex w-full max-w-6xl flex-col ${ALIGN[align]}`}>{children}</div>
    </section>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-caption uppercase text-saiyan">{children}</p>
}

/**
 * El relato. Scrollea por encima del canvas y es quien da la altura total de la
 * página: siete capítulos de 100dvh = seis tramos de scroll, que es la duración
 * de la película de cámara definida en `camera-path.ts`.
 *
 * Si se añade o se quita un capítulo hay que tocar tres sitios más, o la página
 * se desincroniza en silencio: los `at` de `camera-path.ts`, los umbrales de
 * `DragonBalls` y los índices de capítulo de `Onomatopoeia`.
 */

const BIBLIOTECA = `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}/`

/** Los párrafos de un capítulo y su remate en amarillo. */
function Parrafos({ cap, ancho }: { cap: Capitulo; ancho: string }) {
  return (
    <>
      {cap.parrafos.map((t, i) => (
        <p key={i} className={`${i ? 'mt-4' : 'mt-6'} ${ancho} text-body text-paper/70`}>
          {t}
        </p>
      ))}
      {cap.remate && <p className={`mt-4 ${ancho} text-body text-saiyan`}>{cap.remate}</p>}
    </>
  )
}

export const OverlayContent = forwardRef<HTMLDivElement>(function OverlayContent(_, ref) {
  const { personaje: p, modelo } = ELEGIDA!

  return (
    <div ref={ref} className="relative z-10">
      {/* ── 1 · Plano general ────────────────────────────────────────────── */}
      <Chapter align="left" scrim="bottom" className="md:justify-end md:pb-36">
        <p className="hero-in text-caption uppercase text-saiyan">{p.kicker}</p>
        <p className="hero-in jp mt-3 text-[clamp(1.1rem,2.1vw,1.7rem)] tracking-[0.3em] text-paper/55">
          {p.jp}
        </p>
        <HeroTitle lineas={p.titulo} />
        {/* La figura concreta que se eligió en la biblioteca. */}
        <p className="hero-in mt-4 text-caption uppercase text-paper/60">{modelo.nombre}</p>
        <p className="hero-in mt-6 max-w-md text-body text-paper/70">{p.intro}</p>
        <p className="hero-in mt-8 text-caption uppercase text-paper/45">
          {AUTOR.nombre} <span className="text-paper/25">·</span> {AUTOR.rol}
        </p>
        <p className="hero-in mt-1 font-mono text-[0.8rem] lowercase tracking-[0.12em] text-paper/30">
          @{AUTOR.alias}
        </p>
        <p className="hero-in mt-8 hidden text-caption uppercase text-paper/40 md:block" aria-hidden="true">
          Desplázate ↓ <span className="text-paper/25">·</span> Arrastra para girar
        </p>
      </Chapter>

      {/* ── 2 · Historia ─────────────────────────────────────────────────── */}
      <Chapter align="left" scrim="left">
        <Eyebrow>01 — Historia</Eyebrow>
        <TituloVivo className="mt-5" entrada="fusion" lineas={p.historia.titulo} />
        <Parrafos cap={p.historia} ancho="max-w-md" />
      </Chapter>

      {/* ── 3 · La cámara se acerca ──────────────────────────────────────── */}
      <Chapter align="right" scrim="right">
        <Eyebrow>02 — {p.aspecto.etiqueta}</Eyebrow>
        <TituloVivo className="mt-5" entrada="caida" lineas={p.aspecto.titulo} />
        <Parrafos cap={p.aspecto} ancho="max-w-sm" />
      </Chapter>

      {/* ── 4 · Zoom al torso: características de pelea ──────────────────── */}
      <Chapter align="left" scrim="left">
        <Eyebrow>03 — Estilo de pelea</Eyebrow>
        <TituloVivo className="mt-5" entrada="barrido" lineas={p.pelea.titulo} />
        <dl className="mt-8 grid max-w-md grid-cols-2 gap-px overflow-hidden border border-paper/10 bg-paper/10 text-left">
          {p.pelea.rasgos.map(([rasgo, valor]) => (
            <div key={rasgo} className="bg-ink px-4 py-3">
              <dt className="text-caption uppercase text-paper/45">{rasgo}</dt>
              <dd className="mt-1 text-base text-paper md:text-title">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 max-w-md text-body text-paper/55">{p.pelea.nota}</p>
        <p className="mt-6 hidden max-w-md text-body text-saiyan md:block">
          ↓ Cámbiale el render ahí abajo: el mismo modelo, dibujado o real.
        </p>
      </Chapter>

      {/* ── 5 · Órbita: la batalla ───────────────────────────────────────── */}
      <Chapter align="right" scrim="right">
        <Eyebrow>04 — La batalla</Eyebrow>
        <TituloVivo className="mt-5" entrada="impacto" lineas={p.batalla.titulo} />
        <Parrafos cap={p.batalla} ancho="max-w-sm" />
      </Chapter>

      {/* ── 6 · Técnicas especiales ──────────────────────────────────────── */}
      <Chapter align="left" scrim="bottom" className="md:justify-end md:pb-32">
        <Eyebrow>05 — Técnicas especiales</Eyebrow>
        <dl className={`mt-8 grid w-full grid-cols-2 gap-x-8 gap-y-8 ${p.tecnicas.length > 3 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          {p.tecnicas.map(({ nombre, detalle }) => (
            <div key={nombre}>
              <dt className="dbz-sub font-display text-[clamp(1.1rem,1.7vw,1.6rem)] uppercase leading-tight text-saiyan [overflow-wrap:anywhere]">{nombre}</dt>
              <dd className="mt-2 text-[0.95rem] leading-snug text-paper/60">{detalle}</dd>
            </div>
          ))}
        </dl>
        {p.tecnicasNota && <p className="mt-8 max-w-2xl text-body text-paper/55">{p.tecnicasNota}</p>}
      </Chapter>

      {/* ── 7 · Cierre ───────────────────────────────────────────────────── */}
      {/* Relleno inferior extra: es el capítulo con más contenido y en vertical
          no cabe de una pantalla, así que la última línea acababa por debajo del
          selector de render, que flota fijo. */}
      <Chapter align="left" scrim="left" className="pb-52 md:pb-28">
        <Eyebrow>06 — Quién firma esto</Eyebrow>
        <TituloVivo className="mt-5" entrada="giro" lineas={['¿Hacemos algo así?']} />

        {/*
          El mejor remate posible, y no es invención: el alias del autor ya es
          una fusión de dos apodos, igual que Gogeta lo es de dos guerreros. La
          página abre con una fusión y cierra con otra.
        */}
        <p className="mt-6 max-w-lg text-body text-paper/70">
          Soy <span className="text-paper">{AUTOR.nombre}</span>. Unos me llaman Flemin y otros
          Fleremahias, así que hice lo mismo que Goku y Vegeta: fusionarlos. De ahí{' '}
          <span className="font-mono lowercase text-saiyan">@{AUTOR.alias}</span>.
        </p>
        {/*
          La tesis del cierre, y va en primera persona porque es una opinión, no
          una ficha técnica. En una pieza que dice abiertamente que se dirigió
          con IA, esta es la frase que separa "lo generó una máquina" de "lo
          decidí yo y usé una máquina para ir más rápido".
        */}
        <p className="mt-4 max-w-lg text-body text-paper/70">
          Con conocimientos y fundamentos,{' '}
          <span className="text-paper">Claude Code se convierte en una de tus mejores herramientas
          de trabajo</span>. Aquí las decisiones son mías —cuánto aligerar la malla sin que se note,
          dónde cae cada luz, qué hace la cámara en cada momento— y la herramienta pone la velocidad.
          Ese es el oficio: saber qué pedir y por qué.
        </p>

        {/* La figura de esta página, a un clic: es lo que vino a ver quien
            llegó desde la biblioteca. */}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href={enlaceCompra(modelo)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block border-2 border-ink bg-saiyan px-8 py-4 text-caption uppercase text-ink shadow-[0.25rem_0.3rem_0_#0A0A0B] transition-transform duration-300 hover:scale-[1.03]"
          >
            Quiero esta figura · {precio(modelo.precio)}
          </a>
          <a
            href={BIBLIOTECA}
            className="text-caption uppercase text-paper/60 underline decoration-paper/25 underline-offset-[6px] transition-colors hover:text-saiyan"
          >
            ← Volver a la Biblioteca 3D
          </a>
        </div>

        <a
          href={AUTOR.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block border-2 border-ink bg-accent px-10 py-4 text-caption uppercase text-paper shadow-[0.25rem_0.3rem_0_#0A0A0B] transition-transform duration-300 hover:scale-[1.03]"
        >
          Ver mi perfil en LinkedIn
        </a>

        {REDES.length > 0 && (
          <ul className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2">
            {REDES.map(({ nombre, url }) => (
              <li key={nombre}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-caption uppercase text-paper/45 underline decoration-paper/20 underline-offset-[6px] transition-colors duration-200 hover:text-saiyan hover:decoration-saiyan"
                >
                  {nombre}
                </a>
              </li>
            ))}
          </ul>
        )}

        {/*
          Atribución. Va en el cierre y no escondida: la página usa un personaje,
          unos emblemas y unas páginas de manga que no son de quien firma, y
          decirlo claramente es lo que separa una pieza de estudio de alguien
          colgándose una medalla ajena. También es lo que se espera de un fan art
          publicado: reduce el riesgo de que llegue un aviso de retirada.
        */}
        <p className="mt-12 max-w-lg text-caption uppercase leading-relaxed text-paper/25">
          Dragon Ball es propiedad de Akira Toriyama, Shueisha y Toei Animation. Esta es una pieza de
          estudio sin fines comerciales, hecha por afición.
        </p>

        {/* Aquí hubo un pie con nombre, alias, año y tecnologías. Fuera entero:
            todo eso ya está en el párrafo de arriba y en la ficha del capítulo
            anterior, y encima quedaba pegado al selector de render — medido, dos
            píxeles de holgura. Un pie que repite y además estorba no es un pie. */}
      </Chapter>
    </div>
  )
})
