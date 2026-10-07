/*
 * El Taller 3D, comprobado con geometría hecha a mano.
 *
 * Lo que se enseña al público como "ingeniería exacta" tiene que serlo: las
 * piezas separadas cierran, sus volúmenes suman el de la pieza entera y la
 * pintura del laminador se reconstruye con la misma geometría.
 *
 *   npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import { Constructor, cerrarBucle, medir, quitarIslas, separar, subdividir, suavizar, topologia, type Malla } from '../src/lib/taller/malla.ts'
import { decodificarPintura } from '../src/lib/taller/pintura.ts'
import { leerZip } from '../src/lib/taller/zip.ts'
import { leer3MF } from '../src/lib/taller/tresmf.ts'
import { cuantizar } from '../src/lib/taller/color.ts'

/** Caja [0,lx]×[0,ly]×[0,lz] con cada cara en una rejilla n×n, normales hacia fuera. */
function caja(lx: number, ly: number, lz: number, n: number, color: (cx: number, cy: number, cz: number) => number): Malla {
  const c = new Constructor()
  // Cada cara: origen, dos ejes (u × v apunta hacia fuera).
  const caras: [number[], number[], number[]][] = [
    [[0, 0, 0], [0, ly, 0], [lx, 0, 0]], // z = 0, normal -z
    [[0, 0, lz], [lx, 0, 0], [0, ly, 0]], // z = lz
    [[0, 0, 0], [lx, 0, 0], [0, 0, lz]], // y = 0, normal -y
    [[0, ly, 0], [0, 0, lz], [lx, 0, 0]], // y = ly
    [[0, 0, 0], [0, 0, lz], [0, ly, 0]], // x = 0, normal -x
    [[lx, 0, 0], [0, ly, 0], [0, 0, lz]], // x = lx
  ]
  for (const [o, u, v] of caras)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const p = (a: number, b: number) => o.map((x, k) => x + (u[k] * a) / n + (v[k] * b) / n)
        const [p00, p10, p11, p01] = [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)]
        for (const [a, b, d] of [[p00, p10, p11], [p00, p11, p01]]) {
          const cx = (a[0] + b[0] + d[0]) / 3, cy = (a[1] + b[1] + d[1]) / 3, cz = (a[2] + b[2] + d[2]) / 3
          c.agregar(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2], color(cx, cy, cz))
        }
      }
  return c.malla()
}

test('la caja de prueba está bien orientada: volumen positivo y exacto', () => {
  const m = caja(20, 10, 10, 4, () => 0)
  assert.ok(Math.abs(medir(m.pos).volumen - 2000) < 1e-6)
  const topo = topologia(m.pos)
  assert.equal(topo.vpos.length / 3, 6 * 16 + 2) // vértices de una caja 4×4 por cara: 6n² + 2
  assert.ok(topo.vecinos.every((v) => v >= 0))
})

test('separar por color da piezas cerradas cuyos volúmenes suman el total', () => {
  const m = caja(20, 10, 10, 4, (x) => (x < 10 ? 0 : 1))
  const piezas = separar(m, topologia(m.pos), 'auto')
  assert.equal(piezas.length, 2)
  for (const p of piezas) {
    assert.ok(p.cerrada, `pieza ${p.color} abierta`)
    assert.equal(p.bucles, 1)
    assert.ok(Math.abs(p.volumen - 1000) < 1e-3, `volumen ${p.volumen}`)
    // Corte plano de 10×10 con 4×4 vértices de borde: se tapa con triángulos planos, sin centroide.
    assert.equal(p.tapas, 16 - 2)
  }
})

test('una mancha en medio de una cara deja un bucle por cada lado y ambas piezas cerradas', () => {
  const m = caja(10, 10, 10, 6, (x, y, z) => (z === 10 && x > 3 && x < 7 && y > 3 && y < 7 ? 1 : 0))
  const piezas = separar(m, topologia(m.pos), 'auto')
  assert.equal(piezas.length, 2)
  assert.ok(piezas.every((p) => p.cerrada && p.bucles === 1))
  const total = piezas.reduce((s, p) => s + p.volumen, 0)
  assert.ok(Math.abs(total - 1000) < 1e-3, `total ${total}`)
})

test('las tapas cierran también con abanico desde el centroide', () => {
  const m = caja(20, 10, 10, 2, (x) => (x < 10 ? 0 : 1))
  for (const p of separar(m, topologia(m.pos), 'centroide')) {
    assert.ok(p.cerrada)
    assert.ok(Math.abs(p.volumen - 1000) < 1e-3)
  }
})

test('cerrarBucle mira al lado contrario del bucle', () => {
  // Cuadrado antihorario visto desde +z: la tapa debe mirar a -z.
  const { tris } = cerrarBucle([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 'plana')
  const pts = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [pts[tris[i]], pts[tris[i + 1]], pts[tris[i + 2]]]
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    assert.ok(nz < 0)
  }
})

