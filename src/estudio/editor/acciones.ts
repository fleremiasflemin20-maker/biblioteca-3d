import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { geo } from '../geo/cliente.ts'
import { paramsIniciales, defForma } from '../geo/formas.ts'
import { PLANTILLAS, paramsPlantilla } from '../geo/plantillas.ts'
import { stl, tresmf, type PiezaExport } from '../geo/exportar.ts'
import { soldar } from '../geo/impresion.ts'
import type { Analisis, MallaIdx, Params, TipoForma, Vec3 } from '../geo/tipos.ts'
import { importarArchivo, importarURL } from '../../lib/taller/importar.ts'
import { rutaModelo, type Modelo3D } from '../../lib/catalogo.ts'
import { cajaMundo, centrarMalla, desdeMatriz, impresoraActual, mallaMundo, matrizNodo, nuevoId, nuevoNodo, useEditor, type NodoEditor } from './estado.ts'
import { mallaLocal } from './mallas.ts'
import { entrada } from '../separador/estado.ts'
import { aSopa } from './mallas.ts'
import { camara } from './camara.ts'

/**
 * Lo que hacen los botones y los atajos del editor. Todo pasa por
 * `useEditor.getState().hacer`, así que todo se puede deshacer.
 */
const E = () => useEditor.getState()

function avisar(texto: string, tipo: 'ok' | 'error' | 'info' = 'info') {
  E().set({ aviso: { texto, tipo } })
}

/** Corre una tarea larga con el indicador de "trabajando" y convierte los errores en aviso. */
async function tarea<T>(mensaje: string, f: () => Promise<T>): Promise<T | undefined> {
  E().set({ ocupado: mensaje })
  try {
    return await f()
  } catch (e) {
    avisar(e instanceof Error ? e.message : String(e), 'error')
    return undefined
  } finally {
    E().set({ ocupado: null })
  }
}

const seleccionados = () => {
  const s = new Set(E().seleccion)
  return E().nodos.filter((n) => s.has(n.id))
}

/** Lo que se opera: la selección, o toda la escena visible si no hay nada elegido. */
const objetivo = () => {
  const s = seleccionados()
  return s.length ? s : E().nodos.filter((n) => n.visible)
}

async function mundo(n: NodoEditor) {
  return mallaMundo(n, await mallaLocal(n))
}

/** Sube el nodo para que su punto más bajo toque la cama (z = 0). */
async function apoyado(n: NodoEditor): Promise<NodoEditor> {
  const caja = cajaMundo(n, await mallaLocal(n))
  return { ...n, pos: [n.pos[0], n.pos[1], +(n.pos[2] - caja.min.z).toFixed(4)] }
}

function agregar(nuevos: NodoEditor[]) {
  E().hacer((l) => [...l, ...nuevos])
  E().seleccionar(nuevos.map((n) => n.id))
}

/* ── Crear ──────────────────────────────────────────────────────────── */

export async function agregarForma(tipo: TipoForma, extra: Params = {}) {
  const n = nuevoNodo({ tipo, nombre: defForma(tipo).nombre, params: { ...paramsIniciales(tipo), ...extra } })
  // Las formas nuevas caen en un hueco libre cerca del centro, como en Tinkercad.
  const k = E().nodos.length
  n.pos = [((k % 5) - 2) * 4, (Math.floor(k / 5) % 5) * 4, 0]
  await tarea('Creando forma…', async () => agregar([await apoyado(n)]))
}

