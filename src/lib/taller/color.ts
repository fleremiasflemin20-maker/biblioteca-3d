/**
 * De textura a filamentos: una impresora multicolor tiene 4, 8 o 16 bobinas,
 * no millones de colores. Se agrupan los colores de los triángulos con
 * k-medias en el espacio OKLab (donde la distancia se parece a lo que ve el
 * ojo), ponderando por área para que lo que se ve grande mande.
 *
 * La siembra es determinista (el más lejano cada vez, desde el color más
 * frecuente): mover el control de colores no hace parpadear la paleta.
 */
const lineal = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** sRGB 0–1 → OKLab. */
export function aOklab(r: number, g: number, b: number): [number, number, number] {
  const R = lineal(r), G = lineal(g), B = lineal(b)
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

export function deOklab(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const c = (x: number) => Math.min(1, Math.max(0, gamma(x)))
  return [
    c(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    c(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    c(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

export const aHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase()

export function deHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/**
 * Agrupa `rgb` (3 valores 0–1 por triángulo) en hasta `k` colores.
 * Devuelve la paleta en hex, de mayor a menor área, y el índice de cada triángulo.
 */
export function cuantizar(rgb: Float32Array, pesos: Float32Array, k: number): { paleta: string[]; asignacion: Uint8Array } {
  const n = pesos.length
  // Histograma en una rejilla OKLab de 32³: miles de celdas en vez de cientos de miles de triángulos.
  const celdas = new Map<number, { L: number; a: number; b: number; w: number }>()
  const celdaDe = new Uint32Array(n)
  for (let t = 0; t < n; t++) {
    const [L, a, b] = aOklab(rgb[t * 3], rgb[t * 3 + 1], rgb[t * 3 + 2])
    const clave = (Math.round(L * 31) << 10) | (Math.round((a + 0.4) * 38.75) << 5) | Math.round((b + 0.4) * 38.75)
    celdaDe[t] = clave
    const w = pesos[t] || 1e-9
    const c = celdas.get(clave)
    if (c) {
      c.L += L * w; c.a += a * w; c.b += b * w; c.w += w
    } else celdas.set(clave, { L: L * w, a: a * w, b: b * w, w })
  }
  const puntos = [...celdas.values()].map((c) => ({ L: c.L / c.w, a: c.a / c.w, b: c.b / c.w, w: c.w }))
  const claves = [...celdas.keys()]
  k = Math.max(1, Math.min(k, puntos.length))

  const d2 = (p: { L: number; a: number; b: number }, q: { L: number; a: number; b: number }) =>
    (p.L - q.L) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2
  const centros = [puntos.reduce((x, y) => (y.w > x.w ? y : x))].map((p) => ({ ...p }))
  while (centros.length < k) {
    let mejor = puntos[0], max = -1
    for (const p of puntos) {
      const d = Math.min(...centros.map((c) => d2(p, c))) * Math.sqrt(p.w)
      if (d > max) [mejor, max] = [p, d]
    }
    centros.push({ ...mejor })
  }

  const grupo = new Uint8Array(puntos.length)
  for (let it = 0; it < 24; it++) {
    let movido = false
    puntos.forEach((p, i) => {
      let g = 0, min = Infinity
      centros.forEach((c, j) => {
        const d = d2(p, c)
        if (d < min) [g, min] = [j, d]
      })
      if (grupo[i] !== g) movido = true
      grupo[i] = g
    })
    const suma = centros.map(() => ({ L: 0, a: 0, b: 0, w: 0 }))
    puntos.forEach((p, i) => {
      const s = suma[grupo[i]]
      s.L += p.L * p.w; s.a += p.a * p.w; s.b += p.b * p.w; s.w += p.w
    })
    suma.forEach((s, j) => {
      if (s.w) centros[j] = { L: s.L / s.w, a: s.a / s.w, b: s.b / s.w, w: s.w }
    })
    if (!movido && it) break
  }

  // Orden por área; los grupos vacíos desaparecen.
  const area = centros.map(() => 0)
  puntos.forEach((p, i) => (area[grupo[i]] += p.w))
  const orden = centros.map((_, j) => j).filter((j) => area[j] > 0).sort((x, y) => area[y] - area[x])
  const nuevo = new Uint8Array(centros.length)
  orden.forEach((j, i) => (nuevo[j] = i))
  const grupoDeCelda = new Map<number, number>()
  claves.forEach((c, i) => grupoDeCelda.set(c, nuevo[grupo[i]]))

  const asignacion = new Uint8Array(n)
  for (let t = 0; t < n; t++) asignacion[t] = grupoDeCelda.get(celdaDe[t])!
  return { paleta: orden.map((j) => aHex(...deOklab(centros[j].L, centros[j].a, centros[j].b))), asignacion }
}
