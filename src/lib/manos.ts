/*
 * Núcleo del modo manos: filtrado de señal, clasificación de gestos y
 * seguimiento de identidad de las manos.
 *
 * Todo aquí es aritmética pura, sin React ni three.js ni MediaPipe, por dos
 * razones: el bucle de detección lo llama ~30 veces por segundo y no puede
 * generar basura ni repintar nada, y así se prueba con manos sintéticas en
 * `pruebas/manos.test.ts` sin encender una cámara.
 *
 * Parte de `src/lib/manos.ts` del portafolio (pinza, zoom por referencia,
 * conteo de dedos) y añade lo que hace falta para que se sienta como un
 * sistema profesional y no como una demo:
 *
 * - Filtro One Euro en cada señal: sin temblor con la mano quieta, sin
 *   retraso con la mano en movimiento.
 * - Gestos con histéresis: entrar en un gesto exige más que mantenerlo, así
 *   que nada parpadea en la frontera.
 * - Identidad de las manos por continuidad: la etiqueta izquierda/derecha de
 *   MediaPipe salta a veces de un fotograma a otro, y eso hacía saltar la
 *   figura de mano.
 */

/* ── Rutas de MediaPipe (las mismas que el portafolio) ─────────────────── */

export const RUTA_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
export const RUTA_MODELO_MANO =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

/** Un punto del esqueleto de la mano, en coordenadas de imagen (0..1). */
export type Punto = { x: number; y: number; z: number }

const MUNECA = 0
const PULGAR = 4
const PULGAR_IP = 3
const INDICE = 8
const NUDILLO_MEDIO = 9
/** Punta y articulación media de índice, corazón, anular y meñique. */
const DEDOS: [number, number][] = [
  [8, 6],
  [12, 10],
  [16, 14],
  [20, 18],
]

/** Las 21 articulaciones unidas como las dibuja MediaPipe: para pintar el esqueleto. */
export const CONEXIONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

const dist = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y)
const escala = (p: Punto[]) => Math.max(1e-3, dist(p[MUNECA], p[NUDILLO_MEDIO]))

export const recorta = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/* ── Geometría de la mano ──────────────────────────────────────────────── */

/** Centro de la mano. El nudillo del corazón tiembla mucho menos que la muñeca. */
export function centro(p: Punto[]): { x: number; y: number } {
  return { x: p[NUDILLO_MEDIO].x, y: p[NUDILLO_MEDIO].y }
}

/** ¿Cada dedo largo estirado? Índice, corazón, anular, meñique. */
export function dedosLargos(p: Punto[]): boolean[] {
  return DEDOS.map(([punta, media]) => dist(p[punta], p[MUNECA]) > dist(p[media], p[MUNECA]))
}

/** Cuántos dedos están estirados, de 0 a 5. */
export function contarDedos(p: Punto[]): number {
  const pulgar = dist(p[PULGAR], p[MUNECA]) > dist(p[PULGAR_IP], p[MUNECA]) ? 1 : 0
  return pulgar + dedosLargos(p).filter(Boolean).length
}

/** Apertura de la pinza pulgar–índice, normalizada por el tamaño de la mano (≈0.25 junta, ≈1.2 abierta). */
export function pinza(p: Punto[]): number {
  return dist(p[PULGAR], p[INDICE]) / escala(p)
}

/* ── Zoom (igual que el portafolio) ────────────────────────────────────── */

const SENSIBILIDAD_ZOOM = 0.9

/** Zoom a partir de la pinza, medido contra la pose con la que apareció la mano. */
export function zoomDesdePinza(actual: number, referencia: number) {
  return recorta(1 + (referencia - actual) * SENSIBILIDAD_ZOOM, 0.55, 1.6)
}

/** El cero del zoom sale de un solo fotograma: se recorta a lo que una mano puede dar de sí. */
export const referenciaValida = (v: number) => recorta(v, 0.35, 1.45)

/* ── Filtro One Euro ───────────────────────────────────────────────────── */

/**
 * Filtro One Euro (Casiez, Roussel y Vogel, CHI 2012).
 *
 * Un paso bajo cuyo corte se adapta a la velocidad de la señal: con la mano
 * quieta el corte es bajo y se come el temblor de la detección; en cuanto la
 * mano se mueve, el corte sube y la señal pasa casi sin retraso. Es lo que
 * usan los sistemas de seguimiento serios, y la diferencia frente a un
 * suavizado fijo se nota justo donde importa: una figura que no tiembla en
 * reposo pero que tampoco va "arrastrada" detrás de la mano.
 *
 * - `minCorte` (Hz): suavizado en reposo. Más bajo, más estable.
 * - `beta`: cuánto sube el corte con la velocidad. Más alto, menos retraso.
 */
