/*
 * El Club Flemin del lado de la web: quién ha iniciado sesión, si su
 * suscripción está activa y qué modelos tienen archivos de impresión.
 *
 * Todo vive en el Worker de Cloudflare (worker/index.ts). En GitHub Pages no
 * hay Worker: `/api/club/config` falla, `disponible` queda en false y la web
 * esconde todo lo del Club.
 */
import { useSyncExternalStore } from 'react'

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
export const API = `${BASE}/api`

export type Suscripcion = { activa: boolean; vence: number | null; proveedor: string | null; estado: string | null }
export type UsuarioClub = { id: string; correo: string; admin: boolean }
export type ConfigClub = { precio: string; paypal: { clientId: string; planId: string } | null; whatsapp: string }

type Estado = {
  cargado: boolean
  disponible: boolean
  config: ConfigClub
  usuario: UsuarioClub | null
  suscripcion: Suscripcion | null
  modelos: Set<string>
  panel: boolean
  pestana: PestanaClub
}

export type PestanaClub = 'info' | 'cuenta'
/** Lo que se enseña aunque el servidor no responda (GitHub Pages o antes de cargar). */
export const PRECIO_CLUB = '9.99'
const CONFIG_BASE: ConfigClub = { precio: PRECIO_CLUB, paypal: null, whatsapp: '593979523040' }

let estado: Estado = { cargado: false, disponible: false, config: CONFIG_BASE, usuario: null, suscripcion: null, modelos: new Set(), panel: false, pestana: 'info' }
const oyentes = new Set<() => void>()
const cambiar = (parcial: Partial<Estado>) => {
  estado = { ...estado, ...parcial }
  oyentes.forEach((f) => f())
}

export const useClub = () =>
  useSyncExternalStore(
    (f) => {
      oyentes.add(f)
      return () => oyentes.delete(f)
    },
    () => estado,
  )

/** Abre el Club. Sin pestaña: la explicación para quien no es socio, su cuenta para quien sí. */
export const abrirClub = (pestana?: PestanaClub) =>
  cambiar({ panel: true, pestana: pestana ?? (estado.suscripcion?.activa ? 'cuenta' : 'info') })
export const verPestana = (pestana: PestanaClub) => cambiar({ pestana })
export const cerrarClub = () => cambiar({ panel: false })

export async function pedir<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(`${API}${ruta}`, {
    method: cuerpo === undefined ? 'GET' : 'POST',
    headers: cuerpo === undefined ? undefined : { 'content-type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    credentials: 'same-origin',
  })
  const tipo = r.headers.get('content-type') ?? ''
  const datos = tipo.includes('json') ? await r.json() : null
  if (!r.ok || !datos) throw new Error(datos?.error ?? `Error ${r.status}`)
  return datos as T
}

/** Vuelve a preguntar quién soy (tras entrar, salir o pagar). */
export async function refrescarUsuario() {
  try {
    const yo = await pedir<{ usuario: UsuarioClub | null; suscripcion?: Suscripcion }>('/yo')
    cambiar({ usuario: yo.usuario, suscripcion: yo.suscripcion ?? null })
  } catch {
    cambiar({ usuario: null, suscripcion: null })
  }
}

let iniciado = false
export async function iniciarClub() {
  if (iniciado) return
  iniciado = true
  try {
    const config = await pedir<ConfigClub>('/club/config')
    cambiar({ config, disponible: true })
    await Promise.all([
      refrescarUsuario(),
      pedir<{ modelos: string[] }>('/club/modelos')
        .then((m) => cambiar({ modelos: new Set(m.modelos) }))
        .catch(() => {}),
    ])
  } catch {
    cambiar({ disponible: false, config: CONFIG_BASE })
  } finally {
    cambiar({ cargado: true })
  }
}

export const entrar = (correo: string, clave: string) => pedir('/entrar', { correo, clave }).then(refrescarUsuario)
export const crearCuenta = (correo: string, clave: string) => pedir('/registro', { correo, clave }).then(refrescarUsuario)
export const salir = () => pedir('/salir', {}).then(refrescarUsuario)
export const confirmarPayPal = (subscriptionID: string) => pedir('/paypal/confirmar', { subscriptionID }).then(refrescarUsuario)

export type ArchivoClub = { nombre: string; tamano: number }
export const archivosDe = (id: string) => pedir<{ archivos: ArchivoClub[] }>(`/archivos/${encodeURIComponent(id)}`).then((r) => r.archivos)
export const enlaceDescarga = (id: string, nombre: string) => `${API}/descargar/${encodeURIComponent(id)}/${encodeURIComponent(nombre)}`

export const fecha = (ms: number) => new Date(ms).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })
export const megas = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
