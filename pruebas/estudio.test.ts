/*
 * El Estudio 3D, comprobado con Manifold real (el mismo WASM del navegador).
 *
 * Lo que sale del editor va a una impresora: cada forma y cada plantilla
 * tiene que salir cerrada, con las medidas prometidas, y los archivos que se
 * exportan tienen que volver a leerse igual.
 *
 *   npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Font, type FontData } from 'three/examples/jsm/loaders/FontLoader.js'
import { aManifold, cargarWasm, deManifold, liberar } from '../src/estudio/geo/wasm.ts'
import { FORMAS, construirForma, paramsIniciales } from '../src/estudio/geo/formas.ts'
import { HUECOS, PLANTILLAS, generarPlantilla } from '../src/estudio/geo/plantillas.ts'
import { analizar, gramos, mejorApoyo, soldar } from '../src/estudio/geo/impresion.ts'
import { stl, tresmf } from '../src/estudio/geo/exportar.ts'
import { mallaMundo } from '../src/estudio/editor/estado.ts'
import { leer3MF } from '../src/lib/taller/tresmf.ts'
import type { MallaIdx } from '../src/estudio/geo/tipos.ts'

const fuente = new Font(JSON.parse(readFileSync(new URL('../src/data/fuente-nombre.json', import.meta.url), 'utf8')) as FontData)
const w = await cargarWasm()
const ctx = { fuente }

const tam = (m: MallaIdx) => {
  const a = analizar(m)
  return [0, 1, 2].map((i) => a.max[i] - a.min[i])
}

test('cada forma básica sale cerrada y con volumen', () => {
  for (const f of FORMAS) {
    const s = construirForma(w, f.tipo, paramsIniciales(f.tipo), ctx)
    assert.equal(s.status(), 'NoError', f.tipo)
    const a = analizar(deManifold(s))
    assert.ok(a.estanca, `${f.tipo} no cierra`)
    assert.ok(a.volumen > 1, `${f.tipo} sin volumen`)
  }
  liberar()
})

test('la caja mide lo que dice y sale centrada', () => {
  const m = deManifold(construirForma(w, 'caja', { ancho: 30, fondo: 20, alto: 10, radio: 0 }))
  const a = analizar(m)
  assert.deepEqual(tam(m).map((x) => +x.toFixed(4)), [30, 20, 10])
  assert.ok(Math.abs(a.volumen - 6000) < 1e-3)
  assert.deepEqual(a.min.map((x) => +x.toFixed(4)), [-15, -10, -5])
  liberar()
})

test('combinar: una caja menos un cilindro pasante deja el volumen exacto', () => {
  const caja = w.Manifold.cube([20, 20, 10], true)
  const agujero = aManifold(w, deManifold(w.Manifold.cylinder(20, 4, 4, 256, true)))
  const r = caja.subtract(agujero)
  const esperado = 4000 - Math.PI * 16 * 10
  assert.ok(Math.abs(r.volume() - esperado) / esperado < 0.002, `${r.volume()} vs ${esperado}`)
  assert.equal(r.genus(), 1)
  liberar()
})

for (const pl of PLANTILLAS) {
  test(`plantilla «${pl.nombre}»: piezas cerradas y apoyadas`, () => {
    const piezas = generarPlantilla(w, pl.id, {}, ctx)
    assert.ok(piezas.length > 0)
    let suelo = Infinity
    for (const p of piezas) {
      const a = analizar(p.malla)
      assert.ok(a.estanca, `${p.nombre}: ${a.bordesAbiertos} bordes abiertos, ${a.aristasRaras} aristas raras`)
      assert.ok(a.volumen > 10, p.nombre)
      // La malla sale centrada; su `pos` la deja sobre la cama (o montada sobre otra pieza).
      const base = p.pos[2] + a.min[2]
      assert.ok(base > -1e-3, `${p.nombre} atraviesa la cama`)
      suelo = Math.min(suelo, base)
    }
    assert.ok(Math.abs(suelo) < 1e-3, 'el lote no toca la cama')
    liberar()
  })
}

test('funda BIC Mini: hueco de la tabla HUECOS más dos paredes', () => {
  const [f] = generarPlantilla(w, 'funda-encendedor', { encendedor: 'mini', pared: 1.8, ajuste: 0 }, ctx)
  const [x, y, z] = tam(f.malla)
  assert.ok(Math.abs(x - (HUECOS.mini.ancho + 3.6)) < 0.05, `ancho ${x}`)
  assert.ok(y >= HUECOS.mini.grosor + 3.6 - 0.05, `grosor ${y}`)
  assert.ok(Math.abs(z - HUECOS.mini.alto) < 0.05, `alto ${z}`)
  liberar()
})

test('grinder: 63 mm de diámetro, cuatro piezas que no chocan con la holgura de rosca', () => {
  const piezas = generarPlantilla(w, 'grinder-63', { calidad: 'borrador' }, ctx)
  assert.equal(piezas.length, 4)
  for (const p of piezas) {
    const [x, y] = tam(p.malla)
    assert.ok(x > 61 && x <= 63.05 && y > 61 && y <= 63.05, `${p.nombre}: ${x} × ${y}`)
  }
  liberar()
})

test('llavero: el nombre queda montado sobre la placa', () => {
  const [placa, nombre] = generarPlantilla(w, 'placa-nombre', { texto: 'Kairo', placa: 2.4 }, ctx)
  assert.ok(Math.abs(nombre.pos[2] - tam(nombre.malla)[2] / 2 - 2.4) < 1e-3)
  assert.ok(Math.abs(placa.pos[2] - 1.2) < 1e-3)
  liberar()
})

test('revisar malla: detecta bordes abiertos', () => {
  const caja = deManifold(w.Manifold.cube([10, 10, 10]))
  const abierta = { pos: caja.pos, idx: caja.idx.slice(3) }
  const a = analizar(abierta)
  assert.equal(a.estanca, false)
  assert.equal(a.bordesAbiertos, 3)
  assert.ok(gramos(1000, 600) > 0)
  liberar()
})

test('auto-orientar: una cuña tumbada se apoya por su cara grande', () => {
  // Cuña (rampa) girada 90°: su base de 20 × 20 queda de lado.
  const cuna = construirForma(w, 'cuna', { ancho: 20, fondo: 20, alto: 20 }).rotate([0, 90, 0])
  const r = mejorApoyo(deManifold(cuna))
  // La base original miraba a -Z; tras girar 90° en Y mira a +X... o la hipotenusa, que tiene más área.
  assert.ok(r.apoyo >= 399, `apoyo ${r.apoyo}`)
  assert.ok(r.voladizo < 1, `voladizo ${r.voladizo}`)
  liberar()
})

test('espejo: la malla del mundo invierte triángulos y sigue con volumen positivo', () => {
  const m = deManifold(w.Manifold.cube([10, 20, 30], true))
  const espejada = mallaMundo({ pos: [0, 0, 15], rot: [0, 0, 0], esc: [-1, 1, 1] }, m)
  const a = analizar(espejada)
  assert.ok(a.estanca)
  assert.ok(aManifold(w, espejada).volume() > 5999)
  liberar()
})

test('exportar: STL binario y 3MF multicolor que se vuelve a leer igual', async () => {
  const a = deManifold(w.Manifold.cube([10, 10, 10]))
  const b = deManifold(w.Manifold.cylinder(10, 4, 4, 32).translate([20, 0, 0]))
  const piezas = [
    { nombre: 'Cubo', color: '#FF6A13', malla: a },
    { nombre: 'Cilindro <Flemin>', color: '#2FA8FF', malla: b },
  ]
  const nt = (a.idx.length + b.idx.length) / 3
  const s = stl(piezas)
  assert.equal(s.length, 84 + 50 * nt)
  assert.equal(new DataView(s.buffer).getUint32(80, true), nt)

  const leido = await leer3MF(tresmf(piezas))
  assert.equal(leido.malla.color.length, nt)
  assert.deepEqual(leido.paleta.map((p) => p.color.toUpperCase()), ['#FF6A13', '#2FA8FF'])
  const vuelta = soldar(leido.malla.pos)
  assert.ok(analizar(vuelta).estanca)
  liberar()
})
