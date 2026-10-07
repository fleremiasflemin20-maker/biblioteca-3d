import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Bounds, Environment, Grid, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'
import type { Filamento, Pieza } from '../../lib/taller/malla'
import type { Proyecto } from '../../lib/taller/importar'

export type Herramienta = 'pincel' | 'relleno' | 'gotero' | 'girar'

type Props = {
  proyecto: Proyecto
  /** Sube cada vez que cambian los colores fuera del pincel (relleno, deshacer, limpieza…). */
  version: number
  vista: 'pintar' | 'separar'
  herramienta: Herramienta
  activo: number
  /** Radio del pincel en mm. */
  radio: number
  piezas: Pieza[] | null
  explosion: number
  verCortes: boolean
  enfocada: number | null
  oscuro: boolean
  alEmpezarTrazo: () => void
  alTerminarTrazo: () => void
  alRellenar: (tri: number) => void
  alGotear: (tri: number) => void
}

const CORTE = new THREE.Color('#FF5A1F')

/** Los colores de la paleta en lineal, que es como los quiere el shader. */
const lineales = (paleta: Filamento[]) => paleta.map((f) => new THREE.Color(f.color))

function colorear(attr: THREE.BufferAttribute, color: Uint8Array, paleta: THREE.Color[], desde = 0, hasta = color.length) {
  const a = attr.array as Float32Array
  for (let t = desde; t < hasta; t++) {
    const c = paleta[color[t]] ?? paleta[0]
    const o = t * 9
    a[o] = a[o + 3] = a[o + 6] = c.r
    a[o + 1] = a[o + 4] = a[o + 7] = c.g
    a[o + 2] = a[o + 5] = a[o + 8] = c.b
  }
}

/* ── La pieza que se pinta ──────────────────────────────────────────────── */

