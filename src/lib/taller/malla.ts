import { ShapeUtils, Vector2 } from 'three'

/**
 * La geometría del Taller 3D.
 *
 * Una pieza es una sopa de triángulos: 9 floats por triángulo (tres vértices
 * x, y, z en milímetros, con Z hacia arriba como en los laminadores) y un
 * índice de filamento por triángulo. Pintar es escribir en `color`; la forma
 * no cambia nunca después de importar.
 *
 * La conectividad (qué vértices son el mismo y qué triángulo toca a cuál) se
 * calcula aparte con `topologia()`, soldando vértices por sus bits exactos:
 * los formatos indexados (3MF, STL) repiten coordenadas idénticas, y las
 * costuras de UV de un glTF también.
 */
export type Malla = { pos: Float32Array; color: Uint8Array }
export type Filamento = { color: string; nombre: string }

export const nTriangulos = (m: Malla) => m.color.length

/** Junta triángulos de tamaño desconocido sin copiar a cada paso. */
export class Constructor {
  pos = new Float32Array(9 * 1024)
  color = new Uint8Array(1024)
  n = 0

  agregar(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, c: number) {
    if (this.n === this.color.length) {
      const pos = new Float32Array(this.pos.length * 2)
      pos.set(this.pos)
      this.pos = pos
      const color = new Uint8Array(this.color.length * 2)
      color.set(this.color)
      this.color = color
    }
    const o = this.n * 9
    const p = this.pos
    p[o] = ax; p[o + 1] = ay; p[o + 2] = az
    p[o + 3] = bx; p[o + 4] = by; p[o + 5] = bz
    p[o + 6] = cx; p[o + 7] = cy; p[o + 8] = cz
    this.color[this.n++] = c
  }

  malla(): Malla {
    return { pos: this.pos.slice(0, this.n * 9), color: this.color.slice(0, this.n) }
  }
}

/* ── Topología ─────────────────────────────────────────────────────────── */

export type Topologia = {
  /** Vértice soldado de cada esquina: 3 por triángulo. */
  vert: Uint32Array
  /** Posición de cada vértice soldado. */
  vpos: Float64Array
  /** Triángulo vecino por la arista i (de la esquina i a la i+1), o -1 si es un borde. */
  vecinos: Int32Array
}

/**
 * Suelda vértices y encuentra vecinos en O(n): una tabla hash de
 * direccionamiento abierto sobre los bits de las coordenadas, y un mapa de
 * aristas dirigidas. Una arista a→b tiene por vecino al triángulo que la
 * recorre al revés (b→a), que es como se tocan dos caras bien orientadas.
 */
export function topologia(pos: Float32Array): Topologia {
  const nt = pos.length / 9
  const ne = nt * 3
  const bits = new Uint32Array(new Float32Array(1).buffer)
  const f = new Float32Array(bits.buffer)
  const clave = new Uint32Array(ne * 3)
  for (let i = 0; i < ne * 3; i++) {
    f[0] = pos[i] + 0 // -0 y 0 son el mismo punto
    clave[i] = bits[0]
  }

  let cap = 1
  while (cap < ne * 2) cap <<= 1
  const tabla = new Int32Array(cap).fill(-1)
  const vert = new Uint32Array(ne)
  const primera = new Uint32Array(ne) // esquina que representa a cada vértice soldado
  let nv = 0
  for (let e = 0; e < ne; e++) {
    const x = clave[e * 3], y = clave[e * 3 + 1], z = clave[e * 3 + 2]
    let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & (cap - 1)
    for (;;) {
      const v = tabla[h]
      if (v < 0) {
        tabla[h] = nv
        primera[nv] = e
        vert[e] = nv++
        break
      }
      const p = primera[v] * 3
      if (clave[p] === x && clave[p + 1] === y && clave[p + 2] === z) {
        vert[e] = v
        break
      }
      h = (h + 1) & (cap - 1)
    }
  }

  const vpos = new Float64Array(nv * 3)
  for (let v = 0; v < nv; v++) {
    const p = primera[v] * 3
    vpos[v * 3] = pos[p]
    vpos[v * 3 + 1] = pos[p + 1]
    vpos[v * 3 + 2] = pos[p + 2]
  }

  // Los triángulos degenerados (dos esquinas en el mismo punto) no tienen
  // área ni volumen, pero sus aristas a→b y b→a taparían a los vecinos de
  // verdad: se quedan fuera de la conectividad.
  const aristas = new Map<number, number>()
  for (let t = 0; t < nt; t++) {
    if (degenerado(vert, t)) continue
    for (let i = 0; i < 3; i++) aristas.set(vert[t * 3 + i] * nv + vert[t * 3 + ((i + 1) % 3)], t)
  }
  const vecinos = new Int32Array(ne).fill(-1)
  for (let t = 0; t < nt; t++) {
    if (degenerado(vert, t)) continue
    for (let i = 0; i < 3; i++) {
      const a = vert[t * 3 + i], b = vert[t * 3 + ((i + 1) % 3)]
      const v = aristas.get(b * nv + a)
      vecinos[t * 3 + i] = v === undefined || v === t ? -1 : v
    }
  }

  return { vert, vpos, vecinos }
}

