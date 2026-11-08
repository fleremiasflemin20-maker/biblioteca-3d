/*
 * Crea en PayPal el producto "Club Flemin" y su plan mensual, y escribe el id
 * del plan. Se corre una vez por entorno (sandbox y después live):
 *
 *   PowerShell:
 *   $env:PAYPAL_CLIENT_ID="..."; $env:PAYPAL_SECRETO="..."; $env:PAYPAL_ENTORNO="sandbox"; npm run club:plan -- 9.99
 *
 * El número es el precio mensual en USD (9.99 si no se pone). Copia el
 * "PAYPAL_PLAN_ID" que imprime en wrangler.jsonc.
 */
const { PAYPAL_CLIENT_ID: id, PAYPAL_SECRETO: secreto, PAYPAL_ENTORNO: entorno = 'sandbox' } = process.env
const precio = Number(process.argv[2] ?? 9.99).toFixed(2)
if (!id || !secreto) {
  console.error('Faltan PAYPAL_CLIENT_ID y PAYPAL_SECRETO (de developer.paypal.com → Apps & Credentials).')
  process.exit(1)
}
const base = entorno === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

const t = await fetch(`${base}/v1/oauth2/token`, {
  method: 'POST',
  headers: { authorization: `Basic ${Buffer.from(`${id}:${secreto}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
  body: 'grant_type=client_credentials',
})
if (!t.ok) throw new Error(`PayPal rechazó las credenciales (${t.status}). ¿Son del entorno ${entorno}?`)
const { access_token } = await t.json()
const llamar = async (ruta, cuerpo) => {
  const r = await fetch(`${base}${ruta}`, { method: 'POST', headers: { authorization: `Bearer ${access_token}`, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) })
  const datos = await r.json()
  if (!r.ok) throw new Error(`${ruta}: ${JSON.stringify(datos)}`)
  return datos
}

const producto = await llamar('/v1/catalogs/products', {
  name: 'Club Flemin',
  description: 'Descargas ilimitadas de archivos de impresión 3D (STL, 3MF) de la Biblioteca Flemin 3D',
  type: 'DIGITAL',
  category: 'SOFTWARE',
})
const plan = await llamar('/v1/billing/plans', {
  product_id: producto.id,
  name: `Club Flemin mensual (${precio} USD)`,
  description: 'Suscripción mensual: descargas ilimitadas del Club Flemin',
  status: 'ACTIVE',
  billing_cycles: [{ frequency: { interval_unit: 'MONTH', interval_count: 1 }, tenure_type: 'REGULAR', sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: { value: precio, currency_code: 'USD' } } }],
  payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 1 },
})
console.log(`\n✔ Plan creado en ${entorno}.\n  "PAYPAL_PLAN_ID": "${plan.id}"\n  "PRECIO_CLUB": "${Number(precio)}"\nCópialos en wrangler.jsonc.`)