export async function agregarPlantilla(id: string, params: Params, reemplazar?: string) {
  const pl = PLANTILLAS.find((p) => p.id === id)!
  const todo = { ...paramsPlantilla(pl), ...params }
  await tarea(`Generando ${pl.nombre.toLowerCase()}…`, async () => {
    const piezas = await geo({ tipo: 'plantilla', plantilla: id, params: todo })
    const lote = { id: reemplazar ?? nuevoId(), plantilla: id, params: todo }
    const nuevos = piezas.map((p) => nuevoNodo({ tipo: 'malla', nombre: p.nombre, color: p.color, malla: p.malla, pos: p.pos, lote }))
    if (!reemplazar) await aUnLado(nuevos)
    if (reemplazar) {
      E().hacer((l) => {
        const i = l.findIndex((n) => n.lote?.id === reemplazar)
        const resto = l.filter((n) => n.lote?.id !== reemplazar)
        resto.splice(i < 0 ? resto.length : i, 0, ...nuevos)
        return resto
      })
      E().seleccionar(nuevos.map((n) => n.id))
    } else agregar(nuevos)
    avisar(`${pl.nombre}: ${piezas.length} pieza${piezas.length > 1 ? 's' : ''} lista${piezas.length > 1 ? 's' : ''} para imprimir`, 'ok')
  })
}

/** Corre un lote nuevo a la derecha de lo que ya hay en la cama, para que no se encimen. */
async function aUnLado(nuevos: NodoEditor[]) {
  const visibles = E().nodos.filter((n) => n.visible)
  if (!visibles.length) return
  const ocupada = new THREE.Box3()
  for (const n of visibles) ocupada.union(cajaMundo(n, await mallaLocal(n)))
  const lote = new THREE.Box3()
  for (const n of nuevos) lote.union(cajaMundo(n, n.malla!))
  const dx = ocupada.max.x + 10 - lote.min.x
  const dy = (ocupada.min.y + ocupada.max.y) / 2 - (lote.min.y + lote.max.y) / 2
  for (const n of nuevos) n.pos = [n.pos[0] + dx, n.pos[1] + dy, n.pos[2]]
}

/* ── Editar ─────────────────────────────────────────────────────────── */

export function actualizar(id: string, cambio: Partial<NodoEditor>) {
  E().hacer((l) => l.map((n) => (n.id === id ? { ...n, ...cambio } : n)))
}

export function eliminar() {
  const s = new Set(E().seleccion)
  if (!s.size) return
  E().hacer((l) => l.filter((n) => !s.has(n.id) || n.bloqueado))
}

export function duplicar() {
  const s = seleccionados()
  if (!s.length) return
  const r = E().rejilla || 1
  const copias = s.map((n) => ({ ...n, id: nuevoId(), nombre: `${n.nombre} (copia)`, pos: [n.pos[0] + Math.max(5, r * 5), n.pos[1] + Math.max(5, r * 5), n.pos[2]] as Vec3, lote: undefined }))
  agregar(copias)
}

export function espejo(eje: 0 | 1 | 2) {
  const s = new Set(E().seleccion)
  E().hacer((l) => l.map((n) => (s.has(n.id) ? { ...n, esc: n.esc.map((v, i) => (i === eje ? -v : v)) as Vec3 } : n)))
}

export function alternarHueco() {
  const s = new Set(E().seleccion)
  E().hacer((l) => l.map((n) => (s.has(n.id) ? { ...n, hueco: !n.hueco } : n)))
}

export async function apoyarEnCama() {
  const s = objetivo()
  await tarea('Apoyando…', async () => {
    const nuevos = new Map((await Promise.all(s.map(apoyado))).map((n) => [n.id, n]))
    E().hacer((l) => l.map((n) => nuevos.get(n.id) ?? n))
  })
}

/** Centra la selección (como bloque) en la cama y la apoya. */
export async function centrarEnCama() {
  const s = objetivo()
  if (!s.length) return
  await tarea('Centrando…', async () => {
    const caja = new THREE.Box3()
    for (const n of s) caja.union(cajaMundo(n, await mallaLocal(n)))
    const c = caja.getCenter(new THREE.Vector3())
    const ids = new Set(s.map((n) => n.id))
    E().hacer((l) => l.map((n) => (ids.has(n.id) ? { ...n, pos: [n.pos[0] - c.x, n.pos[1] - c.y, n.pos[2] - caja.min.z] as Vec3 } : n)))
  })
}

