import { geo } from '../geo/cliente.ts'
import { soldar } from '../geo/impresion.ts'
import { planoDesdeEje } from '../geo/separador.ts'
import { stl, tresmf, zip } from '../geo/exportar.ts'
import { COLORES, IMPRESORAS, type MallaIdx, type Vec3 } from '../geo/tipos.ts'
import { aFilamentos, importarArchivo, importarURL, type Proyecto } from '../../lib/taller/importar'
import { areas, region, subdividir, suavizar, quitarIslas, topologia, type Topologia } from '../../lib/taller/malla'
import { regionAngulo, suavizarFrontera } from '../geo/frontera.ts'
import * as THREE from 'three'
import { rutaModelo, type Modelo3D } from '../../lib/catalogo'
import { camaraVisor, entrada, idPieza, medir, useSeparador, type PiezaSep } from './estado.ts'

/**
 * Lo que hacen los botones del Separador. Las operaciones pesadas van al
 * worker de geometría (Manifold); la pintura, al hilo principal como en el
 * Taller, porque es instantánea.
 */
const S = () => useSeparador.getState()

function avisar(texto: string, tipo: 'ok' | 'error' | 'info' = 'info') {
  S().set({ aviso: { texto, tipo } })
}

async function tarea<T>(mensaje: string, f: () => Promise<T>): Promise<T | undefined> {
  S().set({ ocupado: mensaje })
  await new Promise((r) => setTimeout(r, 20)) // que el aviso se pinte antes del trabajo
  try {
    return await f()
  } catch (e) {
    avisar(e instanceof Error ? e.message : String(e), 'error')
    return undefined
  } finally {
    S().set({ ocupado: null })
  }
}

export const impresora = () => IMPRESORAS.find((i) => i.id === S().impresora) ?? IMPRESORAS[0]

const pieza = (p: Omit<PiezaSep, 'id' | 'visible' | 'estanca'> & { estanca?: boolean }): PiezaSep => ({
  id: idPieza(),
  visible: true,
  estanca: p.estanca ?? medir(p.malla).estanca,
  ...p,
})

/** Las piezas sobre las que se opera: las elegidas, o todas las visibles. */
export const objetivo = () => {
  const { piezas, seleccion } = S()
  const s = new Set(seleccion)
  return s.size ? piezas.filter((p) => s.has(p.id)) : piezas.filter((p) => p.visible)
}

/** mm² de superficie de cada color de la paleta. */
const areasCache = new WeakMap<Float32Array, Float32Array>()
export function superficiePorColor(p: Proyecto): number[] {
  let a = areasCache.get(p.malla.pos)
  if (!a) areasCache.set(p.malla.pos, (a = areas(p.malla.pos)))
  const s = new Array<number>(p.paleta.length).fill(0)
  p.malla.color.forEach((c, t) => (s[c] += a[t]))
  return s
}

/* ── Abrir ──────────────────────────────────────────────────────────── */

function cargarProyecto(p: Proyecto, protegida = false) {
  // Una textura agrupada en filamentos deja motas sueltas: se limpian de entrada.
  if (p.rgb && p.paleta.length > 1) {
    const t = topologia(p.malla.pos)
    quitarIslas(p.malla, t, Math.max(12, Math.round(p.malla.color.length / 2500)))
    suavizar(p.malla, t, 2)
  }
  historiaPintura.atras = []
  historiaPintura.adelante = []
  const malla = soldar(p.malla.pos)
  // El color base es el que más superficie cubre: el "cuerpo" de la figura.
  const cuenta = superficiePorColor(p)
  const base = cuenta.indexOf(Math.max(...cuenta))
  S().set({
    nombre: p.nombre,
    proyecto: p,
    version: S().version + 1,
    piezas: [pieza({ nombre: p.nombre, color: p.paleta[base]?.color ?? COLORES[0].color, malla, protegida })],
    pasado: [],
    futuro: [],
    seleccion: [],
    base,
    explosion: 0,
    paso: p.paleta.length > 1 ? 'color' : 'corte',
  })
  // Con colores, se separa solo al abrir (como Split3MF); la pintura queda para retocar.
  if (p.paleta.length > 1) setTimeout(() => void separarColor(), 0)
  const a = medir(malla)
  const t = [0, 1, 2].map((i) => a.max[i] - a.min[i])
  avisar(`${p.nombre}: ${t.map((x) => x.toFixed(1)).join(' × ')} mm · ${p.paleta.length} color${p.paleta.length > 1 ? 'es' : ''}${a.estanca ? '' : ' · malla abierta'}`, a.estanca ? 'ok' : 'info')
}

