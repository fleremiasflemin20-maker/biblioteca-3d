import datos from '../data/kits-pintura.json'
import type { Modelo3D } from './catalogo'

/**
 * Kit para pintar: cada figura en blanco se vende en una cajita con su
 * paleta exacta, la pintura adecuada para PLA y los pinceles para pintarla.
 *
 * La paleta vive en `src/data/kits-pintura.json`. Las que tienen `base` se
 * sacaron de la textura de su versión a color (los colores que más superficie
 * cubren, más blanco y negro para ojos y líneas); las demás se eligieron a mano.
 */
export type ColorKit = { nombre: string; hex: string }
export type KitPintura = { colores: ColorKit[]; base?: string }

const KITS = datos as Record<string, KitPintura>

export const kitDe = (m: Modelo3D): KitPintura | undefined => (m.sinTextura ? KITS[m.id] : undefined)

/** Lo que va en la cajita además de los colores. Igual para todas las figuras. */
export const CONTENIDO_KIT = [
  { nombre: 'La figura impresa en blanco', detalle: 'PLA blanco mate, sin soportes y lijada, lista para imprimar.' },
  { nombre: 'Imprimación para plástico', detalle: 'Una mano fina antes de pintar para que el acrílico agarre bien al PLA.' },
  { nombre: 'Acrílicos para modelismo', detalle: 'Un frasco por color de la paleta, a base de agua, mate y sin olor.' },
  { nombre: 'Barniz acrílico mate', detalle: 'Sella la pintura al final para que no se pele con el uso.' },
  { nombre: 'Carta de colores', detalle: 'La figura numerada: qué color va en cada zona, como un mapa.' },
]

export const PINCELES = [
  { nombre: 'Plano n.º 4', uso: 'Imprimación y zonas grandes' },
  { nombre: 'Redondo n.º 2', uso: 'Ropa, cabello y capas' },
  { nombre: 'Redondo n.º 0', uso: 'Detalles y bordes' },
  { nombre: 'Punta fina 3/0', uso: 'Ojos y líneas' },
  { nombre: 'Pincel seco', uso: 'Realzar relieves del cabello' },
]

/** El texto que acompaña al pedido por WhatsApp. */
export const detalleKit = (k: KitPintura) => `Lo quiero en blanco con su kit para pintar (${k.colores.length} colores y ${PINCELES.length} pinceles)`
