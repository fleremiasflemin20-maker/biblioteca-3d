/*
 * Despiece en mesa: las piezas bajan al suelo, no se pisan, cada filamento
 * va en su fila y el resultado es siempre el mismo.
 *
 *   npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FIN_MESA, FIN_RADIAL, mesaDePiezas, mezclaDespiece, type CajaPieza } from '../src/lib/despiece.ts'

/** Un modelo de juguete: piezas montadas unas sobre otras, en tres colores. */
function kit(n: number): CajaPieza[] {
  const colores = ['#FF6A13', '#1FBF8F', '#2FA8FF']
  return Array.from({ length: n }, (_, i) => {
    const w = 10 + ((i * 7) % 23), d = 8 + ((i * 11) % 17), h = 5 + ((i * 13) % 29)
    const x = (i % 4) * 6 - 9, y = ((i * 3) % 5) * 4 - 8, z = 20 + i * 3
    return { id: `p${i}`, color: colores[i % 3], min: [x, y, z], max: [x + w, y + d, z + h] }
  })
}

const mover = (c: CajaPieza, d: [number, number, number]): CajaPieza => ({ ...c, min: c.min.map((v, k) => v + d[k]) as never, max: c.max.map((v, k) => v + d[k]) as never })

test('todas las piezas quedan apoyadas en el punto más bajo del modelo', () => {
  const cajas = kit(17)
  const suelo = Math.min(...cajas.map((c) => c.min[2]))
  const { desplazar } = mesaDePiezas(cajas)
  for (const c of cajas) assert.ok(Math.abs(mover(c, desplazar.get(c.id)!).min[2] - suelo) < 1e-9)
})

test('ninguna pieza pisa a otra en la mesa', () => {
  const cajas = kit(40)
  const { desplazar } = mesaDePiezas(cajas)
  const puestas = cajas.map((c) => mover(c, desplazar.get(c.id)!))
  for (let i = 0; i < puestas.length; i++)
    for (let j = i + 1; j < puestas.length; j++) {
      const a = puestas[i], b = puestas[j]
      const separadas = a.max[0] <= b.min[0] || b.max[0] <= a.min[0] || a.max[1] <= b.min[1] || b.max[1] <= a.min[1]
      assert.ok(separadas, `${a.id} y ${b.id} se pisan`)
    }
})

test('cada filamento ocupa sus propias filas y la numeración es 1..n', () => {
  const cajas = kit(24)
  const { desplazar, numero } = mesaDePiezas(cajas)
  assert.deepEqual([...numero.values()].sort((a, b) => a - b), cajas.map((_, i) => i + 1))
  // Por color, el rango de Y de su fila no se cruza con el de otro color.
  const rangos = new Map<string, [number, number]>()
  for (const c of cajas) {
    const p = mover(c, desplazar.get(c.id)!)
    const r = rangos.get(c.color) ?? [Infinity, -Infinity]
    rangos.set(c.color, [Math.min(r[0], p.min[1]), Math.max(r[1], p.max[1])])
  }
  const l = [...rangos.values()]
  for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) assert.ok(l[i][1] <= l[j][0] || l[j][1] <= l[i][0], 'dos colores comparten fila')
})

test('las filas de piezas altas van al fondo (+Y) y las bajas delante', () => {
  const cajas: CajaPieza[] = [
    { id: 'baja', color: '#111', min: [0, 0, 0], max: [10, 10, 2] },
    { id: 'alta', color: '#222', min: [0, 0, 0], max: [10, 10, 40] },
  ]
  const { desplazar } = mesaDePiezas(cajas)
  assert.ok(desplazar.get('alta')![1] > desplazar.get('baja')![1])
})

test('es determinista y no cambia la forma de las piezas', () => {
  const a = mesaDePiezas(kit(12)), b = mesaDePiezas(kit(12))
  assert.deepEqual([...a.desplazar], [...b.desplazar])
  for (const c of kit(12)) {
    const p = mover(c, a.desplazar.get(c.id)!)
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(p.max[k] - p.min[k] - (c.max[k] - c.min[k])) < 1e-9)
  }
})

test('sin piezas, mesa vacía; con una, va al suelo', () => {
  assert.equal(mesaDePiezas([]).desplazar.size, 0)
  const [c] = kit(1)
  const d = mesaDePiezas([c]).desplazar.get(c.id)!
  assert.ok(Math.abs(d[2]) < 1e-9)
})

test('el control pasa de montado a abierto y de abierto a la mesa', () => {
  assert.deepEqual(mezclaDespiece(0), { radial: 0, mesa: 0 })
  assert.deepEqual(mezclaDespiece(FIN_RADIAL), { radial: FIN_RADIAL, mesa: 0 })
  assert.equal(mezclaDespiece(FIN_MESA).mesa, 1)
  assert.equal(mezclaDespiece(99).mesa, 1)
  const m = mezclaDespiece((FIN_RADIAL + FIN_MESA) / 2).mesa
  assert.ok(m > 0.4 && m < 0.6)
})

test('en modelos chicos (otras unidades) el hueco escala con las piezas', () => {
  const chicas: CajaPieza[] = [
    { id: 'a', color: '#111', min: [0, 0, 0], max: [0.1, 0.1, 0.1] },
    { id: 'b', color: '#111', min: [0, 0, 0], max: [0.1, 0.1, 0.1] },
  ]
  const { ancho } = mesaDePiezas(chicas, { minimo: 0, proporcion: 0.2 })
  assert.ok(ancho < 0.5, `la mesa mide ${ancho}, demasiado ancha para piezas de 0.1`)
})