export class FiltroEuro {
  private x: number | null = null
  private dx = 0
  private t = 0
  private minCorte: number
  private beta: number
  private corteDerivada: number

  constructor(minCorte = 1.0, beta = 0.02, corteDerivada = 1.0) {
    this.minCorte = minCorte
    this.beta = beta
    this.corteDerivada = corteDerivada
  }

  private static alfa(corte: number, dt: number) {
    const tau = 1 / (2 * Math.PI * corte)
    return 1 / (1 + tau / dt)
  }

  /** `t` en segundos. Devuelve el valor filtrado. */
  filtrar(valor: number, t: number): number {
    if (this.x === null) {
      this.x = valor
      this.t = t
      this.dx = 0
      return valor
    }
    const dt = Math.max(1e-3, t - this.t)
    this.t = t
    const dxBruta = (valor - this.x) / dt
    this.dx += FiltroEuro.alfa(this.corteDerivada, dt) * (dxBruta - this.dx)
    const corte = this.minCorte + this.beta * Math.abs(this.dx)
    this.x += FiltroEuro.alfa(corte, dt) * (valor - this.x)
    return this.x
  }

  /** Velocidad filtrada (unidades por segundo). */
  get velocidad() {
    return this.dx
  }

  get valor() {
    return this.x
  }

  reiniciar() {
    this.x = null
    this.dx = 0
  }
}

/* ── Gestos de la mano principal ───────────────────────────────────────── */

/**
 * - `abierta`: cuatro o cinco dedos. La figura sigue a la mano y se puede
 *   deslizar para cambiar de figura.
 * - `agarre`: pinza pulgar–índice con los otros dedos abiertos (el gesto de
 *   "OK"). La figura queda quieta y se gira arrastrando, como si se cogiera.
 * - `puno`: la figura se lleva de un lado a otro sin disparar nada.
 * - `neutra`: cualquier otra cosa; sigue a la mano y nada más.
 */
export type Gesto = 'abierta' | 'agarre' | 'puno' | 'neutra'

/** Histéresis de la pinza: cerrarla para agarrar exige más que mantenerla cerrada. */
const PINZA_ENTRA = 0.38
const PINZA_SALE = 0.55
/** Fotogramas seguidos que tiene que durar un gesto nuevo para que cuente (salvo soltar el agarre). */
const CONFIRMACION = 2

/** Lo que dice la mano en un solo fotograma, sin memoria. */
export function gestoInstantaneo(p: Punto[], enAgarre: boolean): Gesto {
  const largos = dedosLargos(p)
  // Corazón, anular y meñique: abiertos en el "OK", recogidos en el puño.
  const restoAbiertos = largos.slice(1).filter(Boolean).length
  const pz = pinza(p)
  if (restoAbiertos >= 2 && pz < (enAgarre ? PINZA_SALE : PINZA_ENTRA)) return 'agarre'
  const n = contarDedos(p)
  if (n >= 4) return 'abierta'
  if (n <= 1) return 'puno'
  return 'neutra'
}

/**
 * Gesto con memoria: uno nuevo tiene que verse `CONFIRMACION` fotogramas
 * seguidos antes de sustituir al actual. Una detección mala suelta no cambia
 * nada. Soltar el agarre es la excepción: se aplica al instante, porque
 * quedarse "pegado" a la figura un fotograma de más se siente peor que
 * soltarla uno antes.
 */
export class MaquinaGestos {
  gesto: Gesto = 'neutra'
  private candidato: Gesto = 'neutra'
  private cuenta = 0

  actualizar(p: Punto[]): Gesto {
    const g = gestoInstantaneo(p, this.gesto === 'agarre')
    if (g === this.gesto) {
      this.cuenta = 0
      return this.gesto
    }
    if (this.gesto === 'agarre') {
      this.gesto = g
      this.cuenta = 0
      return g
    }
    if (g === this.candidato) this.cuenta++
    else {
      this.candidato = g
      this.cuenta = 1
    }
    if (this.cuenta >= CONFIRMACION) {
      this.gesto = g
      this.cuenta = 0
    }
    return this.gesto
  }

  reiniciar() {
    this.gesto = 'neutra'
    this.candidato = 'neutra'
    this.cuenta = 0
  }
}

/* ── Deslizar para cambiar de figura ───────────────────────────────────── */

