import * as THREE from 'three'
import type { CrossSection, Manifold, Vec2 } from 'manifold-3d'
import { deManifold, intentarManifold, type Wasm } from './wasm.ts'
import { analizar, mejorApoyo, soldar } from './impresion.ts'
import { bucles, cerrarBucle, quitarIslas, separar as separarFrontera, suavizar, topologia, type Malla, type Tapa } from '../../lib/taller/malla.ts'
import { suavizarFrontera } from './frontera.ts'
import type { MallaIdx, Vec3 } from './tipos.ts'

/**
 * El motor del Separador de Flemin Studio: lo que hacen Split3MF, el "Cut"
 * de Bambu Studio y el "Cut tool" de PrusaSlicer, en Manifold.
 *
 *  - Por color: cada región pintada se vuelve una pieza cerrada, o cortada
 *    por su frontera (tapa) o como incrustación de profundidad fija.
 *  - Por plano: cualquier orientación, con conectores (espiga y hueco con
 *    tolerancia, o clavija suelta) colocados en el interior del corte.
 *  - Por partes: cuerpos sueltos, unir, y dividir lo que no cabe en la cama.
 *
 * Todo trabaja en milímetros, con Z arriba, sobre mallas del mundo.
 */

/* ═══ Reparación ══════════════════════════════════════════════════════ */

/**
 * Sólido a partir de cualquier malla: si no cierra (lo normal en lo que sale
 * de Meshy, de un escaneo o de un STL descargado), se tapan sus agujeros con
 * membrana y se vuelve a intentar. Es lo que hacen "Repair" de Bambu Studio
 * o "3D Print Toolbox → Make Manifold" de Blender, para huecos, no para
 * mallas que se cruzan consigo mismas.
 */
export function solido(w: Wasm, malla: MallaIdx): { solido: Manifold; reparada: boolean } {
  const s = intentarManifold(w, malla)
  if (s) return { solido: s, reparada: false }
  const r = intentarManifold(w, taparAgujeros(malla))
  if (!r)
    throw new Error('La malla tiene agujeros o caras cruzadas que no se pueden cerrar solas. Prueba "Separar por color" con tapa membrana, o repárala en el laminador.')
  return { solido: r, reparada: true }
}

/**
 * Repara para imprimir: quita los triángulos que hacen una arista
 * compartida por más de dos caras (no-manifold) y los degenerados, y tapa
 * cada bucle de borde abierto que queda con una membrana.
 */
export function taparAgujeros(m: MallaIdx): MallaIdx {
  let sopa: Float32Array = new Float32Array(m.idx.length * 3)
  for (let i = 0; i < m.idx.length; i++) sopa.set(m.pos.subarray(m.idx[i] * 3, m.idx[i] * 3 + 3), i * 3)
  sopa = sinAristasRaras(sopa)
  const topo = topologia(sopa)
  const nt = sopa.length / 9
  const bordes: number[] = []
  for (let t = 0; t < nt; t++)
    for (let i = 0; i < 3; i++) if (topo.vecinos[t * 3 + i] < 0) bordes.push(topo.vert[t * 3 + i], topo.vert[t * 3 + ((i + 1) % 3)])
  if (!bordes.length) return m
  const extra: number[] = []
  for (const lazo of bucles(bordes)) {
    const puntos: number[] = []
    for (const v of lazo) puntos.push(topo.vpos[v * 3], topo.vpos[v * 3 + 1], topo.vpos[v * 3 + 2])
    const { tris, extras } = cerrarBucle(puntos, lazo.length > 12 ? 'membrana' : 'centroide')
    const P = (k: number) => (k < lazo.length ? puntos.slice(k * 3, k * 3 + 3) : extras.slice((k - lazo.length) * 3, (k - lazo.length) * 3 + 3))
    for (const k of tris) extra.push(...P(k))
  }
  const todo = new Float32Array(sopa.length + extra.length)
  todo.set(sopa)
  todo.set(extra, sopa.length)
  return soldar(todo)
}

