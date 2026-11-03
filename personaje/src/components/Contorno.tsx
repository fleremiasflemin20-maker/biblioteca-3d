import { useMemo } from 'react'
import * as THREE from 'three'
import { QUALITY } from '../lib/quality'

/**
 * El contorno negro del personaje.
 *
 * Misma técnica que el aura de ki —la malla inflada por sus normales, dibujada
 * solo por las caras traseras— pero opaca y negra. El test de profundidad borra
 * todo lo que queda detrás de la figura, así que del cascarón solo sobrevive el
 * anillo que asoma más allá de la silueta: una línea.
 *
 * Es la forma clásica de hacer contorno en cel shading, y la razón por la que
 * aquí sale casi gratis: el aura ya había resuelto el problema.
 *
 * Infla por la normal y **no por escala**, que es el error obvio. Con el origen
 * de la malla en los pies, escalar un 1% desplaza dos centímetros la cabeza y
 * cero los pies: el contorno saldría gordo arriba y desaparecería abajo.
 */

/**
 * Grosor en unidades de mundo, sobre una figura de 1.90 de alto.
 *
 * Algo mayor de lo que pediría la vista: al decimar la malla al 5% la silueta se
 * mete un poco hacia dentro respecto al personaje, y el contorno tiene que
 * salvar esa diferencia antes de empezar a asomar.
 */
const GROSOR = 0.015

const vertexShader = /* glsl */ `
  uniform float uGrosor;

  void main() {
    vec3 inflado = position + normal * uGrosor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(inflado, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;

  void main() {
    gl_FragColor = vec4(uColor, 1.0);
  }
`

export function Contorno({ geometry }: { geometry: THREE.BufferGeometry }) {

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uGrosor: { value: GROSOR },
          uColor: { value: new THREE.Color('#07070a') },
        },
        side: THREE.BackSide,
        // Opaco de verdad: el contorno es geometría y tiene que ocupar su sitio
        // en el buffer de profundidad. El aura, que es aditiva, hace lo contrario.
        depthWrite: true,
        // Sin niebla ni tono mapeado: una línea de tinta no se destiñe con la
        // distancia. Con niebla, el contorno se aclaraba en los planos lejanos y
        // la silueta se deshacía justo cuando más falta hace.
        fog: false,
        toneMapped: false,
      }),
    [],
  )

  return (
    <mesh geometry={geometry} material={material} scale={QUALITY.scale} frustumCulled={false} />
  )
}
