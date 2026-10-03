/**
 * Las tres capas que convierten un degradado en un atardecer de Miami.
 *
 * Ninguna es decoración suelta: el degradado da la hora del día, el grano le
 * quita el acabado de plantilla —un degradado limpio se lee como CSS; con grano
 * se lee como una foto— y las palmeras dan la escala y el sitio.
 */

/** El sol. Un radial enorme y bajo, que es donde cae el sol al ponerse. */
export function Puesta() {
  return (
    <div
      className="pointer-events-none absolute inset-0 transition-[background] duration-700"
      style={{
        background:
          'radial-gradient(120% 85% at 50% 108%, var(--desde) 0%, color-mix(in oklab, var(--hasta) 70%, transparent) 38%, transparent 72%)',
      }}
      aria-hidden="true"
    />
  )
}

/**
 * Grano de película.
 *
 * `feTurbulence` en un SVG diminuto, repetido como fondo. Se genera una vez y
 * el navegador lo tesela: animar la turbulencia de verdad costaría un repintado
 * completo por frame, y aquí basta con mover el fondo unos píxeles.
 */
export function Grano() {
  const ruido = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140">
       <filter id="r"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/></filter>
       <rect width="140" height="140" filter="url(#r)" opacity="0.42"/>
     </svg>`,
  )
  return (
    <div
      className="grano pointer-events-none absolute inset-0 mix-blend-overlay"
      style={{ backgroundImage: `url("data:image/svg+xml,${ruido}")` }}
      aria-hidden="true"
    />
  )
}

/**
 * Palmeras en silueta.
 *
 * Dibujadas a mano en SVG, no fotos: una silueta negra plana es exactamente
 * cómo se ven a contraluz contra el cielo, y pesa un par de kilobytes en vez de
 * cientos. Van a distinta altura y tamaño para que no se lean como un patrón.
 */
function Palmera({ escala = 1, hojas = 7 }: { escala?: number; hojas?: number }) {
  return (
    <g transform={`scale(${escala})`}>
      {/* Tronco: dos curvas, no un rectángulo — una palmera nunca es recta. */}
      <path d="M0,0 C-2,-40 4,-80 1,-118 L7,-118 C10,-80 4,-40 6,0 Z" fill="currentColor" />
      {Array.from({ length: hojas }, (_, i) => {
        const a = -90 + (i - (hojas - 1) / 2) * (150 / hojas)
        return (
          <path
            key={i}
            d="M3,-118 C24,-132 52,-130 64,-118 C48,-124 22,-122 3,-114 Z"
            fill="currentColor"
            transform={`rotate(${a} 3 -118)`}
          />
        )
      })}
    </g>
  )
}

export function Palmeras() {
  return (
    <svg
      viewBox="0 0 1200 300"
      preserveAspectRatio="xMidYMax slice"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[24vh] text-ink md:h-[38vh]"
      aria-hidden="true"
    >
      <g transform="translate(90 300)"><Palmera escala={1.15} hojas={8} /></g>
      <g transform="translate(232 300)"><Palmera escala={0.72} hojas={6} /></g>
      <g transform="translate(985 300)"><Palmera escala={0.95} hojas={7} /></g>
      <g transform="translate(1118 300)"><Palmera escala={1.3} hojas={9} /></g>
    </svg>
  )
}

/**
 * Velo de legibilidad para vertical.
 *
 * En horizontal el texto vive en la mitad izquierda, que está oscura. En
 * vertical se apila encima de la parte más encendida de la puesta de sol, y el
 * cuerpo del texto pierde contraste justo donde hay que leer.
 *
 * Va fijo al viewport y en una sola pieza, no uno por bloque: apilar velos deja
 * un corte duro donde acaba uno y empieza el siguiente, que se lee como si la
 * página se hubiera roto.
 *
 * Y va flojo. El primer intento lo puse al 90% y se comió el atardecer entero:
 * el texto quedaba perfecto sobre un fondo negro, que es justo la página que no
 * se quiere. Sube el contraste lo justo y deja pasar el color.
 */
export function Velo() {
  return (
    <div
      className="pointer-events-none absolute inset-0 md:hidden"
      style={{ background: 'linear-gradient(to top, #0A0A0BA6 0%, #0A0A0B4D 48%, transparent 76%)' }}
      aria-hidden="true"
    />
  )
}
