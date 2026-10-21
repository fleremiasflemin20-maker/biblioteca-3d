import { topologia, type Malla, type Topologia } from '../../lib/taller/malla.ts'

/**
 * Frontera suave: la pintura por triángulo deja bordes en escalera, y al
 * separar se cortaría por esa escalera. Aquí la frontera se vuelve a trazar
 * como una isolínea que cruza los triángulos por dentro (el "Smooth
 * boundary" de Split3MF, o el "Smart fill" de Bambu con detalle):
 *
 *  1. Cada vértice recibe, por color, la fracción de superficie de ese color
 *     a su alrededor.
 *  2. Ese campo se suaviza `suavizado` veces (laplaciano): más pasadas,
 *     curvas más redondas; 0 = solo quita los dientes.
 *  3. Cada vértice toma el color dominante y, en cada arista donde cambia,
 *     el borde pasa por el punto donde los dos colores empatan.
 *  4. Los triángulos que cruza la frontera se parten por esos puntos.
 *
 * El punto de cada arista depende solo de sus dos vértices, así que los dos
 * triángulos que la comparten lo calculan igual: la malla sigue cerrada.
 */
export function suavizarFrontera(m: Malla, suavizado = 4): Malla {
  const nt = m.color.length
  const topo = topologia(m.pos)
  const nv = topo.vpos.length / 3
  const usados = [...new Set(m.color)].sort((a, b) => a - b)
  if (usados.length < 2) return m
  const k = usados.length
  const indice = new Map(usados.map((c, i) => [c, i]))

  // 1 · Fracción de superficie de cada color alrededor de cada vértice.
  let F = new Float32Array(nv * k)
  const peso = new Float32Array(nv)
  for (let t = 0; t < nt; t++) {
    const o = t * 9, p = m.pos
    const ux = p[o + 3] - p[o], uy = p[o + 4] - p[o + 1], uz = p[o + 5] - p[o + 2]
    const vx = p[o + 6] - p[o], vy = p[o + 7] - p[o + 1], vz = p[o + 8] - p[o + 2]
    const a = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2 || 1e-12
    const c = indice.get(m.color[t])!
    for (let i = 0; i < 3; i++) {
      const v = topo.vert[t * 3 + i]
      F[v * k + c] += a
      peso[v] += a
    }
  }
  for (let v = 0; v < nv; v++) for (let c = 0; c < k; c++) F[v * k + c] /= peso[v] || 1

  // 2 · Suavizado laplaciano sobre las aristas de la malla.
  if (suavizado > 0) {
    const vecinos: number[][] = Array.from({ length: nv }, () => [])
    for (let t = 0; t < nt; t++)
      for (let i = 0; i < 3; i++) {
        const a = topo.vert[t * 3 + i], b = topo.vert[t * 3 + ((i + 1) % 3)]
        if (a !== b) vecinos[a].push(b)
      }
    let G = new Float32Array(F.length)
    for (let it = 0; it < suavizado; it++) {
      for (let v = 0; v < nv; v++) {
        const l = vecinos[v]
        for (let c = 0; c < k; c++) {
          let s = 0
          for (const u of l) s += F[u * k + c]
          G[v * k + c] = l.length ? 0.5 * F[v * k + c] + (0.5 * s) / l.length : F[v * k + c]
        }
      }
      ;[F, G] = [G, F]
    }
  }

  // 3 · Color dominante por vértice.
  const L = new Uint8Array(nv)
  for (let v = 0; v < nv; v++) {
    let mejor = 0
    for (let c = 1; c < k; c++) if (F[v * k + c] > F[v * k + mejor]) mejor = c
    L[v] = mejor
  }

  // 4 · Partir los triángulos que cruza la frontera.
  const pos: number[] = []
  const color: number[] = []
  const puntoArista = new Map<number, [number, number, number]>()
  const vp = topo.vpos
  const punto = (a: number, b: number): [number, number, number] => {
    const clave = a < b ? a * nv + b : b * nv + a
    let p = puntoArista.get(clave)
    if (!p) {
      const [x, y] = a < b ? [a, b] : [b, a]
      const ga = F[x * k + L[x]] - F[x * k + L[y]]
      const gb = F[y * k + L[x]] - F[y * k + L[y]]
      const t = Math.min(0.95, Math.max(0.05, ga - gb > 1e-9 ? ga / (ga - gb) : 0.5))
      p = [vp[x * 3] + t * (vp[y * 3] - vp[x * 3]), vp[x * 3 + 1] + t * (vp[y * 3 + 1] - vp[x * 3 + 1]), vp[x * 3 + 2] + t * (vp[y * 3 + 2] - vp[x * 3 + 2])]
      puntoArista.set(clave, p)
    }
    return p
  }
  const V = (v: number): [number, number, number] => [vp[v * 3], vp[v * 3 + 1], vp[v * 3 + 2]]
  const tri = (a: number[], b: number[], c: number[], col: number) => {
    pos.push(...a, ...b, ...c)
    color.push(usados[col])
  }

  for (let t = 0; t < nt; t++) {
    const v = [topo.vert[t * 3], topo.vert[t * 3 + 1], topo.vert[t * 3 + 2]]
    const l = v.map((x) => L[x])
    if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) continue // degenerado
    if (l[0] === l[1] && l[1] === l[2]) {
      tri(V(v[0]), V(v[1]), V(v[2]), l[0])
      continue
    }
    if (l[0] !== l[1] && l[1] !== l[2] && l[0] !== l[2]) {
      // Tres colores: un abanico por esquina alrededor del centro del triángulo.
      const p01 = punto(v[0], v[1]), p12 = punto(v[1], v[2]), p20 = punto(v[2], v[0])
      const c = [0, 1, 2].map((e) => (vp[v[0] * 3 + e] + vp[v[1] * 3 + e] + vp[v[2] * 3 + e]) / 3)
      tri(V(v[0]), p01, c, l[0]); tri(V(v[0]), c, p20, l[0])
      tri(V(v[1]), p12, c, l[1]); tri(V(v[1]), c, p01, l[1])
      tri(V(v[2]), p20, c, l[2]); tri(V(v[2]), c, p12, l[2])
      continue
    }
    // Dos colores: la esquina distinta se recorta con un triángulo; el resto, un cuadrilátero.
    const k0 = l[0] !== l[1] && l[0] !== l[2] ? 0 : l[1] !== l[0] && l[1] !== l[2] ? 1 : 2
    const a = v[k0], b = v[(k0 + 1) % 3], c = v[(k0 + 2) % 3]
    const pab = punto(a, b), pca = punto(c, a)
    tri(V(a), pab, pca, L[a])
    tri(pab, V(b), V(c), L[b])
    tri(pab, V(c), pca, L[b])
  }
  return { pos: new Float32Array(pos), color: Uint8Array.from(color) }
}

