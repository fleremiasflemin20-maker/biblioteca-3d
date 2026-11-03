/**
 * El desvío de cámara que el visitante impone arrastrando.
 *
 * La decisión de fondo: esto **se suma** al recorrido del scroll, no lo
 * sustituye.
 *
 * Un orbit control clásico se apropiaría de la cámara, y entonces el giro de
 * 180° del segundo acto o el picado del tercero dejarían de caer donde están
 * calculados: la película se rompe en cuanto alguien toca. Y no poner nada deja
 * una figura que se ve pero no se toca.
 *
 * Sumando un desvío, mandan los dos: el scroll sigue conduciendo la toma y el
 * arrastre la desvía mientras la mano esté encima. Al soltar, el desvío se
 * deshace solo en un par de segundos y la cámara vuelve a su sitio del guion,
 * sin que nadie tenga que "recolocarla".
 *
 * Mismo patrón que `scroll-state` e `intro`: objeto mutable que se escribe desde
 * los eventos y se lee en `useFrame`, sin pasar por React.
 */
export const arrastre = {
  /** Radianes de azimut que se suman al recorrido. */
  yaw: 0,
  /** Radianes de polar que se suman al recorrido. */
  pitch: 0,
  /** Mientras es true, la figura deja de girar por su cuenta: manda la mano. */
  activo: false,
}

/** Radianes por píxel arrastrado. Media pantalla ≈ media vuelta. */
export const SENSIBILIDAD_YAW = 0.005
export const SENSIBILIDAD_PITCH = 0.003

/**
 * Tope del desvío vertical. Sin él se puede empujar la cámara por encima del
 * polo, la escena se da la vuelta y no hay forma intuitiva de recuperarla.
 */
export const PITCH_MAXIMO = 0.5

/**
 * Aviso de "golpe": el arrastre ha recorrido bastante como para merecer una
 * onomatopeya, y aquí está el punto de la pantalla donde va.
 *
 * Va aquí y no en un componente aparte para que **haya un solo juego de
 * escuchas de puntero** en toda la página. Un segundo componente escuchando
 * `pointermove` por su cuenta tendría que repetir el umbral de arrastre, el
 * sesgo horizontal del táctil y las bandas de los bordes — y en cuanto uno de
 * los dos cambiara, los efectos dejarían de coincidir con el gesto que dicen
 * acompañar.
 */
type Golpe = (x: number, y: number) => void

let escucha: Golpe | null = null

/** Registra quién dibuja los golpes. `null` para desengancharse al desmontar. */
export function alGolpear(fn: Golpe | null) {
  escucha = fn
}

export function golpear(x: number, y: number) {
  escucha?.(x, y)
}

/**
 * Píxeles de arrastre entre onomatopeya y onomatopeya.
 *
 * Va por distancia recorrida y no por tiempo a propósito: así el ritmo lo marca
 * la mano. Arrastras fuerte y salen seguidas como en una página de pelea;
 * mueves despacio para mirar la figura y no sale casi ninguna, que es justo
 * cuando estorbarían.
 */
export const DISTANCIA_GOLPE = 150