/** Alinea la selección por mínimo, centro o máximo en un eje (la herramienta "Alinear" de Tinkercad). */
export async function alinear(eje: 0 | 1 | 2, donde: 'min' | 'centro' | 'max') {
  const s = seleccionados()
  if (s.length < 2) return avisar('Elige dos o más objetos para alinear')
  const cajas = await Promise.all(s.map(async (n) => cajaMundo(n, await mallaLocal(n))))
  const total = cajas.reduce((a, b) => a.union(b.clone()), new THREE.Box3())
  const k = (['x', 'y', 'z'] as const)[eje]
  const meta = donde === 'min' ? total.min[k] : donde === 'max' ? total.max[k] : (total.min[k] + total.max[k]) / 2
  const delta = new Map(s.map((n, i) => {
    const b = cajas[i]
    const actual = donde === 'min' ? b.min[k] : donde === 'max' ? b.max[k] : (b.min[k] + b.max[k]) / 2
    return [n.id, meta - actual]
  }))
  E().hacer((l) => l.map((n) => (delta.has(n.id) ? { ...n, pos: n.pos.map((v, i) => (i === eje ? +(v + delta.get(n.id)!).toFixed(4) : v)) as Vec3 } : n)))
}

/** Mueve/rota/escala un grupo con la misma matriz (el gizmo con varios objetos). */
export function transformarGrupo(ids: string[], delta: THREE.Matrix4) {
  const s = new Set(ids)
  E().hacer((l) => l.map((n) => (s.has(n.id) ? { ...n, ...desdeMatriz(delta.clone().multiply(matrizNodo(n))) } : n)))
}

/* ── Booleanas ──────────────────────────────────────────────────────── */

/**
 * Combinar (Tinkercad "Agrupar"): une los sólidos de la selección y les resta
 * los huecos. Intersecar deja solo lo común. El resultado es un objeto nuevo
 * con el color del primer sólido.
 */
export async function combinar(op: 'combinar' | 'intersecar' = 'combinar') {
  const s = seleccionados()
  if (s.length < 2) return avisar('Elige dos o más objetos (Mayús + clic) para combinarlos')
  const solidos = s.filter((n) => !n.hueco)
  if (!solidos.length) return avisar('Hace falta al menos un sólido: los huecos solos no dejan nada')
  await tarea(op === 'combinar' ? 'Combinando…' : 'Intersecando…', async () => {
    const r = await geo({
      tipo: 'booleana',
      op,
      solidos: await Promise.all(solidos.map(mundo)),
      huecos: op === 'combinar' ? await Promise.all(s.filter((n) => n.hueco).map(mundo)) : [],
    })
    const { malla, centro } = centrarMalla(r)
    const n = nuevoNodo({ tipo: 'malla', nombre: op === 'combinar' ? 'Combinado' : 'Intersección', malla, pos: centro, color: solidos[0].color, protegido: s.some((x) => x.protegido) })
    const ids = new Set(s.map((x) => x.id))
    E().hacer((l) => [...l.filter((x) => !ids.has(x.id)), n])
    E().seleccionar([n.id])
  })
}

export async function separarCuerpos() {
  const [n] = seleccionados()
  if (!n) return avisar('Elige un objeto')
  await tarea('Separando cuerpos…', async () => {
    const partes = await geo({ tipo: 'separar', malla: await mundo(n) })
    if (partes.length < 2) return avisar('Ese objeto ya es un solo cuerpo')
    const nuevos = partes.map((p, i) => {
      const { malla, centro } = centrarMalla(p)
      return nuevoNodo({ tipo: 'malla', nombre: `${n.nombre} ${i + 1}`, malla, pos: centro, color: n.color, protegido: n.protegido })
    })
    E().hacer((l) => [...l.filter((x) => x.id !== n.id), ...nuevos])
    E().seleccionar(nuevos.map((x) => x.id))
  })
}

/* ── Preparar para imprimir ─────────────────────────────────────────── */

