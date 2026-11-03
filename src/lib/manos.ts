/*
 * Núcleo del modo manos: filtrado de señal, lectura de la mano (cuánto está
 * cerrada, hacia dónde mira, a qué distancia está) y seguimiento de cada mano
 * entre fotogramas.
 *
 * Todo aquí es aritmética pura, sin React ni three.js ni MediaPipe: el bucle
 * de detección lo llama ~30–60 veces por segundo y no puede generar basura ni
 * repintar nada, y así se prueba con manos sintéticas en `pruebas/manos.test.ts`
 * sin encender una cámara.
 *
 * Lo que hace que se sienta como tener la pieza en la mano:
 *
 * - Filtro One Euro en cada señal: sin temblor con la mano quieta, sin
 *   retraso con la mano en movimiento.
 * - Cierre de la mano medido en 3D (landmarks de mundo de MediaPipe, en
 *   metros): girar la mano no la "abre" ni la "cierra" como pasa midiendo en
 *   la imagen plana.
 * - Agarre con histéresis: cerrar para coger exige más que mantenerla cerrada,
 *   así que la pieza no se cae por un fotograma dudoso.
 * - Orientación de la palma como un marco 3D: la pieza gira con la muñeca.
 * - Cada mano conserva su identidad por continuidad: MediaPipe a veces cambia
 *   el orden de las manos entre fotogramas y eso hacía saltar la pieza.
 */

/* ── Rutas de MediaPipe ────────────────────────────────────────────────── */

export const RUTA_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
export const RUTA_MODELO_MANO =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

/** Un punto del esqueleto de la mano: en la imagen (0..1) o en el mundo (metros). */
export type Punto = { x: number; y: number; z: number }

const MUNECA = 0
const PULGAR = 4
const INDICE = 8
const NUDILLO_INDICE = 5
const NUDILLO_MEDIO = 9
const NUDILLO_MENIQUE = 17
/** Punta y nudillo de índice, corazón, anular y meñique. */
const DEDOS: [number, number][] = [
  [8, 5],
  [12, 9],
  [16, 13],
  [20, 17],
]
/** Huesos de la palma que casi no se deforman: sirven para medir la distancia a la cámara. */
const HUESOS_PALMA: [number, number][] = [
  [0, 5],
  [0, 9],
  [0, 17],
  [5, 17],
  [5, 9],
  [9, 13],
  [13, 17],
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

const dist3 = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const dist2 = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y)

export const recorta = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/* ── Lectura de la mano ────────────────────────────────────────────────── */

/** Centro de la palma en la imagen: media de muñeca y nudillos, mucho más estable que un solo punto. */
export function centroPalma(p: Punto[]): { x: number; y: number } {
  const ids = [MUNECA, NUDILLO_INDICE, NUDILLO_MEDIO, 13, NUDILLO_MENIQUE]
  let x = 0
  let y = 0
  for (const i of ids) {
    x += p[i].x
    y += p[i].y
  }
  return { x: x / ids.length, y: y / ids.length }
}

/**
 * Cuánto está cerrada la mano, de 0 (abierta del todo) a 1 (puño).
 *
 * Por dedo: distancia de la punta a la muñeca contra la del nudillo a la
 * muñeca. Estirado da ≈1.9, recogido ≈1.0. Medido en 3D no depende de cómo
 * esté girada la mano.
 */
export function cierre(p: Punto[]): number {
  let abierto = 0
  for (const [punta, nudillo] of DEDOS) {
    const r = dist3(p[punta], p[MUNECA]) / Math.max(1e-6, dist3(p[nudillo], p[MUNECA]))
    abierto += recorta((r - 1.12) / (1.7 - 1.12), 0, 1)
  }
  return 1 - abierto / DEDOS.length
}

/** Apertura de la pinza pulgar–índice, normalizada por el tamaño de la palma (≈0.2 junta, ≈1.2 abierta). */
export function pinza(p: Punto[]): number {
  return dist3(p[PULGAR], p[INDICE]) / Math.max(1e-6, dist3(p[MUNECA], p[NUDILLO_MEDIO]))
}

