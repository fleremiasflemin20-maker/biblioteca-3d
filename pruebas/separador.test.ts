/*
 * El Separador de Flemin Studio, comprobado con Manifold real.
 *
 * Lo que importa al imprimir: cada pieza sale cerrada, nada se pierde ni
 * sobra al separar (los volúmenes suman el original), y espigas, huecos y
 * clavijas no chocan entre sí cuando se monta con holgura.
 *
 *   npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aManifold, cargarWasm, deManifold, liberar } from '../src/estudio/geo/wasm.ts'
import { CONECTOR_INICIAL, separarAutomatico, cortarBoceto, cortarPlano, dividirParaCama, planoDesdeEje, repartirEnCama, separarPorColor, taparAgujeros, type TipoConector } from '../src/estudio/geo/separador.ts'
import { regionAngulo, suavizarFrontera } from '../src/estudio/geo/frontera.ts'
import { areas, topologia } from '../src/lib/taller/malla.ts'
import { leer3MF } from '../src/lib/taller/tresmf.ts'
import { soldar } from '../src/estudio/geo/impresion.ts'
import { readFileSync } from 'node:fs'
import { analizar } from '../src/estudio/geo/impresion.ts'
import type { MallaIdx } from '../src/estudio/geo/tipos.ts'

const w = await cargarWasm()

const volumen = (m: MallaIdx) => analizar(m).volumen
/** Volumen común de dos piezas montadas: 0 = no se tocan por dentro. */
const choque = (a: MallaIdx, b: MallaIdx) => aManifold(w, a).intersect(aManifold(w, b)).volume()

/** Malla indexada → sopa de triángulos (lo que lee el separador por color). */
function sopa(m: MallaIdx) {
  const s = new Float32Array(m.idx.length * 3)
  for (let i = 0; i < m.idx.length; i++) s.set(m.pos.subarray(m.idx[i] * 3, m.idx[i] * 3 + 3), i * 3)
  return s
}

const BLOQUE = () => deManifold(w.Manifold.cube([40, 30, 60], true).translate([0, 0, 30]))
const MITAD = { normal: [0, 0, 1] as [number, number, number], punto: [0, 0, 30] as [number, number, number] }

test('corte sin conectores: dos piezas cerradas que suman el original', () => {
  const r = cortarPlano(w, BLOQUE(), MITAD, { ...CONECTOR_INICIAL, tipo: 'ninguno' })
  const [a, b] = r.lados.map((l) => analizar(l!))
  assert.ok(a.estanca && b.estanca)
  assert.ok(Math.abs(a.volumen + b.volumen - 72000) < 1e-2)
  assert.ok(Math.abs(a.min[2] - 30) < 1e-4 && Math.abs(b.max[2] - 30) < 1e-4)
  liberar()
})

for (const tipo of ['cilindro', 'cuadrado', 'triangulo'] as TipoConector[]) {
  test(`espiga ${tipo}: entra en su hueco sin chocar y con la holgura pedida`, () => {
    const c = { ...CONECTOR_INICIAL, tipo, cantidad: 2, tolerancia: 0.2 }
    const r = cortarPlano(w, BLOQUE(), MITAD, c)
    assert.equal(r.conectores, 2)
    const [arriba, abajo] = r.lados as MallaIdx[]
    assert.ok(analizar(arriba).estanca && analizar(abajo).estanca)
    // La espiga sale del lado de abajo y entra en el de arriba.
    assert.ok(analizar(abajo).max[2] > 30 + c.alto - 0.01)
    assert.ok(choque(arriba, abajo) < 1e-3, `chocan ${choque(arriba, abajo)} mm³`)
    // El hueco es más grande que la espiga: lo que sobra es el aire del encaje.
    const aire = 72000 - volumen(arriba) - volumen(abajo)
    assert.ok(aire > 0 && aire < 400, `aire ${aire}`)
    liberar()
  })
}

