/*
 * Lo que el Club pregunta al registrarse: qué personajes le gustan, qué
 * imprime y con qué. Lo usan la web (para pintar el formulario) y el Worker
 * (para guardar solo valores conocidos).
 */

export const UNIVERSOS = [
  { id: 'dragon-ball', nombre: 'Dragon Ball' },
  { id: 'anime', nombre: 'Anime y manga' },
  { id: 'superheroes', nombre: 'Superhéroes' },
  { id: 'caballeros', nombre: 'Caballeros del Zodiaco' },
  { id: 'videojuegos', nombre: 'Videojuegos' },
  { id: 'peliculas', nombre: 'Películas y series' },
  { id: 'terror', nombre: 'Terror y Halloween' },
  { id: 'originales', nombre: 'Personajes originales Flemin' },
  { id: 'animales', nombre: 'Animales y mascotas' },
] as const

export const IMPRESIONES = [
  { id: 'figuras-pintar', nombre: 'Figuras para pintar' },
  { id: 'figuras-color', nombre: 'Figuras multicolor' },
  { id: 'piezas-utiles', nombre: 'Repuestos y piezas útiles' },
  { id: 'hogar', nombre: 'Hogar y decoración' },
  { id: 'accesorios', nombre: 'Llaveros y accesorios' },
  { id: 'cosplay', nombre: 'Cosplay y máscaras' },
  { id: 'gaming', nombre: 'Soportes gaming' },
  { id: 'articulados', nombre: 'Juguetes articulados' },
] as const

export const IMPRESORAS = [
  { id: 'fdm', nombre: 'Filamento (FDM)', detalle: 'PLA, PETG, TPU…' },
  { id: 'multicolor', nombre: 'Filamento multicolor', detalle: 'AMS, CFS, MMU…' },
  { id: 'resina', nombre: 'Resina', detalle: 'Detalle fino para figuras' },
  { id: 'ninguna', nombre: 'Aún no tengo', detalle: 'Imprimo en un taller' },
] as const

export const NIVELES = [
  { id: 'empezando', nombre: 'Empezando' },
  { id: 'intermedio', nombre: 'Intermedio' },
  { id: 'experto', nombre: 'Experto' },
] as const

export const USOS = [
  { id: 'personal', nombre: 'Colección personal' },
  { id: 'regalos', nombre: 'Regalos' },
  { id: 'negocio', nombre: 'Para vender impresiones' },
] as const

export type Perfil = {
  universos: string[]
  impresiones: string[]
  impresora?: string
  nivel?: string
  uso?: string
  pedido?: string
  whatsapp?: string
  ciudad?: string
  novedades: boolean
}

const ids = (lista: readonly { id: string }[]) => new Set(lista.map((x) => x.id))
const U = ids(UNIVERSOS)
const I = ids(IMPRESIONES)
const P = ids(IMPRESORAS)
const N = ids(NIVELES)
const S = ids(USOS)

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '') || undefined
const uno = (v: unknown, validos: Set<string>) => (typeof v === 'string' && validos.has(v) ? v : undefined)
const varios = (v: unknown, validos: Set<string>) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && validos.has(x)))] : [])

/** Deja solo lo que el formulario puede mandar; cualquier otra cosa se descarta. */
export function limpiarPerfil(p: unknown): Perfil {
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>
  const whatsapp = typeof o.whatsapp === 'string' ? o.whatsapp.replace(/[^\d+]/g, '').slice(0, 16) : ''
  return {
    universos: varios(o.universos, U),
    impresiones: varios(o.impresiones, I),
    impresora: uno(o.impresora, P),
    nivel: uno(o.nivel, N),
    uso: uno(o.uso, S),
    pedido: texto(o.pedido, 200),
    whatsapp: whatsapp.length >= 7 ? whatsapp : undefined,
    ciudad: texto(o.ciudad, 60),
    novedades: o.novedades === true,
  }
}

export const limpiarNombre = (v: unknown) => texto(v, 60)
