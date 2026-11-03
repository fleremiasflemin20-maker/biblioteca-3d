import type { Modelo3D } from './catalogo'

/**
 * Las páginas de historia de Dragon Ball (la plantilla scrollytelling del
 * Gogeta SSJ4, en `personaje/`). Cada figura a color de la sección apunta al
 * personaje que representa: varias figuras comparten historia (las poses A, B,
 * C y las versiones por piezas), pero cada una enseña su propio modelo y nombre.
 *
 * Para sumar una figura nueva basta con añadir su id aquí; para un personaje
 * nuevo, además, su ficha en `personaje/src/lib/personajes.ts`.
 */
export const HISTORIA_DE: Record<string, string> = {
  'saiyan-dorado-chibi-a': 'goku-ssj',
  'saiyan-dorado-chibi-b': 'goku-ssj',
  'saiyan-dorado-batalla-chibi': 'goku-ssj',
  'principe-saiyan-chibi-a': 'vegeta',
  'principe-saiyan-chibi-b': 'vegeta',
  'vegeta-chibi-en-relieve': 'vegeta',
  'fusion-fase4-chibi-a': 'gogeta-ssj4',
  'fusion-fase4-chibi-b': 'gogeta-ssj4',
  'cosmic-fusion-warrior-original': 'gogeta-blue',
  'cosmic-fusion-warrior-vibrante': 'gogeta-blue',
  'cosmic-fusion-warrior-ultra-pop': 'gogeta-blue',
  'cosmic-fusion-warrior-anime-intenso': 'gogeta-blue',
  'cosmic-fusion-warrior-segmentado': 'gogeta-blue',
  'maton-de-traje-chibi': 'octavio',
  'piccolo-busto-en-relieve': 'piccolo',
  'piccolo-chibi': 'piccolo',
  'saiyan-legendario-ova-chibi-a': 'broly-z',
  'saiyan-legendario-ova-chibi-b': 'broly-z',
  'saiyan-legendario-chibi-dorado': 'broly-super',
  'saiyan-legendario-chibi-dorado-piezas': 'broly-super',
  'saiyan-legendario-chibi-verde': 'broly-super',
  'guerrero-futuro-chibi-a': 'trunks',
  'guerrero-futuro-chibi-a-piezas': 'trunks',
  'guerrero-futuro-chibi-b': 'trunks',
  'monje-guerrero-chibi': 'krilin',
  'monje-guerrero-chibi-piezas': 'krilin',
  'samurai-errante-chibi-a': 'yajirobe',
  'samurai-errante-chibi-a-piezas': 'yajirobe',
  'samurai-errante-chibi-b': 'yajirobe',
  'samurai-errante-chibi-c': 'yajirobe',
  'gato-sabio-chibi-a': 'karin',
  'gato-sabio-chibi-b': 'karin',
  'saiyan-fase4-chibi-clasico-a': 'goku-ssj4',
  'saiyan-fase4-chibi-clasico-a-piezas': 'goku-ssj4',
  'saiyan-fase4-chibi-clasico-b': 'goku-ssj4',
  'saiyan-fase4-chibi-clasico-c': 'goku-ssj4',
  'saiyan-fase4-chibi-daima-a': 'goku-ssj4-daima',
  'saiyan-fase4-chibi-daima-b': 'goku-ssj4-daima',
  'saiyan-fase4-chibi-daima-c': 'goku-ssj4-daima',
  'limit-break-clash-a': 'goku-vs-vegeta',
  'limit-break-clash-b': 'goku-vs-vegeta',
  'vibrant-saiyan-showdown': 'goku-vs-vegeta',
  'vibrant-saiyan-segmentado': 'goku-vs-vegeta',
  'dragon-ball-sparking': 'sparking-zero',
}

/** El escaneo de Gogeta ya tiene su página: es la original de la que sale la plantilla. */
const PAGINAS_PROPIAS: Record<string, string> = {
  'gogeta-ssj4': 'https://fleremiasflemin20-maker.github.io/gogeta-ssj4-scrollytelling/',
}

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')

/** La página de historia de una figura, o `undefined` si no tiene. */
export function enlaceHistoria(m: Modelo3D): string | undefined {
  if (m.oculto || m.sinTextura) return undefined
  if (PAGINAS_PROPIAS[m.id]) return PAGINAS_PROPIAS[m.id]
  if (!HISTORIA_DE[m.id]) return undefined
  return `${BASE}/personaje/?id=${encodeURIComponent(m.id)}`
}
