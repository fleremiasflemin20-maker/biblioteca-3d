import { Constructor, type Filamento, type Malla } from './malla.ts'
import { decodificarPintura } from './pintura.ts'
import { leerZip, type Zip } from './zip.ts'

/**
 * Lectura de 3MF, el formato de los laminadores.
 *
 * Entiende el núcleo del estándar (objetos, componentes, transformaciones y
 * colores por `basematerials`/`colorgroup`) y las extensiones de los
 * laminadores multicolor: la pintura por triángulo, el filamento de cada
 * objeto o pieza (`Metadata/model_settings.config` de Bambu/Orca y
 * `Slic3r_PE_model.config` de Prusa) y los colores de los filamentos del
 * proyecto.
 *
 * El XML se recorre con expresiones regulares en vez de `DOMParser`: un 3MF
 * pintado puede traer cientos de miles de triángulos, y así se lee en una
 * pasada sin construir un árbol, también en Node para las pruebas.
 */
export type Leido3MF = { malla: Malla; paleta: Filamento[] }

/** Colores por defecto de los filamentos cuando el archivo no dice cuáles son. */
export const FILAMENTOS = ['#F2F0EB', '#1F1F22', '#E4572E', '#2E86DE', '#F5B700', '#3BB273', '#8E44AD', '#FF7AB6', '#7A5230', '#9AA5B1', '#00B8A9', '#C0392B', '#5D6D7E', '#F39C12', '#16A085', '#2C3E50']

type M = number[] // matriz afín 3MF: m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32
const IDENTIDAD: M = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
const matriz = (s?: string): M => (s ? s.trim().split(/\s+/).map(Number) : IDENTIDAD)
/** Primero `a`, después `b` (convención de fila del 3MF: p' = p·M). */
function componer(a: M, b: M): M {
  const r: M = new Array(12)
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++)
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j] + (i === 3 ? b[9 + j] : 0)
  return r
}

const ETIQUETA = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g
const ATRIBUTO = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

function atributos(s: string): Record<string, string> {
  const r: Record<string, string> = {}
  for (const m of s.matchAll(ATRIBUTO)) r[m[1]] = m[2] ?? m[3]
  return r
}
const local = (nombre: string) => nombre.slice(nombre.indexOf(':') + 1)

type Triangulo = { v1: number; v2: number; v3: number; pid?: string; p1?: string; pintura?: string }
type Objeto = {
  id: string
  pid?: string
  pindex?: string
  vertices?: number[]
  triangulos?: Triangulo[]
  componentes?: { objectid: string; ruta?: string; m: M }[]
}
type Modelo = { objetos: Map<string, Objeto>; colores: Map<string, { color: string; nombre?: string }[]>; build: { objectid: string; m: M }[] }

function leerModelo(xml: string): Modelo {
  const modelo: Modelo = { objetos: new Map(), colores: new Map(), build: [] }
  let objeto: Objeto | null = null
  let grupo: { color: string; nombre?: string }[] | null = null

  for (const e of xml.matchAll(ETIQUETA)) {
    const cierre = e[1] === '/'
    const nombre = local(e[2])
    if (cierre) {
      if (nombre === 'object') objeto = null
      if (nombre === 'basematerials' || nombre === 'colorgroup') grupo = null
      continue
    }
    switch (nombre) {
      case 'vertex': {
        const a = atributos(e[3])
        objeto?.vertices?.push(+a.x, +a.y, +a.z)
        break
      }
      case 'triangle': {
        const a = atributos(e[3])
        objeto?.triangulos?.push({
          v1: +a.v1, v2: +a.v2, v3: +a.v3,
          pid: a.pid, p1: a.p1,
          pintura: a.paint_color ?? a['slic3rpe:mmu_segmentation'] ?? a.mmu_segmentation,
        })
        break
      }
      case 'object': {
        const a = atributos(e[3])
        objeto = { id: a.id, pid: a.pid, pindex: a.pindex }
        modelo.objetos.set(a.id, objeto)
        break
      }
      case 'mesh':
        if (objeto) {
          objeto.vertices = []
          objeto.triangulos = []
        }
        break
      case 'component': {
        const a = atributos(e[3])
        if (objeto) (objeto.componentes ??= []).push({ objectid: a.objectid, ruta: a['p:path'] ?? a.path, m: matriz(a.transform) })
        break
      }
      case 'item': {
        const a = atributos(e[3])
        modelo.build.push({ objectid: a.objectid, m: matriz(a.transform) })
        break
      }
      case 'basematerials':
      case 'colorgroup': {
        grupo = []
        modelo.colores.set(atributos(e[3]).id, grupo)
        break
      }
      case 'base':
      case 'color': {
        const a = atributos(e[3])
        grupo?.push({ color: (a.displaycolor ?? a.color ?? '#CCCCCC').slice(0, 7), nombre: a.name })
        break
      }
    }
  }
  return modelo
}

