import * as THREE from 'three'
import { Font, type FontData } from 'three/examples/jsm/loaders/FontLoader.js'
import fuenteJSON from '../data/fuente-nombre.json'
import iconosJSON from '../data/iconos-llavero.json'

/**
 * El llavero con nombre, construido en el navegador.
 *
 * Es el mismo algoritmo que `llavero_nombre.py`, el script que genera los STL
 * del pedido: misma tipografía (DejaVu Sans Bold convertida a typeface.js),
 * mismas siluetas y mismas medidas. Si se cambia una medida aquí, hay que
 * cambiarla allí, o el cliente recibiría algo distinto de lo que vio.
 */
export const MEDIDAS = {
  tamLetra: 9,
  altoIcono: 13,
  separacion: 2.5,
  margen: 3,
  altoMin: 18,
  radio: 4,
  anillaR: 4.5,
  huecoR: 2,
  anillaDx: 2.5,
  zPlaca: 2.4,
  zRelieve: 1.2,
  maxLetras: 14,
}

export const PALETAS = {
  atardecer: { nombre: 'Atardecer', placa: '#2B0F54', texto: '#FF7A2D', icono: '#FF2D89' },
  ecuador: { nombre: 'Ecuador', placa: '#FFD100', texto: '#024FA3', icono: '#EF333F' },
  galapagos: { nombre: 'Galápagos', placa: '#3BE0D1', texto: '#0F0F11', icono: '#F2F2F2' },
  clasico: { nombre: 'Clásico', placa: '#0F0F11', texto: '#F2F2F2', icono: '#FFC24D' },
} as const

export const ICONOS = {
  ninguno: 'Sin icono',
  palmera: 'Palmera',
  colibri: 'Colibrí',
  tortuga: 'Tortuga',
  corazon: 'Corazón',
} as const

export type PaletaId = keyof typeof PALETAS
export type IconoId = keyof typeof ICONOS
export type OpcionesLlavero = { nombre: string; icono: IconoId; paleta: PaletaId }

export const OPCIONES_INICIALES: OpcionesLlavero = { nombre: 'Tu Nombre', icono: 'palmera', paleta: 'atardecer' }

const fuente = new Font(fuenteJSON as unknown as FontData)

type Anillo = [number, number][]
type GeoJSON = { type: 'Polygon'; coordinates: Anillo[] } | { type: 'MultiPolygon'; coordinates: Anillo[][] }

function formasIcono(id: Exclude<IconoId, 'ninguno'>, escala: number, dx: number, dy: number) {
  const g = (iconosJSON as unknown as Record<string, GeoJSON>)[id]
  const poligonos = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const p = (a: Anillo) => a.map(([x, y]) => new THREE.Vector2(x * escala + dx, y * escala + dy))
  return poligonos.map(([fuera, ...huecos]) => {
    const s = new THREE.Shape(p(fuera))
    s.holes = huecos.map((h) => new THREE.Path(p(h)))
    return s
  })
}

function limites(formas: THREE.Shape[]) {
  const caja = new THREE.Box2()
  for (const f of formas) for (const v of f.getPoints(6)) caja.expandByPoint(v)
  return caja
}

function rectRedondeado(x0: number, y0: number, x1: number, y1: number, r: number) {
  const s = new THREE.Shape()
  s.moveTo(x0 + r, y0)
  s.lineTo(x1 - r, y0)
  s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x1, y1 - r)
  s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false)
  s.lineTo(x0 + r, y1)
  s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x0, y0 + r)
  s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

const extruir = (formas: THREE.Shape[], z0: number, alto: number) => {
  const g = new THREE.ExtrudeGeometry(formas, { depth: alto, bevelEnabled: false, curveSegments: 10 })
  g.translate(0, 0, z0)
  return g
}

/** Las tres piezas del llavero, en mm, con la placa de cara a la cámara. */
export function construirLlavero({ nombre, icono }: OpcionesLlavero) {
  const M = MEDIDAS
  const texto = nombre.trim().slice(0, M.maxLetras) || ' '
  const letras = fuente.generateShapes(texto, M.tamLetra)
  const t = limites(letras)
  if (t.isEmpty()) t.set(new THREE.Vector2(0, 0), new THREE.Vector2(10, 6.6))
  const cy = (t.min.y + t.max.y) / 2

  let iconos: THREE.Shape[] = []
  let anchoIcono = 0
  if (icono !== 'ninguno') {
    const prueba = limites(formasIcono(icono, M.altoIcono, 0, 0))
    anchoIcono = prueba.max.x - prueba.min.x
    iconos = formasIcono(icono, M.altoIcono, t.min.x - M.separacion - prueba.max.x, cy)
  }

  const cx0 = t.min.x - (anchoIcono ? anchoIcono + M.separacion : 0)
  const altoC = Math.max(t.max.y - t.min.y, anchoIcono ? M.altoIcono : 0)
  const alto = Math.max(altoC + 2 * M.margen, M.altoMin)
  const px0 = cx0 - M.margen
  const px1 = t.max.x + M.margen
  const placa = rectRedondeado(px0, cy - alto / 2, px1, cy + alto / 2, M.radio)

  // La anilla va aparte: sin operaciones booleanas en el navegador, su hueco
  // no puede quedar tapado por la placa, así que el agujero cae entero fuera.
  const ax = px0 - M.anillaDx
  const anilla = new THREE.Shape().absarc(ax, cy, M.anillaR, 0, Math.PI * 2, false)
  anilla.holes = [new THREE.Path().absarc(ax, cy, M.huecoR, 0, Math.PI * 2, true)]

  return {
    placa: extruir([placa, anilla], 0, M.zPlaca),
    texto: extruir(letras, M.zPlaca, M.zRelieve),
    icono: iconos.length ? extruir(iconos, M.zPlaca, M.zRelieve) : null,
    ancho: px1 - (ax - M.anillaR),
  }
}

/** El pedido que llega por WhatsApp, con todo lo necesario para generar el STL. */
export const describirPedido = (o: OpcionesLlavero) =>
  `Nombre: "${o.nombre.trim().slice(0, MEDIDAS.maxLetras)}" · Icono: ${ICONOS[o.icono]} · Colores: ${PALETAS[o.paleta].nombre}`
