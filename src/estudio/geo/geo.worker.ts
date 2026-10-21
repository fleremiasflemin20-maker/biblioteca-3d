/// <reference lib="webworker" />
import wasmURL from 'manifold-3d/manifold.wasm?url'
import { Font, type FontData } from 'three/examples/jsm/loaders/FontLoader.js'
import fuenteJSON from '../../data/fuente-nombre.json'
import { cargarWasm, deManifold, liberar, reiniciarWasm } from './wasm.ts'
import { construirForma } from './formas.ts'
import { generarPlantilla } from './plantillas.ts'
import { analizar, mejorApoyo } from './impresion.ts'
import { cortarBoceto, cortarPlano, cuerposSueltos, separarAutomatico, solido, dividirParaCama, repartirEnCama, separarPorColor, unirPiezas } from './separador.ts'
import type { Pedido } from './cliente.ts'
import type { MallaIdx } from './tipos.ts'

/**
 * El worker de geometría: Manifold vive aquí para que una resta de 150 000
 * triángulos o el grinder entero no congelen la interfaz.
 */
const fuente = new Font(fuenteJSON as unknown as FontData)
const ctx = { fuente }

const transferibles = (x: unknown): Transferable[] => {
  const l: Transferable[] = []
  const ver = (v: unknown) => {
    if (v instanceof Float32Array || v instanceof Uint32Array) l.push(v.buffer)
    else if (Array.isArray(v)) v.forEach(ver)
    else if (v && typeof v === 'object') Object.values(v).forEach(ver)
  }
  ver(x)
  return l
}

async function resolver(p: Pedido): Promise<unknown> {
  const w = await cargarWasm(wasmURL)
  try {
    switch (p.tipo) {
      case 'forma':
        return deManifold(construirForma(w, p.forma, p.params, ctx))
      case 'plantilla':
        return generarPlantilla(w, p.plantilla, p.params, ctx)
      case 'booleana': {
        // Las mallas abiertas se cierran solas antes de operar (ver `solido`).
        const solidos = p.solidos.map((m) => solido(w, m).solido)
        const huecos = p.huecos.map((m) => solido(w, m).solido)
        let r = p.op === 'intersecar' ? w.Manifold.intersection(solidos) : w.Manifold.union(solidos)
        if (huecos.length) r = r.subtract(w.Manifold.union(huecos))
        if (r.isEmpty()) throw new Error('El resultado quedó vacío')
        return deManifold(r)
      }
      case 'reparar':
        return deManifold(solido(w, p.malla).solido)
      case 'analizar':
        return analizar(p.malla)
      case 'orientar':
        return mejorApoyo(p.malla)
      case 'separar':
        return cuerposSueltos(w, p.malla) satisfies MallaIdx[]
      case 'sep-auto':
        return separarAutomatico(w, p.pos, p.color, p.opciones)
      case 'sep-color':
        return separarPorColor(w, p.pos, p.color, p.opciones)
      case 'sep-plano':
        return cortarPlano(w, p.malla, p.plano, p.conector)
      case 'sep-boceto':
        return cortarBoceto(w, p.malla, p.poligono, p.marco, p.largo)
      case 'sep-cama':
        return dividirParaCama(w, p.malla, p.cama, p.conector)
      case 'sep-unir':
        return unirPiezas(w, p.mallas)
      case 'sep-repartir':
        return repartirEnCama(p.mallas, p.cama)
    }
  } finally {
    liberar()
  }
}

self.onmessage = async (e: MessageEvent<{ id: number; pedido: Pedido }>) => {
  const { id, pedido } = e.data
  try {
    const r = await resolver(pedido)
    self.postMessage({ id, ok: true, r }, { transfer: transferibles(r) })
  } catch (err) {
    const interno = err instanceof WebAssembly.RuntimeError
    if (interno) reiniciarWasm()
    const texto = interno ? 'La geometría tiene caras rotas que el motor no pudo procesar. Prueba "Por frontera" o repara la malla en el laminador.' : err instanceof Error ? err.message : String(err)
    self.postMessage({ id, ok: false, error: texto })
  }
}
