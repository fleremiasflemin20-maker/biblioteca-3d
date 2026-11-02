import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * La sombra del suelo, pintada en vez de calculada.
 *
 * `<ContactShadows>` de drei es una sombra de verdad: cada fotograma vuelve a
 * renderizar la escena entera desde debajo, con un material de profundidad. Eso
 * son 150.000 triángulos más por frame — medido — y resultó ser la pasada más
 * caro de toda la escena, por encima del mapa de sombras.
 *
 * En móvil no se puede pagar. Y no hace falta: lo único que aporta a este tamaño
 * es una mancha oscura bajo los pies que asienta la figura. Eso es un degradado
 * radial, y un degradado radial son 64 triángulos y cero pasadas.
 *
 * Lo que se pierde es que la mancha no sigue la silueta —no se estrecha en los
 * tobillos ni se abre con los brazos—, pero con este desenfoque y a este tamaño
 * en pantalla eso no se distingue.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uOpacidad;
  varying vec2 vUv;

  void main() {
    // Distancia al centro del disco, de 0 a 1.
    float d = length(vUv - 0.5) * 2.0;

    // Dos caídas multiplicadas: una ancha para la penumbra y otra apretada para
    // el núcleo. Con una sola, o la sombra tiene un borde duro o es una nube.
    float penumbra = 1.0 - smoothstep(0.0, 1.0, d);
    float nucleo = 1.0 - smoothstep(0.0, 0.42, d);

    float alpha = (penumbra * 0.55 + nucleo * 0.45) * uOpacidad;

    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
  }
`

export function SombraFalsa() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uOpacidad: { value: 0.85 } },
        transparent: true,
        // No escribe profundidad: es una mancha sobre el suelo, no un objeto.
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )

  return (
    <mesh material={material} rotation-x={-Math.PI / 2} position-y={0.006} renderOrder={1}>
      <circleGeometry args={[1.5, 32]} />
    </mesh>
  )
}