/** Quita triángulos degenerados y los que tocan una arista con más de dos caras. */
function sinAristasRaras(sopa: Float32Array): Float32Array {
  const topo = topologia(sopa)
  const nt = sopa.length / 9
  const nv = topo.vpos.length / 3
  const cuenta = new Map<number, number>()
  const clave = (a: number, b: number) => (a < b ? a * nv + b : b * nv + a)
  for (let t = 0; t < nt; t++)
    for (let i = 0; i < 3; i++) {
      const k = clave(topo.vert[t * 3 + i], topo.vert[t * 3 + ((i + 1) % 3)])
      cuenta.set(k, (cuenta.get(k) ?? 0) + 1)
    }
  const quedan: number[] = []
  for (let t = 0; t < nt; t++) {
    const v = [topo.vert[t * 3], topo.vert[t * 3 + 1], topo.vert[t * 3 + 2]]
    if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) continue
    if ([0, 1, 2].some((i) => cuenta.get(clave(v[i], v[(i + 1) % 3]))! > 2)) continue
    quedan.push(t)
  }
  if (quedan.length === nt) return sopa
  const salida = new Float32Array(quedan.length * 9)
  quedan.forEach((t, i) => salida.set(sopa.subarray(t * 9, t * 9 + 9), i * 9))
  return salida
}

/* ═══ Conectores ══════════════════════════════════════════════════════ */

export type TipoConector = 'ninguno' | 'cilindro' | 'cuadrado' | 'triangulo' | 'clavija'

export type Conector = {
  tipo: TipoConector
  /** Diámetro (o lado) de la espiga, mm. */
  diametro: number
  /** Cuánto entra la espiga en la otra pieza, mm. */
  alto: number
  /** Holgura por lado entre espiga y hueco, mm. */
  tolerancia: number
  cantidad: number
  /** Qué lado lleva la espiga: el de abajo del plano o el de arriba. */
  lado: 'abajo' | 'arriba'
}

export const CONECTOR_INICIAL: Conector = { tipo: 'cilindro', diametro: 6, alto: 6, tolerancia: 0.2, cantidad: 2, lado: 'abajo' }

/** Chaflán de entrada de la espiga y holgura extra de fondo del hueco. */
const CHAFLAN = 0.4
const FONDO = 0.4

function seccionConector(w: Wasm, tipo: TipoConector, d: number): CrossSection {
  if (tipo === 'cuadrado') return w.CrossSection.square([d, d], true)
  if (tipo === 'triangulo') return w.CrossSection.circle(d / Math.sqrt(3), 3)
  return w.CrossSection.circle(d / 2, 48)
}

/** Espiga de z0 a z0 + alto con la punta achaflanada (entra sin limar). */
function espiga(s: CrossSection, d: number, alto: number, haciaArriba: boolean): Manifold {
  const ch = Math.min(CHAFLAN, alto / 3, d / 4)
  const k = Math.max(0.2, (d / 2 - ch) / (d / 2))
  const cuerpo = s.extrude(alto - ch)
  const punta = s.extrude(ch, 0, 0, [k, k]).translate([0, 0, alto - ch])
  const e = cuerpo.add(punta)
  return haciaArriba ? e : e.mirror([0, 0, 1])
}

/** Clavija suelta: chaflán en las dos puntas, centrada en z = 0. */
function clavija(s: CrossSection, d: number, alto: number): Manifold {
  const ch = Math.min(CHAFLAN, alto / 4, d / 4)
  const k = Math.max(0.2, (d / 2 - ch) / (d / 2))
  const medio = s.extrude(alto - 2 * ch).translate([0, 0, ch])
  const arriba = s.extrude(ch, 0, 0, [k, k]).translate([0, 0, alto - ch])
  const abajo = s.scale([k, k]).extrude(ch, 0, 0, [1 / k, 1 / k])
  return medio.add(arriba).add(abajo).translate([0, 0, -alto / 2])
}

/** ¿El punto (x, y) cae dentro de la sección? (par-impar sobre sus contornos) */
function dentro(contornos: Vec2[][], x: number, y: number) {
  let c = false
  for (const p of contornos)
    for (let i = 0, j = p.length - 1; i < p.length; j = i++)
      if (p[i][1] > y !== p[j][1] > y && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c
  return c
}

/** El punto más adentro de una región (polo de inaccesibilidad): se encoge hasta casi desaparecer. */
function polo(s: CrossSection): Vec2 {
  const b = s.bounds()
  let lo = 0, hi = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]) / 2
  let mejor = s
  for (let i = 0; i < 12; i++) {
    const m = (lo + hi) / 2
    const r = s.offset(-m, 'Round', 2, 16)
    if (r.isEmpty()) hi = m
    else {
      lo = m
      mejor = r
    }
  }
  const c = mejor.bounds()
  return [(c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2]
}

