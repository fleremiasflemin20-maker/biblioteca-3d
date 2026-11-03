/*
 * Física ligera de la pieza en el modo manos: un sólido rígido con gravedad,
 * rebotes contra el suelo y los bordes de la pantalla, rozamiento, giro al
 * rodar y un "tentetieso" suave que la deja de pie al pararse.
 *
 * No es un motor de física general —hay un solo cuerpo y una caja—, y por eso
 * cabe en una página y no pesa nada: un paso cuesta unas pocas
 * multiplicaciones. Sin React: se prueba en `pruebas/fisica.test.ts`.
 */
import * as THREE from 'three'

export const GRAVEDAD = 14
/** Rebote contra el suelo y contra las paredes (0 = plastilina, 1 = goma perfecta). */
const REBOTE_SUELO = 0.48
const REBOTE_PARED = 0.6
/** Por debajo de esta velocidad de choque el rebote se apaga: la pieza se asienta. */
const CHOQUE_MIN = 0.7
const ROCE_SUELO = 3.2
const ROCE_AIRE = 0.15
const ROCE_GIRO_AIRE = 0.35
const ROCE_GIRO_SUELO = 4.5
/** Fuerza con que la pieza se endereza al quedar apoyada. */
const ENDEREZA = 16
const VEL_MAX = 16
const GIRO_MAX = 22

export type Limites = {
  /** Altura del suelo (mundo). */
  suelo: number
  /** Techo, paredes izquierda/derecha y fondo/frente, en el plano z = 0. */
  techo: number
  ancho: number
  fondo: number
  frente: number
  /** Distancia de la cámara al plano z = 0: las paredes se abren con la perspectiva. */
  camaraZ: number
}

export type Cuerpo = {
  p: THREE.Vector3
  v: THREE.Vector3
  q: THREE.Quaternion
  /** Velocidad angular (rad/s) en ejes de mundo. */
  w: THREE.Vector3
  /** Semiejes de la caja de la pieza en sus propios ejes. */
  semi: THREE.Vector3
  dormido: boolean
  apoyado: boolean
}

export const nuevoCuerpo = (): Cuerpo => ({
  p: new THREE.Vector3(),
  v: new THREE.Vector3(),
  q: new THREE.Quaternion(),
  w: new THREE.Vector3(),
  semi: new THREE.Vector3(0.65, 0.65, 0.65),
  dormido: true,
  apoyado: true,
})

const _m = new THREE.Matrix3()
const _m4 = new THREE.Matrix4()
const _ext = new THREE.Vector3()
const _arriba = new THREE.Vector3()
const _par = new THREE.Vector3()
const _dq = new THREE.Quaternion()
const _rodar = new THREE.Vector3()
const Y = new THREE.Vector3(0, 1, 0)

/** Semiejes de la caja alineada con el mundo que envuelve a la pieza girada. */
export function extension(c: Cuerpo, out = _ext): THREE.Vector3 {
  _m.setFromMatrix4(_m4.makeRotationFromQuaternion(c.q))
  const e = _m.elements // columnas
  const s = c.semi
  out.set(
    Math.abs(e[0]) * s.x + Math.abs(e[3]) * s.y + Math.abs(e[6]) * s.z,
    Math.abs(e[1]) * s.x + Math.abs(e[4]) * s.y + Math.abs(e[7]) * s.z,
    Math.abs(e[2]) * s.x + Math.abs(e[5]) * s.y + Math.abs(e[8]) * s.z,
  )
  return out
}

/** La pieza de pie, quieta y apoyada en el centro del suelo. */
export function colocarEnReposo(c: Cuerpo, l: Limites) {
  c.q.identity()
  c.v.set(0, 0, 0)
  c.w.set(0, 0, 0)
  c.p.set(0, l.suelo + c.semi.y, 0)
  c.dormido = true
  c.apoyado = true
}

/** Integra la orientación con la velocidad angular durante `dt`. */
export function girar(q: THREE.Quaternion, w: THREE.Vector3, dt: number) {
  const ang = w.length() * dt
  if (ang < 1e-7) return
  _dq.setFromAxisAngle(_rodar.copy(w).normalize(), ang)
  q.premultiply(_dq).normalize()
}

/**
 * Un paso de simulación. Devuelve la velocidad del choque más fuerte de este
 * paso (0 si no chocó), para hacerlo sonar.
 */
