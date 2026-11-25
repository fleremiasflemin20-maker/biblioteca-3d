import TAPAS_JSON from '../data/tapas-comic.json'

/**
 * Arte cómic y manga de la Biblioteca. Todo sale de nuestras propias figuras:
 * scripts/comic/portadas_comic.py pasa cada portada por el filtro de tinta y
 * trama y la monta en una tapa "FLEMIN COMICS" (estilo americano) o en un tomo
 * manga "フレミン". Las páginas a color del fondo del escenario salen igual.
 */
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')

export type Tapa = { id: string; estilo: 'comic' | 'manga'; url: string }

export const TAPAS: Tapa[] = (TAPAS_JSON as { id: string; estilo: 'comic' | 'manga'; tapa: string }[]).map((t) => ({
  id: t.id,
  estilo: t.estilo,
  url: `${BASE}/comic/tapas/${t.tapa}`,
}))

/** Tira de páginas a color que rodea el escenario de selección (se repite en bucle). */
export const PAGINAS_URL = `${BASE}/comic/paginas.webp`
export const PAGINAS_URL_LIGERA = `${BASE}/comic/paginas_1k.webp`

/** Onomatopeyas y frases de bocadillo para las viñetas del libro. */
export const ONOMATOPEYAS = ['¡BOOM!', '¡ZAS!', 'ドン', '¡KRAK!', 'ゴゴゴ', '¡POW!', 'ズドン', '¡WHAM!', 'バキ', '¡FIUUU!']
export const BOCADILLOS = [
  '¡Llévame a casa!',
  '¡Imprímeme ya!',
  '¿Me buscabas?',
  '¡Gírame en 3D!',
  '¡Este es mi poder!',
  '¡Elige bien!',
  '¡Aquí estoy!',
  '¿Listo para la pelea?',
]

/** Número pseudoaleatorio estable a partir de un texto: cada figura siempre sale igual. */
export function semilla(txt: string) {
  let h = 2166136261
  for (let i = 0; i < txt.length; i++) h = Math.imul(h ^ txt.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}
