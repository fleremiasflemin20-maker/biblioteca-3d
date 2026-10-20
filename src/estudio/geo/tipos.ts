/**
 * Tipos compartidos del Estudio 3D: el hilo principal (editor), el worker de
 * geometría y las pruebas hablan con estos.
 *
 * Todo está en milímetros con Z hacia arriba, como en CrealityPrint, Bambu u
 * Orca: lo que se ve en el editor es lo que llega al laminador.
 */

/** Malla indexada: 3 floats por vértice y 3 índices por triángulo. */
export type MallaIdx = { pos: Float32Array; idx: Uint32Array }

export type Vec3 = [number, number, number]

/** Las formas que el editor sabe construir a partir de parámetros. */
export type TipoForma =
  | 'caja'
  | 'cilindro'
  | 'esfera'
  | 'cono'
  | 'toro'
  | 'tubo'
  | 'prisma'
  | 'piramide'
  | 'cuna'
  | 'texto'
  | 'svg'

export type Params = Record<string, number | string | boolean>

/**
 * Un objeto de la escena. La forma vive en coordenadas locales centradas en
 * el origen; `pos`/`rot`/`esc` la colocan en la cama.
 *
 * `malla` solo existe en objetos que no salen de parámetros (importados,
 * combinados o generados por una plantilla).
 */
export type Nodo = {
  id: string
  nombre: string
  tipo: TipoForma | 'malla'
  params: Params
  pos: Vec3
  /** Grados, orden XYZ. */
  rot: Vec3
  esc: Vec3
  color: string
  /** Los huecos restan a los sólidos al combinar y al exportar (como en Tinkercad). */
  hueco: boolean
  visible: boolean
  bloqueado?: boolean
  /** Piezas del catálogo: se ven y se editan, pero no se descargan. */
  protegido?: boolean
  malla?: MallaIdx
}

/** Parámetro de una plantilla o de una forma: lo que el panel enseña. */
export type Parametro =
  | { clave: string; nombre: string; tipo: 'numero'; min: number; max: number; paso: number; unidad?: string; valor: number; ayuda?: string }
  | { clave: string; nombre: string; tipo: 'opcion'; opciones: { valor: string; nombre: string }[]; valor: string; ayuda?: string }
  | { clave: string; nombre: string; tipo: 'texto'; valor: string; max?: number; ayuda?: string }
  | { clave: string; nombre: string; tipo: 'si-no'; valor: boolean; ayuda?: string }

/** Lo que devuelve una plantilla: piezas separadas, cada una lista para imprimir. */
export type PiezaGenerada = { nombre: string; color: string; malla: MallaIdx; /** Dónde ponerla en la cama, en mm. */ pos: Vec3 }

export type Analisis = {
  triangulos: number
  /** Aristas que no comparten exactamente dos triángulos: 0 = malla cerrada. */
  bordesAbiertos: number
  aristasRaras: number
  estanca: boolean
  cuerpos: number
  volumen: number // mm³
  area: number // mm²
  min: Vec3
  max: Vec3
  /** Área de caras que miran hacia abajo más de 45° y no tocan la cama: necesitan soporte. */
  voladizo: number
}

export type Impresora = { id: string; nombre: string; cama: Vec3; boquilla: number }

/*
 * Volumen útil de cada impresora. La K2 Plus es la de la ficha de Creality
 * (350³); la SPARKX i7 es la de su ficha (260 × 260 × 255).
 */
export const IMPRESORAS: Impresora[] = [
  { id: 'k2-plus', nombre: 'Creality K2 Plus', cama: [350, 350, 350], boquilla: 0.4 },
  { id: 'sparkx-i7', nombre: 'Creality SPARKX i7', cama: [260, 260, 255], boquilla: 0.4 },
  { id: 'a1-mini', nombre: 'Cama pequeña 180', cama: [180, 180, 180], boquilla: 0.4 },
]

/** Colores de la marca Flemin y filamentos comunes, en el orden de la paleta del editor. */
export const COLORES = [
  { color: '#FF6A13', nombre: 'Naranja Flemin' },
  { color: '#FFC23D', nombre: 'Oro Flemin' },
  { color: '#2FA8FF', nombre: 'Azul Flemin' },
  { color: '#1FBF8F', nombre: 'Jade Flemin' },
  { color: '#8A3CFF', nombre: 'Púrpura Flemin' },
  { color: '#F2F0EB', nombre: 'Blanco' },
  { color: '#1F1F22', nombre: 'Negro' },
  { color: '#9AA5B1', nombre: 'Gris' },
  { color: '#E4572E', nombre: 'Rojo' },
  { color: '#FF7AB6', nombre: 'Rosa' },
  { color: '#7A5230', nombre: 'Madera' },
  { color: '#C9A227', nombre: 'Seda oro' },
]