export function paso(c: Cuerpo, l: Limites, dt: number): number {
  if (c.dormido) return 0
  let golpe = 0

  c.v.y -= GRAVEDAD * dt
  c.v.multiplyScalar(Math.exp(-ROCE_AIRE * dt))
  c.w.multiplyScalar(Math.exp(-(c.apoyado ? ROCE_GIRO_SUELO : ROCE_GIRO_AIRE) * dt))
  if (c.v.length() > VEL_MAX) c.v.setLength(VEL_MAX)
  if (c.w.length() > GIRO_MAX) c.w.setLength(GIRO_MAX)

  c.p.addScaledVector(c.v, dt)
  girar(c.q, c.w, dt)

  const ext = extension(c)
  const radio = Math.max(0.2, (ext.x + ext.z) / 2)
  c.apoyado = false

  // Suelo.
  const bajo = l.suelo + ext.y
  if (c.p.y <= bajo) {
    c.p.y = bajo
    c.apoyado = true
    if (c.v.y < 0) {
      const choque = -c.v.y
      golpe = Math.max(golpe, choque)
      c.v.y = choque > CHOQUE_MIN ? choque * REBOTE_SUELO : 0
      // El roce del golpe convierte parte del deslizamiento en vuelta: rueda.
      _rodar.crossVectors(Y, c.v).divideScalar(radio)
      c.w.lerp(_rodar, Math.min(1, choque * 0.06))
    }
    const f = Math.exp(-ROCE_SUELO * dt)
    c.v.x *= f
    c.v.z *= f
  }

  // Techo y paredes. Se abren con la perspectiva: a más fondo, más sitio.
  const k = (l.camaraZ - c.p.z) / l.camaraZ
  const techo = l.techo * k - ext.y
  if (c.p.y > techo) {
    c.p.y = techo
    if (c.v.y > 0) {
      golpe = Math.max(golpe, c.v.y)
      c.v.y = -c.v.y * REBOTE_PARED
    }
  }
  const ancho = l.ancho * k - ext.x
  if (Math.abs(c.p.x) > ancho) {
    const lado = Math.sign(c.p.x)
    c.p.x = lado * ancho
    if (c.v.x * lado > 0) {
      golpe = Math.max(golpe, Math.abs(c.v.x))
      c.v.x = -c.v.x * REBOTE_PARED
      c.w.y += -lado * c.v.z * 0.5
      c.w.z += lado * c.v.y * 0.3
    }
  }
  if (c.p.z < l.fondo + ext.z) {
    c.p.z = l.fondo + ext.z
    if (c.v.z < 0) {
      golpe = Math.max(golpe, -c.v.z)
      c.v.z = -c.v.z * REBOTE_PARED
    }
  }
  if (c.p.z > l.frente - ext.z) {
    c.p.z = l.frente - ext.z
    if (c.v.z > 0) {
      golpe = Math.max(golpe, c.v.z)
      c.v.z = -c.v.z * REBOTE_PARED
    }
  }

  // Apoyada y casi quieta: se endereza poco a poco, como una figura con peso
  // en la base, y la deriva de la pieza hacia el frente vuelve a z = 0.
  if (c.apoyado && c.v.lengthSq() < 4) {
    _arriba.copy(Y).applyQuaternion(c.q)
    _par.crossVectors(_arriba, Y)
    if (_arriba.dot(Y) < -0.95) _par.set(1, 0, 0)
    c.w.addScaledVector(_par, ENDEREZA * dt)
    c.w.y *= Math.exp(-3 * dt)
    c.v.z += -c.p.z * 2 * dt
    if (c.v.lengthSq() < 0.0025 && c.w.lengthSq() < 0.0025 && _arriba.dot(Y) > 0.9995 && Math.abs(c.p.z) < 0.02) {
      c.v.set(0, 0, 0)
      c.w.set(0, 0, 0)
      c.dormido = true
    }
  }
  return golpe
}

/**
 * Historial corto de la pieza mientras está en la mano. Al soltarla, la
 * velocidad y el giro salen de la diferencia con lo que pasaba hace ~0.1 s:
 * un solo fotograma es demasiado ruidoso, una ventana larga se come el gesto.
 */
export class Estela {
  private puntos: { t: number; p: THREE.Vector3; q: THREE.Quaternion }[] = []
  private ventana: number

  constructor(ventana = 0.1) {
    this.ventana = ventana
  }

  anotar(t: number, p: THREE.Vector3, q: THREE.Quaternion) {
    this.puntos.push({ t, p: p.clone(), q: q.clone() })
    while (this.puntos.length > 2 && t - this.puntos[1].t >= this.ventana) this.puntos.shift()
  }

  /** Escribe en `v` y `w` la velocidad lineal y angular del lanzamiento. */
  lanzamiento(v: THREE.Vector3, w: THREE.Vector3) {
    v.set(0, 0, 0)
    w.set(0, 0, 0)
    if (this.puntos.length < 2) return
    const a = this.puntos[0]
    const b = this.puntos[this.puntos.length - 1]
    const dt = b.t - a.t
    if (dt < 1e-3) return
    v.subVectors(b.p, a.p).divideScalar(dt)
    _dq.copy(a.q).invert().premultiply(b.q)
    if (_dq.w < 0) _dq.set(-_dq.x, -_dq.y, -_dq.z, -_dq.w)
    const ang = 2 * Math.acos(Math.min(1, _dq.w))
    const s = Math.sqrt(Math.max(0, 1 - _dq.w * _dq.w))
    if (s > 1e-5) w.set(_dq.x / s, _dq.y / s, _dq.z / s).multiplyScalar(ang / dt)
  }

  vaciar() {
    this.puntos = []
  }
}