export async function analizarSeleccion(): Promise<(Analisis & { nombre: string })[] | undefined> {
  const s = objetivo().filter((n) => !n.hueco)
  if (!s.length) return void avisar('No hay sólidos que analizar')
  return tarea('Analizando…', () => Promise.all(s.map(async (n) => ({ nombre: n.nombre, ...(await geo({ tipo: 'analizar', malla: await mundo(n) })) }))))
}

export async function repararSeleccion() {
  const s = seleccionados().filter((n) => !n.hueco)
  if (!s.length) return avisar('Elige el objeto que quieres cerrar')
  await tarea('Reparando malla…', async () => {
    const nuevos = new Map<string, NodoEditor>()
    for (const n of s) {
      const m = await geo({ tipo: 'reparar', malla: await mundo(n) })
      const { malla, centro } = centrarMalla(m)
      nuevos.set(n.id, { ...n, tipo: 'malla', malla, pos: centro, rot: [0, 0, 0], esc: [1, 1, 1], lote: undefined })
    }
    E().hacer((l) => l.map((n) => nuevos.get(n.id) ?? n))
    avisar('Malla cerrada y lista para el laminador', 'ok')
  })
}

/** Gira cada objeto para apoyarlo por su mejor cara y lo baja a la cama. */
export async function autoOrientar() {
  const s = objetivo().filter((n) => !n.hueco)
  if (!s.length) return avisar('No hay sólidos que orientar')
  await tarea('Buscando la mejor cara de apoyo…', async () => {
    const nuevos = new Map<string, NodoEditor>()
    let antes = 0, despues = 0
    for (const n of s) {
      const w = await mundo(n)
      const r = await geo({ tipo: 'orientar', malla: w })
      const actual = await geo({ tipo: 'analizar', malla: w })
      antes += actual.voladizo
      despues += r.voladizo
      // Solo se gira si mejora: un objeto bien apoyado no se toca.
      if (r.voladizo >= actual.voladizo - 1) {
        nuevos.set(n.id, await apoyado(n))
        despues += actual.voladizo - r.voladizo
        continue
      }
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...r.abajo).normalize(), new THREE.Vector3(0, 0, -1))
      const centro = new THREE.Vector3(...n.pos)
      const delta = new THREE.Matrix4().makeTranslation(centro.x, centro.y, centro.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(-centro.x, -centro.y, -centro.z))
      nuevos.set(n.id, await apoyado({ ...n, ...desdeMatriz(delta.multiply(matrizNodo(n))) }))
    }
    E().hacer((l) => l.map((n) => nuevos.get(n.id) ?? n))
    avisar(antes - despues > 1 ? `Voladizo reducido de ${Math.round(antes)} a ${Math.round(despues)} mm²` : 'Ya estaba en su mejor apoyo', 'ok')
  })
}

/** Escala la selección (o todo) para que quepa en la cama de la impresora elegida, con 5 mm de margen. */
export async function ajustarACama() {
  const s = objetivo()
  if (!s.length) return
  const imp = impresoraActual()
  await tarea('Ajustando a la cama…', async () => {
    const caja = new THREE.Box3()
    for (const n of s) caja.union(cajaMundo(n, await mallaLocal(n)))
    const t = caja.getSize(new THREE.Vector3())
    const k = Math.min((imp.cama[0] - 10) / t.x, (imp.cama[1] - 10) / t.y, (imp.cama[2] - 5) / t.z)
    if (k >= 1) return avisar(`Ya cabe en la ${imp.nombre} (${t.x.toFixed(0)} × ${t.y.toFixed(0)} × ${t.z.toFixed(0)} mm)`, 'ok')
    const c = caja.getCenter(new THREE.Vector3())
    const delta = new THREE.Matrix4().makeTranslation(c.x, c.y, caja.min.z).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -caja.min.z))
    transformarGrupo(s.map((n) => n.id), delta)
    avisar(`Escalado al ${(k * 100).toFixed(1)} % para la ${imp.nombre}`, 'ok')
  })
}

/* ── Importar y exportar ────────────────────────────────────────────── */

export const ACEPTA = '.stl,.3mf,.glb,.gltf,.obj,.svg'

