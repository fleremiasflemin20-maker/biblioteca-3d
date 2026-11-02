import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ETAPAS, type Etapa } from '../lib/etapa'
import { marcador } from '../lib/marcador'

/**
 * El trazado de la salpicadura de tinta.
 *
 * Radios alternos y desiguales a propósito: con las puntas todas iguales sale
 * una estrella de premio de supermercado. Lo que la hace parecer tinta caída es
 * que ninguna púa mida lo mismo que la de al lado.
 */
const SALPICADURA =
  'M0,-46 L7,-22 L26,-33 L19,-14 L43,-11 L22,-1 L40,12 L18,10 L27,32 L9,19 L5,45 ' +
  'L-3,20 L-17,38 L-15,15 L-37,22 L-21,4 L-45,-4 L-22,-11 L-33,-30 L-13,-18 L-12,-40 L-3,-21 Z'

/**
 * El panel de "cómo se hizo".
 *
 * La decisión de fondo: **no se va a ninguna parte**. Un enlace a una galería
 * de capturas rompería la toma continua, que es el argumento entero de la
 * página; y una galería de capturas obliga a creerse lo que cuenta. Aquí el
 * proceso se enseña sobre la misma figura, quitándole capas en vivo: la malla
 * que hay debajo no se describe, se ve.
 *
 * Mientras hay una etapa abierta el selector anime/real se retira. Son dos ejes
 * distintos —cómo está construido y cómo está dibujado— y ofrecerlos a la vez
 * multiplica los estados sin que ninguno cuente nada mejor.
 */
