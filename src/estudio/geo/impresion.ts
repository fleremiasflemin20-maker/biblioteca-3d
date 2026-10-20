import type { Analisis, MallaIdx, Vec3 } from './tipos.ts'

/**
 * Preparar para imprimir, sin WASM: soldar vértices, comprobar que la malla
 * cierra, medir, contar voladizos y buscar la mejor cara para apoyar.
 *
 * Las mallas llegan ya colocadas en la cama (coordenadas del mundo, mm, Z
 * arriba).
 */

/** Sopa de triángulos (9 floats por triángulo) → malla indexada, soldando por posición a 1 µm. */
export function soldar(sopa: Float32Array): MallaIdx {
  const mapa = new Map<string, number>()
  const pos: number[] = []
  const idx = new Uint32Array(sopa.length / 3)
  const q = (x: number) => Math.round(x * 1000)
  for (let v = 0; v < sopa.length / 3; v++) {
    const x = sopa[v * 3], y = sopa[v * 3 + 1], z = sopa[v * 3 + 2]
    const k = `${q(x)},${q(y)},${q(z)}`
    let i = mapa.get(k)
    if (i === undefined) {
      i = pos.length / 3
      mapa.set(k, i)
      pos.push(x, y, z)
    }
    idx[v] = i
  }
  return { pos: new Float32Array(pos), idx }
}

function normal(m: MallaIdx, t: number, salida: Float64Array) {
  const a = m.idx[t * 3] * 3, b = m.idx[t * 3 + 1] * 3, c = m.idx[t * 3 + 2] * 3
  const p = m.pos
  const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2]
  const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2]
  salida[0] = uy * vz - uz * vy
  salida[1] = uz * vx - ux * vz
  salida[2] = ux * vy - uy * vx
  const l = Math.hypot(salida[0], salida[1], salida[2])
  if (l > 0) for (let i = 0; i < 3; i++) salida[i] /= l
  return l / 2 // área
}

/** Ángulo a partir del cual una cara colgante necesita soporte (45° es la regla de los laminadores). */
export const ANGULO_VOLADIZO = 45
const COS_VOLADIZO = Math.cos((ANGULO_VOLADIZO * Math.PI) / 180)

/**
 * Revisa la malla con sus propios índices: no se vuelve a soldar por
 * posición, porque dos cuerpos que solo se tocan en una arista (un bulto
 * tangente a la pared, por ejemplo) compartirían vértices y parecerían
 * no-manifold sin serlo. Las mallas importadas ya llegan soldadas.
 */
export function analizar(m: MallaIdx): Analisis {
  const nt = m.idx.length / 3
  const nv = m.pos.length / 3

  // Aristas: cada una debe aparecer exactamente dos veces, una en cada sentido.
  const aristas = new Map<number, number>()
  const clave = (a: number, b: number) => (a < b ? a * nv + b : b * nv + a)
  for (let t = 0; t < nt; t++)
    for (let e = 0; e < 3; e++) {
      const a = m.idx[t * 3 + e], b = m.idx[t * 3 + ((e + 1) % 3)]
      const k = clave(a, b)
      aristas.set(k, (aristas.get(k) ?? 0) + 1)
    }
  let abiertos = 0, raras = 0
  for (const c of aristas.values()) {
    if (c === 1) abiertos++
    else if (c > 2) raras++
  }

  // Cuerpos separados (union-find por vértice).
  const padre = new Int32Array(nv).map((_, i) => i)
  const raiz = (i: number): number => {
    while (padre[i] !== i) i = padre[i] = padre[padre[i]]
    return i
  }
  for (let t = 0; t < nt; t++) {
    const a = raiz(m.idx[t * 3])
    padre[raiz(m.idx[t * 3 + 1])] = a
    padre[raiz(m.idx[t * 3 + 2])] = a
  }
  const usados = new Set<number>()
  for (let t = 0; t < nt; t++) usados.add(raiz(m.idx[t * 3]))

  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < m.pos.length; i++) {
    const e = i % 3
    if (m.pos[i] < min[e]) min[e] = m.pos[i]
    if (m.pos[i] > max[e]) max[e] = m.pos[i]
  }

  let volumen = 0, area = 0, voladizo = 0
  const n = new Float64Array(3)
  for (let t = 0; t < nt; t++) {
    const a = m.idx[t * 3] * 3, b = m.idx[t * 3 + 1] * 3, c = m.idx[t * 3 + 2] * 3
    const p = m.pos
    volumen += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6
    const s = normal(m, t, n)
    area += s
    const zMin = Math.min(p[a + 2], p[b + 2], p[c + 2])
    if (-n[2] > COS_VOLADIZO && zMin > min[2] + 0.2) voladizo += s
  }
  return {
    triangulos: nt,
    bordesAbiertos: abiertos,
    aristasRaras: raras,
    estanca: abiertos === 0 && raras === 0 && nt > 0,
    cuerpos: usados.size,
    volumen: Math.abs(volumen),
    area,
    min,
    max,
    voladizo,
  }
}

