import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { GizmoHelper, GizmoViewport, Grid, Html, Line, OrbitControls, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { IMPRESORAS } from '../geo/tipos.ts'
import { actualizar, transformarGrupo } from './acciones.ts'
import { cajaMundo, desdeMatriz, useEditor, type NodoEditor } from './estado.ts'
import { geometria, useMallaLocal } from './mallas.ts'
import { camara, type Vista } from './camara.ts'
import { AmbienteFlemin } from '../luces.tsx'

/**
 * El visor del editor: la cama de la impresora en milímetros, con Z hacia
 * arriba como en el laminador, los objetos, el gizmo y la regla.
 */
const NARANJA = '#FF6A13'
const objetos = new Map<string, THREE.Object3D>()

/* ── Cámara: vistas y encuadre, llamables desde fuera del Canvas ───────── */


function ControlCamara() {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: { target: THREE.Vector3; update: () => void } | null }
  const imp = useEditor((s) => IMPRESORAS.find((i) => i.id === s.impresora) ?? IMPRESORAS[0])
  useEffect(() => {
    const animar = (pos: THREE.Vector3, objetivo: THREE.Vector3) => {
      const p0 = camera.position.clone(), t0 = controls?.target.clone() ?? new THREE.Vector3()
      const inicio = performance.now()
      const paso = (ahora: number) => {
        const k = Math.min(1, (ahora - inicio) / 450)
        const e = 1 - (1 - k) ** 3
        camera.position.lerpVectors(p0, pos, e)
        controls?.target.lerpVectors(t0, objetivo, e)
        controls?.update()
        if (k < 1) requestAnimationFrame(paso)
      }
      requestAnimationFrame(paso)
    }
    const centroEscena = () => {
      const { nodos, seleccion } = useEditor.getState()
      const s = new Set(seleccion)
      const lista = nodos.filter((n) => n.visible && (!s.size || s.has(n.id)))
      const caja = new THREE.Box3()
      for (const n of lista) {
        const o = objetos.get(n.id)
        if (o) caja.expandByObject(o)
      }
      if (caja.isEmpty()) caja.set(new THREE.Vector3(-imp.cama[0] / 4, -imp.cama[1] / 4, 0), new THREE.Vector3(imp.cama[0] / 4, imp.cama[1] / 4, 40))
      return { centro: caja.getCenter(new THREE.Vector3()), radio: Math.max(15, caja.getBoundingSphere(new THREE.Sphere()).radius) }
    }
    const dirs: Record<Vista, THREE.Vector3> = {
      iso: new THREE.Vector3(0.75, -1, 0.75),
      frente: new THREE.Vector3(0, -1, 0.001),
      atras: new THREE.Vector3(0, 1, 0.001),
      arriba: new THREE.Vector3(0, -0.001, 1),
      derecha: new THREE.Vector3(1, 0, 0.001),
      izquierda: new THREE.Vector3(-1, 0, 0.001),
    }
    camara.ir = (v) => {
      const { centro, radio } = centroEscena()
      const d = radio / Math.sin((camera.fov * Math.PI) / 360) * 1.15
      animar(centro.clone().add(dirs[v].clone().normalize().multiplyScalar(d)), centro)
    }
    camara.encuadrar = () => {
      const { centro, radio } = centroEscena()
      const dir = camera.position.clone().sub(controls?.target ?? new THREE.Vector3()).normalize()
      animar(centro.clone().add(dir.multiplyScalar((radio / Math.sin((camera.fov * Math.PI) / 360)) * 1.15)), centro)
    }
  }, [camera, controls, imp])
  return null
}

/* ── Luces (los "environment presets" de Spline/Vectary) ───────────────── */

function Luces() {
  const luz = useEditor((s) => s.luz)
  return (
    <>
      <ambientLight intensity={luz === 'neutra' ? 0.7 : 0.25} />
      <directionalLight position={[120, -160, 260]} intensity={luz === 'noche' ? 0.6 : 1.6} castShadow={false} />
      {luz === 'noche' && (
        <>
          <pointLight position={[-150, 60, 120]} intensity={60000} color="#8A3CFF" />
          <pointLight position={[150, 80, 60]} intensity={50000} color="#2FA8FF" />
          <pointLight position={[0, -180, 40]} intensity={40000} color={NARANJA} />
        </>
      )}
      {luz === 'neutra' && <directionalLight position={[-100, 120, 80]} intensity={0.6} />}
      {luz !== 'neutra' && <AmbienteFlemin ambiente={luz === 'noche' ? 'neon' : luz} intensidad={luz === 'noche' ? 0.6 : 1} />}
    </>
  )
}

