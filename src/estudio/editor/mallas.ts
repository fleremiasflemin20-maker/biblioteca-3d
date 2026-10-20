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

const geometrias = new WeakMap<MallaIdx, THREE.BufferGeometry>()

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