export const abrirArchivo = (f: File) => tarea(`Leyendo ${f.name}…`, async () => cargarProyecto(await importarArchivo(f)))

export const abrirCatalogo = (m: Modelo3D) => tarea(`Abriendo ${m.nombre}…`, async () => cargarProyecto(await importarURL(rutaModelo(m), m.nombre), true))

/** Piezas que llegan del editor: ya son sólidos, se empieza por cortar. */
export function abrirEntrada() {
  const p = entrada.proyecto
  entrada.proyecto = undefined
  if (p) {
    cargarProyecto(p, p.origen === 'catalogo')
    return true
  }
  const l = entrada.piezas
  entrada.piezas = undefined
  if (!l?.length) return false
  S().set({ nombre: 'Escena del editor', proyecto: null, piezas: l.map((p) => pieza(p)), pasado: [], futuro: [], seleccion: [], paso: 'corte', explosion: 0 })
  return true
}

/* ── Pintura (paso de color) ────────────────────────────────────────── */

const topo = { pos: null as Float32Array | null, t: null as Topologia | null }
function conTopologia(p: Proyecto) {
  if (topo.pos !== p.malla.pos) (topo.pos = p.malla.pos), (topo.t = topologia(p.malla.pos))
  return topo.t!
}

const historiaPintura: { atras: Uint8Array[]; adelante: Uint8Array[] } = { atras: [], adelante: [] }
export function guardarPintura() {
  const p = S().proyecto
  if (!p) return
  historiaPintura.atras.push(p.malla.color.slice())
  if (historiaPintura.atras.length > 40) historiaPintura.atras.shift()
  historiaPintura.adelante = []
}
export function deshacerPintura(rehacer = false) {
  const p = S().proyecto
  if (!p) return
  const [de, a] = rehacer ? [historiaPintura.adelante, historiaPintura.atras] : [historiaPintura.atras, historiaPintura.adelante]
  const destino = de.pop()
  if (!destino) return
  a.push(p.malla.color.slice())
  p.malla.color.set(destino)
  S().set({ version: S().version + 1 })
}

/**
 * Relleno. Por color: toda la zona conectada del mismo color (como un bote de
 * pintura). Por ángulo: se extiende por la superficie hasta toparse con una
 * arista más viva que `angulo` grados, como el "Smart fill" de Bambu Studio:
 * pinta caras planas, tapas y zonas separadas por un pliegue.
 */
export function rellenar(tri: number, activo: number) {
  const p = S().proyecto
  if (!p) return
  const { rellenoAngulo, angulo } = S()
  const t = conTopologia(p)
  const zona = rellenoAngulo ? regionAngulo(p.malla.pos, t, tri, angulo) : p.malla.color[tri] === activo ? [] : region(p.malla, t, tri)
  if (!zona.length) return
  guardarPintura()
  for (const x of zona) p.malla.color[x] = activo
  S().set({ version: S().version + 1 })
}

/** Pinta todo lo que queda por encima (o por debajo) de una altura: bases, franjas, tapas. */
export function pintarAltura(fraccion: number, encima: boolean, activo: number) {
  const p = S().proyecto
  if (!p) return
  let zmin = Infinity, zmax = -Infinity
  for (let i = 2; i < p.malla.pos.length; i += 3) (zmin = Math.min(zmin, p.malla.pos[i])), (zmax = Math.max(zmax, p.malla.pos[i]))
  const corte = zmin + fraccion * (zmax - zmin)
  guardarPintura()
  let n = 0
  for (let t = 0; t < p.malla.color.length; t++) {
    const z = (p.malla.pos[t * 9 + 2] + p.malla.pos[t * 9 + 5] + p.malla.pos[t * 9 + 8]) / 3
    if (z > corte === encima && p.malla.color[t] !== activo) (p.malla.color[t] = activo), n++
  }
  if (!n) historiaPintura.atras.pop()
  S().set({ version: S().version + 1 })
  avisar(n ? `${n.toLocaleString('es')} triángulos pintados ${encima ? 'por encima' : 'por debajo'} de ${(corte - zmin).toFixed(1)} mm` : 'Nada que pintar ahí', 'ok')
}

