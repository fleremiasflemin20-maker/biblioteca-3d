import { Suspense, useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { AlCargar, Pieza, type Modo } from './Pieza'
import type { Modelo3D } from '../lib/catalogo'
import type { OpcionesLlavero } from '../lib/llavero'

/**
 * Cada pieza llega a su escala: unas miden 0,02 unidades y otras 80. Se lleva
 * todo a 2 de alto con la base en y = -1, que es donde está la sombra.
 */
export function Normalizar({ children }: { children: ReactNode }) {
  const grupo = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    const g = grupo.current!
    g.scale.setScalar(1)
    g.position.set(0, 0, 0)
    g.updateMatrixWorld(true)
    const caja = new THREE.Box3().setFromObject(g)
    const tam = caja.getSize(new THREE.Vector3())
    const centro = caja.getCenter(new THREE.Vector3())
    const k = 2 / Math.max(tam.x, tam.y, tam.z, 1e-6)
    g.scale.setScalar(k)
    g.position.set(-centro.x * k, -caja.min.y * k - 1, -centro.z * k)
  })
  return <group ref={grupo}>{children}</group>
}

/**
 * El visor 3D: una pieza encuadrada sola, girando, con la contra en el color
 * de la categoría — la misma luz que ata la figura al atardecer en el
 * portafolio.
 */
export function Visor({
  modelo,
  modo = 'textura',
  tinta,
  zoom = false,
  margen = 1.3,
  opciones,
}: {
  modelo: Modelo3D
  modo?: Modo
  tinta: string
  zoom?: boolean
  margen?: number
  opciones?: OpcionesLlavero
}) {
  const [cargado, setCargado] = useState<string | null>(null)
  const listo = useCallback(() => setCargado(modelo.id), [modelo.id])

  return (
    <>
    {cargado !== modelo.id && (
      <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center font-mono text-[0.68rem] uppercase tracking-[0.2em] text-paper/50">
        Cargando modelo…
      </p>
    )}
    <Canvas
      dpr={[1, 1.6]}
      camera={{ fov: 38, position: [0, 0.4, 4] }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 2]} intensity={1.4} />
      <spotLight position={[-3, 4, -3]} intensity={50} angle={0.9} penumbra={1} color={tinta} />

      <Suspense fallback={null}>
        <Environment preset="sunset" />
        <Bounds key={modelo.id} fit clip observe margin={margen}>
          <Normalizar>
            <Pieza modelo={modelo} modo={modo} opciones={opciones} />
          </Normalizar>
        </Bounds>
        <AlCargar onListo={listo} />
        <ContactShadows position={[0, -1.001, 0]} opacity={0.45} scale={6} blur={2.4} far={3} />
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={zoom}
        autoRotate
        autoRotateSpeed={1.1}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI - Math.PI / 4}
      />
    </Canvas>
    </>
  )
}
