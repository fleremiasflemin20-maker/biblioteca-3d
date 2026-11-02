import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scroll } from '../lib/scroll-state'
import { arrastre } from '../lib/arrastre'

const TAU = Math.PI * 2

/** Radianes por segundo mientras el usuario hace scroll. Una vuelta cada ~5 min. */
const SPIN_SCROLLING = 0.021
/** Radianes por segundo con la página quieta. Una vuelta cada ~60 s. */
const SPIN_IDLE = 0.105

/** Por debajo de esta velocidad de scroll se considera que la página está parada. */
const IDLE_THRESHOLD = 0.0004

/** Progreso a partir del cual la figura queda libre de girar del todo. */
const HOME_UNTIL = 0.13
/** Fuerza del imán que devuelve la figura al frente en el plano general. */
const HOME_PULL = 2.4

/** En el hero la figura no gira: cabecea. Grados y duración del ciclo. */
const HERO_SWAY_DEGREES = 11
const HERO_SWAY_PERIOD = 9

/** Balanceo lateral, constante en todo el recorrido. */
const TILT_DEGREES = 0.7
const TILT_PERIOD = 7

/** Respiración: estiramiento vertical, ciclo en segundos y fracción que dura inhalar. */
const BREATH_AMOUNT = 0.005
const BREATH_PERIOD = 4.2
const BREATH_INHALE = 0.42

/**
 * Mantiene la figura viva: gira sobre su eje y se balancea muy poco.
 *
 * Tres reglas conviven aquí.
 *
 * **La cámara manda mientras hay scroll.** La cámara ya orbita, se acerca y da
 * la vuelta; una figura girando por su cuenta encima de eso confunde el
 * recorrido —el giro de 180° del segundo acto dejaría de caer donde toca—, así
 * que ahí el giro baja a casi nada. Con la página quieta sube: es el momento en
 * que no pasa nada más y el movimiento tiene que salir de aquí.
 *
 * **El plano general siempre encuentra la figura de frente.** Un giro libre
 * hace que al volver arriba te la encuentres de espaldas, y el primer plano de
 * una portada no puede depender de dónde se quedó el reloj. Cerca del inicio
 * actúa un imán hacia el múltiplo de 2π más cercano: vuelve al frente **por el
 * camino más corto**, sin desandar la vuelta que llevara dada.
 *
 * **Pero de frente no significa parada.** Si el imán se limitara a clavarla, el
 * hero volvería a ser una estatua. Lo que hace en su lugar es cabecear despacio
 * alrededor del frente, ±11°: siempre reconocible, nunca quieta.
 *
 * Las dos velocidades —giro libre y tirón del imán— se suman como velocidades,
 * no se conmutan. Eso es lo que hace que la transición entre "girando" y "de
 * frente" no tenga costura: al subir hacia el hero el giro se apaga mientras el
 * imán aparece, y el ojo solo ve que la figura se acomoda.
 */
export function LivingFigure({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const spin = useRef(SPIN_IDLE)
  const angle = useRef(0)
  const previous = useRef(scroll.progress)
  const elapsed = useRef(0)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    if (!group.current) return

    elapsed.current += dt

    // ── Velocidad de giro: baja mientras se hace scroll, sube en reposo ──────
    const velocity = Math.abs(scroll.progress - previous.current)
    previous.current = scroll.progress

    // Con la mano encima, la figura deja de girar por su cuenta: dos rotaciones
    // a la vez y el visitante no sabe cuál está provocando él.
    const wanted = arrastre.activo
      ? 0
      : velocity > IDLE_THRESHOLD
        ? SPIN_SCROLLING
        : SPIN_IDLE
    spin.current = THREE.MathUtils.damp(spin.current, wanted, 1.2, dt)

    // ── Peso del imán: 1 en el plano general, 0 a partir del 13% ────────────
    const home = 1 - THREE.MathUtils.smoothstep(scroll.progress, 0.02, HOME_UNTIL)

    const sway =
      Math.sin((elapsed.current / HERO_SWAY_PERIOD) * TAU) * THREE.MathUtils.degToRad(HERO_SWAY_DEGREES)

    // El frente más cercano, no el frente absoluto: si lleva 190° girados vuelve
    // hacia los 360°, que está a 170° de distancia, en vez de desandar 190°.
    const front = Math.round(angle.current / TAU) * TAU + sway

    const free = spin.current * (1 - home)
    const pull = (front - angle.current) * HOME_PULL * home

    angle.current += (free + pull) * dt

    group.current.rotation.y = angle.current
    group.current.rotation.z =
      Math.sin((elapsed.current / TILT_PERIOD) * TAU) * THREE.MathUtils.degToRad(TILT_DEGREES)

    /*
     * Respiración. Medio por ciento de estiramiento vertical: la coronilla sube
     * y baja menos de un centímetro sobre una figura de 1.90.
     *
     * Dos detalles marcan la diferencia entre respirar y palpitar.
     *
     * Uno: **inhalar dura menos que exhalar**, 42% del ciclo frente al 58%. Un
     * seno puro sube y baja en el mismo tiempo, y eso no lo hace ningún cuerpo;
     * se lee como un motor, no como un pulmón.
     *
     * Dos: al estirarse a lo alto se estrecha a lo ancho, la mitad. Es la
     * conservación de volumen — sin ella la figura no respira, se infla.
     *
     * Escala desde el origen, que está en los pies: sube el pecho y la cabeza, y
     * los pies no se despegan del suelo.
     */
    const cycle = (elapsed.current / BREATH_PERIOD) % 1
    const breath =
      cycle < BREATH_INHALE
        ? THREE.MathUtils.smootherstep(cycle / BREATH_INHALE, 0, 1)
        : 1 - THREE.MathUtils.smootherstep((cycle - BREATH_INHALE) / (1 - BREATH_INHALE), 0, 1)

    const stretch = (breath - 0.5) * 2 * BREATH_AMOUNT
    group.current.scale.set(1 - stretch * 0.5, 1 + stretch, 1 - stretch * 0.5)

    // Sonda para comprobar desde consola que el imán devuelve la figura al
    // frente: `__figura().grados` tiene que tender a 0 al volver arriba.
    if (import.meta.env.DEV) {
      Object.assign(window, {
        __figura: () => ({
          grados: +(((THREE.MathUtils.radToDeg(angle.current) % 360) + 360) % 360).toFixed(1),
          iman: +home.toFixed(2),
          giro: +spin.current.toFixed(3),
          respira: +breath.toFixed(3),
          altura: +(group.current!.scale.y).toFixed(4),
        }),
      })
    }
  })

  return <group ref={group}>{children}</group>
}
