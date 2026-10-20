import type { CrossSection, Manifold, Vec2 } from 'manifold-3d'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import type { Wasm } from './wasm.ts'
import type { Parametro, Params, TipoForma } from './tipos.ts'

/**
 * Las formas básicas del editor (las de Tinkercad, más texto, SVG y el
 * emblema Flemin), cada una construida con Manifold para que cualquier
 * combinación posterior salga cerrada.
 *
 * Cada forma sale centrada en el origen: así gira y escala sobre su centro,
 * como en Blender, y "apoyar en la cama" la baja después.
 */

export type DefForma = { tipo: TipoForma; nombre: string; params: Parametro[] }

const n = (clave: string, nombre: string, valor: number, min: number, max: number, paso = 0.5, unidad = 'mm'): Parametro => ({
  clave, nombre, tipo: 'numero', valor, min, max, paso, unidad,
})

export const FORMAS: DefForma[] = [
  { tipo: 'caja', nombre: 'Caja', params: [n('ancho', 'Ancho', 20, 0.2, 400), n('fondo', 'Fondo', 20, 0.2, 400), n('alto', 'Alto', 20, 0.2, 400), n('radio', 'Redondeo', 0, 0, 50, 0.1)] },
  { tipo: 'cilindro', nombre: 'Cilindro', params: [n('diametro', 'Diámetro', 20, 0.2, 400), n('alto', 'Alto', 20, 0.2, 400), n('lados', 'Lados', 96, 3, 256, 1, '')] },
  { tipo: 'esfera', nombre: 'Esfera', params: [n('diametro', 'Diámetro', 20, 0.2, 400)] },
  { tipo: 'cono', nombre: 'Cono', params: [n('base', 'Diámetro base', 20, 0.2, 400), n('arriba', 'Diámetro arriba', 0, 0, 400), n('alto', 'Alto', 20, 0.2, 400)] },
  { tipo: 'toro', nombre: 'Toro', params: [n('diametro', 'Diámetro', 30, 1, 400), n('grosor', 'Grosor', 6, 0.2, 200)] },
  { tipo: 'tubo', nombre: 'Tubo', params: [n('diametro', 'Diámetro', 20, 0.4, 400), n('pared', 'Pared', 2, 0.2, 100, 0.1), n('alto', 'Alto', 20, 0.2, 400)] },
  { tipo: 'prisma', nombre: 'Prisma', params: [n('lados', 'Lados', 6, 3, 24, 1, ''), n('diametro', 'Diámetro', 20, 0.2, 400), n('alto', 'Alto', 20, 0.2, 400)] },
  { tipo: 'piramide', nombre: 'Pirámide', params: [n('base', 'Base', 20, 0.2, 400), n('alto', 'Alto', 20, 0.2, 400)] },
  { tipo: 'cuna', nombre: 'Cuña', params: [n('ancho', 'Ancho', 20, 0.2, 400), n('fondo', 'Fondo', 20, 0.2, 400), n('alto', 'Alto', 20, 0.2, 400)] },
  {
    tipo: 'texto',
    nombre: 'Texto',
    params: [
      { clave: 'texto', nombre: 'Texto', tipo: 'texto', valor: 'Flemin', max: 40 },
      n('tamano', 'Tamaño de letra', 10, 1, 200),
      n('alto', 'Relieve', 3, 0.2, 100, 0.1),
    ],
  },
  { tipo: 'svg', nombre: 'Emblema Flemin', params: [n('ancho', 'Ancho', 30, 1, 400), n('alto', 'Relieve', 2, 0.2, 100, 0.1)] },
]

export const defForma = (t: TipoForma) => FORMAS.find((f) => f.tipo === t)!
export const paramsIniciales = (t: TipoForma): Params => Object.fromEntries(defForma(t).params.map((p) => [p.clave, p.valor]))

const num = (p: Params, k: string, def = 0) => (typeof p[k] === 'number' ? (p[k] as number) : Number(p[k]) || def)
const pos = (x: number, min = 0.05) => Math.max(min, x)

/* ── 2D ─────────────────────────────────────────────────────────────── */

/** Bézier cúbica muestreada (sin el primer punto). */
function bezier(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, k = 16): Vec2[] {
  const r: Vec2[] = []
  for (let i = 1; i < k; i++) {
    const t = i / (k - 1), u = 1 - t
    r.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ])
  }
  return r
}

/**
 * El emblema Flemin (la "F" con chispa del SVG de marca, viewBox 0..100 con
 * Y hacia abajo), igual que en `grinder/flemin_grinder.py`. Sale centrado,
 * con Y arriba y lado 100.
 */
export function poligonosEmblema(): Vec2[][] {
  const f: Vec2[] = [[37, 80], [37, 40]]
  f.push(...bezier([37, 40], [37, 26], [45, 16], [58, 11]))
  f.push(...bezier([58, 11], [54, 19], [56, 23], [62, 25]))
  f.push([72, 25])
  f.push(...bezier([72, 25], [68, 32], [61, 35], [50, 35]))
  f.push([50, 46], [67, 46])
  f.push(...bezier([67, 46], [63, 53], [57, 56], [50, 56]))
  f.push([50, 80])
  f.push(...bezier([50, 80], [46, 76], [41, 76], [37, 80]).slice(0, -1))
  const chispa: Vec2[] = [[66, 58], [58, 70], [64, 70], [59, 82], [72, 66], [65, 66], [70, 58]]
  const arreglar = (p: Vec2[]): Vec2[] => {
    const a = p.map(([x, y]) => [x - 50, 50 - y] as Vec2)
    let area = 0
    for (let i = 0; i < a.length; i++) {
      const [x0, y0] = a[i], [x1, y1] = a[(i + 1) % a.length]
      area += x0 * y1 - x1 * y0
    }
    return area > 0 ? a : a.reverse()
  }
  return [arreglar(f), arreglar(chispa)]
}