/** Filamento asignado a cada objeto y pieza, según el laminador que guardó el archivo. */
type Asignacion = {
  objeto: Map<string, number>
  parte: Map<string, number> // "objeto:parte"
  /** Prusa: rangos de triángulos por volumen dentro de un objeto. */
  volumenes: Map<string, { desde: number; hasta: number; filamento: number }[]>
}

function leerAsignacion(bambu?: string, prusa?: string): Asignacion {
  const r: Asignacion = { objeto: new Map(), parte: new Map(), volumenes: new Map() }
  let obj: string | null = null
  let parte: string | null = null
  let vol: { desde: number; hasta: number; filamento: number } | null = null
  for (const e of (bambu ?? '').matchAll(ETIQUETA)) {
    const n = local(e[2])
    if (e[1] === '/') {
      if (n === 'part') parte = null
      if (n === 'object') obj = null
      continue
    }
    const a = atributos(e[3])
    if (n === 'object') obj = a.id
    else if (n === 'part') parte = a.id
    else if (n === 'metadata' && a.key === 'extruder' && obj) {
      if (parte) r.parte.set(`${obj}:${parte}`, +a.value)
      else r.objeto.set(obj, +a.value)
    }
  }
  for (const e of (prusa ?? '').matchAll(ETIQUETA)) {
    const n = local(e[2])
    if (e[1] === '/') {
      if (n === 'volume') vol = null
      continue
    }
    const a = atributos(e[3])
    if (n === 'object') obj = a.id
    else if (n === 'volume' && obj) {
      vol = { desde: +a.firstid, hasta: +a.lastid, filamento: 0 }
      const l = r.volumenes.get(obj) ?? []
      l.push(vol)
      r.volumenes.set(obj, l)
    } else if (n === 'metadata' && a.key === 'extruder' && obj) {
      if (a.type === 'volume' && vol) vol.filamento = +a.value
      else if (a.type === 'object') r.objeto.set(obj, +a.value)
    }
  }
  return r
}