function Pintable(p: Props) {
  const { malla, paleta } = p.proyecto
  const malla3 = useRef<THREE.Mesh>(null)
  const cursor = useRef<THREE.Mesh>(null)
  const pintando = useRef(false)

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(malla.pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(malla.pos.length), 3))
    // Normales suavizadas salvo en aristas vivas (> 35°): una figura se ve
    // orgánica y una pieza mecánica conserva sus cantos. En mallas enormes,
    // facetado, que es instantáneo.
    if (malla.color.length <= 400_000) toCreasedNormals(g, (35 * Math.PI) / 180)
    else g.computeVertexNormals()
    // El BVH reordena un índice propio: el triángulo original de un vértice v es ⌊v/3⌋.
    const bvh = new MeshBVH(g)
    ;(g as unknown as { boundsTree: MeshBVH }).boundsTree = bvh // lo que lee acceleratedRaycast
    return { g, bvh }
  }, [malla.pos, malla.color.length])
  const geometria = geo.g
  useEffect(() => () => geo.g.dispose(), [geo])

  const colores = useMemo(() => lineales(paleta), [paleta])
  useLayoutEffect(() => {
    const attr = geometria.attributes.color as THREE.BufferAttribute
    colorear(attr, malla.color, colores)
    attr.clearUpdateRanges()
    attr.needsUpdate = true
  }, [geometria, colores, malla.color, p.version])

  // El pincel: una esfera en el espacio de la pieza. Pinta las caras que
  // toca y que miran hacia el mismo lado que la cara apuntada, para no
  // atravesar paredes finas y manchar la de detrás.
  const esfera = useMemo(() => new THREE.Sphere(), [])
  const normalTri = useMemo(() => new THREE.Vector3(), [])
  const pincel = (punto: THREE.Vector3, normal: THREE.Vector3) => {
    const mesh = malla3.current!
    esfera.center.copy(mesh.worldToLocal(punto.clone()))
    esfera.radius = p.radio
    const indice = geometria.index!.array
    const attr = geometria.attributes.color as THREE.BufferAttribute
    const c = colores[p.activo] ?? colores[0]
    let min = Infinity, max = -1
    geo.bvh.shapecast({
      intersectsBounds: (caja) => esfera.intersectsBox(caja),
      intersectsTriangle: (tri, i) => {
        if (!tri.intersectsSphere(esfera)) return false
        tri.getNormal(normalTri)
        if (normalTri.dot(normal) < 0.15) return false
        const t = (indice[i * 3] / 3) | 0
        if (malla.color[t] === p.activo) return false
        malla.color[t] = p.activo
        const a = attr.array as Float32Array
        for (let k = 0; k < 9; k += 3) {
          a[t * 9 + k] = c.r
          a[t * 9 + k + 1] = c.g
          a[t * 9 + k + 2] = c.b
        }
        if (t < min) min = t
        if (t > max) max = t
        return false
      },
    })
    if (max >= 0) {
      attr.clearUpdateRanges()
      attr.addUpdateRange(min * 9, (max - min + 1) * 9)
      attr.needsUpdate = true
    }
  }

  const moverCursor = (e: ThreeEvent<PointerEvent>) => {
    const c = cursor.current
    if (!c || !e.face) return
    const local = malla3.current!.worldToLocal(e.point.clone())
    c.position.copy(local).addScaledVector(e.face.normal, 0.05)
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), e.face.normal)
    c.scale.setScalar(p.radio)
    c.visible = p.herramienta === 'pincel'
  }

  useEffect(() => {
    const soltar = () => {
      if (!pintando.current) return
      pintando.current = false
      p.alTerminarTrazo()
    }
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
    return () => {
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
    }
  }, [p])

  return (
    <group>
      <mesh
        ref={malla3}
        geometry={geometria}
        raycast={acceleratedRaycast}
        onPointerDown={(e) => {
          if (e.button !== 0 || p.herramienta === 'girar' || !e.face) return
          e.stopPropagation()
          const tri = (e.face.a / 3) | 0
          if (p.herramienta === 'relleno') return p.alRellenar(tri)
          if (p.herramienta === 'gotero') return p.alGotear(tri)
          p.alEmpezarTrazo()
          pintando.current = true
          pincel(e.point, e.face.normal)
        }}
        onPointerMove={(e) => {
          moverCursor(e)
          if (pintando.current && e.face) pincel(e.point, e.face.normal)
        }}
        onPointerOut={() => cursor.current && (cursor.current.visible = false)}
      >
        <meshStandardMaterial vertexColors roughness={0.62} metalness={0.02} />
      </mesh>
      <mesh ref={cursor} visible={false} renderOrder={10}>
        <ringGeometry args={[0.9, 1, 48]} />
        <meshBasicMaterial color="#FFFFFF" depthTest={false} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/* ── Las piezas separadas, en despiece ───────────────────────────────────── */

function Despiece({ piezas, paleta, explosion, verCortes, enfocada }: { piezas: Pieza[]; paleta: Filamento[]; explosion: number; verCortes: boolean; enfocada: number | null }) {
  const grupos = useRef<(THREE.Group | null)[]>([])

  const datos = useMemo(() => {
    const caja = new THREE.Box3()
    for (const p of piezas) caja.union(new THREE.Box3(new THREE.Vector3(...p.min), new THREE.Vector3(...p.max)))
    const centro = caja.getCenter(new THREE.Vector3())
    const tam = caja.getSize(new THREE.Vector3()).length()

    // Centro de cada pieza: el de su superficie pintada, ponderado por área.
    const centros = piezas.map((p) => {
      const c = new THREE.Vector3()
      let total = 0
      for (let o = 0; o < p.triangulos * 9; o += 9) {
        const a = new THREE.Vector3(p.pos[o], p.pos[o + 1], p.pos[o + 2])
        const b = new THREE.Vector3(p.pos[o + 3], p.pos[o + 4], p.pos[o + 5])
        const d = new THREE.Vector3(p.pos[o + 6], p.pos[o + 7], p.pos[o + 8])
        const area = b.clone().sub(a).cross(d.clone().sub(a)).length()
        c.addScaledVector(a.add(b).add(d), area / 3)
        total += area
      }
      return total ? c.divideScalar(total) : centro.clone()
    })

    // Piezas apiladas (capas de una placa, un relieve sobre su base): sus
    // centros casi coinciden y un despiece radial no las separa. Entonces se
    // abren como un libro de instrucciones, en orden a lo largo del eje en
    // que se apilan. Si están repartidas, cada una sale en su dirección y la
    // del centro se queda quieta.
    const lejos = Math.max(...centros.map((c) => c.distanceTo(centro)))
    let dirs: THREE.Vector3[]
    if (piezas.length > 1 && lejos < tam * 0.12) {
      const varianza = [0, 1, 2].map((e) => {
        const m = centros.reduce((s, c) => s + c.getComponent(e), 0) / centros.length
        return centros.reduce((s, c) => s + (c.getComponent(e) - m) ** 2, 0)
      })
      const eje = varianza.indexOf(Math.max(...varianza))
      const orden = centros.map((_, i) => i).sort((a, b) => centros[a].getComponent(eje) - centros[b].getComponent(eje))
      dirs = centros.map(() => new THREE.Vector3())
      orden.forEach((i, rango) => dirs[i].setComponent(eje, (rango - (piezas.length - 1) / 2) * tam * 0.3))
    } else {
      dirs = centros.map((c) => {
        const d = c.clone().sub(centro)
        return d.length() < tam * 0.03 ? d.set(0, 0, 0) : d.normalize().multiplyScalar(tam * 0.45)
      })
    }

    return piezas.map((p, i) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3))
      g.computeVertexNormals()
      g.addGroup(0, p.triangulos * 3, 0)
      g.addGroup(p.triangulos * 3, p.tapas * 3, 1)
      return { g, dir: dirs[i] }
    })
  }, [piezas])
  useEffect(() => () => datos.forEach((d) => d.g.dispose()), [datos])

  useFrame((_, dt) => {
    datos.forEach((d, i) => {
      const g = grupos.current[i]
      if (!g) return
      g.position.x = THREE.MathUtils.damp(g.position.x, d.dir.x * explosion, 6, dt)
      g.position.y = THREE.MathUtils.damp(g.position.y, d.dir.y * explosion, 6, dt)
      g.position.z = THREE.MathUtils.damp(g.position.z, d.dir.z * explosion, 6, dt)
    })
  })

  return (
    <>
      {piezas.map((p, i) => {
        const color = new THREE.Color(paleta[p.color]?.color ?? '#cccccc')
        const tenue = enfocada !== null && enfocada !== i
        return (
          <group key={i} ref={(g) => void (grupos.current[i] = g)}>
            <mesh geometry={datos[i].g}>
              <meshStandardMaterial attach="material-0" color={color} roughness={0.6} transparent={tenue} opacity={tenue ? 0.12 : 1} depthWrite={!tenue} />
              <meshStandardMaterial
                attach="material-1"
                color={verCortes ? CORTE : color}
                emissive={verCortes ? CORTE : '#000000'}
                emissiveIntensity={verCortes ? 0.25 : 0}
                roughness={0.8}
                side={THREE.DoubleSide}
                transparent={tenue}
                opacity={tenue ? 0.12 : 1}
                depthWrite={!tenue}
              />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

/* ── El lienzo ──────────────────────────────────────────────────────────── */

export function Lienzo(p: Props) {
  const pintar = p.vista === 'pintar' || !p.piezas
  const girar = p.herramienta === 'girar' || !pintar
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 35, position: [180, 140, 220], near: 0.1, far: 10000 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05, preserveDrawingBuffer: false }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ cursor: pintar && p.herramienta !== 'girar' ? 'crosshair' : 'grab', touchAction: 'none' }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[200, 400, 150]} intensity={1.5} />
      <directionalLight position={[-250, 120, -200]} intensity={0.45} />
      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      {/* La malla vive en mm con Z arriba (como en el laminador); en pantalla, Y arriba. */}
      <Bounds key={p.proyecto.id} fit clip observe margin={1.25}>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          {pintar ? (
            <Pintable {...p} />
          ) : (
            <Despiece piezas={p.piezas!} paleta={p.proyecto.paleta} explosion={p.explosion} verCortes={p.verCortes} enfocada={p.enfocada} />
          )}
        </group>
      </Bounds>

      <Grid
        position={[0, -0.01, 0]}
        infiniteGrid
        cellSize={10}
        sectionSize={50}
        cellThickness={0.6}
        sectionThickness={1}
        cellColor={p.oscuro ? '#2A2A2D' : '#E2DFDA'}
        sectionColor={p.oscuro ? '#3A3A3E' : '#CFCAC3'}
        fadeDistance={900}
        fadeStrength={1.5}
      />

      <OrbitControls
        makeDefault
        enableDamping
        // -1: el botón izquierdo (o un dedo) no mueve la cámara mientras se pinta.
        mouseButtons={{ LEFT: girar ? THREE.MOUSE.ROTATE : (-1 as THREE.MOUSE), MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        touches={{ ONE: girar ? THREE.TOUCH.ROTATE : (-1 as THREE.TOUCH), TWO: THREE.TOUCH.DOLLY_ROTATE }}
      />
    </Canvas>
  )
}
