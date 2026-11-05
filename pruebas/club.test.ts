/*
 * La lógica del Club Flemin sin Cloudflare: contraseñas, nombres de archivo y
 * hasta cuándo vale una suscripción según PayPal.
 *
 *   npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DIA,
  GRACIA,
  cifrarClave,
  comprobarClave,
  correoValido,
  idValido,
  leerCookie,
  nombreArchivoValido,
  problemaClave,
  suscripcionDelEvento,
  venceManual,
  venceSegunPayPal,
} from '../worker/logica.ts'

const AHORA = Date.parse('2026-11-05T12:00:00Z')

test('la contraseña se guarda cifrada y solo entra la correcta', async () => {
  const g = await cifrarClave('goku-fase-4')
  assert.match(g, /^pbkdf2\$100000\$/)
  assert.ok(!g.includes('goku'))
  assert.equal(await comprobarClave('goku-fase-4', g), true)
  assert.equal(await comprobarClave('goku-fase-5', g), false)
  assert.equal(await comprobarClave('goku-fase-4', 'basura'), false)
  assert.notEqual(await cifrarClave('goku-fase-4'), g, 'cada cifrado lleva su propia sal')
})

test('correos y contraseñas', () => {
  assert.ok(correoValido('cliente@gmail.com'))
  assert.ok(!correoValido('cliente@'))
  assert.ok(!correoValido('sin arroba.com'))
  assert.equal(problemaClave('1234567'), 'La contraseña necesita al menos 8 caracteres.')
  assert.equal(problemaClave('12345678'), null)
})

test('no se puede pedir un archivo fuera de su carpeta', () => {
  assert.ok(idValido('espadachin-rubio-chibi'))
  assert.ok(!idValido('../usuarios'))
  assert.ok(!idValido('a/b'))
  assert.ok(nombreArchivoValido('organizador-consola-base-TPU.stl'))
  assert.ok(nombreArchivoValido('Goku SS4 (120 mm).3mf'))
  assert.ok(!nombreArchivoValido('../secreto.stl'))
  assert.ok(!nombreArchivoValido('a/b.stl'))
  assert.ok(!nombreArchivoValido('sin-extension'))
})

test('PayPal activa: vale hasta el próximo cobro más la gracia', () => {
  const proximo = '2026-12-05T10:00:00Z'
  const v = venceSegunPayPal({ id: 'I-1', status: 'ACTIVE', billing_info: { next_billing_time: proximo } }, 0, AHORA)
  assert.equal(v, Date.parse(proximo) + GRACIA)
})

test('PayPal cancelada: respeta el mes ya pagado', () => {
  const previo = AHORA + 10 * DIA
  assert.equal(venceSegunPayPal({ id: 'I-1', status: 'CANCELLED' }, previo, AHORA), previo)
  const pago = '2026-11-01T00:00:00Z'
  assert.equal(venceSegunPayPal({ id: 'I-1', status: 'CANCELLED', billing_info: { last_payment: { time: pago } } }, 0, AHORA), Date.parse(pago) + 30 * DIA + GRACIA)
})

test('PayPal suspendida o expirada: se corta ya', () => {
  assert.equal(venceSegunPayPal({ id: 'I-1', status: 'SUSPENDED' }, AHORA + 20 * DIA, AHORA), AHORA)
  assert.equal(venceSegunPayPal({ id: 'I-1', status: 'EXPIRED' }, AHORA - DIA, AHORA), AHORA - DIA)
})

test('la activación manual suma días sin quitar lo pagado', () => {
  assert.equal(venceManual(0, 30, AHORA), AHORA + 30 * DIA)
  assert.equal(venceManual(AHORA + 5 * DIA, 30, AHORA), AHORA + 35 * DIA)
})

test('del webhook sale el id de la suscripción', () => {
  assert.equal(suscripcionDelEvento({ event_type: 'BILLING.SUBSCRIPTION.CANCELLED', resource: { id: 'I-ABC' } }), 'I-ABC')
  assert.equal(suscripcionDelEvento({ event_type: 'PAYMENT.SALE.COMPLETED', resource: { id: 'PAY-1', billing_agreement_id: 'I-XYZ' } }), 'I-XYZ')
  assert.equal(suscripcionDelEvento({ event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'O-1' } }), null)
  assert.equal(suscripcionDelEvento(null), null)
})

test('leer la cookie de sesión', () => {
  assert.equal(leerCookie('a=1; club_sesion=abc-def_; b=2', 'club_sesion'), 'abc-def_')
  assert.equal(leerCookie(null, 'club_sesion'), null)
})
