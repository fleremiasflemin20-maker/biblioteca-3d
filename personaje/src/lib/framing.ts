import * as THREE from 'three'

/**
 * Corrección de encuadre según la forma de la ventana.
 *
 * El FOV de una cámara en perspectiva es vertical, así que la figura ocupa
 * siempre la misma fracción de alto. Lo que cambia con la forma de la ventana es
 * el sitio que queda **libre**: en 16:9 hay una columna entera al lado para el
 * texto; en una ventana cuadrada o en vertical no hay columna, y la única salida
 * es alejarse un poco y dejar la figura arriba con el texto debajo.
 *
 * Antes esto salía del perfil de calidad, que se elegía por anchura. Un portátil
 * con la ventana a media pantalla acababa con el encuadre de móvil, y una
 * ventana casi cuadrada con el de escritorio: la figura salía enorme y baja. La
 * relación de aspecto describe el problema directamente y no hay que adivinar
 * dispositivo.
 *
 * Calibrado en dos puntos y recta entre ellos: 16:9 apaisado = sin corrección;
 * móvil en vertical (~0.46) = la corrección que ya estaba validada a mano.
 */

const WIDE = 1.6

/*
 * La pendiente del `lift` subió de 0.30 a 0.38 después de medir el hero en
 * vertical: con el titular, el nombre en katakana, el párrafo, la firma y la
 * banda del selector, al texto no le queda sitio si la figura no sube más.
 */
const SLOPE_DISTANCE = 0.28
const SLOPE_LIFT = 0.38
const SLOPE_FOV = 6

export type Framing = {
  /** Multiplica el radio orbital. 1 = el del keyframe. */
  distance: number
  /** Sube la figura en el encuadre, en fracción de media altura. */
  lift: number
  /** Grados que se suman al FOV del keyframe. */
  fovBoost: number
  /** Cuánto del desplazamiento lateral se aplica; en vertical no hay hueco al lado. */
  shiftScale: number
}

export function framingForAspect(aspect: number, out: Framing): Framing {
  // Durante un resize el contenedor llega a medir 0 y `camera.aspect` sale NaN.
  // Sin este guardia el NaN atraviesa el clamp —`Math.min(x, NaN)` es NaN—, se
  // cuela en el FOV y deja la matriz de proyección rota **para siempre**: pantalla
  // negra que no se recupera aunque la ventana vuelva a un tamaño válido.
  const a = Number.isFinite(aspect) ? THREE.MathUtils.clamp(aspect, 0.4, 1.9) : WIDE
  const narrowness = Math.max(0, WIDE - a)

  out.distance = 1 + narrowness * SLOPE_DISTANCE
  out.lift = narrowness * SLOPE_LIFT
  out.fovBoost = narrowness * SLOPE_FOV
  out.shiftScale = THREE.MathUtils.clamp((a - 0.7) / 0.9, 0.25, 1)

  return out
}

export const emptyFraming = (): Framing => ({
  distance: 1,
  lift: 0,
  fovBoost: 0,
  shiftScale: 1,
})
