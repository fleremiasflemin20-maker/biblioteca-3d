import { create } from 'zustand'
import * as THREE from 'three'
import type { MallaIdx, Nodo, Params, Vec3 } from '../geo/tipos.ts'
import { IMPRESORAS, COLORES } from '../geo/tipos.ts'

/**
 * El estado del editor: la escena, la selección y el historial.
 *
 * Cada cambio reemplaza la lista de nodos entera (las mallas se comparten por
 * referencia, así que es barato) y guarda la anterior: deshacer es volver a
 * ella, como el "undo stack" de Blender.
 */
export type Herramienta = 'mover' | 'rotar' | 'escalar' | 'medir'
export type Luz = 'estudio' | 'atardecer' | 'noche' | 'neutra'

/** Lo que una plantilla deja en sus piezas para poder regenerarlas con otros parámetros. */
export type Lote = { id: string; plantilla: string; params: Params }

/**
 * Colores de un modelo importado (textura de Meshy, 3MF pintado…), uno por
 * triángulo de `malla` en el mismo orden: `rgb` es lo que se ve (sRGB, 0–1) y
 * `color`/`paleta`, los filamentos con los que se separa.
 */
export type Pintura = { color: Uint8Array; paleta: { color: string; nombre: string }[]; rgb?: Float32Array }

export type NodoEditor = Nodo & { lote?: Lote; pintura?: Pintura }

type Estado = {
  nodos: NodoEditor[]
  seleccion: string[]
  pasado: NodoEditor[][]
  futuro: NodoEditor[][]
  impresora: string
  rejilla: number
  herramienta: Herramienta
  luz: Luz
  voladizos: boolean
  alambre: boolean
  ocupado: string | null
  aviso: { texto: string; tipo: 'ok' | 'error' | 'info' } | null

  hacer: (cambio: (nodos: NodoEditor[]) => NodoEditor[]) => void
  deshacer: () => void
  rehacer: () => void
  seleccionar: (ids: string[], sumar?: boolean) => void
  set: (p: Partial<Pick<Estado, 'impresora' | 'rejilla' | 'herramienta' | 'luz' | 'voladizos' | 'alambre' | 'ocupado' | 'aviso'>>) => void
  /** Reemplaza la escena sin historial (al abrir un proyecto guardado). */
  cargar: (nodos: NodoEditor[]) => void
}

const LIMITE_HISTORIAL = 80

export const useEditor = create<Estado>((set, get) => ({
  nodos: [],
  seleccion: [],
  pasado: [],
  futuro: [],
  impresora: IMPRESORAS[0].id,
  rejilla: 1,
  herramienta: 'mover',
  luz: 'estudio',
  voladizos: false,
  alambre: false,
  ocupado: null,
  aviso: null,

  hacer(cambio) {
    const antes = get().nodos
    const despues = cambio(antes)
    if (despues === antes) return
    const ids = new Set(despues.map((n) => n.id))
    set({
      nodos: despues,
      pasado: [...get().pasado.slice(-LIMITE_HISTORIAL + 1), antes],
      futuro: [],
      seleccion: get().seleccion.filter((id) => ids.has(id)),
    })
  },
  deshacer() {
    const { pasado, nodos, futuro } = get()
    if (!pasado.length) return
    set({ nodos: pasado[pasado.length - 1], pasado: pasado.slice(0, -1), futuro: [nodos, ...futuro] })
  },
  rehacer() {
    const { pasado, nodos, futuro } = get()
    if (!futuro.length) return
    set({ nodos: futuro[0], futuro: futuro.slice(1), pasado: [...pasado, nodos] })
  },
  seleccionar(ids, sumar = false) {
    if (!sumar) return set({ seleccion: ids })
    const s = new Set(get().seleccion)
    for (const id of ids) (s.has(id) ? s.delete(id) : s.add(id))
    set({ seleccion: [...s] })
  },
  set: (p) => set(p),
  cargar: (nodos) => set({ nodos, pasado: [], futuro: [], seleccion: [] }),
}))

