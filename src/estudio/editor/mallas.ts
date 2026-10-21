import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { geo } from '../geo/cliente.ts'
import type { MallaIdx, Nodo, TipoForma } from '../geo/tipos.ts'

/**
 * Mallas locales de cada nodo. Las formas paramétricas se construyen en el
 * worker y se guardan por (tipo, parámetros): diez cubos iguales son una sola
 * malla, y deshacer no vuelve a calcular nada.
 */
const cache = new Map<string, Promise<MallaIdx>>()

const clave = (n: Pick<Nodo, 'tipo' | 'params'>) => `${n.tipo}:${JSON.stringify(n.params, Object.keys(n.params).sort())}`

export function mallaLocal(n: Pick<Nodo, 'tipo' | 'params' | 'malla'>): Promise<MallaIdx> {
  if (n.tipo === 'malla') return n.malla ? Promise.resolve(n.malla) : Promise.reject(new Error('Objeto sin malla'))
  const k = clave(n)
  let p = cache.get(k)
  if (!p) {
    p = geo({ tipo: 'forma', forma: n.tipo as TipoForma, params: n.params })
    p.catch(() => cache.delete(k))
    cache.set(k, p)
    if (cache.size > 300) cache.delete(cache.keys().next().value!)
  }
  return p
}

/** La malla del nodo para pintar; mientras se recalcula, se queda la anterior. */
export function useMallaLocal(n: Pick<Nodo, 'tipo' | 'params' | 'malla'>) {
  const [m, setM] = useState<MallaIdx | null>(n.malla ?? null)
  const [error, setError] = useState<string | null>(null)
  const k = n.tipo === 'malla' ? n.malla : clave(n)
  useEffect(() => {
    let vivo = true
    mallaLocal(n).then(
      (r) => vivo && (setM(r), setError(null)),
      (e: Error) => vivo && setError(e.message),
    )
    return () => {
      vivo = false
    }
  }, [k])
  return { malla: m, error }
}

/** Malla indexada → sopa de triángulos (9 floats por triángulo), en el mismo orden. */
export function aSopa(m: MallaIdx): Float32Array {
  const s = new Float32Array(m.idx.length * 3)
  for (let i = 0; i < m.idx.length; i++) s.set(m.pos.subarray(m.idx[i] * 3, m.idx[i] * 3 + 3), i * 3)
  return s
}

const geometrias = new WeakMap<MallaIdx, THREE.BufferGeometry>()
const conColor = new WeakMap<object, THREE.BufferGeometry>()

/**
 * Geometría con el color de cada triángulo (textura o filamentos), para ver
 * un modelo de Meshy o un 3MF pintado como es. Facetada: un color por cara.
 */
export function geometriaColor(m: MallaIdx, pintura: { color: Uint8Array; paleta: { color: string }[]; rgb?: Float32Array }): THREE.BufferGeometry {
  let g = conColor.get(pintura)
  if (!g) {
    g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(aSopa(m), 3))
    const nt = m.idx.length / 3
    const col = new Float32Array(nt * 9)
    const c = new THREE.Color()
    const paleta = pintura.paleta.map((f) => new THREE.Color(f.color))
    for (let t = 0; t < nt; t++) {
      if (pintura.rgb) c.setRGB(pintura.rgb[t * 3], pintura.rgb[t * 3 + 1], pintura.rgb[t * 3 + 2], THREE.SRGBColorSpace)
      else c.copy(paleta[pintura.color[t]] ?? paleta[0])
      for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], t * 9 + k * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    g.computeBoundingBox()
    g.computeBoundingSphere()
    conColor.set(pintura, g)
  }
  return g
}

/** Geometría de three con aristas vivas a más de 30° y curvas suaves (como "Auto Smooth" de Blender). */
export function geometria(m: MallaIdx): THREE.BufferGeometry {
  let g = geometrias.get(m)
  if (!g) {
    const base = new THREE.BufferGeometry()
    base.setAttribute('position', new THREE.BufferAttribute(m.pos, 3))
    base.setIndex(new THREE.BufferAttribute(m.idx, 1))
    g = m.idx.length / 3 > 400_000 ? base.toNonIndexed() : toCreasedNormals(base, Math.PI / 6)
    if (!g.attributes.normal) g.computeVertexNormals()
    g.computeBoundingBox()
    g.computeBoundingSphere()
    geometrias.set(m, g)
  }
  return g
}
