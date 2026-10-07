/*
 * El proxy de "Foto a 3D", contra un Meshy falso: que la clave y los enlaces
 * firmados no salgan nunca y que los límites funcionen.
 *
 *   npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crearManejador } from '../servidor/taller.ts'

const ID = '0193abcd-0000-4000-8000-1234567890ab'
const IMAGEN = 'data:image/png;base64,iVBORw0KGgo='

function meshyFalso() {
  const llamadas: { url: string; auth: string | null; cuerpo?: unknown }[] = []
  const pedir = (async (url: string, init?: RequestInit) => {
    const auth = new Headers(init?.headers).get('authorization')
    llamadas.push({ url: String(url), auth, cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (String(url).endsWith('/image-to-3d')) return new Response(JSON.stringify({ result: ID }), { status: 202 })
    if (String(url).includes('/image-to-3d/'))
      return new Response(JSON.stringify({ status: 'SUCCEEDED', progress: 100, model_urls: { glb: 'https://assets.meshy.ai/firmado.glb?Expires=1&Signature=x' } }))
    return new Response(new Uint8Array([0x67, 0x6c, 0x54, 0x46]))
  }) as typeof fetch
  return { pedir, llamadas }
}

const post = (cuerpo: unknown, cabeceras: Record<string, string> = {}) =>
  new Request('http://x/api/taller/generar', { method: 'POST', body: JSON.stringify(cuerpo), headers: cabeceras })

test('genera con la clave del servidor y devuelve solo el id', async () => {
  const { pedir, llamadas } = meshyFalso()
  const h = crearManejador({ clave: 'secreta', fetch: pedir })
  const r = await h(post({ imagen: IMAGEN }))
  assert.equal(r.status, 200)
  assert.deepEqual(await r.json(), { id: ID })
  assert.equal(llamadas[0].auth, 'Bearer secreta')
  assert.equal((llamadas[0].cuerpo as { image_url: string }).image_url, IMAGEN)
})

test('el modelo se sirve por el proxy, sin enlace firmado', async () => {
  const { pedir } = meshyFalso()
  const h = crearManejador({ clave: 'k', fetch: pedir })
  const estado = await (await h(new Request(`http://x/api/taller/estado/${ID}`))).text()
  assert.ok(!estado.includes('firmado'))
  const r = await h(new Request(`http://x/api/taller/modelo/${ID}`))
  assert.equal(r.headers.get('content-type'), 'model/gltf-binary')
  assert.equal(await r.text(), 'glTF')
})

test('límite por IP y por día', async () => {
  const { pedir } = meshyFalso()
  const h = crearManejador({ clave: 'k', fetch: pedir, porHora: 2, porDia: 3 })
  const ip = (n: string) => ({ 'x-forwarded-for': n })
  assert.equal((await h(post({ imagen: IMAGEN }, ip('1.1.1.1')))).status, 200)
  assert.equal((await h(post({ imagen: IMAGEN }, ip('1.1.1.1')))).status, 200)
  assert.equal((await h(post({ imagen: IMAGEN }, ip('1.1.1.1')))).status, 429)
  assert.equal((await h(post({ imagen: IMAGEN }, ip('2.2.2.2')))).status, 200)
  assert.equal((await h(post({ imagen: IMAGEN }, ip('3.3.3.3')))).status, 429) // tope diario
})

test('rechaza entradas que no son una foto, ids raros y orígenes ajenos', async () => {
  const { pedir, llamadas } = meshyFalso()
  const h = crearManejador({ clave: 'k', fetch: pedir, origenes: ['https://bien.io'] })
  assert.equal((await h(post({ imagen: 'https://otro.sitio/foto.png' }))).status, 400)
  assert.equal((await h(post({ imagen: 'data:text/html;base64,PGgxPg==' }))).status, 400)
  assert.equal((await h(new Request('http://x/api/taller/estado/..%2F..%2Fetc'))).status, 404)
  assert.equal((await h(new Request(`http://x/api/taller/estado/${ID}`, { headers: { origin: 'https://malo.io' } }))).status, 403)
  const ok = await h(new Request(`http://x/api/taller/estado/${ID}`, { headers: { origin: 'https://bien.io' } }))
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://bien.io')
  assert.equal(llamadas.length, 1) // solo la consulta permitida llegó a Meshy
})

test('sin clave responde con un aviso claro, sin llamar a Meshy', async () => {
  const { pedir, llamadas } = meshyFalso()
  const r = await crearManejador({ clave: '', fetch: pedir })(post({ imagen: IMAGEN }))
  assert.equal(r.status, 503)
  assert.equal(llamadas.length, 0)
})