test('sin holgura, la espiga ocupa exactamente su hueco (salvo el fondo extra)', () => {
  const r = cortarPlano(w, BLOQUE(), MITAD, { ...CONECTOR_INICIAL, tipo: 'cuadrado', cantidad: 1, tolerancia: 0 })
  const [arriba, abajo] = r.lados as MallaIdx[]
  assert.ok(choque(arriba, abajo) < 1e-3)
  liberar()
})

test('clavija suelta: dos huecos y una clavija que no choca con ninguno', () => {
  const r = cortarPlano(w, BLOQUE(), MITAD, { ...CONECTOR_INICIAL, tipo: 'clavija', cantidad: 2 })
  assert.equal(r.clavijas.length, 2)
  const [arriba, abajo] = r.lados as MallaIdx[]
  for (const cl of r.clavijas) {
    assert.ok(analizar(cl).estanca)
    assert.ok(choque(cl, arriba) < 1e-3 && choque(cl, abajo) < 1e-3)
  }
  liberar()
})

test('corte inclinado y girado: piezas cerradas, mismo volumen total', () => {
  const plano = planoDesdeEje(2, 0.4, 25, 30, [-20, -15, 0], [20, 15, 60])
  const r = cortarPlano(w, BLOQUE(), plano, { ...CONECTOR_INICIAL, tipo: 'ninguno' })
  const v = r.lados.map((l) => volumen(l!))
  assert.ok(r.lados.every((l) => analizar(l!).estanca))
  assert.ok(Math.abs(v[0] + v[1] - 72000) < 1e-2)
  liberar()
})

test('un plano que no toca la pieza la deja intacta', () => {
  const r = cortarPlano(w, BLOQUE(), { normal: [0, 0, 1], punto: [0, 0, 100] }, CONECTOR_INICIAL)
  assert.equal(r.lados[0], null)
  assert.ok(r.aviso)
  liberar()
})

test('corte demasiado estrecho para el conector: avisa y corta igual', () => {
  const fino = deManifold(w.Manifold.cube([40, 3, 60], true).translate([0, 0, 30]))
  const r = cortarPlano(w, fino, MITAD, { ...CONECTOR_INICIAL, diametro: 6 })
  assert.equal(r.conectores, 0)
  assert.match(r.aviso ?? '', /estrecho/)
  assert.ok(r.lados[0] && r.lados[1])
  liberar()
})

test('dividir para la cama: una barra de 700 mm queda en piezas que caben en la K2 Plus', () => {
  const barra = deManifold(w.Manifold.cube([700, 40, 40], true))
  const r = dividirParaCama(w, barra, [350, 350, 350], { ...CONECTOR_INICIAL, tipo: 'ninguno' })
  assert.equal(r.cortes, 2)
  assert.equal(r.piezas.length, 3)
  for (const p of r.piezas) {
    const a = analizar(p)
    assert.ok(a.estanca && a.max[0] - a.min[0] <= 340)
  }
  liberar()
})

test('por color, frontera: dos piezas cerradas que suman el volumen', () => {
  const caja = deManifold(w.Manifold.cube([20, 20, 20], true).refine(6))
  const pos = sopa(caja)
  const color = new Uint8Array(pos.length / 9).map((_, t) => (pos[t * 9 + 2] + pos[t * 9 + 5] + pos[t * 9 + 8] > 0 ? 1 : 0))
  const r = separarPorColor(w, pos, color, { modo: 'frontera', tapa: 'auto', profundidad: 1, base: 0 })
  assert.equal(r.piezas.length, 2)
  assert.ok(r.piezas.every((p) => p.estanca))
  const suma = r.piezas.reduce((s, p) => s + volumen(p.malla), 0)
  assert.ok(Math.abs(suma - 8000) < 1, `suma ${suma}`)
  liberar()
})

