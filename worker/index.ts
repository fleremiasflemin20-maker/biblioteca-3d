/*
 * El Worker de la Biblioteca 3D. La tienda sigue siendo estática (la sirve
 * ASSETS); este código solo atiende /api/*, que es el Club Flemin:
 *
 *   cuentas (correo + contraseña) → D1
 *   suscripción mensual con PayPal, o activación manual del administrador
 *   archivos de impresión (STL, 3MF…) en R2, que solo se entregan a socios
 *
 * Los archivos de un modelo viven en R2 bajo `modelos/<id-del-catálogo>/`.
 * Un modelo entra al Club en cuanto tiene archivos ahí (ver scripts/subir-club.mjs).
 */
import type { Entorno, R2Objeto } from './tipos.ts'
import {
  DURACION_SESION,
  type SuscripcionPayPal,
  cifrarClave,
  comprobarClave,
  correoValido,
  hashToken,
  idValido,
  leerCookie,
  nombreArchivoValido,
  normalizarCorreo,
  nuevoId,
  nuevoToken,
  problemaClave,
  suscripcionDelEvento,
  venceManual,
  venceSegunPayPal,
} from './logica.ts'
import { limpiarNombre, limpiarPerfil } from './perfil.ts'
import { PREFIJO_PAQUETES, type PedidoPayPal, pagoCompleto, paqueteValido, precioPaquete, puedeBajarPaquete } from './paquetes.ts'

const COOKIE = 'club_sesion'
const PREFIJO = 'modelos/'

type Usuario = { id: string; correo: string; nombre: string | null }
type Suscripcion = { proveedor: string; referencia: string | null; estado: string; vence: number }

const json = (datos: unknown, estado = 200, extra?: HeadersInit) => {
  const h = new Headers(extra)
  h.set('content-type', 'application/json; charset=utf-8')
  h.set('cache-control', 'no-store')
  return new Response(JSON.stringify(datos), { status: estado, headers: h })
}
const error = (mensaje: string, estado = 400) => json({ error: mensaje }, estado)

