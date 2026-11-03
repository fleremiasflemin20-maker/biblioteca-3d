/**
 * Perfil de **rendimiento**. Solo decide lo que cuesta caro cambiar en caliente:
 * resolución de texturas, dpr, sombras y postprocesado. Se resuelve una vez al
 * arrancar y no reacciona al resize, porque recargar texturas de 4K a mitad de
 * sesión provoca un tirón mucho peor que servir el set de escritorio en una
 * ventana estrecha.
 *
 * El **encuadre** no vive aquí: depende de la forma de la ventana, cambia con
 * cada resize y lo calcula `framing.ts`.
 */
const SINGLE_FILE = import.meta.env.VITE_SINGLEFILE === '1'

export type Quality = {
  isMobile: boolean
  /** Sufijo de las texturas: '4k' | '2k' | '1k' */
  textures: { diffuse: string; rest: string }
  /** Escala del modelo. */
  scale: number
  dpr: [number, number]
  /** PCSS es caro: solo en escritorio. */
  softShadows: boolean
  shadowMapSize: number
  /** Un paso extra de render a pantalla completa; en móvil no compensa. */
  bloom: boolean
}

const MOBILE: Quality = {
  isMobile: true,
  textures: { diffuse: '2k', rest: '1k' },
  scale: 0.92,
  dpr: [1, 1.5],
  softShadows: false,
  shadowMapSize: 1024,
  bloom: false,
}

const DESKTOP: Quality = {
  isMobile: false,
  textures: { diffuse: '4k', rest: '2k' },
  scale: 1,
  dpr: [1, 2],
  softShadows: true,
  shadowMapSize: 2048,
  bloom: true,
}

export function detectQuality(): Quality {
  if (typeof window === 'undefined') return DESKTOP

  // Forzar perfil desde la URL (?perfil=desktop | ?perfil=mobile). Es la única
  // forma de revisar el encuadre y las texturas de escritorio en una ventana
  // estrecha, porque el perfil se resuelve una vez y no reacciona al resize.
  const forced = new URLSearchParams(window.location.search).get('perfil')
  if (forced === 'desktop') return DESKTOP
  if (forced === 'mobile') return MOBILE

  // 767 y no 1023: una ventana de escritorio estrecha sigue siendo escritorio, y
  // con el perfil móvil se quedaba con la figura diminuta y subida. Las tabletas
  // caen por `coarse`, que es lo que de verdad las distingue.
  const narrow = window.matchMedia('(max-width: 767px)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const weak = (navigator.hardwareConcurrency ?? 8) <= 4

  return narrow || coarse || weak ? MOBILE : DESKTOP
}

export const QUALITY = detectQuality()

/**
 * Antepone el subdirectorio donde vive la página, si lo hay.
 *
 * En GitHub Pages sin dominio propio el sitio cuelga de `/<repo>/`, así que una
 * ruta absoluta como `/models/gogeta.glb` apuntaría a la raíz de github.io — que
 * es otro sitio — y no cargaría nada.
 *
 * La condición de que empiece por `/` no es una comprobación de más: en la
 * compilación de archivo único, `build-artifact.mjs` ya ha sustituido estas
 * cadenas por data URIs, que empiezan por `data:`. Sin el guardia les pegaría el
 * prefijo delante y las dejaría inservibles.
 */
const PREFIJO = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
const ruta = (p: string) => (p.startsWith('/') ? PREFIJO + p : p)

/** La tira de páginas de manga que envuelve la escena (ver MangaBackdrop). */
export const MANGA_URL =
  QUALITY.isMobile || SINGLE_FILE
    ? ruta('/historias/manga_strip_1k.webp')
    : ruta('/historias/manga_strip.webp')