export const degenerado = (vert: Uint32Array, t: number) =>
  vert[t * 3] === vert[t * 3 + 1] || vert[t * 3 + 1] === vert[t * 3 + 2] || vert[t * 3] === vert[t * 3 + 2]

/* ── Pintura ───────────────────────────────────────────────────────────── */

/** Todos los triángulos conectados del mismo color que `inicio`. */
export function region(m: Malla, topo: Topologia, inicio: number): number[] {
  const c = m.color[inicio]
  const visto = new Uint8Array(m.color.length)
  const pila = [inicio]
  const salida: number[] = []
  visto[inicio] = 1
  while (pila.length) {
    const t = pila.pop()!
    salida.push(t)
    for (let i = 0; i < 3; i++) {
      const v = topo.vecinos[t * 3 + i]
      if (v >= 0 && !visto[v] && m.color[v] === c) {
        visto[v] = 1
        pila.push(v)
      }
    }
  }
  return salida
}

/**
 * Filtro de mayoría: un triángulo con dos vecinos de otro color común toma
 * ese color. Endereza los bordes en sierra que deja pintar triángulo a
 * triángulo, sin mover las fronteras que ya son limpias.
 */
export function suavizar(m: Malla, topo: Topologia, pasadas = 3): number {
  let cambios = 0
  for (let p = 0; p < pasadas; p++) {
    const antes = m.color.slice()
    let enEsta = 0
    for (let t = 0; t < antes.length; t++) {
      const a = topo.vecinos[t * 3], b = topo.vecinos[t * 3 + 1], c = topo.vecinos[t * 3 + 2]
      const ca = a >= 0 ? antes[a] : -1, cb = b >= 0 ? antes[b] : -2, cc = c >= 0 ? antes[c] : -3
      const mayoria = ca === cb || ca === cc ? ca : cb === cc ? cb : -1
      if (mayoria >= 0 && mayoria !== antes[t]) {
        m.color[t] = mayoria
        enEsta++
      }
    }
    cambios += enEsta
    if (!enEsta) break
  }
  return cambios
}

/** Absorbe las manchas de menos de `minimo` triángulos en el color que más las rodea. */
export function quitarIslas(m: Malla, topo: Topologia, minimo: number): number {
  const visto = new Uint8Array(m.color.length)
  let cambios = 0
  for (let t = 0; t < m.color.length; t++) {
    if (visto[t]) continue
    const r = region(m, topo, t)
    for (const x of r) visto[x] = 1
    if (r.length >= minimo) continue
    const votos = new Map<number, number>()
    for (const x of r)
      for (let i = 0; i < 3; i++) {
        const v = topo.vecinos[x * 3 + i]
        if (v >= 0 && m.color[v] !== m.color[x]) votos.set(m.color[v], (votos.get(m.color[v]) ?? 0) + 1)
      }
    let mejor = -1, max = 0
    for (const [c, n] of votos) if (n > max) [mejor, max] = [c, n]
    if (mejor < 0) continue
    for (const x of r) m.color[x] = mejor
    cambios += r.length
  }
  return cambios
}