test('la pintura del laminador se reconstruye con su geometría', () => {
  const t = [[0, 0, 0], [2, 0, 0], [0, 2, 0]] as const
  const hojas: { t: number[][]; e: number }[] = []
  // "841": raíz partida por un lado (1); luego el último hijo (estado 1) y el primero (estado 2).
  decodificarPintura('841', t, (tri, e) => hojas.push({ t: tri.map((p) => [...p]), e }))
  assert.deepEqual(hojas, [
    { t: [[1, 1, 0], [0, 2, 0], [0, 0, 0]], e: 1 },
    { t: [[0, 0, 0], [2, 0, 0], [1, 1, 0]], e: 2 },
  ])
})

test('estados extendidos, árboles uniformes y árboles corruptos', () => {
  const t = [[0, 0, 0], [1, 0, 0], [0, 1, 0]] as const
  const estados = (hex: string) => {
    const r: number[] = []
    decodificarPintura(hex, t, (_, e) => r.push(e))
    return r
  }
  assert.deepEqual(estados('2C'), [5]) // 0b11 → siguiente nibble + 3
  assert.deepEqual(estados('1FC'), [19]) // 0xF → siguiente + 18
  assert.deepEqual(estados('4882'), [2, 2, 1]) // dos lados partidos: tres hijos
  assert.deepEqual(estados('44443'), [1]) // todo del mismo color: el triángulo entero
  assert.deepEqual(estados('3'), [0]) // le faltan los hijos: se descarta la pintura
})

test('los hijos de la pintura cubren el triángulo sin solaparse', () => {
  const t = [[0, 0, 0], [4, 0, 0], [0, 4, 0]] as const
  for (const hex of ['48443', '4882', '8846', '849', '4884431']) {
    let area = 0
    decodificarPintura(hex, t, (p) => {
      area += Math.abs((p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0])) / 2
    })
    assert.ok(Math.abs(area - 8) < 1e-9, `${hex}: ${area}`)
  }
})

/** ZIP mínimo para las pruebas: una entrada guardada y el resto con deflate. */
function zip(archivos: Record<string, string>): Uint8Array {
  const partes: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  Object.entries(archivos).forEach(([nombre, contenido], i) => {
    const datos = Buffer.from(contenido)
    const comprimido = i === 0 ? datos : deflateRawSync(datos)
    const n = Buffer.from(nombre)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(i === 0 ? 0 : 8, 8)
    local.writeUInt32LE(comprimido.length, 18)
    local.writeUInt32LE(datos.length, 22)
    local.writeUInt16LE(n.length, 26)
    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(i === 0 ? 0 : 8, 10)
    cd.writeUInt32LE(comprimido.length, 20)
    cd.writeUInt32LE(datos.length, 24)
    cd.writeUInt16LE(n.length, 28)
    cd.writeUInt32LE(offset, 42)
    partes.push(local, n, comprimido)
    central.push(cd, n)
    offset += 30 + n.length + comprimido.length
  })
  const cdTam = central.reduce((s, b) => s + b.length, 0)
  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0)
  fin.writeUInt16LE(central.length / 2, 8)
  fin.writeUInt16LE(central.length / 2, 10)
  fin.writeUInt32LE(cdTam, 12)
  fin.writeUInt32LE(offset, 16)
  return new Uint8Array(Buffer.concat([...partes, ...central, fin]))
}

test('leerZip abre entradas guardadas y comprimidas', async () => {
  const z = leerZip(zip({ 'a.txt': 'hola', 'b/c.txt': 'mundo '.repeat(100) }))
  assert.equal(new TextDecoder().decode(await z.get('a.txt')!()), 'hola')
  assert.equal(new TextDecoder().decode(await z.get('b/c.txt')!()), 'mundo '.repeat(100))
})

const TETRA = `<vertices><vertex x="0" y="0" z="0"/><vertex x="10" y="0" z="0"/><vertex x="0" y="10" z="0"/><vertex x="0" y="0" z="10"/></vertices>`