/**
 * Auto-orientar: prueba como "abajo" las normales de las caras más grandes y
 * los seis ejes, y se queda con la que deja menos voladizo y más apoyo en la
 * cama (lo que hacen Cura y Orca con su "Auto-orient", en sencillo).
 *
 * Devuelve la dirección del mundo que debe quedar mirando a -Z.
 */
export function mejorApoyo(entrada: MallaIdx): { abajo: Vec3; voladizo: number; apoyo: number } {
  const m = entrada
  const nt = m.idx.length / 3
  // Con mallas enormes basta una muestra para puntuar.
  const salto = Math.max(1, Math.floor(nt / 150_000))
  const normales: { t: number; n: Vec3; area: number }[] = []
  const n = new Float64Array(3)
  for (let t = 0; t < nt; t += salto) {
    const a = normal(m, t, n)
    if (a > 0) normales.push({ t, n: [n[0], n[1], n[2]], area: a * salto })
  }

  // Candidatas: normales agrupadas por dirección (celdas de ~5°), las 24 con más área.
  const grupos = new Map<string, { n: Vec3; area: number }>()
  for (const f of normales) {
    const k = f.n.map((x) => Math.round(x * 12)).join(',')
    const g = grupos.get(k)
    if (g) {
      g.area += f.area
      for (let i = 0; i < 3; i++) g.n[i] += f.n[i] * f.area
    } else grupos.set(k, { n: f.n.map((x) => x * f.area) as Vec3, area: f.area })
  }
  const candidatas: Vec3[] = [...grupos.values()]
    .sort((a, b) => b.area - a.area)
    .slice(0, 24)
    .map((g) => {
      const l = Math.hypot(...g.n) || 1
      return g.n.map((x) => x / l) as Vec3
    })
  candidatas.push([0, 0, -1], [0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0])

  // Altura de cada vértice a lo largo de una dirección, para saber qué cara toca la cama.
  let mejor = { abajo: [0, 0, -1] as Vec3, voladizo: Infinity, apoyo: 0, puntos: -Infinity }
  for (const d of candidatas) {
    let minProy = Infinity
    for (let i = 0; i < m.pos.length; i += 3) minProy = Math.min(minProy, -(m.pos[i] * d[0] + m.pos[i + 1] * d[1] + m.pos[i + 2] * d[2]))
    let voladizo = 0, apoyo = 0
    for (const c of normales) {
      const t = c.t
      const caida = c.n[0] * d[0] + c.n[1] * d[1] + c.n[2] * d[2] // 1 = mira justo hacia la cama
      if (caida < COS_VOLADIZO) continue
      let alto = Infinity
      for (let k = 0; k < 3; k++) {
        const v = m.idx[t * 3 + k] * 3
        alto = Math.min(alto, -(m.pos[v] * d[0] + m.pos[v + 1] * d[1] + m.pos[v + 2] * d[2]) - minProy)
      }
      if (alto < 0.15 && caida > 0.996) apoyo += c.area
      else voladizo += c.area
    }
    const puntos = apoyo * 1.5 - voladizo
    if (puntos > mejor.puntos) mejor = { abajo: d, voladizo, apoyo, puntos }
  }
  return { abajo: mejor.abajo, voladizo: mejor.voladizo, apoyo: mejor.apoyo }
}

/**
 * Gramos aproximados: paredes y tapas macizas (≈1,2 mm de piel) y el resto
 * al porcentaje de relleno. PLA 1,24 g/cm³, PETG 1,27.
 */
export function gramos(volumen: number, area: number, relleno = 0.15, densidad = 1.24) {
  const piel = Math.min(volumen, area * 1.2)
  return ((piel + (volumen - piel) * relleno) / 1000) * densidad
}

/** Metros de filamento de 1,75 mm para esos gramos. */
export const metros = (g: number, densidad = 1.24) => (g / densidad) * 1000 / (Math.PI * 0.875 ** 2) / 1000