/**
 * Cuántos filamentos se sacan de la textura (k-medias en OKLab, como el
 * Taller). Solo para modelos con textura: Meshy, escaneos, GLB pintados.
 */
export const reagrupar = (k: number) =>
  tarea(`Agrupando la textura en ${k} colores…`, async () => {
    const p = S().proyecto
    if (!p?.rgb) return
    const r = aFilamentos(p.rgb, p.malla.pos, k)
    p.malla.color.set(r.color)
    const t = conTopologia(p)
    quitarIslas(p.malla, t, Math.max(12, Math.round(p.malla.color.length / 2500)))
    suavizar(p.malla, t, 2)
    historiaPintura.atras = []
    historiaPintura.adelante = []
    const cuenta = superficiePorColor({ ...p, paleta: r.paleta })
    S().set({ proyecto: { ...p, paleta: r.paleta }, base: cuenta.indexOf(Math.max(...cuenta)), version: S().version + 1 })
    avisar(`${k} colores sacados de la textura`, 'ok')
  })

/** Parte cada triángulo en cuatro: más resolución para pintar detalles finos. */
export function masDetalle() {
  const p = S().proyecto
  if (!p) return
  if (p.malla.color.length > 600_000) return avisar('La malla ya es muy densa: más detalle la haría lenta en el navegador', 'info')
  const malla = subdividir(p.malla)
  historiaPintura.atras = []
  historiaPintura.adelante = []
  S().set({ proyecto: { ...p, malla, rgb: undefined }, version: S().version + 1 })
  avisar(`${malla.color.length.toLocaleString('es')} triángulos para pintar`, 'ok')
}

/** Vuelve a trazar las fronteras de pintura como curvas suaves que cruzan los triángulos. */
export const fronteraSuave = () =>
  tarea('Suavizando fronteras…', async () => {
    const p = S().proyecto
    if (!p) return
    const malla = suavizarFrontera(p.malla, S().suavizado)
    historiaPintura.atras = []
    historiaPintura.adelante = []
    S().set({ proyecto: { ...p, malla, rgb: undefined }, version: S().version + 1 })
    avisar('Fronteras suavizadas: el corte seguirá esas curvas', 'ok')
  })

export function limpiarPintura(tipo: 'bordes' | 'manchas') {
  const p = S().proyecto
  if (!p) return
  guardarPintura()
  const t = conTopologia(p)
  const n = tipo === 'bordes' ? suavizar(p.malla, t, 4) : quitarIslas(p.malla, t, Math.max(12, Math.round(p.malla.color.length / 2500)))
  if (!n) historiaPintura.atras.pop()
  S().set({ version: S().version + 1 })
  avisar(n ? `${n.toLocaleString('es')} triángulos corregidos` : 'La pintura ya estaba limpia', 'ok')
}

export function agregarColor(color: string) {
  const p = S().proyecto
  if (!p) return
  S().set({ proyecto: { ...p, paleta: [...p.paleta, { color, nombre: `Filamento ${p.paleta.length + 1}` }] } })
}

export function cambiarColorPaleta(i: number, color: string) {
  const p = S().proyecto
  if (!p) return
  S().set({ proyecto: { ...p, paleta: p.paleta.map((f, j) => (j === i ? { ...f, color } : f)) } })
}

/* ── Separar ────────────────────────────────────────────────────────── */

export const separarColor = () =>
  tarea('Separando por color…', async () => {
    const { proyecto, modoColor, tapa, profundidad, base, piezas } = S()
    if (!proyecto) throw new Error('Este modelo no trae colores: píntalo primero o ábrelo como 3MF pintado')
    const r = await geo({ tipo: 'sep-auto', pos: proyecto.malla.pos.slice(), color: proyecto.malla.color.slice(), opciones: { modo: modoColor, tapa, profundidad, base, suavizado: S().suavizado, limpiar: true } })
    if (r.piezas.length < 2) throw new Error('Solo hay un color pintado: usa el pincel o el relleno para marcar las zonas')
    const protegida = piezas.some((p) => p.protegida)
    S().cambiarPiezas(() =>
      r.piezas.map((p) =>
        pieza({ nombre: proyecto.paleta[p.color]?.nombre ?? `Color ${p.color + 1}`, color: proyecto.paleta[p.color]?.color ?? '#ccc', malla: p.malla, estanca: p.estanca, protegida }),
      ),
    )
    S().set({ paso: 'partes', explosion: 0.6 })
    avisar([`${r.piezas.length} piezas por color${modoColor === 'incrustar' ? ` (incrustadas ${profundidad} mm)` : ''}`, ...r.avisos].join(' · '), r.avisos.length ? 'info' : 'ok')
  })