/** Parte cada triángulo en cuatro por los puntos medios. Sin juntas en T: todos se parten igual. */
export function subdividir(m: Malla): Malla {
  const n = m.color.length
  const pos = new Float32Array(n * 36)
  const color = new Uint8Array(n * 4)
  const p = m.pos
  for (let t = 0; t < n; t++) {
    const o = t * 9
    const a = [p[o], p[o + 1], p[o + 2]], b = [p[o + 3], p[o + 4], p[o + 5]], c = [p[o + 6], p[o + 7], p[o + 8]]
    const ab = a.map((x, i) => (x + b[i]) / 2), bc = b.map((x, i) => (x + c[i]) / 2), ca = c.map((x, i) => (x + a[i]) / 2)
    const hijos = [a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca]
    for (let k = 0; k < 12; k++) pos.set(hijos[k], t * 36 + k * 3)
    color.fill(m.color[t], t * 4, t * 4 + 4)
  }
  return { pos, color }
}

/** Área de cada triángulo. */
export function areas(pos: Float32Array): Float32Array {
  const n = pos.length / 9
  const salida = new Float32Array(n)
  for (let t = 0; t < n; t++) {
    const o = t * 9
    const ux = pos[o + 3] - pos[o], uy = pos[o + 4] - pos[o + 1], uz = pos[o + 5] - pos[o + 2]
    const vx = pos[o + 6] - pos[o], vy = pos[o + 7] - pos[o + 1], vz = pos[o + 8] - pos[o + 2]
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx
    salida[t] = Math.sqrt(x * x + y * y + z * z) / 2
  }
  return salida
}

/* ── Separación ────────────────────────────────────────────────────────── */

/**
 * Cómo se cierra el hueco que deja cada color al separarlo.
 *  - plana: triangulación por orejas sobre el plano medio del corte. Exacta
 *    cuando el corte es plano (lo normal en piezas mecánicas).
 *  - centroide: abanico desde el centro del borde. Cierra cualquier borde,
 *    aunque esté alabeado.
 *  - auto: plana si el borde se aparta de su plano menos de un 2 % de su
 *    tamaño, centroide si no.
 */
export type Tapa = 'auto' | 'plana' | 'centroide'

export type Pieza = {
  color: number
  /** Sopa de triángulos: primero la superficie original, al final las tapas. */
  pos: Float32Array
  triangulos: number
  tapas: number
  bucles: number
  /** mm³, mm² y mm, en la escala de la malla. */
  volumen: number
  area: number
  min: [number, number, number]
  max: [number, number, number]
  /** Cada arista la comparten exactamente dos caras con orientación opuesta. */
  cerrada: boolean
}

/** Recorre las aristas de borde dirigidas (a→b) y las encadena en bucles cerrados. */
function bucles(bordes: number[]): number[][] {
  const salientes = new Map<number, number[]>()
  for (let i = 0; i < bordes.length; i += 2) {
    const l = salientes.get(bordes[i])
    if (l) l.push(bordes[i + 1])
    else salientes.set(bordes[i], [bordes[i + 1]])
  }
  const salida: number[][] = []
  for (const [inicio, l] of salientes) {
    while (l.length) {
      const bucle = [inicio]
      let actual = l.pop()!
      while (actual !== inicio) {
        bucle.push(actual)
        const siguiente = salientes.get(actual)?.pop()
        if (siguiente === undefined) break // cadena abierta: malla rota de origen
        actual = siguiente
      }
      if (bucle.length >= 3) salida.push(bucle)
    }
  }
  return salida
}

