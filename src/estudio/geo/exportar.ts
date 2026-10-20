import type { MallaIdx } from './tipos.ts'

/**
 * Salida a los laminadores: STL binario (una pieza o todas juntas) y 3MF con
 * una pieza por objeto y su color, que CrealityPrint, Bambu Studio, Orca y
 * PrusaSlicer abren como multicolor.
 *
 * Las mallas llegan en coordenadas de la cama (mm, Z arriba).
 */
export type PiezaExport = { nombre: string; color: string; malla: MallaIdx }

export function stl(piezas: PiezaExport[]): Uint8Array<ArrayBuffer> {
  const nt = piezas.reduce((s, p) => s + p.malla.idx.length / 3, 0)
  const buf = new ArrayBuffer(84 + nt * 50)
  const dv = new DataView(buf)
  const cabecera = new TextEncoder().encode('Flemin Studio 3D - binary STL (mm)')
  new Uint8Array(buf).set(cabecera.subarray(0, 80))
  dv.setUint32(80, nt, true)
  let o = 84
  for (const { malla: m } of piezas) {
    for (let t = 0; t < m.idx.length; t += 3) {
      const a = m.idx[t] * 3, b = m.idx[t + 1] * 3, c = m.idx[t + 2] * 3
      const p = m.pos
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2]
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2]
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
      const l = Math.hypot(nx, ny, nz) || 1
      nx /= l; ny /= l; nz /= l
      for (const x of [nx, ny, nz]) (dv.setFloat32(o, x, true), (o += 4))
      for (const v of [a, b, c]) for (let k = 0; k < 3; k++) (dv.setFloat32(o, p[v + k], true), (o += 4))
      o += 2
    }
  }
  return new Uint8Array(buf)
}

/* ── 3MF ───────────────────────────────────────────────────────────── */

const xml = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)
const f = (x: number) => (Math.abs(x) < 1e-7 ? '0' : String(Math.round(x * 1e4) / 1e4))

export function tresmf(piezas: PiezaExport[]): Uint8Array<ArrayBuffer> {
  const partes: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    '<model unit="millimeter" xml:lang="es-EC" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n',
    '<metadata name="Application">Flemin Studio 3D</metadata>\n<resources>\n<basematerials id="1">\n',
  ]
  for (const p of piezas) partes.push(`<base name="${xml(p.nombre)}" displaycolor="${p.color.toUpperCase()}FF"/>\n`)
  partes.push('</basematerials>\n')
  piezas.forEach((p, i) => {
    partes.push(`<object id="${i + 2}" type="model" name="${xml(p.nombre)}" pid="1" pindex="${i}"><mesh><vertices>\n`)
    const v = p.malla.pos
    for (let k = 0; k < v.length; k += 3) partes.push(`<vertex x="${f(v[k])}" y="${f(v[k + 1])}" z="${f(v[k + 2])}"/>\n`)
    partes.push('</vertices><triangles>\n')
    const t = p.malla.idx
    for (let k = 0; k < t.length; k += 3) partes.push(`<triangle v1="${t[k]}" v2="${t[k + 1]}" v3="${t[k + 2]}"/>\n`)
    partes.push('</triangles></mesh></object>\n')
  })
  partes.push('</resources>\n<build>\n')
  piezas.forEach((_, i) => partes.push(`<item objectid="${i + 2}"/>\n`))
  partes.push('</build>\n</model>\n')

  const tx = new TextEncoder()
  return zip([
    ['[Content_Types].xml', tx.encode('<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')],
    ['_rels/.rels', tx.encode('<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')],
    ['3D/3dmodel.model', tx.encode(partes.join(''))],
  ])
}

/* ── ZIP sin comprimir (lo que pide el 3MF; el lector está en taller/zip.ts) ── */

const TABLA = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(d: Uint8Array) {
  let c = 0xffffffff
  for (let i = 0; i < d.length; i++) c = TABLA[(c ^ d[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function zip(archivos: [string, Uint8Array][]): Uint8Array<ArrayBuffer> {
  const tx = new TextEncoder()
  const locales: Uint8Array[] = [], centrales: Uint8Array[] = []
  let desplazamiento = 0
  for (const [nombre, datos] of archivos) {
    const n = tx.encode(nombre), crc = crc32(datos)
    const l = new DataView(new ArrayBuffer(30))
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(8, 0, true)
    l.setUint32(14, crc, true); l.setUint32(18, datos.length, true); l.setUint32(22, datos.length, true); l.setUint16(26, n.length, true)
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true)
    c.setUint32(16, crc, true); c.setUint32(20, datos.length, true); c.setUint32(24, datos.length, true); c.setUint16(28, n.length, true)
    c.setUint32(42, desplazamiento, true)
    locales.push(new Uint8Array(l.buffer), n, datos)
    centrales.push(new Uint8Array(c.buffer), n)
    desplazamiento += 30 + n.length + datos.length
  }
  const tamCentral = centrales.reduce((s, x) => s + x.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true)
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, desplazamiento, true)
  const todo = [...locales, ...centrales, new Uint8Array(fin.buffer)]
  const salida = new Uint8Array(todo.reduce((s, x) => s + x.length, 0))
  let o = 0
  for (const x of todo) (salida.set(x, o), (o += x.length))
  return salida
}