/** El plano de corte actual, calculado sobre la caja de las piezas objetivo. */
export function planoActual() {
  const lista = objetivo()
  if (!lista.length) return null
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const p of lista) {
    const a = medir(p.malla)
    for (let i = 0; i < 3; i++) (min[i] = Math.min(min[i], a.min[i])), (max[i] = Math.max(max[i], a.max[i]))
  }
  const c = S().corte
  return { plano: planoDesdeEje(c.eje, c.t, c.inclinacion, c.giro, min, max), min, max }
}

export const cortar = () =>
  tarea('Cortando…', async () => {
    const actual = planoActual()
    if (!actual) throw new Error('No hay piezas que cortar')
    const { conector } = S()
    const ids = new Set(objetivo().map((p) => p.id))
    const nuevas = new Map<string, PiezaSep[]>()
    let cortadas = 0, conectores = 0, reparadas = 0
    const avisos = new Set<string>()
    for (const p of S().piezas.filter((x) => ids.has(x.id))) {
      const r = await geo({ tipo: 'sep-plano', malla: p.malla, plano: actual.plano, conector })
      if (!r.lados[0] || !r.lados[1]) continue
      cortadas++
      conectores += r.conectores
      if (r.reparada) reparadas++
      if (r.aviso) avisos.add(r.aviso)
      const salen = [
        pieza({ ...p, nombre: `${p.nombre} · A`, malla: r.lados[0] }),
        pieza({ ...p, nombre: `${p.nombre} · B`, malla: r.lados[1] }),
        ...r.clavijas.map((m, i) => pieza({ nombre: `Clavija ${i + 1}`, color: '#F2F0EB', malla: m, protegida: p.protegida })),
      ]
      nuevas.set(p.id, salen)
    }
    if (!cortadas) throw new Error('El plano no atraviesa ninguna pieza: muévelo con el deslizador')
    S().cambiarPiezas((l) => l.flatMap((p) => nuevas.get(p.id) ?? [p]))
    S().set({ seleccion: [], explosion: Math.max(S().explosion, 0.35) })
    if (reparadas) avisos.add(`${reparadas} pieza${reparadas > 1 ? 's venían abiertas y se cerraron' : ' venía abierta y se cerró'} antes de cortar`)
    avisar([`${cortadas} pieza${cortadas > 1 ? 's' : ''} cortada${cortadas > 1 ? 's' : ''}${conectores ? ` · ${conectores} conectores` : ''}`, ...avisos].join(' · '), avisos.size ? 'info' : 'ok')
  })

/**
 * Corte con boceto: el contorno dibujado en pantalla se lleva a un plano
 * perpendicular a la mirada que pasa por el centro de la vista, y desde ahí
 * se extruye a través de las piezas.
 */