test('por color, incrustado: el parche sale como placa de la profundidad pedida', () => {
  const caja = deManifold(w.Manifold.cube([20, 20, 20], true).refine(10))
  const pos = sopa(caja)
  // Un cuadrado pintado en la cara de arriba, lejos de los bordes.
  const color = new Uint8Array(pos.length / 9).map((_, t) => {
    const cx = (pos[t * 9] + pos[t * 9 + 3] + pos[t * 9 + 6]) / 3
    const cy = (pos[t * 9 + 1] + pos[t * 9 + 4] + pos[t * 9 + 7]) / 3
    const cz = (pos[t * 9 + 2] + pos[t * 9 + 5] + pos[t * 9 + 8]) / 3
    return cz > 9.99 && Math.abs(cx) < 5 && Math.abs(cy) < 5 ? 1 : 0
  })
  const r = separarPorColor(w, pos, color, { modo: 'incrustar', tapa: 'auto', profundidad: 1.5, base: 0 })
  assert.deepEqual(r.avisos, [])
  const [cuerpo, placa] = r.piezas.map((p) => p.malla)
  const a = analizar(placa)
  assert.ok(a.estanca && analizar(cuerpo).estanca)
  assert.ok(Math.abs(a.max[2] - a.min[2] - 1.5) < 1e-3, `grosor ${a.max[2] - a.min[2]}`)
  assert.ok(Math.abs(volumen(cuerpo) + volumen(placa) - 8000) < 1e-2)
  assert.ok(choque(cuerpo, placa) < 1e-3)
  liberar()
})

test('repartir en la cama: todas apoyadas, dentro de la cama y sin encimarse', () => {
  const r = cortarPlano(w, BLOQUE(), MITAD, { ...CONECTOR_INICIAL, tipo: 'clavija' })
  const piezas = [...(r.lados as MallaIdx[]), ...r.clavijas]
  const { mallas, camas } = repartirEnCama(piezas, [350, 350, 350])
  assert.equal(camas, 1)
  const cajas = mallas.map(analizar)
  for (const a of cajas) {
    assert.ok(Math.abs(a.min[2]) < 1e-4)
    assert.ok(a.min[0] >= -175 - 1e-3 && a.max[0] <= 175 + 1e-3 && a.min[1] >= -175 - 1e-3 && a.max[1] <= 175 + 1e-3)
  }
  for (let i = 0; i < cajas.length; i++)
    for (let j = i + 1; j < cajas.length; j++) {
      const [a, b] = [cajas[i], cajas[j]]
      const solapan = a.min[0] < b.max[0] && b.min[0] < a.max[0] && a.min[1] < b.max[1] && b.min[1] < a.max[1]
      assert.ok(!solapan, `piezas ${i} y ${j} se enciman`)
    }
  // El grupo queda centrado en la cama, no amontonado en una esquina.
  const gx = (Math.min(...cajas.map((a) => a.min[0])) + Math.max(...cajas.map((a) => a.max[0]))) / 2
  const gy = (Math.min(...cajas.map((a) => a.min[1])) + Math.max(...cajas.map((a) => a.max[1]))) / 2
  assert.ok(Math.abs(gx) < 1e-3 && Math.abs(gy) < 1e-3, `centro ${gx}, ${gy}`)
  // La mitad cortada se apoya por su cara de corte: 40 × 30 abajo, 30 de alto.
  assert.ok(Math.abs(cajas[0].max[2] - 30) < 1e-3)
  liberar()
})

