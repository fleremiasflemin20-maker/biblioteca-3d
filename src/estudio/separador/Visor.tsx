import { useEffect, useMemo } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Bounds, GizmoHelper, GizmoViewport, Grid, OrbitControls, useBounds } from '@react-three/drei'
import * as THREE from 'three'
import { geometria } from '../editor/mallas.ts'
import { AmbienteFlemin } from '../luces.tsx'
import { IMPRESORAS } from '../geo/tipos.ts'
import { planoActual } from './acciones.ts'
import { camaraVisor, medir, useSeparador, type PiezaSep } from './estado.ts'

/**
 * El visor de piezas: cada pieza en su color, en su sitio o en despiece, y
 * el plano de corte en vivo mientras se mueve el deslizador.
 */
const NARANJA = '#FF6A13'

function centro(p: PiezaSep) {
  const a = medir(p.malla)
  return new THREE.Vector3((a.min[0] + a.max[0]) / 2, (a.min[1] + a.max[1]) / 2, (a.min[2] + a.max[2]) / 2)
}

function Piezas() {
  const piezas = useSeparador((s) => s.piezas)
  const seleccion = useSeparador((s) => s.seleccion)
  const explosion = useSeparador((s) => s.explosion)
  const paso = useSeparador((s) => s.paso)
  const corte = useSeparador((s) => s.corte)
  const modoCorte = useSeparador((s) => s.modoCorte)

  // Despiece: cada pieza se aleja del centro común en la dirección de su
  // propio centro. En el paso de corte, a lo largo de la normal del plano,
  // cada una hacia su lado, como la vista previa de corte de Bambu Studio.
  const desplazamientos = useMemo(() => {
    // Con el boceto, todo en su sitio: lo que se dibuja es lo que se corta.
    if (paso === 'corte' && modoCorte === 'boceto') return piezas.map(() => new THREE.Vector3())
    const actual = paso === 'corte' ? planoActual() : null
    if (actual) {
      const n = new THREE.Vector3(...actual.plano.normal).normalize()
      const o = new THREE.Vector3(...actual.plano.punto)
      const tam = Math.hypot(...actual.max.map((x, i) => x - actual.min[i]))
      return piezas.map((p) => n.clone().multiplyScalar(Math.sign(centro(p).sub(o).dot(n)) * tam * 0.12))
    }
    const centros = piezas.map(centro)
    const total = new THREE.Box3()
    for (const p of piezas) {
      const a = medir(p.malla)
      total.expandByPoint(new THREE.Vector3(...a.min)).expandByPoint(new THREE.Vector3(...a.max))
    }
    const c = total.getCenter(new THREE.Vector3())
    const tam = total.getSize(new THREE.Vector3()).length()
    return centros.map((x) => {
      const d = x.clone().sub(c)
      if (d.lengthSq() < 1e-6) d.set(0, 0, 1)
      return d.normalize().multiplyScalar(tam * 0.35)
    })
  }, [piezas, paso, corte, modoCorte])

  const alClic = (id: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const s = useSeparador.getState()
    if (e.shiftKey || e.metaKey || e.ctrlKey) s.set({ seleccion: s.seleccion.includes(id) ? s.seleccion.filter((x) => x !== id) : [...s.seleccion, id] })
    else s.set({ seleccion: [id] })
  }

  return (
    <>
      {piezas.map((p, i) =>
        p.visible ? (
          <mesh key={p.id} geometry={geometria(p.malla)} position={desplazamientos[i].clone().multiplyScalar(explosion)} onClick={alClic(p.id)}>
            <meshStandardMaterial
              color={p.color}
              roughness={0.55}
              metalness={0.05}
              emissive={seleccion.includes(p.id) ? NARANJA : '#000000'}
              emissiveIntensity={seleccion.includes(p.id) ? 0.25 : 0}
            />
          </mesh>
        ) : null,
      )}
    </>
  )
}

