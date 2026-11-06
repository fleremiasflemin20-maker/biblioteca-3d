import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { COLOR_HOLOGRAMA, RELOJ } from '../lib/holograma'

/**
 * El ambiente del acabado Holograma: fragmentos de "señal" (trozos de texto
 * de impresión 3D) y polvo de luz orbitando la pieza, todo en un solo
 * `Points` por capa. Las órbitas las calcula la GPU a partir del reloj: la
 * CPU no hace nada por cuadro más que subir un número.
 *
 * Con "reducir movimiento" en el sistema, se queda quieto.
 */
const FRAGMENTOS = ['G1 Z0.2', 'M104 S215', '0.4 mm', 'PLA', 'PETG', 'STL', '3MF', 'Δz 0.12', 'infill 15%', 'mesh ok', 'brim', 'F1800', 'E2.31', 'xyz', 'layer 42', '210 °C']
const COLS = 4
const CELDA = 128

/** Todos los textos en una textura, un texto por celda. */
function atlas() {
  const c = document.createElement('canvas')
  c.width = c.height = COLS * CELDA
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  FRAGMENTOS.forEach((t, i) => {
    g.font = `600 ${t.length > 7 ? 18 : 22}px ui-monospace, Consolas, monospace`
    g.fillText(t, (i % COLS) * CELDA + CELDA / 2, Math.floor(i / COLS) * CELDA + CELDA / 2)
  })
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const V = /* glsl */ `
  uniform float uTiempo;
  uniform float uTam;
  attribute float aRadio;
  attribute float aAltura;
  attribute float aFase;
  attribute float aVelocidad;
  attribute float aCelda;
  varying float vCelda;
  varying float vBrillo;
  void main() {
    float ang = aFase + uTiempo * aVelocidad;
    vec3 p = vec3(cos(ang) * aRadio, aAltura + sin(uTiempo * 0.3 + aFase) * 0.08, sin(ang) * aRadio);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uTam * (4.0 / -mv.z);
    vCelda = aCelda;
    vBrillo = 0.55 + 0.45 * sin(uTiempo * 1.7 + aFase * 3.0);
  }`
const F_TEXTO = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 uColor;
  varying float vCelda;
  varying float vBrillo;
  void main() {
    vec2 celda = vec2(mod(vCelda, ${COLS}.0), floor(vCelda / ${COLS}.0));
    // La textura del canvas va con Y hacia arriba y gl_PointCoord con Y hacia abajo: la fila se cuenta desde arriba.
    vec2 uv = vec2((celda.x + gl_PointCoord.x) / ${COLS}.0, 1.0 - (celda.y + gl_PointCoord.y) / ${COLS}.0);
    float a = texture2D(uAtlas, uv).a * vBrillo * 0.7;
    if (a < 0.02) discard;
    gl_FragColor = vec4(uColor * a, 1.0);
    #include <colorspace_fragment>
  }`
const F_POLVO = /* glsl */ `
  uniform vec3 uColor;
  varying float vBrillo;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vBrillo * 0.6;
    gl_FragColor = vec4(uColor * a, 1.0);
    #include <colorspace_fragment>
  }`

/** Puntos en una corona alrededor de la pieza (que mide 2 de alto, con la base en y = -1). */
function corona(n: number, conCelda: boolean, semilla: number) {
  let s = semilla
  const azar = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const g = new THREE.BufferGeometry()
  const attr = (f: () => number) => new THREE.BufferAttribute(Float32Array.from({ length: n }, f), 1)
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  g.setAttribute('aRadio', attr(() => 1.5 + azar() * 1.8))
  g.setAttribute('aAltura', attr(() => -1 + azar() * 2.6))
  g.setAttribute('aFase', attr(() => azar() * Math.PI * 2))
  g.setAttribute('aVelocidad', attr(() => (0.04 + azar() * 0.1) * (azar() < 0.5 ? -1 : 1)))
  g.setAttribute('aCelda', attr(() => (conCelda ? Math.floor(azar() * FRAGMENTOS.length) : 0)))
  // Las órbitas salen del shader: la caja tiene que abarcarlas para que no se recorten.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4)
  return g
}

export function CampoRuido() {
  const sinMovimiento = useMemo(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const capas = useMemo(() => {
    const color = { value: new THREE.Color(COLOR_HOLOGRAMA) }
    const comun = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }
    const textos = new THREE.ShaderMaterial({ vertexShader: V, fragmentShader: F_TEXTO, uniforms: { uTiempo: RELOJ, uTam: { value: 115 }, uAtlas: { value: atlas() }, uColor: color }, ...comun })
    const polvo = new THREE.ShaderMaterial({ vertexShader: V, fragmentShader: F_POLVO, uniforms: { uTiempo: RELOJ, uTam: { value: 14 }, uColor: color }, ...comun })
    return [
      { g: corona(80, true, 7), m: textos },
      { g: corona(900, false, 13), m: polvo },
    ]
  }, [])
  useEffect(
    () => () =>
      capas.forEach(({ g, m }) => {
        g.dispose()
        ;(m.uniforms.uAtlas?.value as THREE.Texture | undefined)?.dispose()
        m.dispose()
      }),
    [capas],
  )
  return (
    <>
      {!sinMovimiento && <Reloj />}
      {capas.map(({ g, m }, i) => (
        <points key={i} geometry={g} material={m} raycast={() => {}} />
      ))}
    </>
  )
}

/** Mueve el reloj de los hologramas (franja de escaneo y órbitas). */
export function Reloj() {
  useFrame((_, dt) => void (RELOJ.value += Math.min(dt, 0.1)))
  return null
}