test('reparación: una malla con agujeros se cierra y se corta igual', () => {
  const caja = deManifold(w.Manifold.cube([40, 30, 60], true).translate([0, 0, 30]).refine(4))
  const abierta = { pos: caja.pos, idx: caja.idx.slice(3 * 20) } // le faltan 20 triángulos
  assert.ok(!analizar(abierta).estanca)
  assert.ok(analizar(taparAgujeros(abierta)).estanca)
  const r = cortarPlano(w, abierta, MITAD, CONECTOR_INICIAL)
  assert.equal(r.reparada, true)
  assert.ok(r.lados.every((l) => l && analizar(l).estanca))
  // Como llega de un STL: cada triángulo con sus propios vértices. La salida debe cerrar por índices.
  const p = sopa(abierta)
  const suelta = { pos: p, idx: new Uint32Array(p.length / 3).map((_, i) => i) }
  const r2 = cortarPlano(w, suelta, MITAD, CONECTOR_INICIAL)
  assert.ok(r2.lados.every((l) => l && analizar(l).bordesAbiertos === 0))
  liberar()
})

test('frontera suave: el borde sigue la curva pintada, no la escalera de triángulos', () => {
  // Placa teselada con un círculo de 6 mm pintado triángulo a triángulo: borde en escalera.
  const placa = deManifold(w.Manifold.cube([20, 20, 2], true).refine(20))
  const pos = sopa(placa)
  const color = new Uint8Array(pos.length / 9).map((_, t) => (Math.hypot((pos[t * 9] + pos[t * 9 + 3] + pos[t * 9 + 6]) / 3, (pos[t * 9 + 1] + pos[t * 9 + 4] + pos[t * 9 + 7]) / 3) < 6 ? 1 : 0))
  /** Distancia media al círculo ideal de los vértices de la frontera en la cara de arriba. */
  const desvio = (p: Float32Array, c: Uint8Array) => {
    const t = topologia(p)
    let s = 0, n = 0
    for (let k = 0; k < c.length; k++)
      for (let i = 0; i < 3; i++) {
        const v = t.vecinos[k * 3 + i]
        if (v < 0 || c[v] === c[k]) continue
        const a = t.vert[k * 3 + i]
        if (t.vpos[a * 3 + 2] < 0.9) continue
        s += Math.abs(Math.hypot(t.vpos[a * 3], t.vpos[a * 3 + 1]) - 6)
        n++
      }
    return s / n
  }
  const antes = desvio(pos, color)
  const m = suavizarFrontera({ pos, color }, 2)
  const despues = desvio(m.pos, m.color)
  assert.ok(despues < antes / 4, `antes ${antes.toFixed(3)} después ${despues.toFixed(3)}`)
  const r = separarPorColor(w, m.pos, m.color, { modo: 'frontera', tapa: 'auto', profundidad: 1, base: 0 })
  assert.ok(r.piezas.every((p) => p.estanca))
  const suma = r.piezas.reduce((s2, p) => s2 + volumen(p.malla), 0)
  assert.ok(Math.abs(suma - 800) < 0.5, `suma ${suma}`)
  liberar()
})

test('tapa membrana: piezas cerradas en cortes curvos', () => {
  const esfera = deManifold(w.Manifold.sphere(15, 48))
  const pos = sopa(esfera)
  // Casquete pintado por una curva ondulada: el borde no es plano.
  const color = new Uint8Array(pos.length / 9).map((_, t) => {
    const x = (pos[t * 9] + pos[t * 9 + 3] + pos[t * 9 + 6]) / 3, z = (pos[t * 9 + 2] + pos[t * 9 + 5] + pos[t * 9 + 8]) / 3
    return z > 4 * Math.sin(x / 4) ? 1 : 0
  })
  const r = separarPorColor(w, pos, color, { modo: 'frontera', tapa: 'membrana', profundidad: 1, base: 0 })
  assert.equal(r.piezas.length, 2)
  assert.ok(r.piezas.every((p) => p.estanca))
  liberar()
})