export function ComoSeHizo({
  etapa,
  abierto,
  onEtapa,
  onAbrir,
}: {
  etapa: Etapa
  abierto: boolean
  onEtapa: (e: Etapa) => void
  onAbrir: (v: boolean) => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const hotspot = useRef<HTMLButtonElement>(null)

  /*
   * El botón persigue al punto proyectado desde el ticker de GSAP, no desde un
   * `requestAnimationFrame` propio: dos bucles de animación compitiendo es la
   * causa más habitual de micro-tirones, y aquí ya hay uno moviendo la escena.
   *
   * Se escribe con `gsap.set` sobre `left`/`top` y no con estado de React: esto
   * cambia 60 veces por segundo.
   */
  useEffect(() => {
    const el = hotspot.current
    if (!el) return

    let ultima = -1

    const seguir = () => {
      // Mientras el panel está abierto el botón sobra: el panel lleva su propio
      // "Cerrar", y un botón flotante sobre la figura taparía justo la capa que
      // se está enseñando.
      const v = abierto ? 0 : marcador.visible

      /*
       * El punto proyectado se mantiene dentro de la pantalla.
       *
       * En vertical el ancla cae a 3 px del borde superior: ahí lo tapa la barra
       * del navegador, y en un móvil con muesca directamente no se ve. Y por la
       * derecha, la etiqueta desplegada se salía. El tope no descoloca nada —
       * mientras el ancla está en zona buena manda el ancla, y solo cuando se
       * escapa el botón se queda pegado al margen en vez de desaparecer.
       */
      const caja = el.getBoundingClientRect()
      const x = Math.min(marcador.x, window.innerWidth - caja.width - 14)
      // El suelo son 92 px y no 58: en vertical las siete bolas van en fila
      // bajo el borde superior y terminan en 68, así que por encima de eso el
      // botón se les mete en la fila.
      const y = Math.min(Math.max(marcador.y, 92), window.innerHeight - 58)

      gsap.set(el, { left: Math.max(14, x), top: y })

      // La opacidad solo se toca cuando cambia de verdad: escribirla en cada
      // frame ensucia el estilo y obliga al navegador a recomponer sin motivo.
      if (Math.abs(v - ultima) > 0.01) {
        ultima = v
        gsap.set(el, { opacity: v, pointerEvents: v > 0.5 ? 'auto' : 'none' })
      }
    }

    gsap.ticker.add(seguir)
    return () => gsap.ticker.remove(seguir)
  }, [abierto])

  // El panel se anima con GSAP y no con clases: al cerrarse tiene que terminar
  // en `display:none` para no robarle los clics al selector de render que hay
  // justo debajo, y una transición de CSS no encadena eso sin parpadeo.
  useEffect(() => {
    const el = panel.current
    if (!el) return

    gsap.killTweensOf(el)

    if (abierto) {
      gsap.set(el, { display: 'block' })
      gsap.fromTo(
        el,
        { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: 0.42, ease: 'power3.out' },
      )
    } else {
      gsap.to(el, {
        opacity: 0,
        y: 20,
        duration: 0.26,
        ease: 'power2.in',
        onComplete: () => gsap.set(el, { display: 'none' }),
      })
    }
  }, [abierto])

  // Escape cierra. Es un panel que tapa media pantalla en vertical: sin salida
  // de teclado, quien navega sin ratón se queda dentro.
  useEffect(() => {
    if (!abierto) return
    const salir = (e: KeyboardEvent) => e.key === 'Escape' && onAbrir(false)
    window.addEventListener('keydown', salir)
    return () => window.removeEventListener('keydown', salir)
  }, [abierto, onAbrir])

  const actual = ETAPAS.find((e) => e.id === etapa) ?? ETAPAS[ETAPAS.length - 1]

  return (
    <>
      <div
        ref={panel}
        style={{ display: 'none' }}
        className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-paper/15 bg-ink/95 px-6 pb-7 pt-6 backdrop-blur-md md:px-12"
        role="dialog"
        aria-label="Cómo se hizo"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
          <div className="flex items-start justify-between gap-6">
            <p className="text-caption uppercase text-saiyan">Cómo se hizo</p>
            <button
              type="button"
              onClick={() => onAbrir(false)}
              className="shrink-0 text-caption uppercase text-paper/45 transition-colors hover:text-paper"
            >
              Cerrar ✕
            </button>
          </div>

          {/* Las cuatro etapas en fila: son un recorrido, no un menú de opciones
              sueltas, y en fila se lee el orden. */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {ETAPAS.map((e, i) => {
              const activa = e.id === etapa
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onEtapa(e.id)}
                  aria-pressed={activa}
                  className={`border px-3 py-3 text-left transition-colors duration-200 ${
                    activa
                      ? 'border-accent bg-accent/15 text-paper'
                      : 'border-paper/15 text-paper/55 hover:border-paper/40 hover:text-paper'
                  }`}
                >
                  <span className="block font-mono text-[0.7rem] text-paper/35">0{i + 1}</span>
                  <span className="mt-1 block text-caption uppercase">{e.nombre}</span>
                  <span
                    className={`mt-1 block font-mono text-[0.72rem] ${activa ? 'text-saiyan' : 'text-paper/30'}`}
                  >
                    {e.dato}
                  </span>
                </button>
              )
            })}
          </div>

          <p className="max-w-2xl text-body text-paper/65">{actual.detalle}</p>
        </div>
      </div>

      {/*
        El botón no vive en una esquina: va **pegado al hombro izquierdo de la
        figura**, y la escena 3D le dice dónde está eso en píxeles a cada frame
        (ver MarcadorEscena).

        Un botón en la esquina es cromo de interfaz y se ignora. Anclado al
        cuerpo se lee como lo que es —un punto caliente sobre el objeto—, y
        además señala: dice "esto de aquí" en vez de "hay una sección en algún
        sitio".

        Desaparece en cuanto la cámara empieza a girar, porque a partir de ahí el
        hombro que señalaba se va detrás y el botón quedaría flotando sobre la
        espalda sin apuntar a nada.
      */}
      <button
        ref={hotspot}
        type="button"
        onClick={() => onAbrir(true)}
        aria-expanded={abierto}
        style={{ opacity: 0, pointerEvents: 'none' }}
        className="group fixed left-0 top-0 z-40 flex -translate-y-1/2 items-center gap-3"
      >
        {/*
          Salpicadura de tinta, no un disco.

          En una plancha de manga los golpes se dibujan así, y la página entera
          ya habla ese idioma —el contorno del titular, las onomatopeyas, las
          líneas de concentración—. Un círculo limpio con un "+" dentro es
          lenguaje de interfaz y se lee como algo pegado encima; la mancha se lee
          como parte de la viñeta.

          Va en amarillo saiyan sobre una página casi negra, que es el contraste
          más alto de la paleta, y el "+" en tinta dentro de la mancha.

          Dos copias del mismo trazado: la de detrás crece y se apaga en bucle
          para que el punto lata. En CSS, sin gastar un hueco en el ticker.
        */}
        <span className="relative grid h-14 w-14 shrink-0 place-items-center">
          <svg viewBox="-50 -50 100 100" className="pulso absolute inset-0 h-14 w-14 text-saiyan">
            <path d={SALPICADURA} fill="currentColor" />
          </svg>

          <svg
            viewBox="-50 -50 100 100"
            className="relative h-14 w-14 text-saiyan drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[18deg]"
          >
            <path d={SALPICADURA} fill="currentColor" />
            {/* El signo se dibuja con dos barras y no con texto: una fuente
                puede no estar cargada todavía y el símbolo saldría descolocado
                justo en el primer plano, que es cuando más se mira. */}
            <path d="M-13 0 H13 M0 -13 V13" stroke="#0A0A0B" strokeWidth="7" strokeLinecap="round" />
          </svg>
        </span>

        {/*
          La etiqueta se despliega al acercar el puntero y el resto del tiempo no
          ocupa nada.

          Es lo único que cabe: junto a la figura hay sitio para un disco de 36
          px, no para 185. Y funciona a favor — un punto que late sobre el objeto
          ya invita a acercarse, y al acercarse aparece el texto que explica qué
          hay detrás.

          En táctil no existe el hover, así que ahí va siempre desplegada: en
          vertical el texto del hero está anclado abajo y la banda de arriba está
          libre.
        */}
        <span className="max-w-0 overflow-hidden opacity-0 transition-all duration-300 ease-out group-hover:max-w-[14rem] group-hover:opacity-100 group-focus-visible:max-w-[14rem] group-focus-visible:opacity-100 [@media(hover:none)]:max-w-[14rem] [@media(hover:none)]:opacity-100">
          <span className="block whitespace-nowrap border border-paper/20 bg-ink/75 px-3 py-1.5 text-caption uppercase text-paper/80 backdrop-blur-sm transition-colors duration-300 group-hover:border-saiyan group-hover:text-saiyan">
            Cómo se hizo
          </span>
        </span>
      </button>
    </>
  )
}
