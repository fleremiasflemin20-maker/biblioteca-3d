/*
 * Paquetes de descarga: quién puede bajarlos y cuándo un pago de PayPal cuenta.
 *
 *   npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PRECIOS, pagoCompleto, puedeBajarPaquete } from '../worker/paquetes.ts'

const datos = JSON.parse(readFileSync(new URL('../src/data/paquetes.json', import.meta.url), 'utf8')) as { id: string; precio: string; fotos: string[] }[]

test('los paquetes de la web y los del Worker son los mismos, con el mismo precio', () => {
  assert.deepEqual(datos.map((p) => p.id).sort(), Object.keys(PRECIOS).sort())
  for (const p of datos) {
    assert.equal(p.precio, PRECIOS[p.id], p.id)
    assert.ok(p.fotos.length > 0, `${p.id} necesita fotos`)
  }
})

const DBZ = 'dragon-ball-z-01'

test('baja el paquete quien lo compró o quien tiene el Club', () => {
  assert.equal(puedeBajarPaquete(DBZ, [DBZ], false), true)
  assert.equal(puedeBajarPaquete(DBZ, ['otro'], false), false)
  assert.equal(puedeBajarPaquete(DBZ, [], true), true)
  assert.equal(puedeBajarPaquete('inventado', ['inventado'], true), false)
})

const pedido = (custom: string, valor = '2.50', estado = 'COMPLETED') => ({
  status: estado,
  purchase_units: [{ payments: { captures: [{ status: estado, custom_id: custom, amount: { currency_code: 'USD', value: valor } }] } }],
})

test('un pago de PayPal solo vale si es completo, de esta cuenta y de este paquete', () => {
  assert.equal(pagoCompleto(pedido(`u1|${DBZ}`), 'u1', DBZ), true)
  assert.equal(pagoCompleto(pedido(`u2|${DBZ}`), 'u1', DBZ), false, 'otra cuenta')
  assert.equal(pagoCompleto(pedido('u1|otro'), 'u1', DBZ), false, 'otro paquete')
  assert.equal(pagoCompleto(pedido(`u1|${DBZ}`, '0.50'), 'u1', DBZ), false, 'pago incompleto')
  assert.equal(pagoCompleto(pedido(`u1|${DBZ}`, '2.50', 'PENDING'), 'u1', DBZ), false, 'sin cobrar')
})
