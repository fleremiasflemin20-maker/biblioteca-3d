/*
 * La física de la pieza en el modo manos, sin pantalla: que se quede quieta,
 * que rebote, que se pare y que el lanzamiento salga de la mano.
 *
 *   npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { Estela, colocarEnReposo, extension, nuevoCuerpo, paso, type Limites } from '../src/lib/fisica.ts'

const lim: Limites = { suelo: -1.2, techo: 2, ancho: 3, fondo: -3, frente: 1.8, camaraZ: 5 }

const simula = (c: ReturnType<typeof nuevoCuerpo>, s: number, alGolpe?: (g: number) => void) => {
  for (let i = 0; i < s * 120; i++) {
    const g = paso(c, lim, 1 / 120)
    if (g && alGolpe) alGolpe(g)
  }
}

test('en reposo la pieza no se mueve nada', () => {
  const c = nuevoCuerpo()
  colocarEnReposo(c, lim)
  const p = c.p.clone()
  const q = c.q.clone()
  simula(c, 2)
  assert.ok(c.p.equals(p))
  assert.ok(c.q.equals(q))
  assert.equal(c.p.y, lim.suelo + c.semi.y)
})

test('soltada en el aire cae, rebota cada vez menos y se queda apoyada', () => {
  const c = nuevoCuerpo()
  colocarEnReposo(c, lim)
  c.p.y = 1.5
  c.dormido = false
  const golpes: number[] = []
  simula(c, 4, (g) => golpes.push(g))
  assert.ok(golpes.length >= 2, `golpes ${golpes}`)
  assert.ok(golpes[1] < golpes[0])
  assert.ok(Math.abs(c.p.y - (lim.suelo + extension(c).y)) < 1e-6)
  assert.ok(c.v.length() < 0.05)
})

test('lanzada contra la pared rebota hacia dentro y nunca sale de la pantalla', () => {
  const c = nuevoCuerpo()
  colocarEnReposo(c, lim)
  c.dormido = false
  c.v.set(14, 6, 0)
  c.w.set(3, 8, -2)
  let maxX = 0
  for (let i = 0; i < 600; i++) {
    paso(c, lim, 1 / 120)
    maxX = Math.max(maxX, c.p.x + extension(c).x)
    assert.ok(c.p.y - extension(c).y >= lim.suelo - 1e-6)
  }
  assert.ok(maxX <= lim.ancho * ((lim.camaraZ - c.p.z) / lim.camaraZ) + 0.05)
  assert.ok(c.p.x < lim.ancho)
})

test('tras dar vueltas acaba de pie y dormida', () => {
  const c = nuevoCuerpo()
  colocarEnReposo(c, lim)
  c.dormido = false
  c.p.y = 0.5
  c.q.setFromEuler(new THREE.Euler(0.9, 0.4, -0.6))
  c.w.set(2, 5, 1)
  simula(c, 12)
  const arriba = new THREE.Vector3(0, 1, 0).applyQuaternion(c.q)
  assert.ok(arriba.y > 0.999, `inclinada ${arriba.y}`)
  assert.equal(c.dormido, true)
})

test('la estela da la velocidad y el giro del lanzamiento', () => {
  const e = new Estela(0.1)
  const q = new THREE.Quaternion()
  for (let i = 0; i <= 12; i++) {
    const t = i / 60
    e.anotar(t, new THREE.Vector3(2 * t, -t, 0), q.clone().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 3 * t))
  }
  const v = new THREE.Vector3()
  const w = new THREE.Vector3()
  e.lanzamiento(v, w)
  assert.ok(v.distanceTo(new THREE.Vector3(2, -1, 0)) < 1e-6, `v ${v.toArray()}`)
  assert.ok(w.distanceTo(new THREE.Vector3(0, 3, 0)) < 1e-6, `w ${w.toArray()}`)
})