export async function importar(archivos: FileList | File[]) {
  for (const f of Array.from(archivos)) {
    await tarea(`Abriendo ${f.name}…`, async () => {
      if (f.name.toLowerCase().endsWith('.svg')) return importarSVG(f)
      const p = await importarArchivo(f)
      // Una sola pieza con sus colores (textura o filamentos): se ve como el
      // original y "Separar por colores" la manda entera al Separador.
      const { malla, centro } = centrarMalla(soldar(p.malla.pos))
      const multicolor = p.paleta.length > 1
      const pintura = multicolor ? { color: p.malla.color, paleta: p.paleta, rgb: p.rgb } : undefined
      const nuevos: NodoEditor[] = [nuevoNodo({ tipo: 'malla', nombre: p.nombre, malla, pos: centro, color: p.paleta[0]?.color ?? '#D9D4CC', pintura })]
      await aUnLado(nuevos)
      agregar(nuevos)
      avisar(
        multicolor
          ? `${f.name}: ${p.paleta.length} colores. Para imprimirlo en piezas por color, elígelo y pulsa "Separar por colores".`
          : `${f.name}: ${p.malla.color.length.toLocaleString('es')} triángulos`,
        'ok',
      )
    })
  }
}

async function importarSVG(f: File) {
  const datos = new SVGLoader().parse(await f.text())
  const contornos: [number, number][][] = []
  for (const camino of datos.paths)
    for (const forma of SVGLoader.createShapes(camino)) {
      const { shape, holes } = forma.extractPoints(8)
      // El SVG tiene Y hacia abajo: se voltea para que el dibujo no salga en espejo.
      for (const anillo of [shape, ...holes]) contornos.push(anillo.map((p) => [p.x, -p.y]))
    }
  if (!contornos.length) throw new Error('El SVG no tiene formas rellenas')
  await agregarForma('svg', { contornos: JSON.stringify(contornos), ancho: 40, alto: 2 })
  E().hacer((l) => l.map((n, i) => (i === l.length - 1 ? { ...n, nombre: f.name.replace(/\.svg$/i, '') } : n)))
}

/** Pieza del catálogo: se ve, se mide y se combina, pero no se descarga. */
export async function abrirDelCatalogo(m: Modelo3D) {
  await tarea(`Cargando ${m.nombre}…`, async () => {
    const p = await importarURL(rutaModelo(m), m.nombre)
    const { malla, centro } = centrarMalla(soldar(p.malla.pos))
    const n = nuevoNodo({ tipo: 'malla', nombre: m.nombre, malla, pos: centro, color: p.paleta[0]?.color ?? '#D9D4CC', protegido: true })
    await aUnLado([n])
    agregar([n])
  })
}

function descargar(datos: BlobPart, nombre: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([datos], { type: tipo }))
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Lo que sale del editor: cada sólido visible con los huecos que lo tocan ya
 * restados, en coordenadas de la cama.
 */
async function piezasParaExportar(): Promise<PiezaExport[]> {
  const todos = objetivo().filter((n) => n.visible)
  if (todos.some((n) => n.protegido)) throw new Error('Las piezas del catálogo se pueden mirar y editar, pero no descargar. Pídela desde su ficha.')
  const solidos = todos.filter((n) => !n.hueco)
  if (!solidos.length) throw new Error('No hay nada que exportar')
  const huecos = await Promise.all(E().nodos.filter((n) => n.hueco && n.visible).map(async (n) => ({ malla: await mundo(n), caja: cajaMundo(n, await mallaLocal(n)) })))
  const salida: PiezaExport[] = []
  for (const n of solidos) {
    let malla = await mundo(n)
    const caja = cajaMundo(n, await mallaLocal(n))
    const tocan = huecos.filter((h) => h.caja.intersectsBox(caja))
    if (tocan.length) malla = await geo({ tipo: 'booleana', op: 'combinar', solidos: [malla], huecos: tocan.map((h) => h.malla) })
    salida.push({ nombre: n.nombre, color: n.color, malla })
  }
  return salida
}

