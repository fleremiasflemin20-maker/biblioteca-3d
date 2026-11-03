/**
 * El recorrido de cámara como una lista de keyframes en coordenadas ESFÉRICAS.
 *
 * Interpolar posiciones cartesianas entre "delante" y "detrás" hace que la
 * cámara atraviese el modelo en línea recta. En esféricas (azimut, polar,
 * radio) el mismo tramo describe un arco alrededor de la figura, que es lo que
 * uno espera de una órbita. Además el radio se puede acercar y alejar sin tocar
 * el ángulo.
 *
 * Convención: theta = azimut (radianes, 0 = de frente, negativo = gira a la
 * derecha del espectador), phi = polar (PI/2 = a la altura de los ojos,
 * menor = cámara por encima mirando hacia abajo).
 */

export type Keyframe = {
  /** Progreso de scroll, 0 → 1. Deben ir en orden ascendente. */
  at: number
  theta: number
  phi: number
  radius: number
  /** Altura del punto al que mira la cámara. El modelo mide 1.90 con los pies en y=0. */
  targetY: number
  fov: number
  /** Peso de la luz de contra (0 = estudio neutro, 1 = contraluz dramático). */
  rim: number
  /**
   * Desplazamiento lateral de la figura en pantalla, en fracción de media
   * anchura de encuadre: +1 la manda al borde derecho, −1 al izquierdo.
   *
   * Va en fracción y no en unidades de mundo porque el mismo desplazamiento
   * tiene que valer para el plano general (radio 4.7) y para el primer plano
   * del torso (radio 1.55). El rig lo convierte a metros con el FOV y el aspect
   * de cada frame. Sirve para que la figura y el texto del capítulo nunca
   * ocupen el mismo lado.
   */
  shift: number
}

const HALF = Math.PI
const FULL = Math.PI * 2

// prettier-ignore
export const CAMERA_PATH: Keyframe[] = [
  // Los `at` coinciden con los límites de capítulo del DOM: con SIETE secciones
  // de 100dvh hay seis tramos de scroll, uno cada 1/6 ≈ 0.1667 de progreso.
  //
  // Cada capítulo se lee cuando llena la pantalla, o sea en k/6. Por eso los
  // seis primeros keyframes caen exactamente ahí: así el movimiento de cámara
  // que acompaña a un texto empieza cuando ese texto empieza, y no a mitad.
  // Los dos últimos (0.80 y 0.92) no son límites de capítulo — son beats
  // sueltos dentro de la órbita, que necesita más de un tramo para no quedar en
  // un barrido plano.
  //
  // El `shift` alterna de signo con el lado del texto de su capítulo: positivo
  // manda la figura a la derecha, y ese capítulo lleva el texto a la izquierda.

  // ── Acto I · plano general frontal, rotación mínima ───────────────────────
  { at: 0.0000, theta:  0.22, phi: 1.52, radius: 4.70, targetY: 0.98, fov: 30, rim: 0.15, shift:  0.20 },  // 1 · hero
  { at: 0.1667, theta: -0.14, phi: 1.50, radius: 4.30, targetY: 1.02, fov: 30, rim: 0.22, shift:  0.30 },  // 2 · el canon

  // ── Acto II · zoom al torso mientras gira 180° ────────────────────────────
  // Los radios y las alturas de mira están medidos contra la figura: encuadran
  // pecho, brazos y el arranque del pelo. Bajar de ~2.0 deja el pelo llenando
  // el cuadro y el plano deja de leerse.
  //
  // El giro arranca aquí y no antes por un motivo de guion: el capítulo 3 pide
  // al visitante que lo gire para ver que el pelo es de Goku por delante y de
  // Vegeta por detrás, y la cámara tiene que estar enseñando ese giro mientras
  // se lee la frase.
  { at: 0.3333, theta: -0.20 - HALF * 0.45, phi: 1.48, radius: 3.30, targetY: 1.10, fov: 29, rim: 0.34, shift: -0.28 },  // 3 · diseño
  { at: 0.5000, theta: -0.20 - HALF * 0.80, phi: 1.46, radius: 2.60, targetY: 1.18, fov: 28, rim: 0.52, shift:  0.32 },  // 4 · el traje
  { at: 0.6667, theta: -0.20 - HALF,        phi: 1.44, radius: 2.10, targetY: 1.28, fov: 28, rim: 0.70, shift: -0.10 },  // 5 · el combate

  // ── Acto III · órbita completa de 360° con inclinación y contraluz ────────
  { at: 0.8000, theta: -0.20 - HALF - FULL * 0.35, phi: 1.22, radius: 2.90, targetY: 1.30, fov: 30, rim: 1.00, shift:  0.00 },
  { at: 0.9200, theta: -0.20 - HALF - FULL * 0.72, phi: 1.70, radius: 4.20, targetY: 1.00, fov: 32, rim: 0.85, shift:  0.28 },
  { at: 1.0000, theta: -0.20 - HALF - FULL,        phi: 1.48, radius: 5.10, targetY: 0.98, fov: 34, rim: 0.55, shift:  0.34 },  // 7 · cierre
]

/** Smootherstep de Perlin. Suaviza la unión entre keyframes sin frenar de golpe. */
const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export type CameraState = Omit<Keyframe, 'at'>

/** Muestrea el recorrido en un progreso dado. Escribe sobre `out` para no asignar en cada frame. */
export function sampleCameraPath(progress: number, out: CameraState): CameraState {
  const p = Math.min(1, Math.max(0, progress))

  let i = 0
  while (i < CAMERA_PATH.length - 2 && p > CAMERA_PATH[i + 1].at) i++

  const a = CAMERA_PATH[i]
  const b = CAMERA_PATH[i + 1]
  const span = b.at - a.at
  const t = ease(span > 0 ? Math.min(1, Math.max(0, (p - a.at) / span)) : 0)

  out.theta = lerp(a.theta, b.theta, t)
  out.phi = lerp(a.phi, b.phi, t)
  out.radius = lerp(a.radius, b.radius, t)
  out.targetY = lerp(a.targetY, b.targetY, t)
  out.fov = lerp(a.fov, b.fov, t)
  out.rim = lerp(a.rim, b.rim, t)
  out.shift = lerp(a.shift, b.shift, t)

  return out
}

export const initialCameraState = (): CameraState =>
  sampleCameraPath(0, { theta: 0, phi: 0, radius: 0, targetY: 0, fov: 30, rim: 0, shift: 0 })