/**
 * Un deslizamiento es rápido Y largo: velocidad filtrada por encima de
 * `velocidadMin` (anchos de imagen por segundo) y un recorrido de al menos
 * `recorridoMin` dentro de la ventana. Con solo una de las dos condiciones,
 * o un tirón corto disparaba cambios o mover la figura con calma los
 * disparaba también.
 *
 * Tras disparar, una espera y el historial vacío: la vuelta de la mano a su
 * sitio no cuenta como deslizar hacia el otro lado.
 */
export class Deslizamiento {
  private historial: { t: number; x: number }[] = []
  private bloqueadoHasta = 0
  private velocidadMin: number
  private recorridoMin: number
  private ventana: number
  private espera: number

  constructor(velocidadMin = 1.1, recorridoMin = 0.14, ventana = 0.32, espera = 0.7) {
    this.velocidadMin = velocidadMin
    this.recorridoMin = recorridoMin
    this.ventana = ventana
    this.espera = espera
  }

  /** `t` en segundos, `x` en pantalla (0 izquierda, 1 derecha), `vx` velocidad filtrada. 1 = hacia la derecha. */
  leer(t: number, x: number, vx: number): -1 | 0 | 1 {
    this.historial.push({ t, x })
    while (this.historial.length && t - this.historial[0].t > this.ventana) this.historial.shift()
    if (t < this.bloqueadoHasta || this.historial.length < 3) return 0
    const recorrido = x - this.historial[0].x
    if (Math.abs(recorrido) < this.recorridoMin || Math.abs(vx) < this.velocidadMin) return 0
    if (Math.sign(recorrido) !== Math.sign(vx)) return 0
    this.bloqueadoHasta = t + this.espera
    this.historial = []
    return recorrido > 0 ? 1 : -1
  }

  /** Progreso del gesto en curso, de -1 a 1, para dibujarlo en pantalla. */
  progreso(): number {
    if (this.historial.length < 2) return 0
    const r = this.historial[this.historial.length - 1].x - this.historial[0].x
    return recorta(r / this.recorridoMin, -1, 1)
  }

  reiniciar() {
    this.historial = []
  }
}

/* ── Identidad de las manos ────────────────────────────────────────────── */

export type Deteccion = { puntos: Punto[]; etiqueta: 'Left' | 'Right'; confianza: number }

/**
 * Decide cuál de las manos detectadas es la principal (la que lleva la
 * figura) y cuál la secundaria (la del zoom).
 *
 * La etiqueta de MediaPipe es la primera opinión, pero no la última: si en el
 * fotograma anterior había una principal y ahora alguna mano está justo donde
 * estaba, esa sigue siendo la principal aunque la etiqueta diga otra cosa.
 * Sin esto, una mano que gira un poco cambia de etiqueta un fotograma y la
 * figura salta a la otra mano.
 *
 * `invertida` cambia el criterio de etiqueta (imagen sin reflejar: MediaPipe
 * llama "Right" a la mano izquierda del usuario, ver el portafolio).
 */
export class IdentidadManos {
  private ultimaPrincipal: { x: number; y: number; t: number } | null = null
  /** Cuánto puede moverse una mano entre fotogramas y seguir siendo "la misma" (fracción de imagen). */
  private radio = 0.12
  /** Segundos que se recuerda dónde estaba la principal tras perderla. */
  private memoria = 0.4

  asignar(detecciones: Deteccion[], t: number, invertida: boolean): { principal?: Punto[]; secundaria?: Punto[] } {
    const esPrincipalPorEtiqueta = (d: Deteccion) => (invertida ? d.etiqueta === 'Left' : d.etiqueta === 'Right')
    let principal: Deteccion | undefined
    let secundaria: Deteccion | undefined

    const previa = this.ultimaPrincipal && t - this.ultimaPrincipal.t < this.memoria ? this.ultimaPrincipal : null
    if (previa && detecciones.length) {
      let mejor: Deteccion | undefined
      let mejorD = Infinity
      for (const d of detecciones) {
        const c = centro(d.puntos)
        const dd = Math.hypot(c.x - previa.x, c.y - previa.y)
        if (dd < mejorD) {
          mejorD = dd
          mejor = d
        }
      }
      if (mejor && mejorD < this.radio) {
        principal = mejor
        secundaria = detecciones.find((d) => d !== mejor)
      }
    }

    if (!principal) {
      for (const d of detecciones) {
        if (esPrincipalPorEtiqueta(d) && (!principal || d.confianza > principal.confianza)) principal = d
      }
      secundaria = detecciones.find((d) => d !== principal)
    }

    if (principal) {
      const c = centro(principal.puntos)
      this.ultimaPrincipal = { x: c.x, y: c.y, t }
    }
    return { principal: principal?.puntos, secundaria: secundaria?.puntos }
  }
}