function coloresDeFilamento(bambu?: string, prusa?: string): string[] {
  try {
    const json = bambu ? JSON.parse(bambu) : null
    const l = json?.filament_colour ?? json?.extruder_colour
    if (Array.isArray(l) && l.length) return l.map((c: string) => c.slice(0, 7))
  } catch {
    /* no era JSON */
  }
  const linea = prusa?.match(/^;\s*(?:filament|extruder)_colour\s*=\s*(.+)$/m)
  if (linea) return linea[1].split(';').map((c) => c.trim().slice(0, 7)).filter((c) => /^#[0-9a-f]{6}$/i.test(c))
  return []
}

async function texto(zip: Zip, ruta: string) {
  const f = zip.get(ruta.replace(/^\//, ''))
  return f ? new TextDecoder().decode(await f()) : undefined
}

export async function leer3MF(datos: Uint8Array): Promise<Leido3MF> {
  const zip = leerZip(datos)
  const rels = (await texto(zip, '_rels/.rels')) ?? ''
  const raiz = rels.match(/Target="([^"]+)"[^>]*Type="[^"]*\/3dmodel"/)?.[1] ?? rels.match(/Type="[^"]*\/3dmodel"[^>]*Target="([^"]+)"/)?.[1] ?? '/3D/3dmodel.model'

  const modelos = new Map<string, Modelo>()
  const modelo = async (ruta: string) => {
    const r = ruta.replace(/^\//, '')
    if (!modelos.has(r)) {
      const xml = await texto(zip, r)
      if (xml === undefined) throw new Error(`Falta ${r} dentro del 3MF`)
      modelos.set(r, leerModelo(xml))
    }
    return modelos.get(r)!
  }

  const asignacion = leerAsignacion(await texto(zip, 'Metadata/model_settings.config'), await texto(zip, 'Metadata/Slic3r_PE_model.config'))
  const filamentos = coloresDeFilamento(await texto(zip, 'Metadata/project_settings.config'), await texto(zip, 'Metadata/Slic3r_PE.config'))

  // Cada color distinto (filamento n o material de la tabla) es una entrada de la paleta.
  const paleta: Filamento[] = []
  const indice = new Map<string, number>()
  const colorDe = (clave: string, color: () => string, nombre: () => string) => {
    let i = indice.get(clave)
    if (i === undefined) {
      if (paleta.length >= 255) return 0
      i = paleta.length
      indice.set(clave, i)
      paleta.push({ color: color(), nombre: nombre() })
    }
    return i
  }
  const filamento = (n: number) =>
    colorDe(`f${n}`, () => filamentos[n - 1] ?? FILAMENTOS[(n - 1) % FILAMENTOS.length], () => `Filamento ${n}`)

  const salida = new Constructor()

  const emitir = async (ruta: string, id: string, m: M, raizId: string, parteId: string | null, profundidad: number) => {
    if (profundidad > 16) return
    const mod = await modelo(ruta)
    const obj = mod.objetos.get(id)
    if (!obj) return
    for (const c of obj.componentes ?? [])
      await emitir(c.ruta ?? ruta, c.objectid, componer(c.m, m), raizId, parteId ?? c.objectid, profundidad + 1)
    if (!obj.vertices || !obj.triangulos) return

    const v = obj.vertices
    const n = v.length / 3
    const w = new Float64Array(n * 3)
    for (let i = 0; i < n; i++) {
      const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2]
      w[i * 3] = x * m[0] + y * m[3] + z * m[6] + m[9]
      w[i * 3 + 1] = x * m[1] + y * m[4] + z * m[7] + m[10]
      w[i * 3 + 2] = x * m[2] + y * m[5] + z * m[8] + m[11]
    }
    const base =
      (parteId ? asignacion.parte.get(`${raizId}:${parteId}`) : undefined) ?? asignacion.objeto.get(raizId) ?? asignacion.objeto.get(id) ?? 1
    const volumenes = asignacion.volumenes.get(raizId)

    obj.triangulos.forEach((t, k) => {
      if (t.v1 >= n || t.v2 >= n || t.v3 >= n) return
      // Un material del 3MF manda sobre el filamento del laminador.
      const pid = t.pid ?? obj.pid
      const p = t.p1 ?? obj.pindex
      const g = pid === undefined ? undefined : mod.colores.get(pid)
      const e = g?.[+(p ?? 0)] ?? g?.[0]
      const base_ = e
        ? colorDe(`m${pid}:${p}`, () => e.color, () => e.nombre ?? `Color ${paleta.length + 1}`)
        : filamento(volumenes?.find((r) => k >= r.desde && k <= r.hasta)?.filamento || base)
      const a = [w[t.v1 * 3], w[t.v1 * 3 + 1], w[t.v1 * 3 + 2]] as const
      const b = [w[t.v2 * 3], w[t.v2 * 3 + 1], w[t.v2 * 3 + 2]] as const
      const c = [w[t.v3 * 3], w[t.v3 * 3 + 1], w[t.v3 * 3 + 2]] as const
      if (!t.pintura) {
        salida.agregar(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], base_)
        return
      }
      decodificarPintura(t.pintura, [a, b, c], ([p0, p1, p2], estado) =>
        salida.agregar(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], estado ? filamento(estado) : base_),
      )
    })
  }

  const raizMod = await modelo(raiz)
  const items = raizMod.build.length ? raizMod.build : [...raizMod.objetos.keys()].map((objectid) => ({ objectid, m: IDENTIDAD }))
  for (const it of items) await emitir(raiz, it.objectid, it.m, it.objectid, null, 0)

  if (!salida.n) throw new Error('El 3MF no tiene ninguna malla')
  if (!paleta.length) filamento(1)
  return { malla: salida.malla(), paleta }
}