const cookieSesion = (token: string, url: URL) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DURACION_SESION / 1000}${url.protocol === 'https:' ? '; Secure' : ''}`
const cookieBorrada = `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`

export default {
  async fetch(peticion: Request, env: Entorno): Promise<Response> {
    const url = new URL(peticion.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(peticion)
    try {
      return await api(peticion, url, env)
    } catch (e) {
      console.error(e)
      return error('Algo falló en el servidor. Intenta de nuevo en un momento.', 500)
    }
  },
}

async function api(req: Request, url: URL, env: Entorno): Promise<Response> {
  const ruta = url.pathname.replace(/\/+$/, '')
  const metodo = req.method

  // Toda escritura que no sea el webhook de PayPal tiene que venir de la propia web.
  if (metodo === 'POST' && ruta !== '/api/paypal/webhook') {
    const origen = req.headers.get('origin')
    if (origen && new URL(origen).host !== url.host) return error('Origen no permitido.', 403)
  }

  if (ruta === '/api/club/config' && metodo === 'GET') {
    return json({
      precio: env.PRECIO_CLUB ?? '9.99',
      paypal: env.PAYPAL_CLIENT_ID && env.PAYPAL_PLAN_ID ? { clientId: env.PAYPAL_CLIENT_ID, planId: env.PAYPAL_PLAN_ID } : null,
      // Los paquetes se cobran con un pago único: basta el Client ID (y el secreto en el Worker).
      paypalPaquetes: env.PAYPAL_CLIENT_ID || null,
      whatsapp: env.WHATSAPP ?? '593979523040',
    })
  }
  if (ruta === '/api/registro' && metodo === 'POST') return registro(req, url, env)
  if (ruta === '/api/entrar' && metodo === 'POST') return entrar(req, url, env)
  if (ruta === '/api/clave' && metodo === 'POST') {
    const u = await usuarioDe(req, env)
    if (!u) return error('Inicia sesión primero.', 401)
    const { actual, nueva } = (await req.json().catch(() => ({}))) as { actual?: string; nueva?: string }
    const fila = await env.DB.prepare('SELECT clave FROM usuarios WHERE id = ?').bind(u.id).first<{ clave: string }>()
    if (!fila || typeof actual !== 'string' || !(await comprobarClave(actual, fila.clave))) return error('La contraseña actual no es correcta.', 401)
    const p = problemaClave(nueva)
    if (p) return error(p)
    // Se cierran las demás sesiones: si alguien conocía la contraseña provisional, queda fuera.
    const t = leerCookie(req.headers.get('cookie'), COOKIE)
    await env.DB.batch([
      env.DB.prepare('UPDATE usuarios SET clave = ? WHERE id = ?').bind(await cifrarClave(nueva!), u.id),
      env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ? AND token != ?').bind(u.id, t ? await hashToken(t) : ''),
    ])
    return json({ ok: true })
  }
  if (ruta === '/api/salir' && metodo === 'POST') {
    const t = leerCookie(req.headers.get('cookie'), COOKIE)
    if (t) await env.DB.prepare('DELETE FROM sesiones WHERE token = ?').bind(await hashToken(t)).run()
    return json({ ok: true }, 200, { 'set-cookie': cookieBorrada })
  }
  if (ruta === '/api/yo' && metodo === 'GET') {
    const u = await usuarioDe(req, env)
    if (!u) return json({ usuario: null })
    let s = await suscripcionDe(env, u.id)
    if (s && s.proveedor === 'paypal' && s.referencia && s.vence < Date.now()) s = (await sincronizarPayPal(env, u.id, s.referencia).catch(() => null)) ?? s
    return json({
      usuario: { id: u.id, correo: u.correo, nombre: u.nombre, admin: esAdmin(env, u.correo) },
      suscripcion: resumen(s),
      paquetes: await paquetesDe(env, u.id),
    })
  }

  let p = ruta.match(/^\/api\/paquetes\/([^/]+)\/archivos$/)
  if (p && metodo === 'GET') {
    const id = decodeURIComponent(p[1])
    if (!paqueteValido(id)) return error('Paquete no válido.', 404)
    const objetos = await listarTodo(env, `${PREFIJO_PAQUETES}${id}/`)
    return json({ archivos: objetos.map((o) => ({ nombre: o.key.slice(PREFIJO_PAQUETES.length + id.length + 1), tamano: o.size })) })
  }
  p = ruta.match(/^\/api\/paquetes\/([^/]+)\/descargar\/([^/]+)$/)
  if (p && metodo === 'GET') return descargarPaquete(req, env, decodeURIComponent(p[1]), decodeURIComponent(p[2]))
  p = ruta.match(/^\/api\/paquetes\/([^/]+)\/paypal\/(orden|capturar)$/)
  if (p && metodo === 'POST') {
    const paquete = decodeURIComponent(p[1])
    if (!paqueteValido(paquete)) return error('Paquete no válido.', 404)
    const u = await usuarioDe(req, env)
    if (!u) return error('Inicia sesión primero.', 401)
    return p[2] === 'orden' ? ordenPayPal(env, u.id, paquete) : capturarPayPal(req, env, u.id, paquete)
  }
  if (ruta === '/api/club/modelos' && metodo === 'GET') return modelosDelClub(env)

  let m = ruta.match(/^\/api\/archivos\/([^/]+)$/)
  if (m && metodo === 'GET') {
    const id = decodeURIComponent(m[1])
    if (!idValido(id)) return error('Modelo no válido.')
    const objetos = await listarTodo(env, `${PREFIJO}${id}/`)
    return json({ archivos: objetos.map((o) => ({ nombre: o.key.slice(PREFIJO.length + id.length + 1), tamano: o.size })) })
  }

  m = ruta.match(/^\/api\/descargar\/([^/]+)\/([^/]+)$/)
  if (m && metodo === 'GET') return descargar(req, env, decodeURIComponent(m[1]), decodeURIComponent(m[2]))

  if (ruta === '/api/paypal/confirmar' && metodo === 'POST') {
    const u = await usuarioDe(req, env)
    if (!u) return error('Inicia sesión primero.', 401)
    const { subscriptionID } = (await req.json().catch(() => ({}))) as { subscriptionID?: string }
    if (!subscriptionID || !/^I-[A-Z0-9]{6,40}$/.test(subscriptionID)) return error('Suscripción no válida.')
    const s = await sincronizarPayPal(env, u.id, subscriptionID)
    if (!s) return error('PayPal no confirmó la suscripción. Si ya pagaste, escríbenos por WhatsApp.', 402)
    return json({ suscripcion: resumen(s) })
  }
  if (ruta === '/api/paypal/webhook' && metodo === 'POST') {
    // No hace falta fiarse del contenido: se vuelve a preguntar a PayPal por la suscripción.
    const ref = suscripcionDelEvento(await req.json().catch(() => null))
    if (ref) {
      const fila = await env.DB.prepare("SELECT usuario_id FROM suscripciones WHERE proveedor = 'paypal' AND referencia = ?").bind(ref).first<{ usuario_id: string }>()
      const dueno = fila?.usuario_id ?? (await duenoSegunPayPal(env, ref))
      if (dueno) await sincronizarPayPal(env, dueno, ref)
    }
    return json({ ok: true })
  }

  if (ruta.startsWith('/api/admin/')) {
    const u = await usuarioDe(req, env)
    if (!u || !esAdmin(env, u.correo)) return error('Solo para el administrador.', 403)
    if (ruta === '/api/admin/socios' && metodo === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT u.correo, u.nombre, u.perfil, u.creado, s.proveedor, s.estado, s.vence,
                (SELECT COUNT(*) FROM descargas d WHERE d.usuario_id = u.id) AS descargas
           FROM usuarios u LEFT JOIN suscripciones s ON s.usuario_id = u.id
          ORDER BY COALESCE(s.vence, 0) DESC, u.creado DESC LIMIT 500`,
      ).all()
      const socios = (results as Record<string, unknown>[]).map((r) => {
        let perfil = null
        try {
          perfil = r.perfil ? JSON.parse(String(r.perfil)) : null
        } catch {
          /* perfil dañado: se ignora */
        }
        return { ...r, perfil }
      })
      return json({ socios })
    }
    if (ruta === '/api/admin/activar' && metodo === 'POST') {
      const { correo, dias } = (await req.json().catch(() => ({}))) as { correo?: string; dias?: number }
      const c = normalizarCorreo(correo)
      const d = Math.round(Number(dias))
      if (!Number.isFinite(d) || d < -3650 || d > 3650 || d === 0) return error('Días no válidos.')
      const destino = await env.DB.prepare('SELECT id FROM usuarios WHERE correo = ?').bind(c).first<{ id: string }>()
      if (!destino) return error('No hay ninguna cuenta con ese correo. Pídele que la cree primero.', 404)
      const previa = await suscripcionDe(env, destino.id)
      const ahora = Date.now()
      const vence = d > 0 ? venceManual(previa?.vence ?? 0, d, ahora) : ahora
      await guardarSuscripcion(env, destino.id, { proveedor: previa?.proveedor === 'paypal' && d > 0 ? 'paypal' : 'manual', referencia: previa?.referencia ?? null, estado: d > 0 ? 'MANUAL' : 'CANCELADA', vence })
      return json({ ok: true, vence })
    }
    if (ruta === '/api/admin/paquete' && metodo === 'POST') {
      // Venta de un paquete pagado por transferencia, Deuna o PayPal: se le da (o se le quita) a la cuenta.
      const { correo, paquete, quitar } = (await req.json().catch(() => ({}))) as { correo?: string; paquete?: string; quitar?: boolean }
      if (typeof paquete !== 'string' || !paqueteValido(paquete)) return error('Paquete no válido.')
      const destino = await env.DB.prepare('SELECT id FROM usuarios WHERE correo = ?').bind(normalizarCorreo(correo)).first<{ id: string }>()
      if (!destino) return error('No hay ninguna cuenta con ese correo. Pídele que la cree primero.', 404)
      if (quitar) await env.DB.prepare('DELETE FROM compras WHERE usuario_id = ? AND paquete = ?').bind(destino.id, paquete).run()
      else await env.DB.prepare('INSERT OR IGNORE INTO compras (usuario_id, paquete, fecha) VALUES (?, ?, ?)').bind(destino.id, paquete, Date.now()).run()
      return json({ ok: true })
    }
  }

  return error('No encontrado.', 404)
}