/**
 * Dónde van los conectores en la cara de corte: primero el punto más interior
 * de cada isla del corte, y si piden más, repartidos a lo largo de la isla
 * más grande, siempre a un radio + margen del borde y separados entre sí.
 */
export function puntosConector(seccion: CrossSection, c: Conector): { puntos: Vec2[]; aviso?: string } {
  const margen = c.diametro / 2 + Math.max(1.2, c.tolerancia + 0.8)
  const util = seccion.offset(-margen, 'Round', 2, 32)
  if (util.isEmpty()) return { puntos: [], aviso: `El corte es muy estrecho para conectores de ${c.diametro} mm: usa unos más finos.` }
  const islas = util.decompose().sort((a, b) => b.area() - a.area())
  const puntos: Vec2[] = []
  const lejos = (x: number, y: number) => puntos.every(([px, py]) => Math.hypot(px - x, py - y) >= c.diametro + 3)
  for (const isla of islas) {
    if (puntos.length >= c.cantidad) break
    const [x, y] = polo(isla)
    if (lejos(x, y)) puntos.push([x, y])
  }
  // Más conectores que islas: se reparten a lo largo del eje largo de la isla mayor.
  if (puntos.length < c.cantidad) {
    const isla = islas[0]
    const contornos = isla.toPolygons() as Vec2[][]
    const b = isla.bounds()
    const largoX = b.max[0] - b.min[0] >= b.max[1] - b.min[1]
    const faltan = c.cantidad - puntos.length + 1
    const candidatos: Vec2[] = []
    for (let k = 0; k <= 40; k++) {
      const t = k / 40
      const fila = largoX ? b.min[0] + t * (b.max[0] - b.min[0]) : b.min[1] + t * (b.max[1] - b.min[1])
      // Para cada posición a lo largo, el centro del tramo interior en la otra dirección.
      let lo = Infinity, hi = -Infinity
      for (let j = 0; j <= 40; j++) {
        const o = largoX ? b.min[1] + (j / 40) * (b.max[1] - b.min[1]) : b.min[0] + (j / 40) * (b.max[0] - b.min[0])
        const [x, y] = largoX ? [fila, o] : [o, fila]
        if (dentro(contornos, x, y)) (lo = Math.min(lo, o), (hi = Math.max(hi, o)))
      }
      if (lo <= hi) {
        const m = (lo + hi) / 2
        const p: Vec2 = largoX ? [fila, m] : [m, fila]
        if (dentro(contornos, p[0], p[1])) candidatos.push(p)
      }
    }
    // Se eligen extremos y puntos intermedios repartidos; los que chocan se saltan.
    for (let k = 0; k < faltan * 3 && puntos.length < c.cantidad && candidatos.length; k++) {
      const i = Math.round(((k % faltan) + (k >= faltan ? 0.5 : 0)) / Math.max(1, faltan - 1) * (candidatos.length - 1))
      const p = candidatos[Math.min(candidatos.length - 1, Math.max(0, i))]
      if (lejos(p[0], p[1])) puntos.push(p)
    }
  }
  const aviso = puntos.length < c.cantidad ? `Solo caben ${puntos.length} conector${puntos.length === 1 ? '' : 'es'} de ${c.diametro} mm en este corte.` : undefined
  return { puntos, aviso }
}

/* ═══ Corte por plano ═════════════════════════════════════════════════ */

export type Plano = { normal: Vec3; punto: Vec3 }

/** Matriz que lleva el plano a z = 0 con su normal hacia +Z (y su inversa). */
function marcoPlano(p: Plano) {
  const n = new THREE.Vector3(...p.normal).normalize()
  const q = new THREE.Quaternion().setFromUnitVectors(n, new THREE.Vector3(0, 0, 1))
  const ida = new THREE.Matrix4().makeRotationFromQuaternion(q).multiply(new THREE.Matrix4().makeTranslation(-p.punto[0], -p.punto[1], -p.punto[2]))
  const vuelta = ida.clone().invert()
  type M4 = Parameters<Manifold['transform']>[0]
  return { ida: ida.elements as unknown as M4, vuelta: vuelta.elements as unknown as M4 }
}

