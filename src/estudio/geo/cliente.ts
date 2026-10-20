import type { Analisis, MallaIdx, Params, PiezaGenerada, TipoForma, Vec3 } from './tipos.ts'

/** Lo que el editor le puede pedir al worker de geometría, y lo que devuelve cada pedido. */
export type Pedido =
  | { tipo: 'forma'; forma: TipoForma; params: Params }
  | { tipo: 'plantilla'; plantilla: string; params: Params }
  | { tipo: 'booleana'; op: 'combinar' | 'intersecar'; solidos: MallaIdx[]; huecos: MallaIdx[] }
  | { tipo: 'reparar'; malla: MallaIdx }
  | { tipo: 'analizar'; malla: MallaIdx }
  | { tipo: 'orientar'; malla: MallaIdx }
  | { tipo: 'separar'; malla: MallaIdx }

type Respuestas = {
  forma: MallaIdx
  plantilla: PiezaGenerada[]
  booleana: MallaIdx
  reparar: MallaIdx
  analizar: Analisis
  orientar: { abajo: Vec3; voladizo: number; apoyo: number }
  separar: MallaIdx[]
}

let worker: Worker | null = null
let siguiente = 0
const pendientes = new Map<number, { ok: (r: unknown) => void; mal: (e: Error) => void }>()

function arrancar() {
  if (worker) return worker
  worker = new Worker(new URL('./geo.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; r?: unknown; error?: string }>) => {
    const p = pendientes.get(e.data.id)
    pendientes.delete(e.data.id)
    if (!p) return
    if (e.data.ok) p.ok(e.data.r)
    else p.mal(new Error(e.data.error))
  }
  worker.onerror = (e) => {
    for (const p of pendientes.values()) p.mal(new Error(e.message || 'El motor de geometría falló'))
    pendientes.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

/** Pide algo al worker. Las mallas se copian (no se transfieren): el editor las sigue usando. */
export function geo<P extends Pedido>(pedido: P): Promise<Respuestas[P['tipo']]> {
  const w = arrancar()
  const id = siguiente++
  return new Promise((ok, mal) => {
    pendientes.set(id, { ok: ok as (r: unknown) => void, mal })
    w.postMessage({ id, pedido })
  })
}
