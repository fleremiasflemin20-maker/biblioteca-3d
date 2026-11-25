import datos from '../data/ova.json'

/**
 * "La Incursión", la OVA propia de la Biblioteca.
 *
 * Cada viñeta es una imagen 4K renderizada a partir de nuestros propios GLB
 * (cel shading + contorno de tinta, sin peana) con `scripts/ova/`. Los textos
 * NO van pegados en la imagen: narración y globos se pintan en HTML encima, así
 * se pueden corregir sin volver a renderizar y no se pixelan.
 *
 * `src/data/ova.json` lo genera `scripts/ova/guion.py` (ver el LEEME de ahí).
 */

export type Globo = {
  quien: string
  texto: string
  /** Posición del globo en fracciones de la viñeta (0–1). */
  x: number
  y: number
  cola: 'abajo' | 'izq' | 'der'
  tipo: 'normal' | 'grito'
}

export type Vineta = {
  id: string
  /** 0 = prólogo, 1–6 capítulos, 7 = epílogo, 8 = "vida en el multiverso". */
  cap: number
  narra: string
  globos: Globo[]
  /** Claves del reparto que salen en la viñeta (ver `scripts/ova/reparto.json`). */
  reparto: string[]
}

export const VINETAS = datos as Vineta[]

export const CAPITULOS: { num: number; titulo: string; kanji: string }[] = [
  { num: 0, titulo: 'Prólogo · El Archivo', kanji: '序' },
  { num: 1, titulo: 'La primera grieta', kanji: '裂' },
  { num: 2, titulo: 'Choque de orgullos', kanji: '誇' },
  { num: 3, titulo: 'El reino de los pecados', kanji: '罪' },
  { num: 4, titulo: 'El hilo rojo', kanji: '糸' },
  { num: 5, titulo: 'Guerra total', kanji: '戦' },
  { num: 6, titulo: 'Fusión multiversal', kanji: '合' },
  { num: 7, titulo: 'Epílogo · El mismo estante', kanji: '終' },
]

/** Las viñetas de la OVA propiamente dicha (sin las escenas sueltas). */
export const EPISODIO = VINETAS.filter((v) => v.cap <= 7)

/** Qué claves del reparto cuentan como cada historia de `personaje/`. */
const REPARTO_DE: Record<string, string[]> = {
  'goku-ssj': ['goku', 'goku-batalla', 'goku-nino'],
  vegeta: ['vegeta'],
  'gogeta-ssj4': ['gogeta4'],
  'gogeta-blue': ['gogetablue'],
  octavio: ['octavio'],
  piccolo: ['piccolo'],
  'broly-z': ['broly'],
  'broly-super': ['broly-verde'],
  trunks: ['trunks'],
  krilin: ['krilin'],
  yajirobe: ['yajirobe'],
  karin: ['karin'],
  'goku-ssj4': ['goku4'],
  'goku-ssj4-daima': ['goku4'],
}

/** Las viñetas (OVA y escenas sueltas) donde aparece el personaje de una historia. */
export function vinetasDe(historia: string): Vineta[] {
  if (historia === 'goku-vs-vegeta')
    return VINETAS.filter((v) => v.reparto.includes('vegeta') && v.reparto.some((k) => k.startsWith('goku')))
  if (historia === 'sparking-zero') return VINETAS.filter((v) => v.reparto.length >= 4)
  const claves = REPARTO_DE[historia] ?? []
  return VINETAS.filter((v) => v.reparto.some((k) => claves.includes(k)))
}

const BASE = import.meta.env.BASE_URL

export const imagenVineta = (id: string, talla: '4k' | 'movil') => `${BASE}ova/${talla}/${id}.webp`

/** Enlace a la OVA abierta en una viñeta concreta. */
export const enlaceOva = (id?: string) => `${BASE}ova/${id ? `#${id}` : ''}`
