import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Los efectos de energía de la arena de selección, como el ki de un juego de
 * pelea de consola: un aura que sube alrededor de la figura y chispas que
 * ascienden desde el pedestal. Todo es geometría con mezcla aditiva y un
 * shader corto: sin posprocesado, así el lienzo sigue siendo transparente
 * sobre el cielo de la sección.
 */

const VERTICE = /* glsl */ `
  varying vec2 vUv;
  varying float vBorde;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    // Más brillo en la silueta del cilindro que de frente: no tapa la figura.
    vBorde = 1.0 - abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`

const FRAGMENTO = /* glsl */ `
  uniform float uTiempo;
  uniform float uFuerza;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vBorde;
  void main() {
    float x = vUv.x * 6.2831;
    // Lenguas de energía que suben y se retuercen.
    float lengua = sin(x * 7.0 + sin(vUv.y * 6.0 - uTiempo * 3.0) * 1.6 - uTiempo * 1.3) * 0.5 + 0.5;
    lengua = pow(lengua, 3.0);
    float fina = pow(sin(x * 19.0 - uTiempo * 2.1 + vUv.y * 9.0) * 0.5 + 0.5, 8.0);
    float sube = fract(vUv.y * 1.6 - uTiempo * 0.7);
    float base = smoothstep(0.0, 0.12, vUv.y);
    float tope = 1.0 - smoothstep(0.25, 1.0, vUv.y);
    float a = (lengua * 0.75 + fina * 0.6 + 0.12) * base * tope * (0.55 + 0.45 * sube);
    a *= (0.35 + pow(vBorde, 1.5)) * uFuerza;
    vec3 c = mix(uColor, vec3(1.0), fina * 0.6 + lengua * 0.2);
    gl_FragColor = vec4(c * a, a);
  }
`

/** Aura de ki: un cilindro abierto con lenguas de energía; estalla un momento al cambiar de figura. */
export function Aura({ tinta, pulso }: { tinta: string; pulso: number }) {
  // Los uniforms se crean una vez; el color se actualiza abajo sin recompilar el shader.
  const [uniforms] = useState(() => ({ uTiempo: { value: 0 }, uFuerza: { value: 1 }, uColor: { value: new THREE.Color(tinta) } }))
  const malla = useRef<THREE.Mesh>(null)
  const desde = useRef(-10)
  const ultimo = useRef(pulso)
  useEffect(() => {
    uniforms.uColor.value.set(tinta)
  }, [tinta, uniforms])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (ultimo.current !== pulso) {
      ultimo.current = pulso
      desde.current = t
    }
    // El estallido: el aura se infla y brilla el doble, y vuelve a su respiración.
    const e = Math.min(1, (t - desde.current) / 1.1)
    const golpe = (1 - e) ** 2
    uniforms.uTiempo.value = t
    uniforms.uFuerza.value = 1.9 + Math.sin(t * 2.2) * 0.25 + golpe * 2.5
    malla.current?.scale.set(1 + golpe * 0.35, 1 + golpe * 0.2, 1 + golpe * 0.35)
  })
  return (
    <mesh ref={malla} position={[0, 0.25, 0]}>
      <cylinderGeometry args={[0.9, 1.05, 2.7, 96, 1, true]} />
      {/* Solo la cara de atrás: el aura arde detrás de la figura y no la lava de frente.
          Suma pura (uno + uno): el lienzo es transparente y premultiplicado, así el brillo se ve sobre el cielo. */}
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VERTICE}
        fragmentShader={FRAGMENTO}
        transparent
        depthWrite={false}
        blending={THREE.CustomBlending}
        blendSrc={THREE.OneFactor}
        blendDst={THREE.OneFactor}
        side={THREE.BackSide}
      />
    </mesh>
  )
}

/** Chispas que suben desde el pedestal y se apagan arriba. */
export function Chispas({ tinta, cuantas = 140 }: { tinta: string; cuantas?: number }) {
  const puntos = useRef<THREE.Points>(null)
  const { posiciones, velocidades } = useMemo(() => {
    const posiciones = new Float32Array(cuantas * 3)
    const velocidades = new Float32Array(cuantas)
    for (let k = 0; k < cuantas; k++) {
      const ang = Math.random() * Math.PI * 2
      const r = 0.5 + Math.random() * 0.8
      posiciones.set([Math.cos(ang) * r, -1 + Math.random() * 3, Math.sin(ang) * r], k * 3)
      velocidades[k] = 0.25 + Math.random() * 0.7
    }
    return { posiciones, velocidades }
  }, [cuantas])
  useFrame((_, dt) => {
    const p = puntos.current
    if (!p) return
    const pos = p.geometry.attributes.position as THREE.BufferAttribute
    const a = pos.array as Float32Array
    const paso = Math.min(dt, 0.05)
    for (let k = 0; k < cuantas; k++) {
      a[k * 3 + 1] += velocidades[k] * paso
      if (a[k * 3 + 1] > 2.1) a[k * 3 + 1] = -1
    }
    pos.needsUpdate = true
  })
  return (
    <points ref={puntos}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posiciones, 3]} />
      </bufferGeometry>
      <pointsMaterial color={tinta} size={0.035} sizeAttenuation transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}
