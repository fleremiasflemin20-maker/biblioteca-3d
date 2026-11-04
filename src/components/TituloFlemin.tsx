import { Component, Suspense, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { DRACO } from '../lib/catalogo'

/**
 * El título de la pantalla de inicio en 3D: las letras de Meshy "Biblioteca
 * Flemin 3D" (sin la g de "Fleming", que se cortó de la malla y el "3D" se
 * corrió para cerrar el hueco). Cada letra es un nodo `L_…` del .glb, en
 * orden de lectura. Entran una por una volando desde fuera de cuadro, y al
 * llegar la última todas se encienden a la vez y se funden en el título.
 */
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
const RUTA = `${BASE}/titulo/biblioteca-flemin-3d.glb`
useGLTF.preload(RUTA, DRACO)

const INICIO = 0.3 // s antes de la primera letra
const PASO = 0.11 // s entre letra y letra
const VUELO = 0.8 // s que tarda cada letra en llegar
const FUSION = 0.9 // s del destello final
const FUEGO = new THREE.Color('#FF8A1F')

const suave = (x: number) => 1 - Math.pow(1 - x, 3)
const rebote = (x: number) => {
  const c = 1.9
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)
}
// Azar fijo por letra: la entrada es igual en cada visita y no rompe la pureza del render.
const azar = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x)
}
const tramo = (t: number, a: number, d: number) => Math.min(1, Math.max(0, (t - a) / d))

type Letra = {
  malla: THREE.Mesh
  mat: THREE.MeshStandardMaterial
  sitio: THREE.Vector3
  desde: THREE.Vector3
  giro: THREE.Euler
  llegada: number
}