/**
 * Triángulos que cierran un bucle de borde, como índices a `puntos` (el
 * índice `puntos.length / 3` es el centroide, si hace falta). Las tapas miran
 * al revés que el bucle: la superficie recorre su borde en sentido
 * antihorario visto desde fuera, así que el cierre apunta al lado contrario.
 */
export function cerrarBucle(puntos: number[], tapa: Tapa): { tris: number[]; centroide: boolean } {
  const n = puntos.length / 3
  let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const [ax, ay, az] = [puntos[i * 3], puntos[i * 3 + 1], puntos[i * 3 + 2]]
    const [bx, by, bz] = [puntos[j * 3], puntos[j * 3 + 1], puntos[j * 3 + 2]]
    nx += (ay - by) * (az + bz)
    ny += (az - bz) * (ax + bx)
    nz += (ax - bx) * (ay + by)
    cx += ax; cy += ay; cz += az
  }
  cx /= n; cy /= n; cz /= n
  const largo = Math.hypot(nx, ny, nz)

  const abanico = () => {
    const tris: number[] = []
    for (let i = 0; i < n; i++) tris.push((i + 1) % n, i, n)
    return { tris, centroide: true }
  }
  if (largo < 1e-12 || tapa === 'centroide' || n === 3) {
    return n === 3 ? { tris: [2, 1, 0], centroide: false } : abanico()
  }

  nx /= largo; ny /= largo; nz /= largo
  let desvio = 0, rmin = Infinity, rmax = -Infinity
  // Base del plano: u perpendicular a la normal, v = n × u.
  const [ux, uy, uz] = Math.abs(nx) < 0.9 ? normalizar(0, -nz, ny) : normalizar(-nz, 0, nx)
  const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux
  const plano: Vector2[] = []
  for (let i = 0; i < n; i++) {
    const dx = puntos[i * 3] - cx, dy = puntos[i * 3 + 1] - cy, dz = puntos[i * 3 + 2] - cz
    desvio = Math.max(desvio, Math.abs(dx * nx + dy * ny + dz * nz))
    const u = dx * ux + dy * uy + dz * uz
    rmin = Math.min(rmin, u)
    rmax = Math.max(rmax, u)
    plano.push(new Vector2(u, dx * vx + dy * vy + dz * vz))
  }
  if (tapa === 'auto' && desvio > 0.02 * Math.max(rmax - rmin, 1e-9)) return abanico()

  const caras = ShapeUtils.triangulateShape(plano, [])
  // Una proyección que se cruza consigo misma deja huecos: entonces, abanico.
  if (caras.length !== n - 2) return abanico()
  // El bucle va antihorario en el plano (u, v) visto desde +n; la tapa, horario.
  const tris: number[] = []
  for (const [a, b, c] of caras) {
    const giro = (plano[b].x - plano[a].x) * (plano[c].y - plano[a].y) - (plano[b].y - plano[a].y) * (plano[c].x - plano[a].x)
    if (giro > 0) tris.push(a, c, b)
    else tris.push(a, b, c)
  }
  return { tris, centroide: false }
}

const normalizar = (x: number, y: number, z: number): [number, number, number] => {
  const l = Math.hypot(x, y, z) || 1
  return [x / l, y / l, z / l]
}

/**
 * Separa la malla en una pieza sólida por color, como un laminador
 * multimaterial espera recibirla: cada región se corta por su frontera de
 * pintura y se tapa para que sea un volumen cerrado, imprimible por sí solo.
 */