/* ── La cama ──────────────────────────────────────────────────────────── */

function Cama() {
  const imp = useEditor((s) => IMPRESORAS.find((i) => i.id === s.impresora) ?? IMPRESORAS[0])
  const [x, y, z] = imp.cama
  const borde = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(x, y, z)), [x, y, z])
  return (
    <group>
      <mesh position={[0, 0, -0.05]} receiveShadow onClick={(e) => e.stopPropagation()} name="cama">
        <planeGeometry args={[x, y]} />
        <meshStandardMaterial color="#17121F" roughness={0.9} />
      </mesh>
      <Grid
        args={[x, y]}
        rotation={[Math.PI / 2, 0, 0]}
        cellSize={10}
        cellThickness={0.6}
        cellColor="#3A2F4D"
        sectionSize={50}
        sectionThickness={1.1}
        sectionColor="#6B4FA0"
        fadeDistance={4000}
        position={[0, 0, 0.01]}
      />
      <lineSegments geometry={borde} position={[0, 0, z / 2]}>
        <lineBasicMaterial color="#8A3CFF" transparent opacity={0.22} />
      </lineSegments>
      {/* Frente de la cama, como en el laminador. */}
      <Html position={[0, -y / 2 - 6, 0]} center className="pointer-events-none select-none whitespace-nowrap font-chakra text-[11px] uppercase tracking-[0.2em] text-white/35">
        {imp.nombre} · {x} × {y} × {z} mm
      </Html>
    </group>
  )
}

/* ── Objetos ──────────────────────────────────────────────────────────── */

/** Pinta en rojo las caras que miran hacia abajo más de 45°: las que piden soporte. */
function conVoladizos(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vNormalMundo;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvNormalMundo = normalize(mat3(modelMatrix) * objectNormal);')
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vNormalMundo;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nif (vNormalMundo.z < -0.7071) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.12, 0.08), 0.8);')
  }
  m.customProgramCacheKey = () => 'voladizo'
  return m
}

function ObjetoNodo({ n, elegido }: { n: NodoEditor; elegido: boolean }) {
  const { malla } = useMallaLocal(n)
  const voladizos = useEditor((s) => s.voladizos)
  const alambre = useEditor((s) => s.alambre)
  const herramienta = useEditor((s) => s.herramienta)
  const grupo = useRef<THREE.Group>(null)
  const geo = useMemo(() => (malla ? geometria(malla) : null), [malla])

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: n.hueco ? '#9AA5B1' : n.color,
      roughness: 0.55,
      metalness: 0.05,
      transparent: n.hueco,
      opacity: n.hueco ? 0.33 : 1,
      depthWrite: !n.hueco,
      wireframe: alambre,
      emissive: new THREE.Color(elegido ? NARANJA : '#000000'),
      emissiveIntensity: elegido ? 0.18 : 0,
      side: n.hueco ? THREE.DoubleSide : THREE.FrontSide,
    })
    return voladizos && !n.hueco ? conVoladizos(m) : m
  }, [n.color, n.hueco, voladizos, alambre, elegido])
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    const g = grupo.current
    if (!g) return
    objetos.set(n.id, g)
    return () => {
      if (objetos.get(n.id) === g) objetos.delete(n.id)
    }
  }, [n.id])

  const alClic = (e: ThreeEvent<MouseEvent>) => {
    if (herramienta === 'medir') return
    e.stopPropagation()
    if (n.bloqueado) return
    useEditor.getState().seleccionar([n.id], e.shiftKey || e.metaKey || e.ctrlKey)
  }

  if (!n.visible) return null
  return (
    <group ref={grupo} name={n.id} position={n.pos} rotation={n.rot.map((r) => (r * Math.PI) / 180) as [number, number, number]} scale={n.esc}>
      {geo && (
        <mesh geometry={geo} material={material} onClick={alClic} userData={{ nodo: n.id }} renderOrder={n.hueco ? 1 : 0}>
          {elegido && geo.index === null && (geo.attributes.position.count < 180_000) && (
            <lineSegments>
              <edgesGeometry args={[geo, 35]} />
              <lineBasicMaterial color={NARANJA} />
            </lineSegments>
          )}
        </mesh>
      )}
    </group>
  )
}