/**
 * Tamaño aparente de la mano: cuánto mide en la imagen cada hueso de la
 * palma comparado con su largo real. Se queda con el mayor, el del hueso
 * menos escorzado, así que inclinar la mano apenas lo cambia y acercarla a
 * la cámara sí. Sirve para llevar la pieza hacia ti o alejarla.
 */
export function escalaAparente(imagen: Punto[], mundo: Punto[]): number {
  let mejor = 0
  for (const [a, b] of HUESOS_PALMA) {
    const real = dist3(mundo[a], mundo[b])
    if (real < 1e-4) continue
    mejor = Math.max(mejor, dist2(imagen[a], imagen[b]) / real)
  }
  return mejor
}

export type Vec3 = [number, number, number]

const normaliza = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
const cruz = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/**
 * Pasa un punto de mundo de MediaPipe (x a la derecha de la imagen, y hacia
 * abajo, z hacia dentro) a la escena tal como se ve en pantalla: espejada,
 * con y hacia arriba y z hacia quien mira.
 */
export const aEscena = (q: Punto): Vec3 => [-q.x, -q.y, -q.z]

/**
 * Orientación de la palma en la escena: `arriba` va de la muñeca al nudillo
 * del corazón y `lado` de meñique a índice, ortogonalizados. Como la base se
 * construye con productos vectoriales es una rotación propia aunque la imagen
 * vaya espejada, y el giro relativo entre dos instantes es exactamente el que
 * se ve en el espejo.
 */
export function ejesPalma(mundo: Punto[]): { arriba: Vec3; lado: Vec3 } {
  const m = aEscena(mundo[MUNECA])
  const c = aEscena(mundo[NUDILLO_MEDIO])
  const i = aEscena(mundo[NUDILLO_INDICE])
  const k = aEscena(mundo[NUDILLO_MENIQUE])
  const arriba = normaliza([c[0] - m[0], c[1] - m[1], c[2] - m[2]])
  let lado: Vec3 = [i[0] - k[0], i[1] - k[1], i[2] - k[2]]
  const normal = normaliza(cruz(arriba, lado))
  lado = normaliza(cruz(normal, arriba))
  return { arriba, lado }
}

/**
 * Cuaternión (x, y, z, w) de la base ortonormal (lado, arriba, lado × arriba).
 * `arriba` y `lado` pueden venir filtrados y algo torcidos: se reortogonalizan.
 */
export function cuaternionPalma(arriba: Vec3, ladoBruto: Vec3): [number, number, number, number] {
  const y = normaliza(arriba)
  const z = normaliza(cruz(ladoBruto, y))
  const x = cruz(y, z)
  // Matriz de columnas x, y, z → cuaternión (Shepperd).
  const m00 = x[0], m01 = y[0], m02 = z[0]
  const m10 = x[1], m11 = y[1], m12 = z[1]
  const m20 = x[2], m21 = y[2], m22 = z[2]
  const traza = m00 + m11 + m22
  if (traza > 0) {
    const s = 0.5 / Math.sqrt(traza + 1)
    return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22)
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22)
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11)
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]
}

/* ── Filtro One Euro ───────────────────────────────────────────────────── */

/**
 * Filtro One Euro (Casiez, Roussel y Vogel, CHI 2012).
 *
 * Un paso bajo cuyo corte se adapta a la velocidad de la señal: con la mano
 * quieta el corte es bajo y se come el temblor de la detección; en cuanto la
 * mano se mueve, el corte sube y la señal pasa casi sin retraso.
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

/* ── Agarre ────────────────────────────────────────────────────────────── */

/** Histéresis del puño: cerrar para coger exige más que mantenerla cerrada. */
const CIERRE_ENTRA = 0.6
const CIERRE_SALE = 0.38
/** Histéresis de la pinza pulgar–índice. */
const PINZA_ENTRA = 0.36
const PINZA_SALE = 0.55

