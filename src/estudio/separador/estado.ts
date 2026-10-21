import { create } from 'zustand'
import type { Proyecto } from '../../lib/taller/importar'
import type { Tapa } from '../../lib/taller/malla'
import { CONECTOR_INICIAL, type Conector, type ModoColor } from '../geo/separador.ts'
import { IMPRESORAS, type Analisis, type MallaIdx } from '../geo/tipos.ts'
import { analizar } from '../geo/impresion.ts'

/**
 * Estado del Separador: el modelo pintado (para separar por color) y las
 * piezas que van saliendo de cada corte. Cada operación guarda la lista
 * anterior de piezas: deshacer es volver a ella.
 */
export type Paso = 'color' | 'corte' | 'partes'

export type PiezaSep = {
  id: string
  nombre: string
  color: string
  /** En coordenadas de la cama, mm, Z arriba, tal como queda montada. */
  malla: MallaIdx
  estanca: boolean
  visible: boolean
  /** Piezas del catálogo: se separan para verlas, pero no se descargan. */
  protegida?: boolean
}

export type CorteUI = { eje: 0 | 1 | 2; t: number; inclinacion: number; giro: number }

type Estado = {
  nombre: string
  proyecto: Proyecto | null
  /** Sube cuando la pintura cambia fuera del pincel (relleno, deshacer…). */
  version: number
  piezas: PiezaSep[]
  pasado: PiezaSep[][]
  futuro: PiezaSep[][]
  seleccion: string[]
  paso: Paso
  explosion: number
  impresora: string
  conector: Conector
  corte: CorteUI
  modoColor: ModoColor
  tapa: Tapa
  profundidad: number
  base: number
  /** Cómo se corta en el paso 2: plano con conectores o boceto a mano. */
  modoCorte: 'plano' | 'boceto'
  /** Puntos del boceto en coordenadas normalizadas de pantalla (-1..1). */
  boceto: [number, number][]
  suavizado: number
  rellenoAngulo: boolean
  angulo: number
  ocupado: string | null
  aviso: { texto: string; tipo: 'ok' | 'error' | 'info' } | null

  cambiarPiezas: (f: (l: PiezaSep[]) => PiezaSep[]) => void
  deshacer: () => void
  rehacer: () => void
  set: (p: Partial<Omit<Estado, 'cambiarPiezas' | 'deshacer' | 'rehacer' | 'set'>>) => void
}

export const useSeparador = create<Estado>((set, get) => ({
  nombre: '',
  proyecto: null,
  version: 0,
  piezas: [],
  pasado: [],
  futuro: [],
  seleccion: [],
  paso: 'corte',
  explosion: 0,
  impresora: IMPRESORAS[0].id,
  conector: CONECTOR_INICIAL,
  corte: { eje: 2, t: 0.5, inclinacion: 0, giro: 0 },
  modoColor: 'frontera',
  tapa: 'auto',
  profundidad: 1.2,
  base: 0,
  modoCorte: 'plano',
  boceto: [],
  suavizado: 2,
  rellenoAngulo: false,
  angulo: 30,
  ocupado: null,
  aviso: null,

  cambiarPiezas(f) {
    const antes = get().piezas
    const despues = f(antes)
    if (despues === antes) return
    const ids = new Set(despues.map((p) => p.id))
    set({ piezas: despues, pasado: [...get().pasado.slice(-39), antes], futuro: [], seleccion: get().seleccion.filter((id) => ids.has(id)) })
  },
  deshacer() {
    const { pasado, piezas, futuro } = get()
    if (!pasado.length) return
    set({ piezas: pasado[pasado.length - 1], pasado: pasado.slice(0, -1), futuro: [piezas, ...futuro] })
  },
  rehacer() {
    const { pasado, piezas, futuro } = get()
    if (!futuro.length) return
    set({ piezas: futuro[0], futuro: futuro.slice(1), pasado: [...pasado, piezas] })
  },
  set: (p) => set(p),
}))

let n = 0
export const idPieza = () => `p${Date.now().toString(36)}${(n++).toString(36)}`

/**
 * Lo que otra vista le pasa al Separador al abrirlo (las piezas del editor,
 * por ejemplo). Se lee una vez y se vacía.
 */
export const entrada: { piezas?: Omit<PiezaSep, 'id' | 'visible'>[]; proyecto?: Proyecto } = {}

/** `analizar` con memoria: la lista y el visor piden las medidas en cada render. */
const medidas = new WeakMap<MallaIdx, Analisis>()
export function medir(m: MallaIdx): Analisis {
  let a = medidas.get(m)
  if (!a) medidas.set(m, (a = analizar(m)))
  return a
}

/**
 * La cámara del visor, para convertir el boceto (pantalla) en un prisma en
 * el mundo. La rellena el visor en cada cuadro.
 */
export const camaraVisor: { camara: import('three').PerspectiveCamera | null; objetivo: import('three').Vector3 | null } = { camara: null, objetivo: null }