/* ── Gizmo ────────────────────────────────────────────────────────────── */

function Gizmo() {
  const seleccion = useEditor((s) => s.seleccion)
  const nodos = useEditor((s) => s.nodos)
  const herramienta = useEditor((s) => s.herramienta)
  const rejilla = useEditor((s) => s.rejilla)
  const pivote = useMemo(() => new THREE.Object3D(), [])
  const inicio = useRef(new THREE.Matrix4())
  const [, refrescar] = useState(0)

  const elegidos = nodos.filter((n) => seleccion.includes(n.id) && n.visible && !n.bloqueado)
  const uno = elegidos.length === 1 ? objetos.get(elegidos[0].id) : undefined

  // El pivote del grupo va al centro de los objetos elegidos.
  const claveGrupo = elegidos.map((n) => `${n.id}:${n.pos}`).join('|')
  useEffect(() => {
    if (elegidos.length < 2) return
    const c = new THREE.Vector3()
    for (const n of elegidos) c.add(new THREE.Vector3(...n.pos))
    pivote.position.copy(c.divideScalar(elegidos.length))
    pivote.rotation.set(0, 0, 0)
    pivote.scale.set(1, 1, 1)
    pivote.updateMatrix()
    refrescar((x) => x + 1)
  }, [claveGrupo, pivote])

  // Al montar un objeto nuevo, su grupo aparece después del render: se vuelve a mirar.
  useEffect(() => {
    if (elegidos.length === 1 && !uno) {
      const t = requestAnimationFrame(() => refrescar((x) => x + 1))
      return () => cancelAnimationFrame(t)
    }
  })

  if (!elegidos.length || herramienta === 'medir') return null
  const objeto = elegidos.length === 1 ? uno : pivote
  if (!objeto) return null
  const modo = herramienta === 'rotar' ? 'rotate' : herramienta === 'escalar' ? 'scale' : 'translate'
  return (
    <>
      {elegidos.length > 1 && <primitive object={pivote} />}
      <TransformControls
        object={objeto}
        mode={modo}
        space={modo === 'scale' ? 'local' : 'world'}
        size={0.85}
        translationSnap={rejilla || null}
        rotationSnap={rejilla ? Math.PI / 12 : null}
        scaleSnap={rejilla ? 0.05 : null}
        onMouseDown={() => {
          objeto.updateMatrix()
          inicio.current.copy(objeto.matrix)
        }}
        onMouseUp={() => {
          objeto.updateMatrix()
          if (objeto.matrix.equals(inicio.current)) return
          if (elegidos.length === 1) actualizar(elegidos[0].id, desdeMatriz(objeto.matrix))
          else transformarGrupo(elegidos.map((n) => n.id), objeto.matrix.clone().multiply(inicio.current.clone().invert()))
        }}
      />
    </>
  )
}

/* ── Regla ────────────────────────────────────────────────────────────── */

