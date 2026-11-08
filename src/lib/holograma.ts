import * as THREE from 'three'

/**
 * El acabado Holograma de la ficha: la pieza como una proyección de luz.
 *
 * Todo se calcula por píxel, así que cuesta lo mismo con 2.000 triángulos
 * que con 400.000 (un `wireframe` de verdad en una figura de 369k caras son
 * más de un millón de líneas y satura la imagen):
 *  - una rejilla en el espacio del mundo, sacada de la posición de cada
 *    fragmento con `fwidth`, siempre del mismo grosor en pantalla;
 *  - el contorno encendido donde la superficie se pone de canto;
 *  - una franja de escaneo que sube despacio.
 * Además, las aristas vivas (más de 28°) como líneas, calculadas una vez
 * por geometría, y solo en mallas que no son enormes.
 */
export const COLOR_HOLOGRAMA = '#4DFFC3'

/** Un reloj para todos los hologramas: un solo `useFrame` lo mueve. */
export const RELOJ = { value: 0 }

const V = /* glsl */ `
  varying vec3 vMundo;
  varying vec3 vNormal;
  varying vec3 vVista;
  void main() {
    vec4 m = modelMatrix * vec4(position, 1.0);
    vMundo = m.xyz;
    vec4 mv = viewMatrix * m;
    vNormal = normalize(normalMatrix * normal);
    vVista = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`
const F = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTiempo;
  uniform float uPaso;
  varying vec3 vMundo;
  varying vec3 vNormal;
  varying vec3 vVista;
  void main() {
    float canto = 1.0 - abs(dot(normalize(vNormal), normalize(vVista)));
    vec3 q = vMundo / uPaso;
    vec3 g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec3(1e-4));
    float linea = 1.0 - clamp(min(min(g.x, g.y), g.z), 0.0, 1.0);
    float franja = exp(-pow((fract(vMundo.y * 0.35 - uTiempo * 0.18) - 0.5) * 16.0, 2.0));
    float a = 0.04 + pow(canto, 2.2) * 0.75 + linea * 0.22 + franja * 0.35;
    gl_FragColor = vec4(uColor * a, 1.0);
    #include <colorspace_fragment>
  }`

export function materialHolograma(color = COLOR_HOLOGRAMA, paso = 0.06) {
  return new THREE.ShaderMaterial({
    vertexShader: V,
    fragmentShader: F,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTiempo: RELOJ, uPaso: { value: paso } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

/** Por encima de esto no se calculan aristas: tardaría y no ayudaría a leer la forma. */
const MAX_ARISTAS = 150_000
const aristas = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry | null>()

/** Las aristas vivas de una geometría (cacheadas), o null si es demasiado densa. */
export function aristasDe(g: THREE.BufferGeometry) {
  if (aristas.has(g)) return aristas.get(g)!
  const tri = (g.index ? g.index.count : g.attributes.position.count) / 3
  const e = tri <= MAX_ARISTAS ? new THREE.EdgesGeometry(g, 28) : null
  aristas.set(g, e)
  return e
}

export const materialAristas = () => new THREE.LineBasicMaterial({ color: COLOR_HOLOGRAMA, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
