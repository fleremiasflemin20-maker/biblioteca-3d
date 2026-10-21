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

/**
 * Tras un error interno de WASM (memoria fuera de rango con geometría muy
 * rota), el módulo puede quedar en mal estado: se descarta y el siguiente
 * pedido carga uno limpio.
 */
export function reiniciarWasm() {
  promesa = null
}

/** Malla de three/STL → Manifold. Suelda los vértices repetidos; lanza si no es un sólido cerrado. */
export function aManifold(w: Wasm, m: MallaIdx): Manifold {
  const mesh = new w.Mesh({ numProp: 3, vertProperties: m.pos, triVerts: m.idx })
  mesh.merge()
  try {
    return new w.Manifold(mesh)
  } catch {
    throw new Error('La malla no es un sólido cerrado (tiene agujeros o aristas compartidas por más de dos caras)')
  }
}

/** Como `aManifold`, pero devuelve null en vez de lanzar si la malla no cierra. */
export function intentarManifold(w: Wasm, m: MallaIdx): Manifold | null {
  try {
    const s = aManifold(w, m)
    return s.status() === 'NoError' && !s.isEmpty() ? s : null
  } catch {
    return null
  }
}

/**
 * Manifold → malla indexada. Manifold puede devolver un vértice repetido a
 * cada lado de una costura de la malla original y anotar en `mergeFromVert`
 * / `mergeToVert` cuáles son el mismo: se aplican aquí, para que la malla
 * de salida sea cerrada también por sus índices (y el laminador no vea
 * bordes abiertos donde no los hay).
 */
export function deManifold(s: Manifold): MallaIdx {
  const m = s.getMesh()
  const n = m.numProp
  const nv = m.vertProperties.length / n
  const pos = new Float32Array(nv * 3)
  if (n === 3) pos.set(m.vertProperties)
  else for (let i = 0; i < nv; i++) pos.set(m.vertProperties.subarray(i * n, i * n + 3), i * 3)
  const idx = new Uint32Array(m.triVerts)
  const desde = m.mergeFromVert, hacia = m.mergeToVert
  if (desde?.length) {
    const destino = new Uint32Array(nv).map((_, i) => i)
    for (let k = 0; k < desde.length; k++) destino[desde[k]] = hacia[k]
    for (let i = 0; i < idx.length; i++) idx[i] = destino[idx[i]]
  }
  return { pos, idx }
}
