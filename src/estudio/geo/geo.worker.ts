/// <reference lib="webworker" />
import wasmURL from 'manifold-3d/manifold.wasm?url'
import { Font, type FontData } from 'three/examples/jsm/loaders/FontLoader.js'
import fuenteJSON from '../../data/fuente-nombre.json'
import { aManifold, cargarWasm, deManifold, liberar } from './wasm.ts'
import { construirForma } from './formas.ts'
import { generarPlantilla } from './plantillas.ts'
import { analizar, mejorApoyo } from './impresion.ts'
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
        const solidos = p.solidos.map((m) => aManifold(w, m))
        const huecos = p.huecos.map((m) => aManifold(w, m))
        for (const s of [...solidos, ...huecos])
          if (s.status() !== 'NoError') throw new Error('Una de las piezas no es un sólido cerrado: repárala antes de combinar')
        let r = p.op === 'intersecar' ? w.Manifold.intersection(solidos) : w.Manifold.union(solidos)
        if (huecos.length) r = r.subtract(w.Manifold.union(huecos))
        if (r.isEmpty()) throw new Error('El resultado quedó vacío')
        return deManifold(r)
      }
      case 'reparar': {
        const s = aManifold(w, p.malla)
        if (s.status() !== 'NoError') throw new Error('No se pudo cerrar la malla automáticamente: tiene agujeros grandes')
        return deManifold(s)
      }
      case 'analizar':
        return analizar(p.malla)
      case 'orientar':
        return mejorApoyo(p.malla)
      case 'separar': {
        const s = aManifold(w, p.malla)
        if (s.status() !== 'NoError') throw new Error('Solo se separan sólidos cerrados')
        return s.decompose().map((x) => deManifold(x)) satisfies MallaIdx[]
      }
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
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
