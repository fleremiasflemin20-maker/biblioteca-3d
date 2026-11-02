/**
 * Estado de la secuencia de entrada.
 *
 * Mismo patrón que `scroll-state.ts`: un objeto mutable que GSAP escribe y
 * `useFrame` lee. La entrada mueve la cámara y la luz, y eso no puede pasar por
 * estado de React sin re-renderizar el árbol sesenta veces por segundo.
 */
export const intro = {
  /** Metros que se suman al radio de cámara. Arranca lejos y entra al plano. */
  dolly: 0,
  /** Golpe de contraluz cuando las letras aterrizan. Se suma al `rim` del recorrido. */
  flash: 0,
}

/** La escena terminó de cargar y la pantalla de carga se ha ido. */
export const SCENE_READY = 'scene:ready'

export const announceSceneReady = () => window.dispatchEvent(new Event(SCENE_READY))
