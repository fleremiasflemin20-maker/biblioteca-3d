import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ENCUADRE } from '../lib/marcador'
import { initialCameraState, sampleCameraPath, type CameraState } from '../lib/camera-path'
import { QUALITY } from '../lib/quality'
import { scroll } from '../lib/scroll-state'
import { intro } from '../lib/intro'
import { arrastre } from '../lib/arrastre'
import { emptyFraming, framingForAspect } from '../lib/framing'

/** Constante de amortiguación. Más alto = la cámara persigue al scroll más de cerca. */
const LAMBDA = 4.5
/** Cuánto se desvía la cámara con el ratón, en radianes. */
const POINTER_YAW = 0.09
const POINTER_PITCH = 0.05

type Props = {
  /** Se llama en cada frame con el peso del contraluz. La luz lo lee sin re-renderizar React. */
  onRim?: (rim: number) => void
}

/**
 * Traduce el progreso del scroll a posición de cámara.
 *
 * Doble suavizado a propósito: `scrub: 1` en el ScrollTrigger amortigua el
 * salto de la rueda, y el `damp` de aquí amortigua el resultado otra vez contra
 * el delta real de frame. Con solo uno de los dos el movimiento se siente
 * escalonado en trackpads y en ratones de rueda con muescas.
 */
export function CameraRig({ onRim }: Props) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera

  const target = useRef<CameraState>(initialCameraState())
  const current = useRef<CameraState>(initialCameraState())
  const pointer = useRef({ x: 0, y: 0 })
  const lookAt = useRef(new THREE.Vector3())
  const framing = useRef(emptyFraming())
  /** false hasta el primer frame: ahí la cámara se coloca de golpe, sin amortiguar. */
  const settled = useRef(false)

  useFrame(({ pointer: p }, delta) => {
    // El clamp evita el salto gigante cuando la pestaña vuelve del segundo plano.
    const dt = Math.min(delta, 1 / 30)

    sampleCameraPath(scroll.progress, target.current)

    // El encuadre se recalcula cada frame contra el aspect real: así el
    // redimensionado de la ventana se acompaña en vez de quedar fijado al
    // arrancar, y no hace falta acertar el dispositivo.
    const frame = framingForAspect(camera.aspect, framing.current)

    const c = current.current
    const t = target.current

    c.theta = THREE.MathUtils.damp(c.theta, t.theta, LAMBDA, dt)
    c.phi = THREE.MathUtils.damp(c.phi, t.phi, LAMBDA, dt)
    c.radius = THREE.MathUtils.damp(c.radius, Math.max(t.radius, ENCUADRE.radioMin) * frame.distance, LAMBDA, dt)
    c.targetY = THREE.MathUtils.damp(c.targetY, t.targetY, LAMBDA, dt)
    c.rim = THREE.MathUtils.damp(c.rim, t.rim, LAMBDA, dt)
    c.shift = THREE.MathUtils.damp(c.shift, t.shift, LAMBDA, dt)

    // El primer frame se coloca de golpe en vez de amortiguar: R3F monta su
    // cámara por defecto (FOV 75) antes de que `makeDefault` aplique la nuestra,
    // y amortiguar desde ahí se ve como un zoom que nadie ha pedido. El guardia
    // de `isFinite` además recupera la escena si el FOV se hubiera ensuciado.
    const targetFov = t.fov + frame.fovBoost
    const fov =
      settled.current && Number.isFinite(camera.fov)
        ? THREE.MathUtils.damp(camera.fov, targetFov, LAMBDA, dt)
        : targetFov

    settled.current = true

    if (Math.abs(fov - camera.fov) > 0.001 || !Number.isFinite(camera.fov)) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    // Parallax de puntero: no en táctil, donde `pointer` se queda pegado
    // en la última posición tocada y deja la cámara torcida.
    if (!QUALITY.isMobile) {
      pointer.current.x = THREE.MathUtils.damp(pointer.current.x, p.x, 3, dt)
      pointer.current.y = THREE.MathUtils.damp(pointer.current.y, p.y, 3, dt)
    }

    /*
     * El desvío del arrastre se SUMA al recorrido, no lo sustituye. Así el
     * scroll sigue conduciendo la toma —el giro de 180° del acto II sigue
     * cayendo donde está calculado— y la mano solo la aparta mientras empuja.
     * Ver `lib/arrastre.ts`.
     */
    const theta = c.theta + pointer.current.x * POINTER_YAW + arrastre.yaw
    const phi = THREE.MathUtils.clamp(
      c.phi - pointer.current.y * POINTER_PITCH + arrastre.pitch,
      0.25,
      Math.PI - 0.25,
    )

    // El `dolly` de la entrada se suma **después** de amortiguar: si entrara en
    // el damp, el suavizado se comería el golpe inicial y la cámara aparecería
    // ya colocada.
    const radius = c.radius + intro.dolly

    camera.position.set(
      radius * Math.sin(phi) * Math.sin(theta),
      c.targetY + radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta),
    )

    // Encuadre lateral. Se mueve el punto de mira, no la cámara: desplazar la
    // cámara y seguir mirando al modelo lo dejaría otra vez en el centro.
    // El vector "derecha" de la cámara en el plano horizontal es (cos θ, 0, −sin θ).
    const halfHeight = radius * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    // En vertical el texto ocupa todo el ancho: apartar la figura a un lado no
    // libera nada y solo la manda contra el borde. Ahí manda el `lift`.
    const offset = c.shift * frame.shiftScale * halfHeight * camera.aspect

    lookAt.current.set(
      -offset * Math.cos(theta),
      c.targetY - frame.lift * halfHeight,
      offset * Math.sin(theta),
    )
    camera.lookAt(lookAt.current)

    onRim?.(c.rim + intro.flash)

    // Sonda para verificar el recorrido desde la consola sin tocar el render.
    if (import.meta.env.DEV) {
      ;(window as unknown as { __rig?: unknown }).__rig = {
        progress: scroll.progress,
        ...c,
        camFov: camera.fov,
        camPos: camera.position.toArray().map((n) => +n.toFixed(2)),
        dolly: intro.dolly,
        aspect: +camera.aspect.toFixed(2),
        ...frame,
      }
    }
  })

  return null
}
