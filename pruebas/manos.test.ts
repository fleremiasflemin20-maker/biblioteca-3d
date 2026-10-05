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
  Deslizamiento,
  FiltroEuro,
  IdentidadManos,
  MaquinaGestos,
  gestoInstantaneo,
  type Deteccion,
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

/** El "OK": pulgar e índice juntos, los otros tres abiertos. */
function agarre(): Punto[] {
  const p = abierta()
  p[6] = { x: 0.4, y: 0.52, z: 0 }
  p[7] = { x: 0.37, y: 0.56, z: 0 }
  p[8] = { x: 0.35, y: 0.6, z: 0 }
  p[4] = { x: 0.34, y: 0.61, z: 0 }
  return p
}

test('abierta, puño y agarre se distinguen', () => {
  assert.equal(gestoInstantaneo(abierta(), false), 'abierta')
  assert.equal(gestoInstantaneo(puno(), false), 'puno')
  assert.equal(gestoInstantaneo(agarre(), false), 'agarre')
})

test('el puño con el pulgar sobre el índice no se confunde con un agarre', () => {
  assert.notEqual(gestoInstantaneo(puno(), false), 'agarre')
  assert.notEqual(gestoInstantaneo(puno(), true), 'agarre')
})

test('la máquina exige dos fotogramas para entrar y suelta el agarre al instante', () => {
  const m = new MaquinaGestos()
  assert.equal(m.actualizar(abierta()), 'neutra')
  assert.equal(m.actualizar(abierta()), 'abierta')
  // Un solo fotograma de puño (una detección mala) no cambia nada.
  assert.equal(m.actualizar(puno()), 'abierta')
  assert.equal(m.actualizar(abierta()), 'abierta')
  m.actualizar(agarre())
  assert.equal(m.actualizar(agarre()), 'agarre')
  // Soltar: inmediato.
  assert.equal(m.actualizar(abierta()), 'abierta')
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
  const xs = [...Array.from({ length: 10 }, (_, i) => 0.3 + i * 0.04), ...Array.from({ length: 10 }, (_, i) => 0.66 - i * 0.04)]
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

test('la mano principal no salta aunque MediaPipe le cambie la etiqueta', () => {
  const id = new IdentidadManos()
  const der = abierta(0.15)
  const izq = abierta(-0.25)
  const r1 = id.asignar(
    [
      { puntos: der, etiqueta: 'Right', confianza: 0.9 },
      { puntos: izq, etiqueta: 'Left', confianza: 0.9 },
    ] satisfies Deteccion[],
    0,
    false,
  )
  assert.equal(r1.principal, der)
  // Siguiente fotograma: las etiquetas llegan cambiadas, las posiciones no.
  const der2 = abierta(0.16)
  const r2 = id.asignar(
    [
      { puntos: der2, etiqueta: 'Left', confianza: 0.8 },
      { puntos: izq, etiqueta: 'Right', confianza: 0.8 },
    ],
    1 / 30,
    false,
  )
  assert.equal(r2.principal, der2)
  assert.equal(r2.secundaria, izq)
})
