/*
 * Los gestos del modo manos, comprobados con manos sintéticas.
 *
 * Igual que en el portafolio: la aritmética de los gestos es lo que más fácil
 * se equivoca y lo más caro de probar a mano. Aquí se prueba en un segundo.
 *
 *   npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  Agarre,
  Deslizamiento,
  FiltroEuro,
  PistasManos,
  centroPalma,
  cierre,
  cuaternionPalma,
  ejesPalma,
  escalaAparente,
  type Punto,
} from '../src/lib/manos.ts'

// Mano vertical en coordenadas de imagen (la y crece hacia abajo), dedos arriba.
function abierta(dx = 0, dy = 0): Punto[] {
  const p: Punto[] = new Array(21).fill(0).map(() => ({ x: 0.5, y: 0.5, z: 0 }))
  p[0] = { x: 0.5, y: 0.9, z: 0 }
  p[1] = { x: 0.42, y: 0.84, z: 0 }
  p[2] = { x: 0.36, y: 0.76, z: 0 }
  p[3] = { x: 0.32, y: 0.69, z: 0 }
  p[4] = { x: 0.29, y: 0.62, z: 0 }
  for (const [mcp, x] of [[5, 0.44], [9, 0.5], [13, 0.56], [17, 0.62]] as const) {
    p[mcp] = { x, y: 0.62, z: 0 }
    p[mcp + 1] = { x, y: 0.48, z: 0 }
    p[mcp + 2] = { x, y: 0.38, z: 0 }
    p[mcp + 3] = { x, y: 0.3, z: 0 }
  }
  return p.map((q) => ({ x: q.x + dx, y: q.y + dy, z: 0 }))
}

/** Dedos largos recogidos y pulgar cruzado por delante: el puño de verdad. */
function puno(): Punto[] {
  const p = abierta()
  for (const mcp of [5, 9, 13, 17]) {
    p[mcp + 1] = { x: p[mcp].x, y: 0.52, z: 0 }
    p[mcp + 2] = { x: p[mcp].x, y: 0.58, z: 0 }
    p[mcp + 3] = { x: p[mcp].x, y: 0.64, z: 0 }
  }
  p[3] = { x: 0.42, y: 0.7, z: 0 }
  p[4] = { x: 0.47, y: 0.66, z: 0 } // la punta del pulgar queda pegada a la del índice
  return p
}

/** Pinza: pulgar e índice juntos, los otros tres abiertos. */
function pinzaOK(): Punto[] {
  const p = abierta()
  p[6] = { x: 0.4, y: 0.52, z: 0 }
  p[7] = { x: 0.37, y: 0.56, z: 0 }
  p[8] = { x: 0.35, y: 0.6, z: 0 }
  p[4] = { x: 0.34, y: 0.61, z: 0 }
  return p
}

/** Gira una mano alrededor del eje z (mirando a la cámara), en torno a su palma. */
function girada(p: Punto[], ang: number): Punto[] {
  const c = centroPalma(p)
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return p.map((q) => ({ x: c.x + (q.x - c.x) * co - (q.y - c.y) * si, y: c.y + (q.x - c.x) * si + (q.y - c.y) * co, z: q.z }))
}

const cada = <T,>(n: number, f: () => T) => Array.from({ length: n }, f)

test('el cierre distingue mano abierta, puño y pinza', () => {
  assert.ok(cierre(abierta()) < 0.15, `abierta ${cierre(abierta())}`)
  assert.ok(cierre(puno()) > 0.8, `puño ${cierre(puno())}`)
  assert.ok(cierre(pinzaOK()) < 0.6)
})

test('girar la mano no la abre ni la cierra', () => {
  for (const ang of [0.4, 1.2, 2.5]) {
    assert.ok(Math.abs(cierre(girada(abierta(), ang)) - cierre(abierta())) < 1e-9)
    assert.ok(Math.abs(cierre(girada(puno(), ang)) - cierre(puno())) < 1e-9)
  }
})

test('el agarre coge con puño o con pinza, pide dos fotogramas y suelta al abrir', () => {
  const a = new Agarre()
  assert.equal(a.actualizar(abierta()), false)
  // Un fotograma suelto de puño (una detección mala) no coge.
  assert.equal(a.actualizar(puno()), false)
  assert.equal(a.actualizar(abierta()), false)
  cada(2, () => a.actualizar(puno()))
  assert.equal(a.cerrada, true)
  assert.equal(a.porPinza, false)
  assert.equal(a.actualizar(abierta()), false)
  cada(2, () => a.actualizar(pinzaOK()))
  assert.equal(a.cerrada, true)
  assert.equal(a.porPinza, true)
})