/** El plano de corte: translúcido, con borde naranja y una rejilla para leer su inclinación. */
function PlanoCorte() {
  const paso = useSeparador((s) => s.paso)
  const corte = useSeparador((s) => s.corte)
  const piezas = useSeparador((s) => s.piezas)
  const seleccion = useSeparador((s) => s.seleccion)
  const modoCorte = useSeparador((s) => s.modoCorte)
  const datos = useMemo(() => (paso === 'corte' && modoCorte === 'plano' ? planoActual() : null), [paso, corte, piezas, seleccion, modoCorte])
  if (!datos) return null
  const { plano, min, max } = datos
  const tam = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 1.15
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...plano.normal).normalize())
  return (
    <group position={plano.punto} quaternion={q}>
      <mesh renderOrder={2}>
        <planeGeometry args={[tam, tam]} />
        <meshBasicMaterial color={NARANJA} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments renderOrder={3}>
        <edgesGeometry args={[new THREE.PlaneGeometry(tam, tam)]} />
        <lineBasicMaterial color={NARANJA} />
      </lineSegments>
      <gridHelper args={[tam, 10, NARANJA, NARANJA]} rotation={[Math.PI / 2, 0, 0]} material-transparent material-opacity={0.25} />
    </group>
  )
}

/** Encuadra de nuevo cuando cambia el modelo (no en cada corte, para no marear). */
function Encuadre() {
  const nombre = useSeparador((s) => s.nombre)
  const bounds = useBounds()
  useEffect(() => {
    const t = setTimeout(() => bounds.refresh().clip().fit(), 80)
    return () => clearTimeout(t)
  }, [nombre, bounds])
  return null
}

function Cama() {
  const imp = useSeparador((s) => IMPRESORAS.find((i) => i.id === s.impresora) ?? IMPRESORAS[0])
  const piezas = useSeparador((s) => s.piezas)
  // La cama va bajo el punto más bajo de las piezas.
  const z = useMemo(() => Math.min(0, ...piezas.map((p) => medir(p.malla).min[2])), [piezas])
  return (
    <Grid
      args={[imp.cama[0], imp.cama[1]]}
      position={[0, 0, z - 0.05]}
      rotation={[Math.PI / 2, 0, 0]}
      cellSize={10}
      cellThickness={0.6}
      cellColor="#3A2F4D"
      sectionSize={50}
      sectionThickness={1.1}
      sectionColor="#6B4FA0"
      fadeDistance={3000}
    />
  )
}

/** Deja a mano la cámara y el centro de la vista, para el corte con boceto. */
function Camara() {
  // La cámara y el objetivo de los controles cambian en el sitio: basta con guardar las referencias.
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null
  useEffect(() => {
    camaraVisor.camara = camera as THREE.PerspectiveCamera
    camaraVisor.objetivo = controls?.target ?? null
  }, [camera, controls])
  return null
}

function Fondo() {
  const { gl } = useThree()
  useEffect(() => gl.setClearColor('#0D0A14'), [gl])
  return null
}

export function VisorPiezas() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [160, -220, 160], fov: 38, near: 0.5, far: 8000, up: [0, 0, 1] }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onPointerMissed={(e) => e.type === 'click' && !e.shiftKey && useSeparador.getState().set({ seleccion: [] })}
    >
      <Fondo />
      <ambientLight intensity={0.3} />
      <directionalLight position={[120, -160, 260]} intensity={1.5} />
      <AmbienteFlemin ambiente="estudio" />
      <Cama />
      <Bounds margin={1.3}>
        <Piezas />
        <Encuadre />
      </Bounds>
      <PlanoCorte />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} />
      <Camara />
      <GizmoHelper alignment="top-right" margin={[60, 60]}>
        <GizmoViewport axisColors={['#FF4D4D', '#1FBF8F', '#2FA8FF']} labelColor="#0D0A14" />
      </GizmoHelper>
    </Canvas>
  )
}
