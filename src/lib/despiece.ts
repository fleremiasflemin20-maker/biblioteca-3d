type Vec3 = [number, number, number]

/**
 * Despiece en mesa: después de abrir el modelo hacia fuera, las piezas se
 * bajan al suelo y se ordenan en filas, como un kit sobre la mesa antes de
 * armarlo. Cada filamento empieza su propia fila (se ve qué va de qué
 * color), las filas altas atrás y las bajas delante, y todas
 * conservan su orientación y su escala: lo que se ve es lo que se imprime.
 *
 * Es puro (sin three) para poder probarlo en Node. Es el mismo de Flemin
 * Studio 3D (src/estudio/separador/despiece.ts): si cambia uno, cambia el otro.
 */
export type CajaPieza = { id: string; color: string; min: Vec3; max: Vec3 }

export type Mesa = {
  /** Lo que hay que sumarle a cada pieza (mm) para llevarla de montada a su sitio en la mesa. */
  desplazar: Map<string, Vec3>
  /** El número de cada pieza en la mesa, de atrás hacia delante y fila por fila. Empieza en 1. */
  numero: Map<string, number>
  ancho: number
  fondo: number
}

/**
 * Hueco entre piezas: proporcional al tamaño típico y nunca menos de
 * `minimo` (4 mm en el estudio; 0 para modelos en otras unidades).
 */
export type OpcionesMesa = { minimo?: number; proporcion?: number }
function hueco(cajas: CajaPieza[], { minimo = 4, proporcion = 0.12 }: OpcionesMesa) {
  const lados = cajas.map((c) => Math.max(c.max[0] - c.min[0], c.max[1] - c.min[1])).sort((a, b) => a - b)
  const mediana = lados[lados.length >> 1] ?? 0
  return Math.max(minimo, mediana * proporcion)
}

export function mesaDePiezas(cajas: CajaPieza[], opciones: OpcionesMesa = {}): Mesa {
  const desplazar = new Map<string, Vec3>()
  const numero = new Map<string, number>()
  if (!cajas.length) return { desplazar, numero, ancho: 0, fondo: 0 }

  const sep = hueco(cajas, opciones)
  // Dónde está el modelo montado: la mesa se arma bajo él, apoyada en su punto más bajo.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, suelo = Infinity
  for (const c of cajas) {
    x0 = Math.min(x0, c.min[0]); x1 = Math.max(x1, c.max[0])
    y0 = Math.min(y0, c.min[1]); y1 = Math.max(y1, c.max[1])
    suelo = Math.min(suelo, c.min[2])
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2

  // Los filamentos con las piezas más altas van al fondo (la primera fila), para
  // que no tapen a las bajas desde la cámara; dentro de cada uno, de mayor a menor huella.
  const alto = new Map<string, number>()
  for (const c of cajas) alto.set(c.color, Math.max(alto.get(c.color) ?? 0, c.max[2] - c.min[2]))
  const colores = [...alto.keys()].sort((a, b) => alto.get(b)! - alto.get(a)!)
  const fichas = cajas
    .map((c, i) => ({ c, i, w: c.max[0] - c.min[0], d: c.max[1] - c.min[1], h: c.max[2] - c.min[2] }))
    .sort((a, b) => colores.indexOf(a.c.color) - colores.indexOf(b.c.color) || b.d * b.w - a.d * a.w || b.h - a.h || a.i - b.i)

  // Ancho de la mesa: casi cuadrada, pero nunca más angosta que la pieza más ancha.
  const area = fichas.reduce((s, f) => s + (f.w + sep) * (f.d + sep), 0)
  const ancho = Math.max(Math.max(...fichas.map((f) => f.w)), Math.sqrt(area * 1.3))

  // Filas (de atrás hacia delante); un filamento nuevo empieza fila nueva.
  type Sitio = { f: (typeof fichas)[number]; x: number; y: number }
  const sitios: Sitio[] = []
  let x = 0, y = 0, fila = 0, color = fichas[0].c.color
  for (const f of fichas) {
    const nuevoColor = f.c.color !== color
    if (x > 0 && (nuevoColor || x + f.w > ancho)) {
      y += fila + sep * (nuevoColor ? 2 : 1)
      x = 0
      fila = 0
    }
    color = f.c.color
    sitios.push({ f, x: x + f.w / 2, y: y + f.d / 2 })
    x += f.w + sep
    fila = Math.max(fila, f.d)
  }
  const fondo = y + fila
  const anchoReal = Math.max(...sitios.map((s) => s.x + s.f.w / 2))

  sitios.forEach((s, k) => {
    const { c } = s.f
    // Centro de la caja en la mesa, con la mesa centrada bajo el modelo (la primera fila, atrás).
    const mx = cx - anchoReal / 2 + s.x
    const my = cy + fondo / 2 - s.y
    desplazar.set(c.id, [mx - (c.min[0] + c.max[0]) / 2, my - (c.min[1] + c.max[1]) / 2, suelo - c.min[2]])
    numero.set(c.id, k + 1)
  })
  return { desplazar, numero, ancho: anchoReal, fondo }
}

/**
 * Un solo control lleva el despiece por tres estados:
 *   0 → 1.5   montado → abierto hacia fuera (como antes)
 *   1.5 → 2.5 abierto → ordenado en la mesa
 * Devuelve cuánto pesa cada uno: posición = radial·d·(1 − mesa) + mesa·m.
 */
export const FIN_RADIAL = 1.5
export const FIN_MESA = 2.5
export function mezclaDespiece(e: number) {
  const radial = Math.min(Math.max(e, 0), FIN_RADIAL)
  const t = Math.min(Math.max((e - FIN_RADIAL) / (FIN_MESA - FIN_RADIAL), 0), 1)
  return { radial, mesa: t * t * (3 - 2 * t) }
}