export type ResultadoCorte = {
  /** [0] el lado hacia donde apunta la normal ("arriba"), [1] el otro. Vacío si el plano no toca ese lado. */
  lados: (MallaIdx | null)[]
  clavijas: MallaIdx[]
  conectores: number
  aviso?: string
  /** La pieza venía abierta y se cerró antes de cortar. */
  reparada?: boolean
}

export function cortarPlano(w: Wasm, malla: MallaIdx, plano: Plano, c: Conector): ResultadoCorte {
  const { solido: s, reparada } = solido(w, malla)
  const { ida, vuelta } = marcoPlano(plano)
  const r = s.transform(ida)
  let arriba = r.trimByPlane([0, 0, 1], 0)
  let abajo = r.trimByPlane([0, 0, -1], 0)
  if (arriba.isEmpty() || abajo.isEmpty()) return { lados: [arriba.isEmpty() ? null : malla, abajo.isEmpty() ? null : malla], clavijas: [], conectores: 0, aviso: 'El plano no corta esta pieza' }

  const clavijas: Manifold[] = []
  let aviso: string | undefined
  let n = 0
  if (c.tipo !== 'ninguno' && c.cantidad > 0) {
    const seccion = r.slice(0)
    const res = puntosConector(seccion, c)
    aviso = res.aviso
    const s = seccionConector(w, c.tipo, c.diametro)
    const hueco = s.offset(c.tolerancia, c.tipo === 'cilindro' || c.tipo === 'clavija' ? 'Round' : 'Miter', 2, 48)
    for (const [x, y] of res.puntos) {
      if (c.tipo === 'clavija') {
        // Clavija suelta: hueco en las dos piezas y la clavija aparte.
        const h = c.alto / 2 + FONDO
        arriba = arriba.subtract(hueco.extrude(h + 0.01).translate([x, y, -0.01]))
        abajo = abajo.subtract(hueco.extrude(h + 0.01).translate([x, y, -h]))
        clavijas.push(clavija(s, c.diametro, c.alto).translate([x, y, 0]))
      } else {
        const sube = c.lado === 'abajo'
        // La espiga nace 0,5 mm dentro de su pieza para fundirse con ella.
        const e = espiga(s, c.diametro, c.alto + 0.5, sube).translate([x, y, sube ? -0.5 : 0.5])
        const h = hueco.extrude(c.alto + FONDO + 0.01)
        if (sube) {
          abajo = abajo.add(e)
          arriba = arriba.subtract(h.translate([x, y, -0.01]))
        } else {
          arriba = arriba.add(e)
          abajo = abajo.subtract(h.mirror([0, 0, 1]).translate([x, y, 0.01]))
        }
      }
      n++
    }
  }
  const volver = (m: Manifold) => deManifold(m.transform(vuelta))
  return { lados: [volver(arriba), volver(abajo)], clavijas: clavijas.map(volver), conectores: n, aviso, reparada }
}

/**
 * Corte con boceto (el "Sketch" de Split3MF): un contorno dibujado sobre la
 * vista se extruye a lo largo de la mirada y separa lo que queda dentro.
 * `marco` lleva el plano del dibujo (x, y) al mundo, con +z hacia la cámara.
 */
export function cortarBoceto(w: Wasm, malla: MallaIdx, poligono: Vec2[], marco: number[], largo: number): ResultadoCorte {
  const { solido: s, reparada } = solido(w, malla)
  const prisma = new w.CrossSection([poligono], 'EvenOdd').extrude(largo, 0, 0, [1, 1], true).transform(marco as unknown as Parameters<Manifold['transform']>[0])
  const dentro = s.intersect(prisma)
  const fuera = s.subtract(prisma)
  if (dentro.isEmpty() || fuera.isEmpty()) return { lados: [dentro.isEmpty() ? null : malla, fuera.isEmpty() ? null : malla], clavijas: [], conectores: 0, aviso: 'El boceto no atraviesa esta pieza', reparada }
  return { lados: [deManifold(dentro), deManifold(fuera)], clavijas: [], conectores: 0, reparada }
}

/**
 * Plano a partir de lo que pide la interfaz: eje, posición dentro de la caja
 * (0–1) e inclinación/giro en grados, como el "Plane cut" de Split3MF.
 */
