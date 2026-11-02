/**
 * Modo de render: dibujado o realista.
 *
 * `anime` sombrea por bandas planas y añade contorno negro — el lenguaje de un
 * fotograma de la serie. `real` es el PBR de estudio con el que nació la página.
 *
 * No es solo un cambio de material: el sombreado cel renuncia a la rugosidad, al
 * metalness y al mapa de entorno, así que las luces tienen que compensar. Cada
 * modo lleva su propio multiplicador de intensidad.
 */
export type Estilo = 'anime' | 'real'

const CLAVE = 'historias:estilo'

/**
 * El estilo inicial, por orden de prioridad: lo que diga la URL (para poder
 * enseñar un modo concreto con un enlace), lo último que se eligiera, y por
 * defecto `anime` — que es el que casa con el fondo de manga.
 */
export function estiloInicial(): Estilo {
  if (typeof window === 'undefined') return 'anime'

  const url = new URLSearchParams(window.location.search).get('estilo')
  if (url === 'anime' || url === 'real') return url

  const guardado = window.localStorage?.getItem(CLAVE)
  if (guardado === 'anime' || guardado === 'real') return guardado

  return 'anime'
}

export function recordarEstilo(estilo: Estilo) {
  try {
    window.localStorage?.setItem(CLAVE, estilo)
  } catch {
    // Modo privado o almacenamiento lleno: se pierde la elección y no pasa nada.
  }
}

/** Cuánto hay que subir las luces en cada modo (ver el comentario de arriba). */
export const LUZ = {
  // El toon no recibe el mapa de entorno, y ese entorno aportaba la mitad de la
  // luz de la escena. Sin este empujón la figura dibujada sale apagada.
  anime: 1.45,
  real: 1,
} as const
