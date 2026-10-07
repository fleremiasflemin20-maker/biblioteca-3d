import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { DRACO } from '../catalogo'
import { Constructor, areas, type Filamento, type Malla } from './malla.ts'
import { FILAMENTOS, leer3MF } from './tresmf.ts'
import { aHex, cuantizar } from './color.ts'

/**
 * Todo lo que entra al taller acaba igual: una malla en milímetros, con Z
 * hacia arriba y apoyada en z = 0, y una paleta de filamentos.
 *
 * Los archivos del visitante se leen en su navegador y no salen de él.
 */
export type Proyecto = {
  id: string
  nombre: string
  malla: Malla
  paleta: Filamento[]
  /** Color de la textura en cada triángulo, para volver a agrupar con otro número de filamentos. */
  rgb?: Float32Array
  /** Las piezas del catálogo y de la IA no se pueden descargar ni sacar del visor. */
  origen: 'catalogo' | 'archivo' | 'ia'
}

/** Más que esto se arrastra en un móvil; los modelos de impresión rara vez lo necesitan. */
export const MAX_TRIANGULOS = 1_500_000
export const ALTURA_POR_DEFECTO = 120

let siguiente = 0
const nuevoId = () => `p${Date.now().toString(36)}${siguiente++}`

/** Lleva la malla a milímetros apoyada en la cama: centrada en X/Y, base en z = 0. */
function asentar(m: Malla, altura?: number) {
  const p = m.pos
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < p.length; i++) {
    const e = i % 3
    if (p[i] < min[e]) min[e] = p[i]
    if (p[i] > max[e]) max[e] = p[i]
  }
  const k = altura ? altura / Math.max(max[2] - min[2], max[0] - min[0], max[1] - min[1], 1e-9) : 1
  const cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2
  for (let i = 0; i < p.length; i += 3) {
    p[i] = (p[i] - cx) * k
    p[i + 1] = (p[i + 1] - cy) * k
    p[i + 2] = (p[i + 2] - min[2]) * k
  }
}

function comprobar(m: Malla) {
  if (!m.color.length) throw new Error('El archivo no tiene triángulos')
  if (m.color.length > MAX_TRIANGULOS)
    throw new Error(`Tiene ${(m.color.length / 1e6).toFixed(1)} M de triángulos; el taller admite hasta ${MAX_TRIANGULOS / 1e6} M. Simplifícalo antes.`)
}

/** Agrupa los colores de la textura en filamentos. */
export function aFilamentos(rgb: Float32Array, pos: Float32Array, k: number): { color: Uint8Array; paleta: Filamento[] } {
  const { paleta, asignacion } = cuantizar(rgb, areas(pos), k)
  return { color: asignacion, paleta: paleta.map((color, i) => ({ color, nombre: `Filamento ${i + 1}` })) }
}

/* ── glTF ──────────────────────────────────────────────────────────────── */

/** Lector de píxeles de una textura, con su repetición y su orientación. */
function muestreador(tex: THREE.Texture) {
  const img = tex.image as CanvasImageSource & { width: number; height: number }
  const ancho = Math.min(img.width, 2048), alto = Math.min(img.height, 2048)
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, ancho, alto)
  const px = ctx.getImageData(0, 0, ancho, alto).data
  tex.updateMatrix() // three la actualiza al pintar; aquí aún no se ha pintado
  const v = new THREE.Vector2()
  return (u: number, w: number, salida: number[]) => {
    v.set(u, w)
    tex.transformUv(v) // repetición, desplazamiento y flipY tal como los pinta three
    const x = Math.min(ancho - 1, Math.max(0, Math.floor(v.x * ancho)))
    const y = Math.min(alto - 1, Math.max(0, Math.floor(v.y * alto)))
    const o = (y * ancho + x) * 4
    salida[0] += px[o] / 255
    salida[1] += px[o + 1] / 255
    salida[2] += px[o + 2] / 255
  }
}

/**
 * Recorre las mallas de una escena y devuelve la geometría en el mundo, con
 * Y arriba pasada a Z arriba, y el color de cada triángulo: textura (media de
 * los tres vértices y el centro), colores de vértice o color del material.
 */