export async function exportar(formato: 'stl' | '3mf' | 'glb') {
  await tarea(`Exportando ${formato.toUpperCase()}…`, async () => {
    const piezas = await piezasParaExportar()
    const base = piezas.length === 1 ? piezas[0].nombre : 'flemin-studio'
    const nombre = base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'modelo'
    if (formato === 'stl') descargar(stl(piezas), `${nombre}.stl`, 'model/stl')
    else if (formato === '3mf') descargar(tresmf(piezas), `${nombre}.3mf`, 'model/3mf')
    else {
      // glTF usa Y arriba: se gira la escena para que quede de pie en otros visores.
      const raiz = new THREE.Group()
      raiz.rotation.x = -Math.PI / 2
      for (const p of piezas) {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(p.malla.pos, 3))
        g.setIndex(new THREE.BufferAttribute(p.malla.idx, 1))
        g.computeVertexNormals()
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.6 }))
        m.name = p.nombre
        m.scale.setScalar(0.001) // glTF va en metros
        raiz.add(m)
      }
      const r = await new GLTFExporter().parseAsync(raiz, { binary: true })
      descargar(r as ArrayBuffer, `${nombre}.glb`, 'model/gltf-binary')
    }
    avisar(`${nombre}.${formato} descargado · ${piezas.length} pieza${piezas.length > 1 ? 's' : ''}`, 'ok')
  })
}

export function nuevaEscena() {
  E().hacer(() => [])
}


/**
 * Pasa al Separador lo visible de la cama (o lo elegido), con los huecos ya
 * restados: allí se corta por planos, con conectores, o se divide para la cama.
 */
export async function enviarAlSeparador(abrir: () => void) {
  await tarea('Preparando piezas…', async () => {
    const lista = objetivo().filter((n) => n.visible && !n.hueco)
    if (!lista.length) throw new Error('No hay sólidos en la cama para separar')
    const huecos = await Promise.all(E().nodos.filter((n) => n.hueco && n.visible).map(async (n) => ({ malla: await mundo(n), caja: cajaMundo(n, await mallaLocal(n)) })))
    entrada.piezas = []
    for (const n of lista) {
      let malla = await mundo(n)
      const caja = cajaMundo(n, await mallaLocal(n))
      const tocan = huecos.filter((h) => h.caja.intersectsBox(caja))
      if (tocan.length) malla = await geo({ tipo: 'booleana', op: 'combinar', solidos: [malla], huecos: tocan.map((h) => h.malla) })
      entrada.piezas.push({ nombre: n.nombre, color: n.color, malla, estanca: true, protegida: n.protegido })
    }
    abrir()
  })
}

/** Lo que abre el Separador; lo pone el editor al montarse. */
export const navegacion = { separador: () => {} }

/** Una pieza cerrada por color de un objeto pintado, en coordenadas de la cama. */
async function piezasPorColor(n: NodoEditor): Promise<{ nombre: string; color: string; malla: MallaIdx }[]> {
  const pintura = n.pintura!
  const malla = mallaMundo(n, await mallaLocal(n))
  const cuenta = new Array<number>(pintura.paleta.length).fill(0)
  for (const c of pintura.color) cuenta[c]++
  const r = await geo({
    tipo: 'sep-auto',
    pos: aSopa(malla),
    color: pintura.color.slice(),
    opciones: { modo: 'frontera', tapa: 'auto', profundidad: 1, base: cuenta.indexOf(Math.max(...cuenta)), suavizado: 2, limpiar: true },
  })
  return r.piezas.map((p) => {
    const f = pintura.paleta[p.color]
    return { nombre: `${n.nombre} · ${f?.nombre ?? `Color ${p.color + 1}`}`, color: f?.color ?? '#D9D4CC', malla: p.malla }
  })
}

/**
 * Separar por colores en el sitio, de un clic: el objeto se cambia por una
 * pieza cerrada por color, montadas como estaban (para imprimir multicolor de
 * una vez o ver cómo encajan).
 */
