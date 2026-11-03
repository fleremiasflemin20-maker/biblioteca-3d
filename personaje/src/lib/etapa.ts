import { ELEGIDA } from './figura'
import { peso, triangulos } from '../../../src/lib/catalogo'

/**
 * Las etapas del "cómo se hizo".
 *
 * La idea: en vez de contar el proceso con capturas de pantalla de otro
 * programa, se cuenta **sobre la misma figura**, quitándole capas en vivo. Quien
 * mira no tiene que creerse que debajo hay una malla — la ve.
 *
 * Los números no son adorno ni redondeos de memoria: salen de medir los
 * archivos de este repositorio. Cambiarlos sin volver a medir convierte la
 * pieza en marketing, que es justo lo que no es.
 */
export type Etapa = 'malla' | 'volumen' | 'color' | 'final'

const M = ELEGIDA?.modelo
const ORIGEN = M?.origen?.match(/Meshy|Tripo/i)?.[0] ?? 'IA'

/*
 * Lo mismo que contaba el Gogeta —malla, volumen, color, escena—, pero con los
 * datos de cada figura: no salen de un escaneo con el móvil sino de una malla
 * generada con IA a partir de una imagen y repasada para imprimirse.
 */
export const ETAPAS: {
  id: Etapa
  nombre: string
  dato: string
  detalle: string
}[] = [
  {
    id: 'malla',
    nombre: 'La malla',
    dato: `${triangulos(M?.triangulos)} triángulos`,
    detalle: `La figura nace como una malla de triángulos generada con ${ORIGEN} a partir de una imagen. Aquí se ve tal cual sale: alambre sobre arcilla, sin una sola capa de color.`,
  },
  {
    id: 'volumen',
    nombre: 'El volumen',
    dato: 'arcilla · sin textura',
    detalle:
      'Solo forma, con la luz del estudio. Así se revisa la pieza antes de imprimirla: que no tenga partes sueltas, paredes demasiado finas ni detalles que la boquilla no pueda dibujar.',
  },
  {
    id: 'color',
    nombre: 'El color',
    dato: 'textura horneada',
    detalle:
      'La textura sola, sin una sola luz. Es el color que lleva pintado el modelo, y el mismo que después se reparte por colores en la impresora multicolor.',
  },
  {
    id: 'final',
    nombre: 'La escena',
    dato: `${peso(M?.peso)} en total`,
    detalle: `Luz de estudio, contraluz, aura, contorno y sombra. Y el modelo comprimido con meshopt: ${peso(M?.peso)} para que esto arranque en un teléfono con datos.`,
  },
]