export const impresoraActual = () => IMPRESORAS.find((i) => i.id === useEditor.getState().impresora) ?? IMPRESORAS[0]

let contador = 0
export const nuevoId = () => `n${Date.now().toString(36)}${(contador++).toString(36)}`

export function nuevoNodo(p: Partial<NodoEditor> & Pick<NodoEditor, 'tipo' | 'nombre'>): NodoEditor {
  const usados = useEditor.getState().nodos.length
  return {
    id: nuevoId(),
    params: {},
    pos: [0, 0, 10],
    rot: [0, 0, 0],
    esc: [1, 1, 1],
    color: COLORES[usados % 5].color,
    hueco: false,
    visible: true,
    ...p,
  }
}

/* ── Transformaciones ───────────────────────────────────────────────── */

const GRAD = Math.PI / 180

export function matrizNodo(n: Pick<Nodo, 'pos' | 'rot' | 'esc'>, m = new THREE.Matrix4()) {
  return m.compose(
    new THREE.Vector3(...n.pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(n.rot[0] * GRAD, n.rot[1] * GRAD, n.rot[2] * GRAD, 'XYZ')),
    new THREE.Vector3(...n.esc),
  )
}

const redondear = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d

/** Matriz → pos/rot/esc del nodo (con redondeo para que el panel no muestre 9,999999). */
export function desdeMatriz(m: THREE.Matrix4): Pick<Nodo, 'pos' | 'rot' | 'esc'> {
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3()
  m.decompose(p, q, s)
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ')
  return {
    pos: [redondear(p.x), redondear(p.y), redondear(p.z)],
    rot: [redondear(e.x / GRAD, 3), redondear(e.y / GRAD, 3), redondear(e.z / GRAD, 3)],
    esc: [redondear(s.x, 5), redondear(s.y, 5), redondear(s.z, 5)],
  }
}

/** La malla local de un nodo llevada a la cama. Un espejo (escala negativa) invierte los triángulos. */
export function mallaMundo(n: Pick<Nodo, 'pos' | 'rot' | 'esc'>, local: MallaIdx): MallaIdx {
  const m = matrizNodo(n).elements
  const p = local.pos, pos = new Float32Array(p.length)
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2]
    pos[i] = m[0] * x + m[4] * y + m[8] * z + m[12]
    pos[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]
    pos[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14]
  }
  const espejo = n.esc[0] * n.esc[1] * n.esc[2] < 0
  if (!espejo) return { pos, idx: local.idx }
  const idx = new Uint32Array(local.idx.length)
  for (let t = 0; t < idx.length; t += 3) (idx[t] = local.idx[t]), (idx[t + 1] = local.idx[t + 2]), (idx[t + 2] = local.idx[t + 1])
  return { pos, idx }
}

/** Centra una malla en su caja: devuelve la malla local y dónde queda su centro. */
export function centrarMalla(m: MallaIdx): { malla: MallaIdx; centro: Vec3 } {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < m.pos.length; i++) {
    const e = i % 3
    if (m.pos[i] < min[e]) min[e] = m.pos[i]
    if (m.pos[i] > max[e]) max[e] = m.pos[i]
  }
  const c: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  const pos = new Float32Array(m.pos.length)
  for (let i = 0; i < pos.length; i++) pos[i] = m.pos[i] - c[i % 3]
  return { malla: { pos, idx: m.idx }, centro: c }
}

export function cajaMundo(n: Nodo, local: MallaIdx) {
  const w = mallaMundo(n, local)
  const caja = new THREE.Box3()
  const v = new THREE.Vector3()
  for (let i = 0; i < w.pos.length; i += 3) caja.expandByPoint(v.set(w.pos[i], w.pos[i + 1], w.pos[i + 2]))
  return caja
}
