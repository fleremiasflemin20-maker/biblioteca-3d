import { useEffect, useLayoutEffect, useMemo } from 'react'
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
    else if (modo === 'malla') mesh.material = new THREE.MeshBasicMaterial({ color: '#3BE0D0', wireframe: true, transparent: true, opacity: 0.55 })
    else mesh.material = new THREE.MeshStandardMaterial({ color: '#d9d4cc', roughness: 0.75 })
  })
}

function Simple({ modelo, modo }: { modelo: Modelo3D; modo: Modo }) {
  const { scene } = useGLTF(rutaModelo(modelo), DRACO)
  // Copia propia: la misma pieza puede estar a la vez en la portada y en la
  // ficha, y un objeto de three.js solo puede colgar de una escena.
  const copia = useMemo(() => scene.clone(true), [scene])
  useLayoutEffect(() => aplicarModo(copia, modo), [copia, modo])
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
      {modo === 'malla' && <meshBasicMaterial color="#3BE0D0" wireframe transparent opacity={0.55} />}
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
    modo === 'malla' ? <meshBasicMaterial color="#3BE0D0" wireframe transparent opacity={0.55} />
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

export function Pieza({ modelo, modo = 'textura', opciones }: { modelo: Modelo3D; modo?: Modo; opciones?: OpcionesLlavero }) {
  if (modelo.personalizable) return <LlaveroNombre opciones={opciones ?? OPCIONES_INICIALES} modo={modo} />
  return modelo.texturas ? <PBR modelo={modelo} modo={modo} /> : <Simple modelo={modelo} modo={modo} />
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