/* ── Cuentas ─────────────────────────────────────────────────── */

async function registro(req: Request, url: URL, env: Entorno) {
  const { correo, clave, nombre, perfil } = (await req.json().catch(() => ({}))) as { correo?: string; clave?: string; nombre?: string; perfil?: unknown }
  const c = normalizarCorreo(correo)
  const n = limpiarNombre(nombre)
  if (!n) return error('Cuéntanos cómo te llamas.')
  if (!correoValido(c)) return error('Escribe un correo válido.')
  const p = problemaClave(clave)
  if (p) return error(p)
  if (await env.DB.prepare('SELECT 1 FROM usuarios WHERE correo = ?').bind(c).first()) return error('Ya existe una cuenta con ese correo. Inicia sesión.', 409)
  const id = nuevoId()
  await env.DB.prepare('INSERT INTO usuarios (id, correo, clave, creado, nombre, perfil) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, c, await cifrarClave(clave!), Date.now(), n, JSON.stringify(limpiarPerfil(perfil)))
    .run()
  return iniciarSesion(env, url, id)
}

async function entrar(req: Request, url: URL, env: Entorno) {
  const { correo, clave } = (await req.json().catch(() => ({}))) as { correo?: string; clave?: string }
  const c = normalizarCorreo(correo)
  const ahora = Date.now()
  const fallos = await env.DB.prepare('SELECT COUNT(*) AS n FROM intentos WHERE correo = ? AND fecha > ?').bind(c, ahora - 15 * 60_000).first<{ n: number }>()
  if ((fallos?.n ?? 0) >= 8) return error('Demasiados intentos. Espera 15 minutos.', 429)
  const u = await env.DB.prepare('SELECT id, clave FROM usuarios WHERE correo = ?').bind(c).first<{ id: string; clave: string }>()
  if (!u || typeof clave !== 'string' || !(await comprobarClave(clave, u.clave))) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO intentos (correo, fecha) VALUES (?, ?)').bind(c, ahora),
      env.DB.prepare('DELETE FROM intentos WHERE fecha < ?').bind(ahora - 86_400_000),
    ])
    return error('Correo o contraseña incorrectos.', 401)
  }
  return iniciarSesion(env, url, u.id)
}

