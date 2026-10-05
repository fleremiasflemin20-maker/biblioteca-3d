import datos from '../data/catalogo.json'

/**
 * El catálogo de la tienda.
 *
 * Vive en `src/data/catalogo.json` y no en código para que el panel de subida
 * (ver `admin.ts`) pueda escribirlo sin tocar TypeScript. Editarlo a mano
 * también vale: cada objeto es una ficha.
 */
export type Modelo3D = {
  id: string
  nombre: string
  categoria: CategoriaId
  /** En dólares. 0 = gratis. */
  precio: number
  formatos: string[]
  descripcion: string
  /** Ruta dentro de `public/models/`. */
  archivo: string
  /** Bytes del `.glb` de vista previa. */
  peso?: number
  triangulos?: number
  /** Nombre del `.webp` dentro de `public/portadas/`. La web la genera sola. */
  portada?: string
  origen?: string
  destacado?: boolean
  /** Enlace de compra externo (Gumroad, Cults3D, CGTrader…). Sin él, se compra por WhatsApp. */
  compra?: string
  alta?: string
  /** Por defecto "Uso personal y comercial". Las piezas de terceros llevan la suya. */
  licencia?: string
  /** Autor original, cuando la pieza no es propia (lo exigen CC BY-SA y similares). */
  autor?: string
  /** Se construye en el navegador con el nombre del cliente (ver llavero.ts). */
  personalizable?: boolean
  draco?: boolean
  /** Mapas PBR sueltos, para mallas que no traen el material horneado. */
  texturas?: { carpeta: string; map: string; normalMap: string; roughnessMap: string; metalnessMap: string }
}

export type CategoriaId = 'tecnologia' | 'mecanica' | 'autos' | 'anime' | 'manga' | 'seres-flemin' | 'accesorios'

export type Categoria = {
  id: CategoriaId | 'todo'
  nombre: string
  clave: string
  desde: string
  hasta: string
  tinta: string
}

/*
 * Mismo criterio que las facetas del portafolio: cada categoría es el mismo
 * atardecer mirado a otra hora. Al elegirla cambia la paleta de la página
 * entera, no solo el filtro.
 */
export const CATEGORIAS: Categoria[] = [
  { id: 'todo', nombre: 'Todo', clave: 'ALL', desde: '#00E5D1', hasta: '#2AC3FF', tinta: '#3BE0D0' },
  { id: 'tecnologia', nombre: 'Tecnología', clave: 'TEC', desde: '#00E5D1', hasta: '#2A7BFF', tinta: '#4DE8FF' },
  { id: 'mecanica', nombre: 'Mecánica', clave: 'MEC', desde: '#FFB800', hasta: '#FF5E2F', tinta: '#FFC24D' },
  { id: 'autos', nombre: 'Autos', clave: 'AUT', desde: '#FF3B3B', hasta: '#FF8A2F', tinta: '#FF7A6B' },
  { id: 'anime', nombre: 'Anime', clave: 'ANI', desde: '#FF2D8A', hasta: '#FF7A2F', tinta: '#FF9A4D' },
  { id: 'manga', nombre: 'Manga', clave: 'MNG', desde: '#F5F4F1', hasta: '#FF2D8A', tinta: '#FF8FC0' },
  { id: 'seres-flemin', nombre: 'Seres Flemin', clave: 'FLM', desde: '#7B2CFF', hasta: '#FF2D8A', tinta: '#C77DFF' },
  { id: 'accesorios', nombre: 'Hogar y accesorios', clave: 'ACC', desde: '#2AC3FF', hasta: '#7B2CFF', tinta: '#7CC8FF' },
]

export const CATALOGO = datos as Modelo3D[]

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
export const DRACO = `${BASE}/draco/`
export const rutaModelo = (m: Modelo3D) => `${BASE}/models/${m.archivo}`
export const rutaTextura = (m: Modelo3D, archivo: string) => `${BASE}/textures/${m.texturas!.carpeta}/${archivo}`
export const rutaPortada = (m: Modelo3D) => (m.portada ? `${BASE}/portadas/${m.portada}` : undefined)

export const precio = (n: number) => (n === 0 ? 'Gratis' : `$${n.toFixed(n % 1 ? 2 : 0)}`)

export const peso = (b?: number) => (!b ? '—' : b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`)

export const triangulos = (n?: number) =>
  !n ? '—' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n)

/* Contacto del portafolio. Sin enlace de compra propio, el botón abre
   WhatsApp con el pedido ya escrito. */
export const WHATSAPP = '593979523040'
export const CORREO = 'fleremias@outlook.com'

export function enlaceCompra(m: Modelo3D, detalle?: string) {
  if (m.compra) return m.compra
  const texto = detalle
    ? `Hola, quiero pedir el "${m.nombre}" (${precio(m.precio)}). ${detalle}.`
    : `Hola, quiero comprar el modelo 3D "${m.nombre}" (${precio(m.precio)}). Formatos: ${m.formatos.join(', ')}.`
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`
}
