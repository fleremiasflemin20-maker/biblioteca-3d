import { Suspense, useCallback, useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import { Normalizar } from './Visor'
import { Pieza, contarTriangulos } from './Pieza'
import type { Modelo3D } from '../lib/catalogo'

/**
 * Fotógrafo de portadas, solo en desarrollo.
 *
 * Diez lienzos WebGL en la rejilla —uno por tarjeta— tumbarían cualquier
 * móvil, y bajar 70 MB de `.glb` para enseñar miniaturas no tiene sentido. Así
 * que cada pieza se fotografía una vez, aquí, en un lienzo fuera de pantalla:
 * se carga, se encuadra a tres cuartos, se guarda como WebP en
 * `public/portadas/` y la tarjeta enseña esa imagen. El 3D de verdad solo se
 * carga al abrir la ficha.
 */
function Disparo({ modelo, alTerminar }: { modelo: Modelo3D; alTerminar: () => void }) {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    let vivo = true
    // Dos fotogramas: uno para que se suban las texturas a la GPU y otro
    // para que se pinten. Antes de eso el lienzo sale negro.
    let cuadros = 0
    const tic = () => {
      if (!vivo) return
      if (++cuadros < 3) return requestAnimationFrame(tic)
      camera.position.set(2.15, 1.0, 3.15)
      camera.lookAt(0, 0, 0)
      gl.render(scene, camera)
      const tris = contarTriangulos(scene)
      gl.domElement.toBlob(
        async (blob) => {
          if (!blob || !vivo) return
          await fetch(`/__admin/portada?id=${encodeURIComponent(modelo.id)}&triangulos=${tris}`, { method: 'POST', body: blob })
          alTerminar()
        },
        'image/webp',
        0.86,
      )
    }
    requestAnimationFrame(tic)
    return () => {
      vivo = false
    }
  }, [gl, scene, camera, modelo, alTerminar])

  return null
}

export function Portadas({ pendientes, alAvanzar }: { pendientes: Modelo3D[]; alAvanzar?: (resto: number) => void }) {
  const [i, setI] = useState(0)
  const actual = pendientes[i]
  // Estable: `Disparo` lo tiene en sus dependencias y una flecha nueva en
  // cada render volvería a disparar la foto.
  const siguiente = useCallback(() => setI((n) => n + 1), [])
  useEffect(() => alAvanzar?.(pendientes.length - i), [i, pendientes.length, alAvanzar])
  // Cola terminada: se recarga para que las tarjetas lean las portadas nuevas.
  useEffect(() => {
    if (i > 0 && i >= pendientes.length) location.reload()
  }, [i, pendientes.length])
  if (!actual) return null

  return (
    <div className="pointer-events-none fixed -left-[9999px] top-0 h-[720px] w-[720px]" aria-hidden>
      {/* Un solo lienzo para toda la cola: desmontar un Canvas de R3F en
          mitad de un render rompe React. Lo que cambia es la pieza de dentro. */}
      <Canvas
        dpr={1}
        camera={{ fov: 32 }}
        gl={{ preserveDrawingBuffer: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
        frameloop="always"
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 2]} intensity={1.5} />
        <spotLight position={[-3, 4, -3]} intensity={50} angle={0.9} penumbra={1} color="#FF7A2F" />
        <Suspense fallback={null}>
          <Environment preset="sunset" />
        </Suspense>
        <Suspense key={actual.id} fallback={null}>
          <group position={[0, 0.05, 0]}>
            <Normalizar>
              <Pieza modelo={actual} />
            </Normalizar>
          </group>
          <Disparo modelo={actual} alTerminar={siguiente} />
        </Suspense>
      </Canvas>
    </div>
  )
}