test('3MF de Bambu: componentes, filamento por pieza, pintura y colores del proyecto', async () => {
  const sub = `<?xml version="1.0"?><model unit="millimeter"><resources>
    <object id="1" type="model"><mesh>${TETRA}<triangles>
      <triangle v1="0" v2="2" v3="1"/>
      <triangle v1="0" v2="1" v3="3" paint_color="8"/>
      <triangle v1="1" v2="2" v3="3" paint_color="841"/>
      <triangle v1="0" v2="3" v3="2"/>
    </triangles></mesh></object></resources></model>`
  const raiz = `<?xml version="1.0"?><model unit="millimeter" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"><resources>
    <object id="2" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="1" transform="1 0 0 0 1 0 0 0 1 100 0 0"/></components></object>
    </resources><build><item objectid="2" transform="1 0 0 0 1 0 0 0 1 0 0 5"/></build></model>`
  const ajustes = `<?xml version="1.0"?><config><object id="2"><metadata key="extruder" value="1"/><part id="1" subtype="normal_part"><metadata key="extruder" value="3"/></part></object></config>`
  const datos = zip({
    '_rels/.rels': `<Relationships><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`,
    '3D/3dmodel.model': raiz,
    '3D/Objects/object_1.model': sub,
    'Metadata/model_settings.config': ajustes,
    'Metadata/project_settings.config': JSON.stringify({ filament_colour: ['#FFFFFF', '#FF0000', '#00FF00'] }),
  })
  const { malla, paleta } = await leer3MF(datos)
  assert.equal(malla.color.length, 5) // 3 enteros + 1 partido en dos
  const usados = [...new Set(malla.color)].map((i) => paleta[i].color).sort()
  assert.deepEqual(usados, ['#00FF00', '#FF0000', '#FFFFFF']) // pieza en filamento 3, pintura en 1 y 2
  // Transformaciones encadenadas: componente (+100 en x) y item (+5 en z).
  assert.equal(malla.pos[0], 100)
  assert.equal(malla.pos[2], 5)
  const piezas = separar(malla, topologia(malla.pos))
  // Con tres colores en un punto cada pieza se tapa por su lado: cierran todas,
  // pero el volumen solo se conserva exacto en fronteras de dos colores.
  assert.ok(piezas.every((p) => p.cerrada))
})

test('3MF con basematerials: un color por material', async () => {
  const modelo = `<model><resources><basematerials id="5"><base name="Rojo" displaycolor="#FF0000FF"/><base name="Azul" displaycolor="#0000FF"/></basematerials>
    <object id="1" type="model" pid="5" pindex="0"><mesh>${TETRA}<triangles>
      <triangle v1="0" v2="2" v3="1"/><triangle v1="0" v2="1" v3="3" pid="5" p1="1"/><triangle v1="1" v2="2" v3="3"/><triangle v1="0" v2="3" v3="2"/>
    </triangles></mesh></object></resources><build><item objectid="1"/></build></model>`
  const { paleta, malla } = await leer3MF(zip({ '3D/3dmodel.model': modelo }))
  assert.deepEqual(paleta.map((p) => [p.nombre, p.color]), [['Rojo', '#FF0000'], ['Azul', '#0000FF']])
  assert.deepEqual([...malla.color], [0, 1, 0, 0])
})

test('suavizar y quitar islas limpian el ruido de pintura', () => {
  const m = caja(10, 10, 10, 6, () => 0)
  m.color[40] = 1 // un triángulo suelto
  const topo = topologia(m.pos)
  assert.ok(suavizar(m, topo) >= 1)
  assert.equal(m.color[40], 0)
  m.color[40] = 1
  m.color[41] = 1
  assert.equal(quitarIslas(m, topo, 5), 2)
  assert.ok(m.color.every((c) => c === 0))
})

test('subdividir conserva superficie, volumen y cierre', () => {
  const m = subdividir(caja(10, 10, 10, 2, (x) => (x < 5 ? 0 : 1)))
  assert.equal(m.color.length, 6 * 8 * 4)
  assert.ok(Math.abs(medir(m.pos).volumen - 1000) < 1e-6)
  assert.ok(separar(m, topologia(m.pos)).every((p) => p.cerrada))
})

test('cuantizar separa colores claros y es estable', () => {
  const n = 300
  const rgb = new Float32Array(n * 3)
  for (let t = 0; t < n; t++) rgb.set(t < 200 ? [0.9, 0.1, 0.1] : t < 280 ? [0.1, 0.2, 0.9] : [0.95, 0.95, 0.95], t * 3)
  const pesos = new Float32Array(n).fill(1)
  const a = cuantizar(rgb, pesos, 3)
  assert.equal(a.paleta.length, 3)
  assert.equal(a.asignacion[0], 0) // el rojo es el de más área
  assert.equal(a.asignacion[250], 1)
  assert.equal(a.asignacion[299], 2)
  assert.deepEqual(cuantizar(rgb, pesos, 3), a)
  assert.equal(cuantizar(rgb, pesos, 10).paleta.length, 3) // no inventa colores
})

test('los triángulos degenerados del origen no abren las piezas', () => {
  const m = caja(20, 10, 10, 4, (x) => (x < 10 ? 0 : 1))
  // Un triángulo con dos esquinas iguales sobre una arista real, como los que dejan algunos exportadores.
  const c = new Constructor()
  for (let t = 0; t < m.color.length; t++) {
    const p = m.pos.subarray(t * 9, t * 9 + 9)
    c.agregar(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], m.color[t])
  }
  const p = m.pos
  c.agregar(p[0], p[1], p[2], p[0], p[1], p[2], p[3], p[4], p[5], 0)
  const conBasura = c.malla()
  const piezas = separar(conBasura, topologia(conBasura.pos))
  assert.ok(piezas.every((x) => x.cerrada))
  assert.ok(piezas.every((x) => Math.abs(x.volumen - 1000) < 1e-3))
})