export function planoDesdeEje(eje: 0 | 1 | 2, t: number, inclinacion: number, giro: number, min: Vec3, max: Vec3): Plano {
  const normal = new THREE.Vector3(eje === 0 ? 1 : 0, eje === 1 ? 1 : 0, eje === 2 ? 1 : 0)
  // Inclinación: alrededor del siguiente eje; giro: alrededor del propio eje.
  const ejeInc = new THREE.Vector3(eje === 1 ? 1 : 0, eje === 2 ? 1 : 0, eje === 0 ? 1 : 0)
  normal.applyAxisAngle(ejeInc, (inclinacion * Math.PI) / 180)
  normal.applyAxisAngle(new THREE.Vector3(eje === 0 ? 1 : 0, eje === 1 ? 1 : 0, eje === 2 ? 1 : 0), (giro * Math.PI) / 180)
  const centro: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  centro[eje] = min[eje] + t * (max[eje] - min[eje])
  return { normal: normal.toArray() as Vec3, punto: centro }
}

/**
 * Divide una pieza que no cabe en la cama: cortes paralelos por cada eje
 * que se pasa, a tramos iguales, con conectores en cada corte.
 */
export function dividirParaCama(w: Wasm, malla: MallaIdx, cama: Vec3, c: Conector, margen = 10): { piezas: MallaIdx[]; cortes: number; avisos: string[] } {
  const a = analizar(malla)
  let piezas: MallaIdx[] = [malla]
  const avisos: string[] = []
  let cortes = 0
  for (const eje of [0, 1, 2] as const) {
    const largo = a.max[eje] - a.min[eje]
    const tramos = Math.ceil(largo / (cama[eje] - margen))
    for (let k = 1; k < tramos; k++) {
      const punto: Vec3 = [0, 0, 0]
      punto[eje] = a.min[eje] + (largo * k) / tramos
      const normal: Vec3 = [0, 0, 0]
      normal[eje] = 1
      const siguientes: MallaIdx[] = []
      for (const p of piezas) {
        const pa = analizar(p)
        if (pa.max[eje] <= punto[eje] + 1e-6 || pa.min[eje] >= punto[eje] - 1e-6) {
          siguientes.push(p)
          continue
        }
        const r = cortarPlano(w, p, { normal, punto }, c)
        if (r.aviso) avisos.push(r.aviso)
        for (const l of r.lados) if (l) siguientes.push(l)
        siguientes.push(...r.clavijas)
        cortes++
      }
      piezas = siguientes
    }
  }
  return { piezas, cortes, avisos: [...new Set(avisos)] }
}

/* ═══ Por color ═══════════════════════════════════════════════════════ */

export type ModoColor = 'frontera' | 'incrustar'

export type PiezaColor = { color: number; malla: MallaIdx; estanca: boolean }

/**
 * Separación por color de un clic, como Split3MF: sobre una copia de la
 * pintura (la del usuario no se toca) quita motas y manchas sueltas,
 * endereza los dientes de los bordes, vuelve a trazar las fronteras como
 * curvas y separa. Lo que se pinta a mano sigue disponible para retocar y
 * volver a separar.
 */
export function separarAutomatico(
  w: Wasm,
  pos: Float32Array,
  color: Uint8Array,
  opciones: { modo: ModoColor; tapa: Tapa; profundidad: number; base: number; suavizado: number; limpiar: boolean },
): { piezas: PiezaColor[]; avisos: string[] } {
  let m: Malla = { pos, color: color.slice() }
  if (opciones.limpiar) {
    const t = topologia(m.pos)
    // Islas de menos del 0,2 % de los triángulos: motas de textura, no detalles.
    quitarIslas(m, t, Math.max(12, Math.round(m.color.length / 500)))
    suavizar(m, t, 2)
  }
  if (opciones.suavizado >= 0 && new Set(m.color).size > 1) m = suavizarFrontera(m, opciones.suavizado)
  return separarPorColor(w, m.pos, m.color, opciones)
}

/**
 * Cada color, una pieza.
 *
 * - frontera: la región se corta por su borde de pintura y el hueco se tapa
 *   (el algoritmo del Taller). Rápido y sirve para cualquier malla.
 * - incrustar: la región se vuelve una placa de `profundidad` mm metida en el
 *   cuerpo (como un ojo o un logo incrustado) y el cuerpo, el color `base`,
 *   lleva el hueco exacto. Es lo que pide la impresión multicolor de
 *   verdad: los colores no atraviesan la figura de lado a lado.
 */