export function separar(m: Malla, topo: Topologia, tapa: Tapa = 'auto'): Pieza[] {
  const nt = m.color.length
  const porColor = new Map<number, number[]>()
  for (let t = 0; t < nt; t++) {
    if (degenerado(topo.vert, t)) continue
    const l = porColor.get(m.color[t])
    if (l) l.push(t)
    else porColor.set(m.color[t], [t])
  }

  const piezas: Pieza[] = []
  for (const [c, tris] of [...porColor].sort((a, b) => a[0] - b[0])) {
    const bordes: number[] = []
    for (const t of tris)
      for (let i = 0; i < 3; i++) {
        const v = topo.vecinos[t * 3 + i]
        if (v < 0 || m.color[v] !== c) bordes.push(topo.vert[t * 3 + i], topo.vert[t * 3 + ((i + 1) % 3)])
      }

    const lazos = bucles(bordes)
    // Tapas como triángulos de vértices soldados (≥ 0) o centroides (< 0).
    const tapas: number[] = []
    const centroides: number[] = []
    for (const lazo of lazos) {
      const puntos: number[] = []
      for (const v of lazo) puntos.push(topo.vpos[v * 3], topo.vpos[v * 3 + 1], topo.vpos[v * 3 + 2])
      const { tris: caras, centroide } = cerrarBucle(puntos, tapa)
      let idCentro = 0
      if (centroide) {
        let x = 0, y = 0, z = 0
        for (let i = 0; i < lazo.length; i++) {
          x += puntos[i * 3]; y += puntos[i * 3 + 1]; z += puntos[i * 3 + 2]
        }
        centroides.push(x / lazo.length, y / lazo.length, z / lazo.length)
        idCentro = -centroides.length / 3
      }
      for (const k of caras) tapas.push(k === lazo.length ? idCentro : lazo[k])
    }

    const nTapas = tapas.length / 3
    const pos = new Float32Array((tris.length + nTapas) * 9)
    let o = 0
    for (const t of tris) {
      pos.set(m.pos.subarray(t * 9, t * 9 + 9), o)
      o += 9
    }
    for (const v of tapas) {
      if (v >= 0) pos.set(topo.vpos.subarray(v * 3, v * 3 + 3), o)
      else pos.set(centroides.slice((-v - 1) * 3, -v * 3), o)
      o += 3
    }

    // Comprobación de estanqueidad sobre los ids soldados: cada a→b con su b→a.
    const ids = new Float64Array(pos.length / 3)
    for (let k = 0; k < tris.length; k++) for (let i = 0; i < 3; i++) ids[k * 3 + i] = topo.vert[tris[k] * 3 + i]
    ids.set(tapas, tris.length * 3) // los centroides ya tienen ids negativos, únicos
    const cuenta = new Map<string, number>()
    for (let k = 0; k < ids.length; k += 3)
      for (let i = 0; i < 3; i++) {
        const a = ids[k + i], b = ids[k + ((i + 1) % 3)]
        const clave = `${a}>${b}`
        cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1)
      }
    let cerrada = true
    for (const [clave, n] of cuenta) {
      const [a, b] = clave.split('>')
      if (cuenta.get(`${b}>${a}`) !== n) {
        cerrada = false
        break
      }
    }

    piezas.push({ color: c, pos, triangulos: tris.length, tapas: nTapas, bucles: lazos.length, cerrada, ...medir(pos) })
  }
  return piezas
}

/** Volumen (teorema de la divergencia, con signo), área y caja de una sopa de triángulos. */
export function medir(pos: Float32Array): Pick<Pieza, 'volumen' | 'area' | 'min' | 'max'> {
  let volumen = 0, area = 0
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let o = 0; o < pos.length; o += 9) {
    const ax = pos[o], ay = pos[o + 1], az = pos[o + 2]
    const bx = pos[o + 3], by = pos[o + 4], bz = pos[o + 5]
    const cx = pos[o + 6], cy = pos[o + 7], cz = pos[o + 8]
    volumen += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az
    area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2
    for (let i = 0; i < 9; i++) {
      const eje = i % 3
      if (pos[o + i] < min[eje]) min[eje] = pos[o + i]
      if (pos[o + i] > max[eje]) max[eje] = pos[o + i]
    }
  }
  return { volumen, area, min, max }
}