export const cortarConBoceto = () =>
  tarea('Cortando con el boceto…', async () => {
    const { boceto } = S()
    const { camara, objetivo: centro } = camaraVisor
    if (boceto.length < 3) throw new Error('Dibuja al menos tres puntos alrededor de lo que quieres separar')
    if (!camara || !centro) throw new Error('El visor no está listo')
    camara.updateMatrixWorld()
    const d = centro.clone().sub(camara.position).normalize()
    const derecha = new THREE.Vector3().setFromMatrixColumn(camara.matrixWorld, 0).normalize()
    const arriba = new THREE.Vector3().setFromMatrixColumn(camara.matrixWorld, 1).normalize()
    const plano = new THREE.Plane().setFromNormalAndCoplanarPoint(d, centro)
    const rayo = new THREE.Raycaster()
    const poligono: [number, number][] = []
    for (const [x, y] of boceto) {
      rayo.setFromCamera(new THREE.Vector2(x, y), camara)
      const p = rayo.ray.intersectPlane(plano, new THREE.Vector3())
      if (!p) continue
      p.sub(centro)
      poligono.push([p.dot(derecha), p.dot(arriba)])
    }
    const marco = new THREE.Matrix4().makeBasis(derecha, arriba, d.clone().negate()).setPosition(centro).elements
    const ids = new Set(objetivo().map((p) => p.id))
    let largo = 10
    for (const p of S().piezas) if (ids.has(p.id)) largo = Math.max(largo, medir(p.malla).max.reduce((s, x, i) => s + Math.abs(x - medir(p.malla).min[i]), 0))
    const nuevas = new Map<string, PiezaSep[]>()
    for (const p of S().piezas.filter((x) => ids.has(x.id))) {
      const r = await geo({ tipo: 'sep-boceto', malla: p.malla, poligono, marco: [...marco], largo: largo * 4 + camara.position.distanceTo(centro) * 2 })
      if (!r.lados[0] || !r.lados[1]) continue
      nuevas.set(p.id, [pieza({ ...p, nombre: `${p.nombre} · dentro`, malla: r.lados[0] }), pieza({ ...p, nombre: `${p.nombre} · fuera`, malla: r.lados[1] })])
    }
    if (!nuevas.size) throw new Error('El boceto no atraviesa ninguna pieza: dibújalo encima del modelo')
    S().cambiarPiezas((l) => l.flatMap((p) => nuevas.get(p.id) ?? [p]))
    S().set({ boceto: [], seleccion: [] })
    avisar(`${nuevas.size} pieza${nuevas.size > 1 ? 's' : ''} cortada${nuevas.size > 1 ? 's' : ''} con el boceto`, 'ok')
  })

export const dividirCama = () =>
  tarea('Dividiendo para la cama…', async () => {
    const imp = impresora()
    const nuevas = new Map<string, PiezaSep[]>()
    let cortes = 0
    for (const p of objetivo()) {
      const r = await geo({ tipo: 'sep-cama', malla: p.malla, cama: imp.cama, conector: S().conector })
      if (!r.cortes) continue
      cortes += r.cortes
      nuevas.set(p.id, r.piezas.map((m, i) => pieza({ ...p, nombre: `${p.nombre} · ${i + 1}`, malla: m })))
    }
    if (!cortes) return avisar(`Todo cabe ya en la ${imp.nombre}`, 'ok')
    S().cambiarPiezas((l) => l.flatMap((p) => nuevas.get(p.id) ?? [p]))
    S().set({ explosion: Math.max(S().explosion, 0.3) })
    avisar(`${cortes} corte${cortes > 1 ? 's' : ''} para que quepa en la ${imp.nombre}`, 'ok')
  })

export const cuerposSueltos = () =>
  tarea('Buscando cuerpos sueltos…', async () => {
    const nuevas = new Map<string, PiezaSep[]>()
    for (const p of objetivo()) {
      const partes = await geo({ tipo: 'separar', malla: p.malla })
      if (partes.length > 1) nuevas.set(p.id, partes.map((m, i) => pieza({ ...p, nombre: `${p.nombre} · ${i + 1}`, malla: m, estanca: true })))
    }
    if (!nuevas.size) return avisar('Cada pieza ya es un solo cuerpo', 'ok')
    S().cambiarPiezas((l) => l.flatMap((p) => nuevas.get(p.id) ?? [p]))
    avisar(`${[...nuevas.values()].reduce((s, l) => s + l.length, 0)} cuerpos separados`, 'ok')
  })

export const unir = () =>
  tarea('Uniendo…', async () => {
    const l = S().piezas.filter((p) => S().seleccion.includes(p.id))
    if (l.length < 2) throw new Error('Elige dos o más piezas para unirlas')
    const m = await geo({ tipo: 'sep-unir', mallas: l.map((p) => p.malla) })
    const ids = new Set(l.map((p) => p.id))
    const nueva = pieza({ nombre: l[0].nombre.replace(/ · [A-Z0-9]+$/, ''), color: l[0].color, malla: m, estanca: true, protegida: l.some((p) => p.protegida) })
    S().cambiarPiezas((lista) => {
      const i = lista.findIndex((p) => ids.has(p.id))
      const resto = lista.filter((p) => !ids.has(p.id))
      resto.splice(i, 0, nueva)
      return resto
    })
    S().set({ seleccion: [nueva.id] })
  })