test('el agarre no se suelta a medio abrir: histéresis', () => {
  const a = new Agarre()
  cada(2, () => a.actualizar(puno()))
  // Dedos a medio recoger: no bastaría para coger, pero tampoco suelta.
  const medio = puno()
  for (const mcp of [5, 9, 13, 17]) {
    medio[mcp + 3] = { x: medio[mcp].x, y: 0.5, z: 0 }
  }
  const c = cierre(medio)
  assert.ok(c < 0.6 && c > 0.38, `cierre a medias ${c}`)
  assert.equal(a.actualizar(medio), true)
  const b = new Agarre()
  cada(3, () => b.actualizar(medio))
  assert.equal(b.cerrada, false)
})

test('la orientación de la palma sigue el giro de la muñeca', () => {
  const q0 = cuaternionPalma(...Object.values(ejesPalma(abierta())) as [never, never])
  const q1 = cuaternionPalma(...Object.values(ejesPalma(girada(abierta(), 0.5))) as [never, never])
  // Ángulo entre los dos cuaterniones = 0.5 rad.
  const punto = Math.abs(q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3])
  assert.ok(Math.abs(2 * Math.acos(Math.min(1, punto)) - 0.5) < 1e-6)
})

test('la escala aparente crece al acercar la mano y casi no cambia al girarla', () => {
  const mundo = abierta()
  const cerca = abierta().map((q) => ({ x: 0.5 + (q.x - 0.5) * 1.5, y: 0.5 + (q.y - 0.5) * 1.5, z: 0 }))
  assert.ok(Math.abs(escalaAparente(cerca, mundo) / escalaAparente(abierta(), mundo) - 1.5) < 1e-9)
  // Inclinada 40° hacia atrás: la palma se acorta en y, pero el hueso transversal no.
  const inclinada = abierta().map((q) => ({ x: q.x, y: 0.5 + (q.y - 0.5) * Math.cos(0.7), z: 0 }))
  assert.ok(escalaAparente(inclinada, mundo) / escalaAparente(abierta(), mundo) > 0.97)
})

test('el filtro One Euro se come el temblor en reposo', () => {
  const f = new FiltroEuro(1.0, 0.02)
  let maxDesvio = 0
  for (let i = 0; i < 120; i++) {
    const ruido = (i % 2 ? 1 : -1) * 0.01
    const v = f.filtrar(0.5 + ruido, i / 30)
    if (i > 30) maxDesvio = Math.max(maxDesvio, Math.abs(v - 0.5))
  }
  assert.ok(maxDesvio < 0.004, `desvío ${maxDesvio}`)
})

test('el filtro One Euro sigue un movimiento rápido sin quedarse atrás', () => {
  const f = new FiltroEuro(1.0, 0.02)
  let v = 0
  // 0.3 → 0.7 en un tercio de segundo, y luego quieto.
  for (let i = 0; i <= 20; i++) {
    const x = i <= 10 ? 0.3 + 0.04 * i : 0.7
    v = f.filtrar(x, i / 30)
  }
  assert.ok(Math.abs(v - 0.7) < 0.03, `quedó en ${v}`)
})

test('deslizar dispara una vez y la vuelta no cuenta', () => {
  const d = new Deslizamiento()
  const f = new FiltroEuro(1.0, 0.02)
  const disparos: number[] = []
  // Ida rápida hacia la derecha y vuelta igual de rápida.
  const xs = [...Array.from({ length: 8 }, (_, i) => 0.3 + i * 0.06), ...Array.from({ length: 8 }, (_, i) => 0.72 - i * 0.06)]
  xs.forEach((x, i) => {
    const t = i / 30
    f.filtrar(x, t)
    const r = d.leer(t, x, f.velocidad)
    if (r) disparos.push(r)
  })
  assert.deepEqual(disparos, [1])
})

test('mover la figura con calma no dispara un deslizamiento', () => {
  const d = new Deslizamiento()
  const f = new FiltroEuro(1.0, 0.02)
  let disparos = 0
  for (let i = 0; i < 90; i++) {
    const x = 0.3 + i * 0.005 // 0.15 anchos por segundo
    f.filtrar(x, i / 30)
    if (d.leer(i / 30, x, f.velocidad)) disparos++
  }
  assert.equal(disparos, 0)
})

test('las pistas no cruzan las manos aunque MediaPipe cambie el orden', () => {
  const p = new PistasManos()
  const a = centroPalma(abierta(0.2))
  const b = centroPalma(abierta(-0.25))
  assert.deepEqual(p.asignar([a, b], 0), [0, 1])
  // Siguiente fotograma: llegan al revés, casi en el mismo sitio.
  const a2 = { x: a.x + 0.01, y: a.y }
  assert.deepEqual(p.asignar([b, a2], 1 / 30), [1, 0])
  // Se va la mano de la pista 0 un momento: la 1 sigue siendo la 1.
  assert.deepEqual(p.asignar([b], 2 / 30), [-1, 0])
  assert.deepEqual(p.asignar([a2, b], 3 / 30), [0, 1])
})