export function separarPorColor(w: Wasm, pos: Float32Array, color: Uint8Array, opciones: { modo: ModoColor; tapa: Tapa; profundidad: number; base: number }): { piezas: PiezaColor[]; avisos: string[] } {
  const topo = topologia(pos)
  const avisos: string[] = []

  if (opciones.modo === 'frontera') {
    const piezas = separarFrontera({ pos, color }, topo, opciones.tapa).map((p) => {
      const m = soldar(p.pos)
      try {
        return { color: p.color, malla: deManifold(solido(w, m).solido), estanca: true }
      } catch {
        return { color: p.color, malla: m, estanca: p.cerrada }
      }
    })
    return { piezas, avisos }
  }

  // ── Incrustación ──
  const original = solido(w, soldar(pos)).solido
  const nt = color.length

  // Normal de cada triángulo (unitaria): para agrupar la pintura en parches casi planos.
  const nTri = new Float64Array(nt * 3)
  for (let t = 0; t < nt; t++) {
    const [a, b, c] = [topo.vert[t * 3], topo.vert[t * 3 + 1], topo.vert[t * 3 + 2]]
    const p = topo.vpos
    const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2]
    const vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const l = Math.hypot(nx, ny, nz) || 1
    nTri.set([nx / l, ny / l, nz / l], t * 3)
  }

  const colores = [...new Set(color)].sort((a, b) => a - b)
  const placas: { color: number; solido: Manifold }[] = []
  for (const c of colores) {
    if (c === opciones.base) continue
    const { pintadas, sueltas } = islas(topo, color, c)
    // Una isla que no toca otro color ya es una pieza entera (lo normal en un
    // 3MF multiobjeto de Bambu u Orca): sale tal cual, sin incrustar.
    const partes: Manifold[] = []
    if (sueltas.length) {
      const sopa = new Float32Array(sueltas.length * 9)
      sueltas.forEach((t, i) => sopa.set(pos.subarray(t * 9, t * 9 + 9), i * 9))
      const s = intentarManifold(w, soldar(sopa))
      if (s) partes.push(s)
      else avisos.push(`El color ${c + 1} tiene piezas sueltas que no cierran: revísalas en el laminador.`)
    }
    let fallos = 0
    const barridos: Manifold[] = []
    for (const parche of parches(topo, nTri, color, pintadas)) {
      const b = barrido(w, topo, parche.tris, parche.normal, opciones.profundidad)
      if (b) barridos.push(b)
      else fallos++
    }
    if (fallos) avisos.push(`El color ${c + 1} tiene ${fallos} zona${fallos > 1 ? 's' : ''} que no se pudo incrustar (malla rota ahí).`)
    if (barridos.length) {
      let inc = w.Manifold.union(barridos).intersect(original)
      // Lo incrustado no puede comerse una pieza suelta de otro color ya separada.
      for (const prev of placas) inc = inc.subtract(prev.solido)
      partes.push(inc)
    }
    if (!partes.length) continue
    const pieza = partes.length > 1 ? w.Manifold.union(partes) : partes[0]
    if (!pieza.isEmpty()) placas.push({ color: c, solido: pieza })
  }
  let cuerpo = original
  if (placas.length) cuerpo = original.subtract(w.Manifold.union(placas.map((p) => p.solido)))
  const piezas: PiezaColor[] = [{ color: opciones.base, malla: deManifold(cuerpo), estanca: true }, ...placas.map((p) => ({ color: p.color, malla: deManifold(p.solido), estanca: true }))]
  return { piezas: piezas.sort((a, b) => a.color - b.color), avisos }
}

/** Ángulo máximo entre la normal de un parche y la de cualquiera de sus triángulos. */
const CONO_PARCHE = Math.cos((60 * Math.PI) / 180)

/**
 * Divide la pintura de un color en parches casi planos: zonas conectadas
 * cuyos triángulos miran a menos de 55° de la normal media del parche. Un
 * parche así es una "altura sobre un plano" respecto de esa normal, y su
 * barrido en esa dirección nunca se cruza consigo mismo.
 */