/** Reparte las piezas (las elegidas o todas) por la cama, apoyadas por su mejor cara y separadas. */
export const ordenarEnCama = () =>
  tarea('Ordenando en la cama…', async () => {
    const lista = objetivo()
    if (!lista.length) return
    const imp = impresora()
    const r = await geo({ tipo: 'sep-repartir', mallas: lista.map((p) => p.malla), cama: imp.cama })
    const nuevas = new Map(lista.map((p, i) => [p.id, { ...p, malla: r.mallas[i] }]))
    S().cambiarPiezas((l) => l.map((p) => nuevas.get(p.id) ?? p))
    S().set({ explosion: 0, nombre: S().nombre })
    avisar(r.camas > 1 ? `No cabe todo en la ${imp.nombre}: van ${r.camas} camas una al lado de otra` : `${lista.length} piezas ordenadas en la cama de la ${imp.nombre}`, r.camas > 1 ? 'info' : 'ok')
  })

export function editarPieza(id: string, cambio: Partial<PiezaSep>) {
  S().cambiarPiezas((l) => l.map((p) => (p.id === id ? { ...p, ...cambio } : p)))
}

export function borrarSeleccion() {
  const s = new Set(S().seleccion)
  if (s.size) S().cambiarPiezas((l) => l.filter((p) => !s.has(p.id)))
}

/** Escala todo (modelo pintado y piezas) para que la altura total sea `alto` mm. */
export function escalarA(alto: number) {
  const { piezas, proyecto } = S()
  if (!piezas.length || alto <= 0) return
  let zmin = Infinity, zmax = -Infinity
  for (const p of piezas) {
    const a = medir(p.malla)
    zmin = Math.min(zmin, a.min[2])
    zmax = Math.max(zmax, a.max[2])
  }
  const k = alto / Math.max(1e-6, zmax - zmin)
  const escalar = (m: MallaIdx): MallaIdx => ({ pos: m.pos.map((v, i) => (i % 3 === 2 ? (v - zmin) * k : v * k)), idx: m.idx })
  S().cambiarPiezas((l) => l.map((p) => ({ ...p, malla: escalar(p.malla) })))
  if (proyecto) {
    const pos = proyecto.malla.pos.map((v, i) => (i % 3 === 2 ? (v - zmin) * k : v * k))
    S().set({ proyecto: { ...proyecto, malla: { ...proyecto.malla, pos } } })
  }
  avisar(`Escalado al ${(k * 100).toFixed(1)} %: ${alto} mm de alto`, 'ok')
}

/* ── Exportar ───────────────────────────────────────────────────────── */

function descargar(datos: BlobPart, nombre: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([datos], { type: tipo }))
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const limpio = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'pieza'

/**
 * - 3MF "montado": cada pieza en su sitio, un objeto por pieza con su color;
 *   el laminador lo abre listo para multicolor (o para ensamblar).
 * - 3MF "en la cama": cada pieza apoyada por su cara de corte y repartida.
 * - STL: un .zip con un STL por pieza.
 */
export const exportar = (formato: '3mf-montado' | '3mf-cama' | 'stl-zip') =>
  tarea('Preparando archivo…', async () => {
    const l = objetivo()
    if (!l.length) throw new Error('No hay piezas que exportar')
    if (l.some((p) => p.protegida)) throw new Error('Las piezas del catálogo se pueden separar para verlas, pero no descargar. Pídela desde su ficha.')
    const base = limpio(S().nombre || 'flemin')
    let mallas = l.map((p) => p.malla)
    if (formato !== '3mf-montado') {
      const r = await geo({ tipo: 'sep-repartir', mallas, cama: impresora().cama })
      mallas = r.mallas
      if (r.camas > 1) avisar(`No cabe todo en una cama: van ${r.camas} camas seguidas en el archivo`, 'info')
    }
    const piezas = l.map((p, i) => ({ nombre: p.nombre, color: p.color, malla: mallas[i] }))
    if (formato === 'stl-zip') {
      const usados = new Map<string, number>()
      const archivos: [string, Uint8Array][] = piezas.map((p) => {
        const n = limpio(p.nombre)
        const k = (usados.get(n) ?? 0) + 1
        usados.set(n, k)
        return [`${n}${k > 1 ? `-${k}` : ''}.stl`, stl([p])]
      })
      descargar(zip(archivos), `${base}-piezas.zip`, 'application/zip')
    } else descargar(tresmf(piezas), `${base}${formato === '3mf-cama' ? '-cama' : ''}.3mf`, 'model/3mf')
    if (S().aviso?.tipo !== 'info') avisar(`Descargado · ${piezas.length} pieza${piezas.length > 1 ? 's' : ''}`, 'ok')
  })
