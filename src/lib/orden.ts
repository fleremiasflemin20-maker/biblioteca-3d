import { CATEGORIAS, type Categoria, type Modelo3D } from './catalogo'

/**
 * Orden de la biblioteca: cada pieza en su sitio.
 *
 * Primero la sección (en el orden de `CATEGORIAS`), dentro de ella las de
 * color antes que las sin textura, y dentro de cada bloque las variantes de
 * una misma figura juntas (A, B, escultura, en piezas…). El orden que eligió
 * el usuario (recientes, precio, nombre) se respeta entre familias: cada una
 * se coloca donde aparece su primer miembro, y dentro van por nombre (A, B…).
 */

/* Sufijos que marcan una variante y no otra figura. Se quitan desde el final. */
const VARIANTE = /-(?:[a-d]|piezas|escultura|segmentado|original|vibrante|ultra-pop|anime-intenso|showdown|dorado|verde|acorazado|meshy)$/

/** La figura base de una pieza: `saiyan-fase4-chibi-clasico-escultura-b` → `saiyan-fase4-chibi-clasico`. */
export function familia(m: Modelo3D) {
  if (m.familia) return m.familia
  let id = m.id
  for (let antes = ''; antes !== id; ) {
    antes = id
    id = id.replace(VARIANTE, '')
  }
  return id
}

/** Filtro de acabado de la biblioteca. */
export type Acabado = 'todos' | 'color' | 'sin-textura'

export type Grupo = {
  categoria: Categoria
  /** Sin textura: mallas en blanco. */
  blanco: boolean
  modelos: Modelo3D[]
}

const indiceCategoria = (m: Modelo3D) => {
  const i = CATEGORIAS.findIndex((c) => c.id === m.categoria)
  return i < 0 ? CATEGORIAS.length : i
}

/** Ordena una lista ya filtrada y la parte en bloques sección × acabado. */
export function agrupar(lista: Modelo3D[]): Grupo[] {
  const primera = new Map<string, number>()
  lista.forEach((m, i) => {
    const f = familia(m)
    if (!primera.has(f)) primera.set(f, i)
  })
  const orden = [...lista].sort(
    (a, b) =>
      indiceCategoria(a) - indiceCategoria(b) ||
      Number(!!a.sinTextura) - Number(!!b.sinTextura) ||
      primera.get(familia(a))! - primera.get(familia(b))! ||
      a.id.localeCompare(b.id, undefined, { numeric: true }),
  )
  const grupos: Grupo[] = []
  for (const m of orden) {
    const ultimo = grupos.at(-1)
    if (ultimo && ultimo.categoria.id === m.categoria && ultimo.blanco === !!m.sinTextura) ultimo.modelos.push(m)
    else grupos.push({ categoria: CATEGORIAS[indiceCategoria(m)] ?? CATEGORIAS[0], blanco: !!m.sinTextura, modelos: [m] })
  }
  return grupos
}

/** Las otras versiones de la misma figura (en la misma lista), en su orden. */
export function variantes(m: Modelo3D, lista: Modelo3D[]) {
  const f = familia(m)
  return lista.filter((x) => x.categoria === m.categoria && familia(x) === f)
}
