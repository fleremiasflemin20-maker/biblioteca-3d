import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CATALOGO, DRACO, rutaModelo, type Modelo3D } from '../../../src/lib/catalogo'
import { HISTORIA_DE } from '../../../src/lib/historias'
import { PERSONAJES, type Personaje } from './personajes'
import { ANCLA, ENCUADRE } from './marcador'

/**
 * Qué figura enseña la página: `?id=<id de la ficha>` en la URL.
 *
 * El modelo, su nombre y su archivo salen del mismo `catalogo.json` que la
 * biblioteca, y la historia del personaje de `personajes.ts`. Se resuelve una
 * vez al cargar: cambiar de figura es abrir otra pestaña.
 */
function resolver(): { modelo: Modelo3D; personaje: Personaje } | null {
  const id = new URLSearchParams(window.location.search).get('id') ?? ''
  const modelo = CATALOGO.find((m) => m.id === id && !m.sinTextura)
  const personaje = modelo ? PERSONAJES[HISTORIA_DE[modelo.id]] : undefined
  return modelo && personaje ? { modelo, personaje } : null
}

export const ELEGIDA = resolver()

export const MODEL_URL = ELEGIDA ? rutaModelo(ELEGIDA.modelo) : ''
export const DRACO_PATH = DRACO

/**
 * Altura de la figura en la escena. La cámara, las luces y el aura de la
 * plantilla están afinadas para el Gogeta de 1.90 con el origen en los pies,
 * así que cada modelo se lleva a ese mismo tamaño y no al revés.
 */
const ALTO = 1.9
/** Dioramas y cuadros son anchos: sin tope se saldrían del encuadre. */
const ANCHO_MAX = 1.55

export type Figura = {
  /** La escena del glTF, ya centrada, apoyada en el suelo y a escala. */
  escena: THREE.Group
  /**
   * La malla entera en una sola geometría, sin UVs ni costuras, para lo que
   * solo necesita la silueta: el aura de ki y el contorno.
   */
  silueta: THREE.BufferGeometry
  triangulos: number
}

/** Copia un atributo cuantizado (KHR_mesh_quantization) a float sin perder la escala. */
function aFloat(attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  const out = new Float32Array(attr.count * 3)
  for (let i = 0; i < attr.count; i++) {
    out[i * 3] = attr.getX(i)
    out[i * 3 + 1] = attr.getY(i)
    out[i * 3 + 2] = attr.getZ(i)
  }
  return new THREE.BufferAttribute(out, 3)
}

export function useFigura(): Figura {
  const { scene } = useGLTF(MODEL_URL, DRACO_PATH)

  return useMemo(() => {
    const escena = scene.clone(true)
    const raiz = new THREE.Group()
    raiz.add(escena)

    // Encuadre: pies en y=0, centrada en x/z, 1.90 de alto.
    escena.updateMatrixWorld(true)
    const caja = new THREE.Box3().setFromObject(escena)
    const tam = caja.getSize(new THREE.Vector3())
    const centro = caja.getCenter(new THREE.Vector3())
    const s = Math.min(ALTO / tam.y, ANCHO_MAX / Math.max(tam.x, 1e-6))
    escena.position.set(-centro.x * s, -caja.min.y * s, -centro.z * s)
    escena.scale.setScalar(s)
    raiz.updateMatrixWorld(true)

    // La silueta: todas las piezas fundidas en espacio de escena.
    const partes: THREE.BufferGeometry[] = []
    let triangulos = 0
    escena.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = true
      m.receiveShadow = true
      m.frustumCulled = false
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', aFloat(m.geometry.attributes.position))
      if (m.geometry.index) g.setIndex(m.geometry.index.clone())
      g.applyMatrix4(m.matrixWorld)
      triangulos += (g.index ? g.index.count : g.attributes.position.count) / 3
      partes.push(g.index ? g : g.toNonIndexed())
    })
    const unida = partes.length > 1 ? mergeGeometries(partes, false)! : partes[0]

    // Sin costuras: las mallas de IA traen los vértices partidos por UV, y una
    // cáscara inflada por normales partidas se abre en grietas.
    const silueta = mergeVertices(unida, 1e-4)
    silueta.computeVertexNormals()

    // El botón del "cómo se hizo" va junto al hombro izquierdo de la figura.
    const ancho = Math.min(tam.x * s, ANCHO_MAX)
    ANCLA[0] = -ancho * 0.42
    ANCLA[1] = ALTO * 0.66
    ANCLA[2] = 0.12

    // Todas las figuras de la biblioteca son chibi (cabeza enorme) o dioramas:
    // la cámara se queda más lejos que con el Gogeta, y más cuanto más ancha.
    const proporcion = ancho / ALTO
    ENCUADRE.radioMin = 4.3 + Math.max(0, proporcion - 0.45) * 3

    return { escena: raiz, silueta, triangulos: Math.round(triangulos) }
  }, [scene])
}

if (MODEL_URL) useGLTF.preload(MODEL_URL, DRACO_PATH)

// Para revisar desde la consola cómo se encuadró la figura.
if (import.meta.env.DEV) Object.assign(window, { __encuadre: { ENCUADRE, ANCLA } })