export function emblema(w: Wasm, escala: number, conAnillo = true): CrossSection {
  const [f, chispa] = poligonosEmblema()
  let s = new w.CrossSection([f]).add(new w.CrossSection([chispa]))
  if (conAnillo) s = s.add(w.CrossSection.circle(46, 96).subtract(w.CrossSection.circle(41.5, 96)))
  return s.scale([escala, escala])
}

/** Texto → contornos con la tipografía del llavero (DejaVu Sans Bold). */
export function seccionTexto(w: Wasm, fuente: Font, texto: string, tamano: number): CrossSection {
  const formas = fuente.generateShapes(texto || ' ', tamano)
  const partes = formas.map((f) => {
    const { shape, holes } = f.extractPoints(6)
    const anillo = (pts: { x: number; y: number }[]) => pts.map((p) => [p.x, p.y] as Vec2)
    return new w.CrossSection([anillo(shape), ...holes.map(anillo)], 'EvenOdd')
  })
  return partes.length ? w.CrossSection.union(partes) : w.CrossSection.square(0.01)
}

/** Contornos ya leídos de un SVG (el hilo principal los saca con SVGLoader). */
export function seccionContornos(w: Wasm, contornos: Vec2[][]): CrossSection {
  return new w.CrossSection(contornos, 'EvenOdd')
}

/* ── 3D ─────────────────────────────────────────────────────────────── */

function centrar(s: Manifold): Manifold {
  const b = s.boundingBox()
  return s.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2, -(b.min[2] + b.max[2]) / 2])
}

export function rectRedondeado(w: Wasm, ancho: number, fondo: number, radio: number): CrossSection {
  const r = Math.min(radio, ancho / 2 - 0.01, fondo / 2 - 0.01)
  if (r <= 0.01) return w.CrossSection.square([ancho, fondo], true)
  return w.CrossSection.square([ancho - 2 * r, fondo - 2 * r], true).offset(r, 'Round', 2, 48)
}

export type Contexto = { fuente?: Font }

export function construirForma(w: Wasm, tipo: TipoForma, p: Params, ctx: Contexto = {}): Manifold {
  const M = w.Manifold
  let s: Manifold
  switch (tipo) {
    case 'caja':
      s = rectRedondeado(w, pos(num(p, 'ancho', 20)), pos(num(p, 'fondo', 20)), num(p, 'radio')).extrude(pos(num(p, 'alto', 20)))
      break
    case 'cilindro': {
      const r = pos(num(p, 'diametro', 20)) / 2
      s = M.cylinder(pos(num(p, 'alto', 20)), r, r, Math.round(Math.min(256, Math.max(3, num(p, 'lados', 96)))))
      break
    }
    case 'esfera':
      s = M.sphere(pos(num(p, 'diametro', 20)) / 2, 96)
      break
    case 'cono':
      s = M.cylinder(pos(num(p, 'alto', 20)), pos(num(p, 'base', 20)) / 2, Math.max(0, num(p, 'arriba')) / 2, 96)
      break
    case 'toro': {
      const g = pos(num(p, 'grosor', 6)) / 2
      const R = Math.max(g + 0.05, pos(num(p, 'diametro', 30)) / 2 - g)
      s = w.CrossSection.circle(g, 48).translate([R, 0]).revolve(96)
      break
    }
    case 'tubo': {
      const r = pos(num(p, 'diametro', 20)) / 2
      const ri = Math.max(0.05, r - pos(num(p, 'pared', 2)))
      const h = pos(num(p, 'alto', 20))
      s = M.cylinder(h, r, r, 96).subtract(M.cylinder(h + 2, ri, ri, 96).translate([0, 0, -1]))
      break
    }
    case 'prisma': {
      const r = pos(num(p, 'diametro', 20)) / 2
      s = M.cylinder(pos(num(p, 'alto', 20)), r, r, Math.round(Math.min(24, Math.max(3, num(p, 'lados', 6)))))
      break
    }
    case 'piramide': {
      const b = pos(num(p, 'base', 20))
      s = w.CrossSection.square([b, b], true).extrude(pos(num(p, 'alto', 20)), 0, 0, [0, 0])
      break
    }
    case 'cuna': {
      const a = pos(num(p, 'ancho', 20)), f = pos(num(p, 'fondo', 20)), h = pos(num(p, 'alto', 20))
      // Perfil triangular en XZ, extruido a lo largo de Y.
      s = new w.CrossSection([[[0, 0], [f, 0], [0, h]]]).extrude(a).rotate([90, 0, 90])
      break
    }
    case 'texto': {
      if (!ctx.fuente) throw new Error('Falta la tipografía')
      s = seccionTexto(w, ctx.fuente, String(p.texto ?? ''), pos(num(p, 'tamano', 10))).extrude(pos(num(p, 'alto', 3)))
      break
    }
    case 'svg': {
      const ancho = pos(num(p, 'ancho', 30))
      const cs = typeof p.contornos === 'string' && p.contornos ? seccionContornos(w, JSON.parse(p.contornos)) : emblema(w, 1)
      const b = cs.bounds()
      const k = ancho / Math.max(1e-6, b.max[0] - b.min[0])
      s = cs.scale([k, k]).extrude(pos(num(p, 'alto', 2)))
      break
    }
  }
  if (s.isEmpty()) throw new Error('La forma quedó vacía: revisa sus medidas')
  return centrar(s)
}