async function iniciarSesion(env: Entorno, url: URL, usuarioId: string) {
  const token = nuevoToken()
  const ahora = Date.now()
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sesiones (token, usuario_id, expira) VALUES (?, ?, ?)').bind(await hashToken(token), usuarioId, ahora + DURACION_SESION),
    env.DB.prepare('DELETE FROM sesiones WHERE expira < ?').bind(ahora),
  ])
  return json({ ok: true }, 200, { 'set-cookie': cookieSesion(token, url) })
}

async function usuarioDe(req: Request, env: Entorno): Promise<Usuario | null> {
  const t = leerCookie(req.headers.get('cookie'), COOKIE)
  if (!t) return null
  return env.DB.prepare('SELECT u.id, u.correo, u.nombre FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ? AND s.expira > ?')
    .bind(await hashToken(t), Date.now())
    .first<Usuario>()
}

const esAdmin = (env: Entorno, correo: string) =>
  (env.ADMIN_CORREOS ?? '').split(',').map(normalizarCorreo).filter(Boolean).includes(correo)

/* ── Suscripción ─────────────────────────────────────────────── */

const suscripcionDe = (env: Entorno, usuarioId: string) =>
  env.DB.prepare('SELECT proveedor, referencia, estado, vence FROM suscripciones WHERE usuario_id = ?').bind(usuarioId).first<Suscripcion>()

const resumen = (s: Suscripcion | null) =>
  s ? { activa: s.vence > Date.now(), vence: s.vence, proveedor: s.proveedor, estado: s.estado } : { activa: false, vence: null, proveedor: null, estado: null }

