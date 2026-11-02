import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ELEGIDA } from '../lib/figura'
import { QUALITY } from '../lib/quality'
import { scroll } from '../lib/scroll-state'
import { intro } from '../lib/intro'

const vertexShader = /* glsl */ `
  uniform float uInflate;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vHeight;

  void main() {
    vHeight = position.y;

    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);

    // La cáscara se infla a lo largo de la normal. Escalar la malla entera no
    // vale: en una figura alta el halo saldría fino en los pies y gordo en el
    // pelo, porque la escala es proporcional a la distancia al origen.
    vec3 inflated = position + normal * uInflate;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(inflated, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uInner;
  uniform vec3 uOuter;

  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vHeight;

  void main() {
    // Fresnel: el borde de la silueta, que es donde vive un aura.
    float fresnel = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), 2.1);

    /*
     * Sin ruido. Un solo ciclo, muy lento.
     *
     * Aquí hubo dos capas de ruido animado y el resultado no se leía como
     * energía sino como un fluorescente estropeado: sobre 150K triángulos y con
     * el bloom encima, cualquier variación rápida se convierte en parpadeo. El
     * ruido se ha quitado entero, no reducido.
     *
     * Queda un solo ciclo de ~42 segundos, y el smoothstep asimétrico es lo que
     * lo hace elegante: al saturar pronto (0.05 → 0.55), el aura llega arriba
     * deprisa y se queda encendida la mayor parte del ciclo. El destello dura,
     * en vez de ser un vaivén constante. La bajada, además, ocupa el tramo
     * largo del seno: se desvanece muy despacio.
     *
     * La amplitud es de solo el 22%. Con eso no hay parpadeo posible: es un
     * respiro, no un encendido y apagado.
     *
     * (Ojo: esto es un template literal de JS. Nada de acentos graves aquí
     * dentro, ni en los comentarios: cierran la cadena y el archivo deja de
     * compilar.)
     */
    float cycle = 0.5 + 0.5 * sin(uTime * 0.15);
    float breath = smoothstep(0.05, 0.55, cycle);

    // El aura pesa más arriba: sube desde el cuerpo hacia el pelo.
    float rise = smoothstep(-0.1, 1.9, vHeight) * 0.55 + 0.45;

    // Nunca baja del 78%: es un respiro, no un encendido.
    float alpha = fresnel * (0.78 + 0.22 * breath) * rise * uIntensity;
    alpha = clamp(alpha, 0.0, 1.0);

    // Núcleo blanco pegado al cuerpo y rojo hacia el borde: el degradado que
    // hace que se lea como calor y no como un contorno pintado.
    vec3 color = mix(uInner, uOuter, clamp(fresnel * 1.5, 0.0, 1.0));

    // Aditivo: el alpha va también en el color o el halo se ve plano.
    gl_FragColor = vec4(color * alpha, alpha);
  }
`

/**
 * El aura de ki: la misma malla del personaje, inflada, con solo las caras
 * traseras y en aditivo.
 *
 * `BackSide` es la clave. Dibujando la cara interior de la cáscara, el test de
 * profundidad borra todo lo que queda por detrás del personaje y solo sobrevive
 * el anillo que asoma más allá de la silueta. Con `FrontSide` el aura se pintaría
 * encima de la cara y del gi, y el personaje quedaría rebozado en amarillo.
 *
 * La intensidad sube con el scroll y recibe el fogonazo de la entrada: es la
 * misma energía que abre el contraluz en el acto III.
 */
export function KiAura({ geometry }: { geometry: THREE.BufferGeometry }) {
  const material = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uInflate: { value: QUALITY.isMobile ? 0.036 : 0.03 },
      // Blanco cálido pegado al cuerpo, rojo hacia fuera.
      uInner: { value: new THREE.Color('#FFF1EC') },
      uOuter: { value: new THREE.Color(ELEGIDA?.personaje.aura ?? '#E4002B') },
    }),
    [],
  )

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    if (!material.current) return

    material.current.uniforms.uTime.value += dt

    // Arranca insinuada y se abre a partir del acto II; el `flash` de la entrada
    // la enciende de golpe cuando aterriza el titular.
    const fromScroll = 0.35 + 0.95 * THREE.MathUtils.smoothstep(scroll.progress, 0.25, 0.8)
    material.current.uniforms.uIntensity.value = fromScroll + intro.flash * 0.9
  })

  return (
    <mesh geometry={geometry} scale={QUALITY.scale} frustumCulled={false} renderOrder={2}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}