function parches(topo: ReturnType<typeof topologia>, nTri: Float64Array, color: Uint8Array, permitidos: Uint8Array): { tris: number[]; normal: [number, number, number] }[] {
  const nt = color.length
  const asignado = new Uint8Array(nt)
  const salida: { tris: number[]; normal: [number, number, number] }[] = []
  for (let semilla = 0; semilla < nt; semilla++) {
    if (!permitidos[semilla] || asignado[semilla]) continue
    const tris: number[] = []
    const suma = [0, 0, 0]
    const media = [nTri[semilla * 3], nTri[semilla * 3 + 1], nTri[semilla * 3 + 2]]
    const pila = [semilla]
    asignado[semilla] = 1
    while (pila.length) {
      const t = pila.pop()!
      tris.push(t)
      for (let e = 0; e < 3; e++) suma[e] += nTri[t * 3 + e]
      const l = Math.hypot(suma[0], suma[1], suma[2]) || 1
      for (let e = 0; e < 3; e++) media[e] = suma[e] / l
      for (let i = 0; i < 3; i++) {
        const v = topo.vecinos[t * 3 + i]
        if (v < 0 || asignado[v] || !permitidos[v]) continue
        if (nTri[v * 3] * media[0] + nTri[v * 3 + 1] * media[1] + nTri[v * 3 + 2] * media[2] < CONO_PARCHE) continue
        asignado[v] = 1
        pila.push(v)
      }
    }
    salida.push({ tris, normal: media as [number, number, number] })
  }
  return salida
}

/**
 * Islas de un color: las que tocan otro color (pintura sobre la superficie,
 * a incrustar) y las que no tocan ninguno (piezas enteras ya separadas).
 */
function islas(topo: ReturnType<typeof topologia>, color: Uint8Array, c: number): { pintadas: Uint8Array; sueltas: number[] } {
  const nt = color.length
  const visto = new Uint8Array(nt)
  const pintadas = new Uint8Array(nt)
  const sueltas: number[] = []
  for (let semilla = 0; semilla < nt; semilla++) {
    if (color[semilla] !== c || visto[semilla]) continue
    const isla: number[] = []
    let toca = false
    const pila = [semilla]
    visto[semilla] = 1
    while (pila.length) {
      const t = pila.pop()!
      isla.push(t)
      for (let i = 0; i < 3; i++) {
        const v = topo.vecinos[t * 3 + i]
        if (v < 0) continue
        if (color[v] !== c) toca = true
        else if (!visto[v]) {
          visto[v] = 1
          pila.push(v)
        }
      }
    }
    if (toca) for (const t of isla) pintadas[t] = 1
    else sueltas.push(...isla)
  }
  return { pintadas, sueltas }
}

/**
 * Barrido de un parche: la superficie (levantada 0,1 mm hacia fuera para
 * que la intersección con el original sea limpia), su copia trasladada
 * `prof` mm hacia dentro a lo largo de la normal del parche, y las paredes
 * del borde. Como todo se mueve en una sola dirección, el sólido es válido
 * aunque la superficie sea curva.
 */
function barrido(w: Wasm, topo: ReturnType<typeof topologia>, tris: number[], n: [number, number, number], prof: number): Manifold | null {
  const dentro = new Set(tris)
  const mapa = new Map<number, number>()
  const pos: number[] = []
  const idx: number[] = []
  const vertice = (v: number) => {
    let i = mapa.get(v)
    if (i === undefined) {
      i = pos.length / 6
      mapa.set(v, i)
      const p = topo.vpos
      pos.push(p[v * 3] + n[0] * 0.1, p[v * 3 + 1] + n[1] * 0.1, p[v * 3 + 2] + n[2] * 0.1)
      pos.push(p[v * 3] - n[0] * prof, p[v * 3 + 1] - n[1] * prof, p[v * 3 + 2] - n[2] * prof)
    }
    return i
  }
  for (const t of tris) {
    const [a, b, cc] = [0, 1, 2].map((k) => vertice(topo.vert[t * 3 + k]))
    if (a === b || b === cc || a === cc) continue
    idx.push(a * 2, b * 2, cc * 2) // fuera
    idx.push(a * 2 + 1, cc * 2 + 1, b * 2 + 1) // dentro, al revés
    for (let k = 0; k < 3; k++) {
      const vecino = topo.vecinos[t * 3 + k]
      if (vecino >= 0 && dentro.has(vecino)) continue
      const p = mapa.get(topo.vert[t * 3 + k])!, q = mapa.get(topo.vert[t * 3 + ((k + 1) % 3)])!
      // Pared en el borde a→b: (b, a, a') y (b, a', b').
      idx.push(q * 2, p * 2, p * 2 + 1, q * 2, p * 2 + 1, q * 2 + 1)
    }
  }
  if (!idx.length) return null
  // `pos` intercala [fuera, dentro] por vértice: índice 2i = fuera, 2i+1 = dentro.
  return intentarManifold(w, { pos: new Float32Array(pos), idx: new Uint32Array(idx) })
}