/**
 * ¿La mano está agarrando? Vale cerrar la mano (como al coger una figura) o
 * hacer pinza con pulgar e índice (como al coger una pieza pequeña).
 *
 * Coger necesita dos fotogramas seguidos: una detección mala suelta no coge
 * nada. Soltar es al instante en cuanto se pasa el umbral de salida, porque
 * quedarse pegado a la pieza se siente peor que soltarla un fotograma antes;
 * la histéresis ya evita que se caiga sola.
 */
export class Agarre {
  cerrada = false
  /** `true` si el agarre empezó como pinza y no como puño. */
  porPinza = false
  private candidato = 0

  actualizar(mundo: Punto[]): boolean {
    const c = cierre(mundo)
    const pz = pinza(mundo)
    if (this.cerrada) {
      if (c < CIERRE_SALE && pz > PINZA_SALE) this.cerrada = false
      this.candidato = 0
      return this.cerrada
    }
    const quiere = c > CIERRE_ENTRA || pz < PINZA_ENTRA
    this.candidato = quiere ? this.candidato + 1 : 0
    if (this.candidato >= 2) {
      this.cerrada = true
      this.porPinza = c <= CIERRE_ENTRA
      this.candidato = 0
    }
    return this.cerrada
  }

  reiniciar() {
    this.cerrada = false
    this.porPinza = false
    this.candidato = 0
  }
}

/* ── Deslizar para cambiar de figura ───────────────────────────────────── */

/**
 * Un deslizamiento es rápido Y largo: velocidad filtrada por encima de
 * `velocidadMin` (anchos de imagen por segundo) y un recorrido de al menos
 * `recorridoMin` dentro de la ventana. Tras disparar, una espera y el
 * historial vacío: la vuelta de la mano a su sitio no cuenta.
 */
export class Deslizamiento {
  private historial: { t: number; x: number }[] = []
  private bloqueadoHasta = 0
  private velocidadMin: number
  private recorridoMin: number
  private ventana: number
  private espera: number

  constructor(velocidadMin = 1.3, recorridoMin = 0.2, ventana = 0.32, espera = 0.8) {
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

/**
 * Reparte las manos detectadas en dos pistas estables. MediaPipe devuelve las
 * manos en cualquier orden; si la pista 0 era la mano que sujeta la pieza,
 * tiene que seguir siéndolo aunque la lista venga al revés. Cada detección va
 * a la pista libre más cercana a donde estaba; una pista que lleva
 * `memoria` segundos sin mano se olvida.
 */
export class PistasManos {
  private ultimas: ({ x: number; y: number; t: number } | null)[] = [null, null]
  private memoria = 0.5
  private radio = 0.25

  /** Devuelve, para cada pista, el índice de la detección que le toca (o -1). */
  asignar(centros: { x: number; y: number }[], t: number): [number, number] {
    const res: [number, number] = [-1, -1]
    for (let k = 0; k < 2; k++) {
      const u = this.ultimas[k]
      if (u && t - u.t > this.memoria) this.ultimas[k] = null
    }
    // Primero, las parejas pista–detección más cercanas.
    const pares: { k: number; i: number; d: number }[] = []
    centros.forEach((c, i) => {
      for (let k = 0; k < 2; k++) {
        const u = this.ultimas[k]
        if (u) pares.push({ k, i, d: Math.hypot(c.x - u.x, c.y - u.y) })
      }
    })
    pares.sort((a, b) => a.d - b.d)
    const usada = new Set<number>()
    for (const { k, i, d } of pares) {
      if (res[k] !== -1 || usada.has(i) || d > this.radio) continue
      res[k] = i
      usada.add(i)
    }
    // Las detecciones nuevas, a una pista vacía.
    centros.forEach((_, i) => {
      if (usada.has(i)) return
      const k = res[0] === -1 && !this.ultimas[0] ? 0 : res[1] === -1 && !this.ultimas[1] ? 1 : res[0] === -1 ? 0 : res[1] === -1 ? 1 : -1
      if (k === -1) return
      res[k] = i
      usada.add(i)
    })
    for (let k = 0; k < 2; k++) {
      const i = res[k]
      if (i !== -1) this.ultimas[k] = { x: centros[i].x, y: centros[i].y, t }
    }
    return res
  }
}