function normalTri(pos: Float32Array, t: number, n: Float64Array) {
  const o = t * 9
  const ux = pos[o + 3] - pos[o], uy = pos[o + 4] - pos[o + 1], uz = pos[o + 5] - pos[o + 2]
  const vx = pos[o + 6] - pos[o], vy = pos[o + 7] - pos[o + 1], vz = pos[o + 8] - pos[o + 2]
  n[0] = uy * vz - uz * vy; n[1] = uz * vx - ux * vz; n[2] = ux * vy - uy * vx
  const l = Math.hypot(n[0], n[1], n[2]) || 1
  n[0] /= l; n[1] /= l; n[2] /= l
}

/**
 * Relleno por ángulo ("Smart fill" de Bambu Studio): los triángulos
 * conectados a `inicio` sin cruzar una arista más viva que `angulo` grados.
 */
export function regionAngulo(pos: Float32Array, topo: Topologia, inicio: number, angulo: number): number[] {
  const nt = pos.length / 9
  const cos = Math.cos((angulo * Math.PI) / 180)
  const visto = new Uint8Array(nt)
  const a = new Float64Array(3), b = new Float64Array(3)
  const pila = [inicio]
  const salida: number[] = []
  visto[inicio] = 1
  while (pila.length) {
    const t = pila.pop()!
    salida.push(t)
    normalTri(pos, t, a)
    for (let i = 0; i < 3; i++) {
      const v = topo.vecinos[t * 3 + i]
      if (v < 0 || visto[v]) continue
      normalTri(pos, v, b)
      if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] >= cos) {
        visto[v] = 1
        pila.push(v)
      }
    }
  }
  return salida
}