test('corte con boceto: lo de dentro del contorno sale aparte, nada se pierde', () => {
  // Un cuadrado de 10 × 10 visto desde arriba (marco = identidad: dibujo en XY, mirada por -Z).
  const marco = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 30, 1]
  const r = cortarBoceto(w, BLOQUE(), [[-5, -5], [5, -5], [5, 5], [-5, 5]], marco, 200)
  const [dentro, fuera] = r.lados as MallaIdx[]
  assert.ok(Math.abs(volumen(dentro) - 10 * 10 * 60) < 1e-2)
  assert.ok(Math.abs(volumen(dentro) + volumen(fuera) - 72000) < 1e-2)
  assert.ok(analizar(fuera).estanca && analizar(dentro).estanca)
  liberar()
})

test('relleno por ángulo: se detiene en las aristas vivas', () => {
  const pos = sopa(deManifold(w.Manifold.cube([10, 10, 10], true).refine(4)))
  const t = topologia(pos)
  // Un triángulo de la cara de arriba: el relleno cubre esa cara y nada más.
  const arriba = [...Array(pos.length / 9).keys()].find((k) => pos[k * 9 + 2] > 4.99 && pos[k * 9 + 5] > 4.99 && pos[k * 9 + 8] > 4.99)!
  const cara = regionAngulo(pos, t, arriba, 30)
  assert.equal(cara.length, pos.length / 9 / 6)
  assert.equal(regionAngulo(pos, t, arriba, 95).length, pos.length / 9)
  liberar()
})

/*
 * Archivos reales: 3MF multicolor de Bambu Studio que se venden en la tienda
 * (public/descargas). Cada color tiene que salir como pieza cerrada y, entre
 * todas, sumar el volumen del original, en los dos modos.
 */
for (const archivo of ['aretes-helados', 'aretes-hongo']) {
  for (const modo of ['frontera', 'incrustar'] as const) {
    test(`3MF real «${archivo}» por color (${modo}): una pieza cerrada por color, volumen exacto`, async () => {
      const { malla, paleta } = await leer3MF(new Uint8Array(readFileSync(new URL(`../public/descargas/${archivo}.3mf`, import.meta.url))))
      const a = areas(malla.pos)
      const sup = new Array<number>(paleta.length).fill(0)
      malla.color.forEach((c, t) => (sup[c] += a[t]))
      const usados = new Set(malla.color).size
      const r = separarPorColor(w, malla.pos, malla.color, { modo, tapa: 'auto', profundidad: 1, base: sup.indexOf(Math.max(...sup)) })
      assert.equal(r.piezas.length, usados)
      assert.ok(r.piezas.every((p) => analizar(p.malla).bordesAbiertos === 0))
      const original = analizar(soldar(malla.pos)).volumen
      const suma = r.piezas.reduce((s2, p) => s2 + volumen(p.malla), 0)
      assert.ok(Math.abs(suma - original) / original < 1e-3, `suma ${suma} vs ${original}`)
      liberar()
    })
  }
}

test('separar automático: limpia motas, suaviza fronteras y deja una pieza cerrada por color', () => {
  const placa = deManifold(w.Manifold.cube([20, 20, 2], true).refine(20))
  const pos = sopa(placa)
  // Un círculo pintado en escalera, más motas sueltas de un tercer color (ruido de textura).
  const color = new Uint8Array(pos.length / 9).map((_, t) => {
    const x = (pos[t * 9] + pos[t * 9 + 3] + pos[t * 9 + 6]) / 3, y = (pos[t * 9 + 1] + pos[t * 9 + 4] + pos[t * 9 + 7]) / 3
    if (t % 997 === 0) return 2
    return Math.hypot(x, y) < 6 ? 1 : 0
  })
  const r = separarAutomatico(w, pos, color, { modo: 'frontera', tapa: 'auto', profundidad: 1, base: 0, suavizado: 2, limpiar: true })
  assert.equal(r.piezas.length, 2, 'las motas no deben salir como pieza')
  assert.ok(r.piezas.every((p) => p.estanca && analizar(p.malla).bordesAbiertos === 0))
  assert.ok(Math.abs(r.piezas.reduce((s2, p) => s2 + volumen(p.malla), 0) - 800) < 0.5)
  liberar()
})