function Letras({ onFusion }: { onFusion: () => void }) {
  const { scene } = useGLTF(RUTA, DRACO)
  const grupo = useRef<THREE.Group>(null)
  const reloj = useRef(0)
  const fundido = useRef(false)
  const quieto = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const { camera, size } = useThree()

  const { raiz, letras, caja } = useMemo(() => {
    // El .glb viene cuantizado (meshopt): cada nodo lleva escala y desplazamiento.
    // Se hornea la transformación en geometría de coma flotante y se cuelga cada
    // letra directamente del grupo raíz, centrada en su propio origen.
    scene.updateMatrixWorld(true)
    const raiz = new THREE.Group()
    const mallas: THREE.Mesh[] = []
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const geo = new THREE.BufferGeometry()
      const pos = m.geometry.attributes.position
      const xyz = new Float32Array(pos.count * 3)
      for (let k = 0; k < pos.count; k++) xyz.set([pos.getX(k), pos.getY(k), pos.getZ(k)], k * 3)
      geo.setAttribute('position', new THREE.BufferAttribute(xyz, 3))
      if (m.geometry.attributes.uv) geo.setAttribute('uv', m.geometry.attributes.uv)
      if (m.geometry.index) geo.setIndex(m.geometry.index)
      geo.applyMatrix4(m.matrixWorld)
      const nueva = new THREE.Mesh(geo, m.material)
      nueva.name = m.name
      mallas.push(nueva)
      raiz.add(nueva)
    })
    const caja = new THREE.Box3().setFromObject(raiz)
    const centro = caja.getCenter(new THREE.Vector3())
    caja.translate(centro.clone().negate())
    const n = mallas.length
    const letras: Letra[] = mallas.map((malla, i) => {
      // Las mallas de Meshy vienen sin normales: se calculan para que la luz las modele.
      malla.geometry.computeVertexNormals()
      // Cada letra gira sobre su propio centro.
      malla.geometry.computeBoundingBox()
      const sitio = malla.geometry.boundingBox!.getCenter(new THREE.Vector3())
      malla.geometry.translate(-sitio.x, -sitio.y, -sitio.z)
      sitio.sub(centro)
      const base = malla.material as THREE.MeshStandardMaterial
      const mat = base.clone()
      mat.metalness = 0
      mat.roughness = 0.5
      mat.emissive = FUEGO.clone()
      mat.emissiveMap = base.map
      mat.emissiveIntensity = 0
      malla.material = mat
      // Cada letra sale de un punto distinto: alterna lados, arriba/abajo y profundidad.
      const lado = i % 2 ? 1 : -1
      const a = (i / n) * Math.PI * 2
      const desde = new THREE.Vector3(lado * (0.9 + azar(i, 1) * 0.7), Math.sin(a) * 0.7, -(2.5 + azar(i, 2) * 2.5))
      const giro = new THREE.Euler((azar(i, 3) - 0.5) * 3, lado * (1.5 + azar(i, 4) * 1.5), (azar(i, 5) - 0.5) * 2)
      return { malla, mat, sitio, desde, giro, llegada: INICIO + i * PASO + VUELO }
    })
    return { raiz, letras, caja }
  }, [scene])

  // Encuadre: que el título entero quepa con un poco de aire, sea cual sea el ancho.
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const v = caja.getSize(new THREE.Vector3())
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const aspecto = size.width / Math.max(1, size.height)
    const d = Math.max(v.y / (2 * t), v.x / (2 * t * aspecto)) * 1.12 + v.z
    cam.position.set(0, 0, d)
    cam.lookAt(0, 0, 0)
    cam.updateProjectionMatrix()
  }, [camera, caja, size])

  useFrame((_, dt) => {
    reloj.current += quieto ? 99 : Math.min(dt, 1 / 20)
    // En desarrollo, ?titulo_t=1.2 congela la animación en ese segundo para revisarla.
    const fijo = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('titulo_t') ?? NaN) : NaN
    const t = Number.isNaN(fijo) ? reloj.current : fijo
    const fin = INICIO + (letras.length - 1) * PASO + VUELO
    const f = tramo(t, fin, FUSION) // 0→1 durante la fusión
    const pulso = f > 0 && f < 1 ? Math.sin(f * Math.PI) : 0

    letras.forEach((l, i) => {
      const p = tramo(t, INICIO + i * PASO, VUELO)
      const e = rebote(p)
      const resto = 1 - e
      l.malla.visible = p > 0
      l.malla.position.set(l.sitio.x + l.desde.x * resto, l.sitio.y + l.desde.y * resto, l.sitio.z + l.desde.z * resto)
      l.malla.rotation.set(l.giro.x * resto, l.giro.y * resto, l.giro.z * resto)
      l.malla.scale.setScalar(0.25 + 0.75 * suave(p))
      // Destello al tocar su sitio y el gran encendido de la fusión.
      const toque = Math.max(0, 1 - Math.abs(t - l.llegada) / 0.25)
      l.mat.emissiveIntensity = (p < 1 ? 0.55 * (1 - p) : 0) + toque * 0.9 + pulso * 1.4
    })

    if (f > 0 && !fundido.current) {
      fundido.current = true
      onFusion()
    }
    const g = grupo.current
    if (g) {
      // Golpe de la fusión y luego un balanceo suave, como un logo vivo.
      const reposo = Math.max(0, t - fin - FUSION)
      g.scale.setScalar(1 + pulso * 0.06)
      g.rotation.y = Math.sin(reposo * 0.7) * 0.14 * Math.min(1, reposo)
      g.rotation.x = Math.sin(reposo * 0.5) * 0.05 * Math.min(1, reposo)
      g.position.y = Math.sin(reposo * 1.1) * 0.015
    }
  })

  return (
    <group ref={grupo}>
      <primitive object={raiz} />
    </group>
  )
}

class SinWebGL extends Component<{ children: ReactNode; respaldo: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    return this.state.error ? this.props.respaldo : this.props.children
  }
}

export function TituloFlemin({ respaldo }: { respaldo: ReactNode }) {
  const [fusion, setFusion] = useState(false)
  return (
    <SinWebGL respaldo={respaldo}>
      <div className="titulo-3d relative mt-1 h-[clamp(11rem,50vw,30rem)] w-[min(96vw,64rem)]">
        {fusion && <div aria-hidden className="fusion-onda pointer-events-none absolute left-1/2 top-1/2" />}
        <Canvas flat dpr={[1, 2]} camera={{ fov: 30, near: 0.1, far: 50 }} gl={{ alpha: true, antialias: true }} fallback={respaldo}>
          <ambientLight intensity={1.6} />
          <directionalLight position={[0.5, 1, 3]} intensity={1.6} />
          <pointLight position={[-2, -1, 1.5]} intensity={3} color="#FF6A13" />
          <Suspense fallback={null}>
            <Letras onFusion={() => setFusion(true)} />
          </Suspense>
        </Canvas>
      </div>
    </SinWebGL>
  )
}
