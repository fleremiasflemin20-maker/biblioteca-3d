/**
 * La pintura multimaterial de Bambu Studio, OrcaSlicer y PrusaSlicer.
 *
 * Cada triángulo pintado guarda en el 3MF (atributo `paint_color` o
 * `slic3rpe:mmu_segmentation`) un árbol de subdivisiones en hexadecimal: el
 * pincel del laminador parte el triángulo en hijos cada vez más pequeños
 * hasta seguir el trazo. Aquí se reconstruye ese árbol con la misma
 * geometría que `TriangleSelector::perform_split` de los laminadores, así que
 * la frontera entre colores queda exactamente donde se pintó.
 *
 * El formato:
 *  - Se lee de atrás hacia delante, un dígito hexadecimal (nibble) cada vez.
 *  - Nibble de nodo: 2 bits bajos = lados partidos (0 = hoja). En una hoja,
 *    los 2 altos son el estado; si valen 0b11 el estado sigue en el próximo
 *    nibble (+3), y si ese es 0xF, en el siguiente (+18). En un nodo partido,
 *    los 2 altos son el "lado especial" que fija cómo se parte.
 *  - Los hijos vienen en orden inverso: primero el último.
 *  - Estado 0 = el filamento del objeto; n = filamento n.
 */
type P = readonly [number, number, number]

const medio = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]

/** Los hijos de un triángulo partido, en el orden en que los crea el laminador. */
function hijos(t: readonly [P, P, P], lados: number, especial: number): [P, P, P][] {
  const v = [t[especial], t[(especial + 1) % 3], t[(especial + 2) % 3]]
  if (lados === 1) {
    v.splice(2, 0, medio(v[2], v[1]))
    return [[v[0], v[1], v[2]], [v[2], v[3], v[0]]]
  }
  if (lados === 2) {
    v.splice(1, 0, medio(v[1], v[0]))
    v.splice(4, 0, medio(v[0], v[3]))
    return [[v[0], v[1], v[4]], [v[1], v[2], v[4]], [v[2], v[3], v[4]]]
  }
  v.splice(1, 0, medio(v[1], v[0]))
  v.splice(3, 0, medio(v[3], v[2]))
  v.splice(5, 0, medio(v[0], v[4]))
  return [[v[0], v[1], v[5]], [v[1], v[2], v[3]], [v[3], v[4], v[5]], [v[1], v[3], v[5]]]
}

/**
 * Llama a `hoja` con cada subtriángulo y su estado. Si todo el árbol es de un
 * solo estado, devuelve el triángulo entero (sin subdividir de más). Con un
 * árbol corrupto, el laminador descarta la pintura; aquí igual: estado 0.
 */
export function decodificarPintura(hex: string, t: readonly [P, P, P], hoja: (t: [P, P, P], estado: number) => void) {
  let i = hex.length - 1
  const nibble = () => {
    if (i < 0) throw new Error('fin')
    const n = parseInt(hex[i--], 16)
    if (Number.isNaN(n)) throw new Error('hex')
    return n
  }

  const hojas: { t: [P, P, P]; estado: number }[] = []
  const nodo = (tri: [P, P, P]) => {
    const codigo = nibble()
    const lados = codigo & 0b11
    if (lados === 0) {
      let estado = codigo >> 2
      if (estado === 3) {
        const n = nibble()
        estado = n === 0xf ? nibble() + 18 : n + 3
      }
      hojas.push({ t: tri, estado })
      return
    }
    if (lados !== 3 && codigo >> 2 === 3) throw new Error('lado')
    const h = hijos(tri, lados, lados === 3 ? 0 : codigo >> 2)
    for (let k = h.length - 1; k >= 0; k--) nodo(h[k])
  }

  try {
    nodo([t[0], t[1], t[2]])
  } catch {
    hoja([t[0], t[1], t[2]], 0)
    return
  }
  if (hojas.every((h) => h.estado === hojas[0].estado)) hoja([t[0], t[1], t[2]], hojas[0].estado)
  else for (const h of hojas) hoja(h.t, h.estado)
}