function desdeEscena(raiz: THREE.Object3D): { malla: Malla; rgb: Float32Array } {
  raiz.updateMatrixWorld(true)
  const c = new Constructor()
  const colores: number[] = []
  const muestreadores = new Map<THREE.Texture, ReturnType<typeof muestreador> | null>()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3()

  raiz.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return
    const g = mesh.geometry
    const pos = g.attributes.position
    const uv = g.attributes.uv
    const col = g.attributes.color
    const idx = g.index
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const grupos = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }]

    for (const grupo of grupos) {
      const mat = (mats[grupo.materialIndex ?? 0] ?? mats[0]) as THREE.MeshStandardMaterial
      const base = mat?.color ?? new THREE.Color(1, 1, 1)
      let leer: ReturnType<typeof muestreador> | null = null
      if (mat?.map?.image && uv) {
        if (!muestreadores.has(mat.map)) {
          try {
            muestreadores.set(mat.map, muestreador(mat.map))
          } catch {
            muestreadores.set(mat.map, null)
          }
        }
        leer = muestreadores.get(mat.map)!
      }
      const fin = Math.min(grupo.start + grupo.count, idx ? idx.count : pos.count)
      for (let k = grupo.start; k + 2 < fin; k += 3) {
        const i0 = idx ? idx.getX(k) : k, i1 = idx ? idx.getX(k + 1) : k + 1, i2 = idx ? idx.getX(k + 2) : k + 2
        a.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld)
        b.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld)
        d.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld)
        // glTF tiene Y arriba; los laminadores, Z: (x, y, z) → (x, -z, y).
        c.agregar(a.x, -a.z, a.y, b.x, -b.z, b.y, d.x, -d.z, d.y, 0)

        const s = [0, 0, 0]
        if (leer) {
          const us = [i0, i1, i2].map((i) => [uv.getX(i), uv.getY(i)])
          for (const [u, w] of us) leer(u, w, s)
          leer((us[0][0] + us[1][0] + us[2][0]) / 3, (us[0][1] + us[1][1] + us[2][1]) / 3, s)
          for (let e = 0; e < 3; e++) s[e] /= 4
        } else if (col) {
          for (const i of [i0, i1, i2]) {
            s[0] += col.getX(i) / 3
            s[1] += col.getY(i) / 3
            s[2] += col.getZ(i) / 3
          }
          // Los colores de vértice de three están en lineal; la cuantización trabaja en sRGB.
          const lin = new THREE.Color(s[0], s[1], s[2]).convertLinearToSRGB()
          ;[s[0], s[1], s[2]] = [lin.r, lin.g, lin.b]
        } else [s[0], s[1], s[2]] = [1, 1, 1]
        const m = base.clone().convertLinearToSRGB()
        colores.push(s[0] * m.r, s[1] * m.g, s[2] * m.b)
      }
    }
  })
  return { malla: c.malla(), rgb: new Float32Array(colores) }
}

let cargadorGLTF: GLTFLoader | null = null
function gltf() {
  if (!cargadorGLTF) {
    const draco = new DRACOLoader().setDecoderPath(DRACO)
    cargadorGLTF = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder)
  }
  return cargadorGLTF
}

export async function importarGLB(datos: ArrayBuffer, nombre: string, origen: Proyecto['origen'], filamentos = 6): Promise<Proyecto> {
  const escena = (await gltf().parseAsync(datos, '')).scene
  const { malla, rgb } = desdeEscena(escena)
  comprobar(malla)
  asentar(malla, ALTURA_POR_DEFECTO)
  const { color, paleta } = aFilamentos(rgb, malla.pos, filamentos)
  malla.color = color
  return { id: nuevoId(), nombre, malla, paleta, rgb, origen }
}

/* ── Entrada ───────────────────────────────────────────────────────────── */

export const FORMATOS = ['.3mf', '.stl', '.glb', '.obj'] as const

export async function importarArchivo(f: File): Promise<Proyecto> {
  const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase()
  const nombre = f.name.replace(/\.[^.]+$/, '')
  if (f.size > 150 * 1048576) throw new Error('El archivo pesa más de 150 MB')
  const datos = await f.arrayBuffer()

  if (ext === '.3mf') {
    const { malla, paleta } = await leer3MF(new Uint8Array(datos))
    comprobar(malla)
    asentar(malla)
    return { id: nuevoId(), nombre, malla, paleta, origen: 'archivo' }
  }
  if (ext === '.glb' || ext === '.gltf') return importarGLB(datos, nombre, 'archivo')
  if (ext === '.stl') {
    const g = new STLLoader().parse(datos)
    const p = g.attributes.position.array as Float32Array
    const malla: Malla = { pos: new Float32Array(p), color: new Uint8Array(p.length / 9) }
    comprobar(malla)
    asentar(malla) // el STL ya viene en milímetros y con Z arriba
    // STL binario con color por cara (extensión VisCAM/SolidView).
    const col = g.attributes.color
    if (col) {
      const rgb = new Float32Array(malla.color.length * 3)
      for (let t = 0; t < malla.color.length; t++) rgb.set([col.getX(t * 3), col.getY(t * 3), col.getZ(t * 3)], t * 3)
      const r = aFilamentos(rgb, malla.pos, 6)
      return { id: nuevoId(), nombre, malla: { ...malla, color: r.color }, paleta: r.paleta, rgb, origen: 'archivo' }
    }
    return { id: nuevoId(), nombre, malla, paleta: [{ color: FILAMENTOS[0], nombre: 'Filamento 1' }], origen: 'archivo' }
  }
  if (ext === '.obj') {
    const { malla, rgb } = desdeEscena(new OBJLoader().parse(new TextDecoder().decode(datos)))
    comprobar(malla)
    asentar(malla, ALTURA_POR_DEFECTO)
    const unico = rgb.every((x, i) => x === rgb[i % 3])
    if (unico) return { id: nuevoId(), nombre, malla, paleta: [{ color: aHex(rgb[0], rgb[1], rgb[2]), nombre: 'Filamento 1' }], origen: 'archivo' }
    const r = aFilamentos(rgb, malla.pos, 6)
    return { id: nuevoId(), nombre, malla: { ...malla, color: r.color }, paleta: r.paleta, rgb, origen: 'archivo' }
  }
  throw new Error(`Formato no soportado. Usa ${FORMATOS.join(', ')}`)
}

export async function importarURL(url: string, nombre: string): Promise<Proyecto> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`No se pudo cargar ${nombre} (${r.status})`)
  return importarGLB(await r.arrayBuffer(), nombre, 'catalogo')
}
