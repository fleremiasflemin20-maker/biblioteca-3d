import Module from 'manifold-3d'
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { cleanup, garbageCollectManifold } from 'manifold-3d/lib/garbage-collector.js'
import type { MallaIdx } from './tipos.ts'

/**
 * Manifold (el núcleo CSG de OpenSCAD y Blender 4.x) compilado a WASM.
 *
 * Garantiza que cada unión, resta o intersección sale como sólido cerrado,
 * que es lo que un laminador necesita. Cada objeto de WASM se libera a mano:
 * `garbageCollectManifold` apunta todo lo que se crea y `liberar()` lo borra
 * al final de cada trabajo del worker.
 */
export type Wasm = ManifoldToplevel

let promesa: Promise<Wasm> | null = null

/** `locateFile` le dice al navegador dónde está el `.wasm` (Vite le pone hash). */
export function cargarWasm(wasmURL?: string): Promise<Wasm> {
  promesa ??= Module(wasmURL ? { locateFile: () => wasmURL } : undefined).then((w) => {
    w.setup()
    w.setCircularSegments(96)
    return garbageCollectManifold(w)
  })
  return promesa
}

export const liberar = cleanup

/** Malla de three/STL → Manifold. Suelda los vértices repetidos; lanza si no es un sólido cerrado. */
export function aManifold(w: Wasm, m: MallaIdx): Manifold {
  const mesh = new w.Mesh({ numProp: 3, vertProperties: m.pos, triVerts: m.idx })
  mesh.merge()
  const s = new w.Manifold(mesh)
  return s
}

export function deManifold(s: Manifold): MallaIdx {
  const m = s.getMesh()
  const n = m.numProp
  if (n === 3) return { pos: new Float32Array(m.vertProperties), idx: new Uint32Array(m.triVerts) }
  const nv = m.vertProperties.length / n
  const pos = new Float32Array(nv * 3)
  for (let i = 0; i < nv; i++) pos.set(m.vertProperties.subarray(i * n, i * n + 3), i * 3)
  return { pos, idx: new Uint32Array(m.triVerts) }
}
