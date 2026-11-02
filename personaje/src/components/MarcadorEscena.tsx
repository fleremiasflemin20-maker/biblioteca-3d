import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ANCLA, marcador } from '../lib/marcador'
import { scroll } from '../lib/scroll-state'

/**
 * Proyecta el punto de anclaje del botón a coordenadas de pantalla.
 *
 * Vive dentro del Canvas porque necesita la cámara real de cada frame — la que
 * ya lleva aplicados el recorrido, el encuadre por proporción y el desvío del
 * arrastre. Cualquier cálculo hecho fuera estaría siempre un paso por detrás.
 *
 * El ancla va en coordenadas de MUNDO y no como hijo del grupo que gira: si
 * colgara de la figura, el giro continuo se lo llevaría dando vueltas y el
 * botón orbitaría alrededor del muñeco en vez de quedarse a su lado.
 */
export function MarcadorEscena() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const punto = useRef(new THREE.Vector3())

  useFrame(() => {
    punto.current.set(...ANCLA).project(camera)

    marcador.x = (punto.current.x * 0.5 + 0.5) * size.width
    marcador.y = (-punto.current.y * 0.5 + 0.5) * size.height

    // Solo mientras la figura mira de frente. El giro arranca en 0.167, así que
    // el botón se va antes de que el hombro que señalaba empiece a rotar.
    // `z > 1` significa que el punto quedó detrás de la cámara: sin ese guardia,
    // la proyección se invierte y el botón salta al lado contrario.
    const deFrente = 1 - THREE.MathUtils.smoothstep(scroll.progress, 0.06, 0.17)
    marcador.visible = punto.current.z > 1 ? 0 : deFrente
  })

  return null
}
