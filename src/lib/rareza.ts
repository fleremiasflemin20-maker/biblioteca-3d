import type { Modelo3D } from './catalogo'

/**
 * La rareza de una pieza, como en un juego de colección: decide el marco de
 * su carta en el catálogo y el sello de la pantalla de selección. Sale del
 * precio, que ya dice cuánto trabajo lleva la figura.
 */
export type Rareza = {
  nombre: 'Común' | 'Rara' | 'Épica' | 'Legendaria'
  /** Los tres tonos del marco de la carta (`--r1`, `--r2`, `--r3`). */
  marco: [string, string, string]
  /** Color del sello. */
  sello: string
}

const RAREZAS: Rareza[] = [
  { nombre: 'Legendaria', marco: ['#FFC23D', '#FFF1C2', '#FF6A13'], sello: '#FFC23D' },
  { nombre: 'Épica', marco: ['#FF2D8A', '#FFB3D6', '#8A3CFF'], sello: '#FF2D8A' },
  { nombre: 'Rara', marco: ['#4D8DFF', '#B8E4FF', '#8A3CFF'], sello: '#5AA9FF' },
  { nombre: 'Común', marco: ['#6B6880', '#C9C6D6', '#3A3550'], sello: '#A8A4B8' },
]

export function rareza(m: Modelo3D): Rareza {
  if (m.precio >= 22) return RAREZAS[0]
  if (m.precio >= 17) return RAREZAS[1]
  if (m.precio >= 12) return RAREZAS[2]
  return RAREZAS[3]
}

/** Coste en puntos de equipo (DP), como el de cada luchador en un juego de pelea: de 1 a 10. */
export const coste = (m: Modelo3D) => (m.precio === 0 ? 0 : Math.max(1, Math.min(10, Math.round(m.precio / 3))))

/** De 1 a 7 estrellas según los triángulos: cuánto detalle trae la pieza. */
export function estrellas(m: Modelo3D) {
  if (!m.triangulos) return 3
  return Math.max(1, Math.min(7, Math.round(Math.log10(m.triangulos) * 2 - 6)))
}
