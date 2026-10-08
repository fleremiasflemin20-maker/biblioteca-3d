import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { DRACO, rutaModelo, rutaTextura, type Modelo3D } from '../lib/catalogo'
import { OPCIONES_INICIALES, PALETAS, construirLlavero, type OpcionesLlavero } from '../lib/llavero'

/**
 * Carga de un modelo del catálogo — la misma lógica que `ModeloPersonaje.tsx`
 * del portafolio: un `.glb` con el material horneado se pinta tal cual, y un
 * escaneo con mapas PBR sueltos se monta a mano.
 *
 * `modo` es lo que el comprador quiere inspeccionar: el acabado, o la malla.
 */
export type Modo = 'textura' | 'malla' | 'arcilla'

function aplicarModo(raiz: THREE.Object3D, modo: Modo) {
  raiz.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    // Se guarda el material original la primera vez para poder volver a él.
    mesh.userData.original ??= mesh.material
    if (modo === 'textura') mesh.material = mesh.userData.original
    else if (modo === 'malla') mesh.material = new THREE.MeshBasicMaterial({ color: '#0E9F93', wireframe: true, transparent: true, opacity: 0.6 })
    else mesh.material = new THREE.MeshStandardMaterial({ color: '#d9d4cc', roughness: 0.75 })
  })
}

function Simple({ modelo, modo, separado = false }: { modelo: Modelo3D; modo: Modo; separado?: boolean }) {
  const { scene } = useGLTF(rutaModelo(modelo), DRACO)
  // Copia propia: la misma pieza puede estar a la vez en la portada y en la
  // ficha, y un objeto de three.js solo puede colgar de una escena.
  const copia = useMemo(() => scene.clone(true), [scene])
  useLayoutEffect(() => aplicarModo(copia, modo), [copia, modo])

  // Vista por partes: cada pieza se aleja por donde se saca (`salida`) o, si
  // no la trae, hacia delante (+Z, el frente de la placa) en el orden en que
  // se monta, como un despiece de instrucciones.
  const capas = useMemo(() => {
    if (!modelo.piezas) return []
    const caja = new THREE.Box3()
    copia.traverse((o) => {
      const g = (o as THREE.Mesh).geometry
      if (!(o as THREE.Mesh).isMesh || !g) return
      g.computeBoundingBox()
      caja.union(g.boundingBox!)
    })
    const tam = caja.getSize(new THREE.Vector3())
    const paso = Math.max(tam.x, tam.y, tam.z) * 0.22
    // `salida` se mide con los nodos ya colocados: en un .glb cuantizado la
    // geometría viene en su propia escala y la del nodo la corrige.
    copia.updateMatrixWorld(true)
    const real = new THREE.Box3().setFromObject(copia).getSize(new THREE.Vector3())
    const lado = Math.max(real.x, real.y, real.z)
    return [...copia.children]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .map((o, i) => {
        const base = o.position.clone()
        const salida = modelo.piezas![i]?.salida
        const lejos = salida
          ? base.clone().addScaledVector(new THREE.Vector3(...salida), lado)
          : base.clone().setZ(base.z + i * paso)
        return { o, base, lejos }
      })
  }, [copia, modelo.piezas])

  useFrame((_, dt) => {
    // Mismo amortiguado que `MathUtils.damp` (λ = 5), en los tres ejes.
    const t = 1 - Math.exp(-5 * dt)
    for (const c of capas) c.o.position.lerp(separado ? c.lejos : c.base, t)
  })

  return <primitive object={copia} />
}

function PBR({ modelo, modo }: { modelo: Modelo3D; modo: Modo }) {
  const { scene } = useGLTF(rutaModelo(modelo), DRACO)
  const t = modelo.texturas!
  const maps = useTexture({
    map: rutaTextura(modelo, t.map),
    normalMap: rutaTextura(modelo, t.normalMap),
    roughnessMap: rutaTextura(modelo, t.roughnessMap),
    metalnessMap: rutaTextura(modelo, t.metalnessMap),
  })

  const geometry = useMemo(() => {
    let hallada: THREE.BufferGeometry | null = null
    scene.traverse((o) => {
      if (!hallada && (o as THREE.Mesh).isMesh) hallada = (o as THREE.Mesh).geometry
    })
    return hallada
  }, [scene])

  useLayoutEffect(() => {
    for (const [slot, tex] of Object.entries(maps) as [keyof typeof maps, THREE.Texture][]) {
      // glTF pone el origen de UV arriba a la izquierda; sin esto sale del revés.
      tex.flipY = false
      tex.colorSpace = slot === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace
      tex.needsUpdate = true
    }
  }, [maps])

  if (!geometry) return null
  return (
    <mesh geometry={geometry}>
      {modo === 'textura' && <meshStandardMaterial {...maps} />}
      {modo === 'malla' && <meshBasicMaterial color="#0E9F93" wireframe transparent opacity={0.6} />}
      {modo === 'arcilla' && <meshStandardMaterial color="#d9d4cc" roughness={0.75} />}
    </mesh>
  )
}

/** El llavero con nombre no viene de un `.glb`: se construye con lo que escribe el cliente. */
function LlaveroNombre({ opciones, modo }: { opciones: OpcionesLlavero; modo: Modo }) {
  const piezas = useMemo(() => construirLlavero(opciones), [opciones])
  useEffect(() => () => [piezas.placa, piezas.texto, piezas.icono].forEach((g) => g?.dispose()), [piezas])
  const p = PALETAS[opciones.paleta]
  const material = (color: string) =>
    modo === 'malla' ? <meshBasicMaterial color="#0E9F93" wireframe transparent opacity={0.6} />
    : modo === 'arcilla' ? <meshStandardMaterial color="#d9d4cc" roughness={0.75} />
    : <meshStandardMaterial color={color} roughness={0.45} />
  return (
    <group>
      <mesh geometry={piezas.placa}>{material(p.placa)}</mesh>
      <mesh geometry={piezas.texto}>{material(p.texto)}</mesh>
      {piezas.icono && <mesh geometry={piezas.icono}>{material(p.icono)}</mesh>}
    </group>
  )
}

export function Pieza({
  modelo,
  modo = 'textura',
  opciones,
  separado,
}: {
  modelo: Modelo3D
  modo?: Modo
  opciones?: OpcionesLlavero
  /** Solo para piezas con `piezas`: las enseña desmontadas. */
  separado?: boolean
}) {
  if (modelo.personalizable) return <LlaveroNombre opciones={opciones ?? OPCIONES_INICIALES} modo={modo} />
  return modelo.texturas ? <PBR modelo={modelo} modo={modo} /> : <Simple modelo={modelo} modo={modo} separado={separado} />
}

/**
 * Avisa cuando la pieza terminó de cargar. El "Cargando…" se pinta fuera del
 * lienzo: `<Html>` de drei dentro de un fallback de Suspense desmonta su
 * propia raíz de React a mitad de un render, y React 19 lo rompe.
 */
export function AlCargar({ onListo }: { onListo: () => void }) {
  useEffect(() => onListo(), [onListo])
  return null
}

/** Cuenta triángulos de lo que haya cargado: la ficha lo enseña como dato de venta. */
export function contarTriangulos(raiz: THREE.Object3D) {
  let n = 0
  raiz.traverse((o) => {
    const g = (o as THREE.Mesh).geometry
    if (!(o as THREE.Mesh).isMesh || !g) return
    n += (g.index ? g.index.count : g.attributes.position.count) / 3
  })
  return Math.round(n)
}
