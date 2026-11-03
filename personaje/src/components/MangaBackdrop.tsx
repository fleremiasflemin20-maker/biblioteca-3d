import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { MANGA_URL } from '../lib/quality'
import { scroll } from '../lib/scroll-state'

/** Radio del cilindro. La cámara nunca pasa de ~6.8, así que siempre queda dentro. */
const RADIUS = 9
const HEIGHT = 15
/** Vueltas de la tira alrededor del cilindro: más repeticiones = viñetas más pequeñas. */
const REPEAT = 2.5
/** Radianes por segundo. Lento a propósito: tiene que notarse vivo, no girando. */
const SPIN = 0.035

// El teñido va de casi apagado en el plano general a bastante presente en la
// órbita final: el fondo entra en escena cuando el contraluz abre el acto III.
const DIM_START = new THREE.Color('#2b2b34')
const DIM_END = new THREE.Color('#55555f')

/**
 * El fondo: las páginas de manga envolviendo la escena en un cilindro visto
 * desde dentro.
 *
 * Un plano plano detrás del modelo se vería de canto en cuanto la cámara pasara
 * de los 90° — y aquí da una vuelta completa. El cilindro está detrás mires
 * donde mires, y como gira despacio la animación no se detiene aunque el
 * usuario deje de hacer scroll.
 *
 * Material `basic`: es tinta, no una superficie. Iluminarlo con las mismas luces
 * que el personaje lo llenaría de degradados y perdería el aspecto de página
 * impresa.
 */
export function MangaBackdrop() {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.MeshBasicMaterial>(null)
  const texture = useTexture(MANGA_URL)

  useLayoutEffect(() => {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.repeat.set(REPEAT, 1)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
  }, [texture])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)

    if (mesh.current) mesh.current.rotation.y += SPIN * dt

    // Girar la malla y desplazar la textura en sentido contrario da dos
    // velocidades sobre la misma superficie: el fondo nunca repite el mismo
    // fotograma aunque el cilindro sí complete vueltas.
    texture.offset.x -= SPIN * 0.35 * dt

    if (material.current) {
      material.current.color.lerpColors(DIM_START, DIM_END, THREE.MathUtils.smoothstep(scroll.progress, 0.15, 0.85))
    }
  })

  return (
    <mesh ref={mesh} position-y={HEIGHT / 2 - 3.5}>
      <cylinderGeometry args={[RADIUS, RADIUS, HEIGHT, 64, 1, true]} />
      <meshBasicMaterial
        ref={material}
        map={texture}
        side={THREE.BackSide}
        toneMapped={false}
        color={DIM_START}
        depthWrite={false}
      />
    </mesh>
  )
}

useTexture.preload(MANGA_URL)
