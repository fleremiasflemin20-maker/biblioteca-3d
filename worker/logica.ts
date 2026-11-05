/*
 * La parte del Club que no toca la red ni la base de datos: contraseñas,
 * tokens, nombres de archivo y hasta cuándo vale una suscripción. Así se puede
 * probar con `npm test` sin Cloudflare.
 */

export const DIA = 86_400_000
/** Días de gracia tras la fecha de cobro de PayPal, por si el cobro tarda. */
export const GRACIA = 2 * DIA
export const DURACION_SESION = 30 * DIA
/** Cloudflare Workers no admite más de 100 000 iteraciones de PBKDF2. */
const ITERACIONES = 100_000

const aB64 = (b: ArrayBuffer | Uint8Array) => {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b)
  let s = ''
  for (const x of bytes) s += String.fromCharCode(x)
  return btoa(s)
}
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const aHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

async function derivar(clave: string, sal: Uint8Array, iteraciones: number) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: iteraciones }, base, 256)
}

/** Compara sin cortar en el primer byte distinto, para no filtrar nada por el tiempo. */
export function iguales(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]
  return d === 0
}

export async function cifrarClave(clave: string) {
  const sal = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivar(clave, sal, ITERACIONES)
  return `pbkdf2$${ITERACIONES}$${aB64(sal)}$${aB64(hash)}`
}

export async function comprobarClave(clave: string, guardada: string) {
  const [tipo, iter, sal, hash] = guardada.split('$')
  if (tipo !== 'pbkdf2' || !iter || !sal || !hash) return false
  const calculado = await derivar(clave, deB64(sal), Number(iter))
  return iguales(new Uint8Array(calculado), deB64(hash))
}

export const nuevoToken = () => aB64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!)
export const nuevoId = () => crypto.randomUUID()
export const hashToken = async (t: string) => aHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))

export const normalizarCorreo = (c: unknown) => (typeof c === 'string' ? c.trim().toLowerCase() : '')
export const correoValido = (c: string) => c.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)
export function problemaClave(c: unknown) {
  if (typeof c !== 'string' || c.length < 8) return 'La contraseña necesita al menos 8 caracteres.'
  if (c.length > 200) return 'La contraseña es demasiado larga.'
  return null
}

/** Ids del catálogo y nombres de archivo: nada de barras, ni "..", ni rarezas. */
export const idValido = (s: string) => /^[a-z0-9][a-z0-9-]{0,80}$/.test(s)
export const nombreArchivoValido = (s: string) => s.length <= 160 && /^[\w][\w .()+-]*\.[A-Za-z0-9]{1,8}$/.test(s) && !s.includes('..')

export type SuscripcionPayPal = {
  id: string
  status: string
  plan_id?: string
  custom_id?: string
  billing_info?: { next_billing_time?: string; last_payment?: { time?: string } }
}

/**
 * Hasta cuándo puede descargar alguien según lo que diga PayPal.
 * - ACTIVE: hasta el próximo cobro, más dos días de gracia.
 * - CANCELLED: ya pagó el mes en curso, así que se respeta lo que tenía.
 * - SUSPENDED / EXPIRED / otro: se corta ya.
 */
export function venceSegunPayPal(s: SuscripcionPayPal, vencePrevio: number, ahora: number) {
  if (s.status === 'ACTIVE') {
    const proximo = Date.parse(s.billing_info?.next_billing_time ?? '')
    const desde = Number.isFinite(proximo) ? proximo : ahora + 30 * DIA
    return Math.max(desde + GRACIA, vencePrevio)
  }
  if (s.status === 'CANCELLED') {
    const ultimo = Date.parse(s.billing_info?.last_payment?.time ?? '')
    const pagado = Number.isFinite(ultimo) ? ultimo + 30 * DIA + GRACIA : 0
    return Math.max(vencePrevio, pagado)
  }
  return Math.min(vencePrevio, ahora)
}

/** Suma días de una activación manual sin quitar lo que ya tenía pagado. */
export const venceManual = (vencePrevio: number, dias: number, ahora: number) => Math.max(vencePrevio, ahora) + dias * DIA

/** De un evento de webhook de PayPal, el id de la suscripción a la que se refiere. */
export function suscripcionDelEvento(evento: unknown): string | null {
  const e = evento as { event_type?: string; resource?: { id?: string; billing_agreement_id?: string } }
  if (!e?.event_type || !e.resource) return null
  if (e.event_type.startsWith('BILLING.SUBSCRIPTION.')) return e.resource.id ?? null
  if (e.event_type.startsWith('PAYMENT.SALE.')) return e.resource.billing_agreement_id ?? null
  return null
}

export function leerCookie(cabecera: string | null, nombre: string) {
  for (const parte of (cabecera ?? '').split(';')) {
    const [k, ...v] = parte.trim().split('=')
    if (k === nombre) return v.join('=')
  }
  return null
}