function Regla() {
  const herramienta = useEditor((s) => s.herramienta)
  const [puntos, setPuntos] = useState<THREE.Vector3[]>([])
  const { scene, camera, gl, raycaster, pointer } = useThree()
  useEffect(() => {
    if (herramienta !== 'medir') return setPuntos([])
    const lienzo = gl.domElement
    let abajo = { x: 0, y: 0 }
    const presionar = (e: PointerEvent) => (abajo = { x: e.clientX, y: e.clientY })
    const soltar = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) > 5) return // fue un giro de cámara
      raycaster.setFromCamera(pointer, camera)
      const golpes = raycaster.intersectObjects(scene.children, true).filter((g) => (g.object as THREE.Mesh).isMesh && (g.object.userData.nodo || g.object.name === 'cama'))
      if (!golpes.length) return
      const p = golpes[0].point.clone()
      setPuntos((l) => (l.length >= 2 ? [p] : [...l, p]))
    }
    lienzo.addEventListener('pointerdown', presionar)
    lienzo.addEventListener('pointerup', soltar)
    return () => {
      lienzo.removeEventListener('pointerdown', presionar)
      lienzo.removeEventListener('pointerup', soltar)
    }
  }, [herramienta, gl, raycaster, pointer, camera, scene])

  // Las etiquetas <Html> se quedan montadas siempre: desmontarlas a mitad de un
  // render rompe la raíz propia que crea drei (ver AlCargar en Pieza.tsx).
  const [a, b] = puntos
  const activa = herramienta === 'medir'
  return (
    <group>
      {activa &&
        puntos.map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[1.2, 16, 16]} />
            <meshBasicMaterial color={NARANJA} depthTest={false} />
          </mesh>
        ))}
      {activa && a && b && <Line points={[a, b]} color={NARANJA} lineWidth={2} depthTest={false} />}
      <Html position={a && b ? a.clone().lerp(b, 0.5) : [0, 0, 0]} center className="pointer-events-none">
        {activa && a && b && (
          <div className="whitespace-nowrap rounded-lg bg-[#0D0A14]/90 px-2.5 py-1.5 font-chakra text-[12px] text-white shadow-lg ring-1 ring-white/10">
            <b className="text-[14px] text-[#FFC23D]">{a.distanceTo(b).toFixed(2)} mm</b>
            <span className="ml-2 text-white/55">
              X {Math.abs(b.x - a.x).toFixed(1)} · Y {Math.abs(b.y - a.y).toFixed(1)} · Z {Math.abs(b.z - a.z).toFixed(1)}
            </span>
          </div>
        )}
      </Html>
    </group>
  )
}

const SIN_NODO = { tipo: 'malla' as const, params: {}, malla: { pos: new Float32Array(), idx: new Uint32Array() } }

/* ── Medidas de la selección (como las cotas de Tinkercad) ─────────────── */

function Cotas() {
  const seleccion = useEditor((s) => s.seleccion)
  const nodos = useEditor((s) => s.nodos)
  const n = seleccion.length === 1 ? nodos.find((x) => x.id === seleccion[0]) : undefined
  const { malla } = useMallaLocal(n ?? SIN_NODO)
  const caja = n && malla && malla.pos.length ? cajaMundo(n, malla) : null
  const t = caja?.getSize(new THREE.Vector3())
  return (
    <Html position={caja ? [caja.max.x, caja.min.y, caja.max.z] : [0, 0, 0]} className="pointer-events-none">
      {t && (
        <div className="ml-3 whitespace-nowrap rounded-md bg-black/55 px-2 py-1 font-chakra text-[11px] tabular-nums text-white/80 backdrop-blur">
          {t.x.toFixed(1)} × {t.y.toFixed(1)} × {t.z.toFixed(1)} mm
        </div>
      )}
    </Html>
  )
}

export function Vista() {
  const nodos = useEditor((s) => s.nodos)
  const seleccion = useEditor((s) => s.seleccion)
  const elegidos = new Set(seleccion)
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [180, -260, 190], fov: 38, near: 0.5, far: 6000, up: [0, 0, 1] }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={(e) => {
        if (useEditor.getState().herramienta !== 'medir' && e.type === 'click' && !e.shiftKey) useEditor.getState().seleccionar([])
      }}
    >
      <color attach="background" args={['#0D0A14']} />
      <fog attach="fog" args={['#0D0A14', 900, 2600]} />
      <Luces />
      <Cama />
      {nodos.map((n) => (
        <ObjetoNodo key={n.id} n={n} elegido={elegidos.has(n.id)} />
      ))}
      <Gizmo />
      <Regla />
      <Cotas />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} maxDistance={2500} minDistance={5} />
      <ControlCamara />
      <GizmoHelper alignment="top-right" margin={[64, 64]}>
        <GizmoViewport axisColors={['#FF4D4D', '#1FBF8F', '#2FA8FF']} labelColor="#0D0A14" />
      </GizmoHelper>
    </Canvas>
  )
}
