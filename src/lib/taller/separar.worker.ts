/// <reference lib="webworker" />
import { medir, separar, topologia, type Tapa } from './malla.ts'

/**
 * La separación corre aquí para que el visor siga girando mientras se
 * calculan cientos de miles de triángulos.
 */
export type Pedido = { id: number; pos: Float32Array; color: Uint8Array; tapa: Tapa }

self.onmessage = (e: MessageEvent<Pedido>) => {
  const { id, pos, color, tapa } = e.data
  const inicio = performance.now()
  const piezas = separar({ pos, color }, topologia(pos), tapa)
  const original = medir(pos).volumen
  ;(self as unknown as Worker).postMessage({ id, piezas, original, ms: performance.now() - inicio }, piezas.map((p) => p.pos.buffer))
}