/* ═══ Partes ══════════════════════════════════════════════════════════ */

export function cuerposSueltos(w: Wasm, malla: MallaIdx): MallaIdx[] {
  return solido(w, malla).solido.decompose().sort((a, b) => b.volume() - a.volume()).map((x) => deManifold(x))
}

export function unirPiezas(w: Wasm, mallas: MallaIdx[]): MallaIdx {
  return deManifold(w.Manifold.union(mallas.map((m) => solido(w, m).solido)))
}

/* ═══ Repartir en la cama ═════════════════════════════════════════════ */

/**
 * Cada pieza apoyada por su mejor cara (casi siempre la del corte) y
 * colocada en filas sobre la cama, con 6 mm entre piezas. Las que no caben
 * siguen en una segunda cama a la derecha, y se avisa.
 */
export function repartirEnCama(mallas: MallaIdx[], cama: Vec3, hueco = 6): { mallas: MallaIdx[]; camas: number } {
  const giradas = mallas.map((m) => {
    const { abajo } = mejorApoyo(m)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...abajo).normalize(), new THREE.Vector3(0, 0, -1))
    const r = new THREE.Matrix4().makeRotationFromQuaternion(q).elements
    const p = new Float32Array(m.pos.length)
    for (let i = 0; i < p.length; i += 3) {
      const [x, y, z] = [m.pos[i], m.pos[i + 1], m.pos[i + 2]]
      p[i] = r[0] * x + r[4] * y + r[8] * z
      p[i + 1] = r[1] * x + r[5] * y + r[9] * z
      p[i + 2] = r[2] * x + r[6] * y + r[10] * z
    }
    const a = analizar({ pos: p, idx: m.idx })
    return { m: { pos: p, idx: m.idx }, a }
  })
  // Estantes: las piezas más altas (en Y) primero.
  const orden = giradas.map((_, i) => i).sort((i, j) => giradas[j].a.max[1] - giradas[j].a.min[1] - (giradas[i].a.max[1] - giradas[i].a.min[1]))
  // 1 · Estantes: dónde va cada pieza (esquina de su caja) y en qué cama.
  let x = 0, y = 0, fila = 0, cama0 = 0
  const sitio: { cama: number; x: number; y: number }[] = new Array(mallas.length)
  for (const i of orden) {
    const { a } = giradas[i]
    const ancho = a.max[0] - a.min[0], fondo = a.max[1] - a.min[1]
    if (x > 0 && x + ancho > cama[0]) (x = 0), (y += fila + hueco), (fila = 0)
    if (y > 0 && y + fondo > cama[1]) (cama0++, (x = 0), (y = 0), (fila = 0))
    sitio[i] = { cama: cama0, x, y }
    x += ancho + hueco
    fila = Math.max(fila, fondo)
  }
  // 2 · Cada cama, con su grupo de piezas centrado: queda ordenado y lejos de los bordes.
  const grupo = new Map<number, { x0: number; y0: number; x1: number; y1: number }>()
  sitio.forEach((s2, i) => {
    const { a } = giradas[i]
    const g = grupo.get(s2.cama) ?? { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    g.x0 = Math.min(g.x0, s2.x)
    g.y0 = Math.min(g.y0, s2.y)
    g.x1 = Math.max(g.x1, s2.x + a.max[0] - a.min[0])
    g.y1 = Math.max(g.y1, s2.y + a.max[1] - a.min[1])
    grupo.set(s2.cama, g)
  })
  const salida: MallaIdx[] = new Array(mallas.length)
  sitio.forEach((s2, i) => {
    const { m, a } = giradas[i]
    const g = grupo.get(s2.cama)!
    const dx = s2.cama * (cama[0] + 40) + s2.x - a.min[0] - (g.x1 + g.x0) / 2
    const dy = s2.y - a.min[1] - (g.y1 + g.y0) / 2
    const p = new Float32Array(m.pos.length)
    for (let k = 0; k < p.length; k += 3) {
      p[k] = m.pos[k] + dx
      p[k + 1] = m.pos[k + 1] + dy
      p[k + 2] = m.pos[k + 2] - a.min[2]
    }
    salida[i] = { pos: p, idx: m.idx }
  })
  return { mallas: salida, camas: cama0 + 1 }
}