export async function separarPorColores(id: string) {
  const n = E().nodos.find((x) => x.id === id)
  if (!n?.pintura) return avisar('Este objeto no trae colores: ábrelo en el Separador para pintarlo')
  await tarea('Separando por colores…', async () => {
    const piezas = await piezasPorColor(n)
    if (piezas.length < 2) throw new Error('Después de limpiar las motas queda un solo color: ábrelo en el Separador y sube los colores de la textura')
    const nuevos = piezas.map((p) => {
      const { malla: m, centro } = centrarMalla(p.malla)
      return nuevoNodo({ tipo: 'malla', nombre: p.nombre, malla: m, pos: centro, color: p.color, protegido: n.protegido })
    })
    E().hacer((l) => {
      const i = l.findIndex((x) => x.id === id)
      const resto = l.filter((x) => x.id !== id)
      resto.splice(i, 0, ...nuevos)
      return resto
    })
    E().seleccionar(nuevos.map((x) => x.id))
    avisar(`${nuevos.length} piezas por color, montadas en su sitio. Exporta el 3MF multicolor o pulsa "Dividir por colores" para repartirlas en la cama.`, 'ok')
  })
}

/**
 * Dividir por colores: lo elegido (o todo lo visible) se parte en una pieza
 * cerrada por color y las piezas se reparten por la cama de la impresora,
 * cada una apoyada por su mejor cara y separada de las demás, listas para
 * imprimir por separado. Los objetos sin colores se ordenan junto con ellas.
 */
export async function dividirPorColores() {
  const lista = objetivo().filter((n) => n.visible && !n.hueco)
  if (!lista.length) return avisar('No hay objetos en la cama')
  if (!lista.some((n) => n.pintura) && lista.length < 2) return avisar('Este objeto no trae colores: ábrelo en el Separador para pintarlo')
  const imp = impresoraActual()
  await tarea('Dividiendo por colores…', async () => {
    const piezas: { nombre: string; color: string; malla: MallaIdx; protegido?: boolean }[] = []
    for (const n of lista) {
      if (n.pintura) piezas.push(...(await piezasPorColor(n)).map((p) => ({ ...p, protegido: n.protegido })))
      else piezas.push({ nombre: n.nombre, color: n.color, malla: mallaMundo(n, await mallaLocal(n)), protegido: n.protegido })
    }
    E().set({ ocupado: `Ordenando ${piezas.length} piezas en la cama…` })
    const r = await geo({ tipo: 'sep-repartir', mallas: piezas.map((p) => p.malla), cama: imp.cama })
    const nuevos = piezas.map((p, i) => {
      const { malla, centro } = centrarMalla(r.mallas[i])
      return nuevoNodo({ tipo: 'malla', nombre: p.nombre, malla, pos: centro, color: p.color, protegido: p.protegido })
    })
    const ids = new Set(lista.map((n) => n.id))
    E().hacer((l) => [...l.filter((x) => !ids.has(x.id)), ...nuevos])
    E().seleccionar([])
    setTimeout(() => camara.ir('arriba'), 120)
    avisar(
      r.camas > 1
        ? `${nuevos.length} piezas: no caben en una cama de la ${imp.nombre}, van ${r.camas} camas una al lado de otra`
        : `${nuevos.length} piezas ordenadas en la cama de la ${imp.nombre}, cada una apoyada por su mejor cara`,
      r.camas > 1 ? 'info' : 'ok',
    )
  })
}

/** Abre el Separador con el objeto y sus colores, para elegir cuántos colores sacar, cortar, etc. */
export async function abrirEnSeparador(id: string) {
  const n = E().nodos.find((x) => x.id === id)
  if (!n?.pintura) return
  const malla = mallaMundo(n, await mallaLocal(n))
  entrada.proyecto = {
    id: n.id,
    nombre: n.nombre,
    malla: { pos: aSopa(malla), color: n.pintura.color.slice() },
    paleta: n.pintura.paleta,
    rgb: n.pintura.rgb,
    origen: n.protegido ? 'catalogo' : 'archivo',
  }
  navegacion.separador()
}