async function guardarSuscripcion(env: Entorno, usuarioId: string, s: Suscripcion) {
  await env.DB.prepare(
    `INSERT INTO suscripciones (usuario_id, proveedor, referencia, estado, vence, actualizado) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (usuario_id) DO UPDATE SET proveedor = excluded.proveedor, referencia = excluded.referencia,
       estado = excluded.estado, vence = excluded.vence, actualizado = excluded.actualizado`,
  )
    .bind(usuarioId, s.proveedor, s.referencia, s.estado, s.vence, Date.now())
    .run()
}

const basePayPal = (env: Entorno) => (env.PAYPAL_ENTORNO === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com')

async function tokenPayPal(env: Entorno) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRETO) throw new Error('Falta configurar PayPal (PAYPAL_CLIENT_ID y el secreto PAYPAL_SECRETO).')
  const t = await fetch(`${basePayPal(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_SECRETO}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!t.ok) throw new Error(`PayPal rechazó las credenciales (${t.status}).`)
  return ((await t.json()) as { access_token: string }).access_token
}

async function consultarPayPal(env: Entorno, id: string): Promise<SuscripcionPayPal | null> {
  const access_token = await tokenPayPal(env)
  const r = await fetch(`${basePayPal(env)}/v1/billing/subscriptions/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${access_token}` } })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`PayPal respondió ${r.status} al consultar ${id}.`)
  return (await r.json()) as SuscripcionPayPal
}

/** El dueño de una suscripción que aún no está en D1: lo dice custom_id, que pone la web al crearla. */
async function duenoSegunPayPal(env: Entorno, id: string) {
  const s = await consultarPayPal(env, id)
  if (!s?.custom_id) return null
  const u = await env.DB.prepare('SELECT id FROM usuarios WHERE id = ?').bind(s.custom_id).first<{ id: string }>()
  return u?.id ?? null
}

/** Pregunta a PayPal por la suscripción y guarda hasta cuándo vale. Null si no es de este usuario o de este plan. */
async function sincronizarPayPal(env: Entorno, usuarioId: string, id: string): Promise<Suscripcion | null> {
  const s = await consultarPayPal(env, id)
  if (!s || s.custom_id !== usuarioId || (env.PAYPAL_PLAN_ID && s.plan_id !== env.PAYPAL_PLAN_ID)) return null
  const previa = await suscripcionDe(env, usuarioId)
  const nueva: Suscripcion = {
    proveedor: 'paypal',
    referencia: id,
    estado: s.status,
    vence: venceSegunPayPal(s, previa?.vence ?? 0, Date.now()),
  }
  await guardarSuscripcion(env, usuarioId, nueva)
  return nueva
}

/* ── Archivos ────────────────────────────────────────────────── */

async function listarTodo(env: Entorno, prefijo: string) {
  const todos: R2Objeto[] = []
  let cursor: string | undefined
  do {
    const l = await env.ARCHIVOS.list({ prefix: prefijo, cursor })
    todos.push(...l.objects)
    cursor = l.truncated ? l.cursor : undefined
  } while (cursor)
  return todos
}

async function modelosDelClub(env: Entorno) {
  const ids: string[] = []
  let cursor: string | undefined
  do {
    const l = await env.ARCHIVOS.list({ prefix: PREFIJO, delimiter: '/', cursor })
    ids.push(...l.delimitedPrefixes.map((p) => p.slice(PREFIJO.length, -1)))
    cursor = l.truncated ? l.cursor : undefined
  } while (cursor)
  return json({ modelos: ids }, 200)
}

async function descargar(req: Request, env: Entorno, id: string, nombre: string) {
  if (!idValido(id) || !nombreArchivoValido(nombre)) return error('Archivo no válido.')
  const u = await usuarioDe(req, env)
  if (!u) return error('Inicia sesión para descargar.', 401)
  let s = await suscripcionDe(env, u.id)
  if (s && s.vence <= Date.now() && s.proveedor === 'paypal' && s.referencia) s = await sincronizarPayPal(env, u.id, s.referencia).catch(() => s)
  if (!s || s.vence <= Date.now()) return error('Tu suscripción no está activa.', 402)

  return entregar(env, u.id, `${PREFIJO}${id}/${nombre}`, nombre)
}

/** Paquetes comprados. Si aún no se aplicó la migración 0003 (tabla compras), no rompe /api/yo: devuelve []. */
const paquetesDe = async (env: Entorno, usuarioId: string) => {
  try {
    return ((await env.DB.prepare('SELECT paquete FROM compras WHERE usuario_id = ?').bind(usuarioId).all<{ paquete: string }>()).results ?? []).map((r) => r.paquete)
  } catch {
    return []
  }
}

async function descargarPaquete(req: Request, env: Entorno, paquete: string, nombre: string) {
  if (!paqueteValido(paquete) || !nombreArchivoValido(nombre)) return error('Archivo no válido.')
  const u = await usuarioDe(req, env)
  if (!u) return error('Inicia sesión para descargar.', 401)
  let s = await suscripcionDe(env, u.id)
  if (s && s.vence <= Date.now() && s.proveedor === 'paypal' && s.referencia) s = await sincronizarPayPal(env, u.id, s.referencia).catch(() => s)
  if (!puedeBajarPaquete(paquete, await paquetesDe(env, u.id), !!s && s.vence > Date.now())) return error('Compra el paquete o activa el Club para descargarlo.', 402)
  return entregar(env, u.id, `${PREFIJO_PAQUETES}${paquete}/${nombre}`, nombre)
}

/** Crea el pedido de PayPal (pago único). custom_id liga el pago a esta cuenta y a este paquete. */
async function ordenPayPal(env: Entorno, usuarioId: string, paquete: string) {
  const r = await fetch(`${basePayPal(env)}/v2/checkout/orders`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await tokenPayPal(env)}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: paquete,
          custom_id: `${usuarioId}|${paquete}`,
          description: `Biblioteca 3D · paquete ${paquete}`,
          amount: { currency_code: 'USD', value: precioPaquete(paquete) },
        },
      ],
      application_context: { shipping_preference: 'NO_SHIPPING', brand_name: 'Biblioteca 3D Flemin' },
    }),
  })
  if (!r.ok) return error(`PayPal no pudo crear el pedido (${r.status}).`, 502)
  const { id } = (await r.json()) as { id: string }
  return json({ id })
}

/** Cobra el pedido aprobado y, si PayPal confirma el pago completo, da el paquete a la cuenta. */
async function capturarPayPal(req: Request, env: Entorno, usuarioId: string, paquete: string) {
  const { orderID } = (await req.json().catch(() => ({}))) as { orderID?: string }
  if (!orderID || !/^[A-Z0-9]{8,40}$/.test(orderID)) return error('Pedido no válido.')
  const r = await fetch(`${basePayPal(env)}/v2/checkout/orders/${orderID}/capture`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await tokenPayPal(env)}`, 'content-type': 'application/json' },
  })
  const pedido = (await r.json().catch(() => null)) as PedidoPayPal | null
  if (!pedido || !pagoCompleto(pedido, usuarioId, paquete)) return error('PayPal no confirmó el pago. Si se te cobró, escríbenos por WhatsApp.', 402)
  await env.DB.prepare('INSERT OR IGNORE INTO compras (usuario_id, paquete, fecha) VALUES (?, ?, ?)').bind(usuarioId, paquete, Date.now()).run()
  return json({ ok: true, paquetes: await paquetesDe(env, usuarioId) })
}

async function entregar(env: Entorno, usuarioId: string, clave: string, nombre: string) {
  const obj = await env.ARCHIVOS.get(clave)
  if (!obj) return error('Ese archivo ya no existe.', 404)
  await env.DB.prepare('INSERT INTO descargas (usuario_id, clave, fecha) VALUES (?, ?, ?)').bind(usuarioId, clave, Date.now()).run()

  const h = new Headers()
  obj.writeHttpMetadata(h)
  h.set('etag', obj.httpEtag)
  h.set('content-length', String(obj.size))
  if (!h.has('content-type')) h.set('content-type', 'application/octet-stream')
  h.set('content-disposition', `attachment; filename="${nombre.replace(/[^\x20-\x7e]|"/g, '_')}"; filename*=UTF-8''${encodeURIComponent(nombre)}`)
  h.set('cache-control', 'private, no-store')
  return new Response(obj.body, { headers: h })
}
