import { useEffect, useState, type ReactNode } from 'react'
import {
  AlignCenterHorizontal, ArrowDownToLine, Box, Circle, Combine, Compass, Copy, Cone, Cylinder, Diamond, Eye, EyeOff, FlipHorizontal2,
  Hexagon, Layers, Lock, Maximize, Pyramid, RefreshCw, Scissors, Shapes, SquareDashed, Trash2, Triangle, Type, Wrench, Sparkles,
} from 'lucide-react'
import { FORMAS, defForma } from '../geo/formas.ts'
import { PLANTILLAS, paramsPlantilla, type Plantilla } from '../geo/plantillas.ts'
import { COLORES, IMPRESORAS, type Analisis, type Parametro, type Params, type TipoForma, type Vec3 } from '../geo/tipos.ts'
import { gramos, metros } from '../geo/impresion.ts'
import {
  actualizar, agregarForma, agregarPlantilla, ajustarACama, alinear, alternarHueco, analizarSeleccion, apoyarEnCama, autoOrientar, centrarEnCama,
  combinar, duplicar, eliminar, espejo, repararSeleccion, separarCuerpos,
} from './acciones.ts'
import { cajaMundo, useEditor, type NodoEditor } from './estado.ts'
import { useMallaLocal } from './mallas.ts'

/* ── Piezas pequeñas de interfaz ──────────────────────────────────────── */

export function Seccion({ titulo, children, extra }: { titulo: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="border-b border-white/[0.06] px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-chakra text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{titulo}</h3>
        {extra}
      </div>
      {children}
    </section>
  )
}

export function Boton({ children, onClick, activo, titulo, peligro, className = '', disabled }: { children: ReactNode; onClick?: () => void; activo?: boolean; titulo?: string; peligro?: boolean; className?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium transition disabled:opacity-35 ${
        activo ? 'bg-[#FF6A13] text-[#0D0A14]' : peligro ? 'bg-white/[0.04] text-[#FF7A6B] hover:bg-[#FF4D4D]/15' : 'bg-white/[0.05] text-white/85 hover:bg-white/[0.1]'
      } ${className}`}
    >
      {children}
    </button>
  )
}

/** Campo numérico que acepta coma o punto y aplica al salir o con Enter (como los campos de Blender). */
function CampoNumero({ valor, onCambio, paso = 0.5, min, max, unidad = 'mm', etiqueta }: { valor: number; onCambio: (v: number) => void; paso?: number; min?: number; max?: number; unidad?: string; etiqueta?: string }) {
  const [texto, setTexto] = useState(fmt(valor))
  useEffect(() => setTexto(fmt(valor)), [valor])
  const aplicar = () => {
    let v = Number(texto.replace(',', '.'))
    if (!Number.isFinite(v)) return setTexto(fmt(valor))
    if (min !== undefined) v = Math.max(min, v)
    if (max !== undefined) v = Math.min(max, v)
    if (v !== valor) onCambio(v)
    setTexto(fmt(v))
  }
  return (
    <label className="flex min-w-0 items-center gap-1.5 rounded-lg bg-white/[0.05] px-2 focus-within:ring-1 focus-within:ring-[#FF6A13]/70">
      {etiqueta && <span className="font-chakra text-[11px] font-semibold text-white/40">{etiqueta}</span>}
      <input
        inputMode="decimal"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={aplicar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const v = valor + (e.key === 'ArrowUp' ? 1 : -1) * paso * (e.shiftKey ? 10 : 1)
            onCambio(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, +v.toFixed(4))))
          }
        }}
        className="h-9 w-full min-w-0 bg-transparent text-right font-chakra text-[13px] tabular-nums text-white outline-none"
      />
      {unidad && <span className="text-[11px] text-white/35">{unidad}</span>}
    </label>
  )
}
const fmt = (v: number) => String(Math.round(v * 1000) / 1000)

/** Un parámetro de forma o plantilla, con su control. */
export function ControlParametro({ p, valor, onCambio }: { p: Parametro; valor: Params[string]; onCambio: (v: number | string | boolean) => void }) {
  if (p.tipo === 'numero')
    return (
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-white/70">{p.nombre}</span>
          <div className="w-28">
            <CampoNumero valor={Number(valor)} onCambio={onCambio} paso={p.paso} min={p.min} max={p.max} unidad={p.unidad} />
          </div>
        </div>
        <input type="range" min={p.min} max={p.max} step={p.paso} value={Number(valor)} onChange={(e) => onCambio(Number(e.target.value))} className="rango w-full" aria-label={p.nombre} />
        {p.ayuda && <p className="mt-1 text-[11px] leading-snug text-white/40">{p.ayuda}</p>}
      </div>
    )
  if (p.tipo === 'opcion')
    return (
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] text-white/70">{p.nombre}</span>
        <select value={String(valor)} onChange={(e) => onCambio(e.target.value)} className="h-9 w-full rounded-lg bg-white/[0.06] px-2 text-[13px] text-white outline-none">
          {p.opciones.map((o) => (
            <option key={o.valor} value={o.valor} className="bg-[#17121F]">
              {o.nombre}
            </option>
          ))}
        </select>
      </label>
    )
  if (p.tipo === 'texto')
    return (
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] text-white/70">{p.nombre}</span>
        <input value={String(valor)} maxLength={p.max} onChange={(e) => onCambio(e.target.value)} className="h-9 w-full rounded-lg bg-white/[0.06] px-2.5 text-[13px] text-white outline-none focus:ring-1 focus:ring-[#FF6A13]/70" />
      </label>
    )
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-[12.5px] text-white/70">{p.nombre}</span>
      <input type="checkbox" checked={!!valor} onChange={(e) => onCambio(e.target.checked)} className="h-4 w-4 accent-[#FF6A13]" />
    </label>
  )
}

/* ── Formas ───────────────────────────────────────────────────────────── */

const ICONOS: Record<TipoForma, typeof Box> = {
  caja: Box, cilindro: Cylinder, esfera: Circle, cono: Cone, toro: Diamond, tubo: SquareDashed, prisma: Hexagon,
  piramide: Pyramid, cuna: Triangle, texto: Type, svg: Sparkles,
}

export function PanelFormas({ alImportar }: { alImportar: () => void }) {
  return (
    <>
      <Seccion titulo="Formas básicas">
        <div className="grid grid-cols-3 gap-2">
          {FORMAS.map((f) => {
            const I = ICONOS[f.tipo]
            return (
              <button
                key={f.tipo}
                type="button"
                onClick={() => agregarForma(f.tipo)}
                className="group flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] text-white/75 ring-1 ring-white/[0.05] transition hover:bg-[#FF6A13]/12 hover:text-white hover:ring-[#FF6A13]/40"
              >
                <I size={22} strokeWidth={1.6} className="transition group-hover:scale-110 group-hover:text-[#FF6A13]" />
                <span className="text-[11px]">{f.nombre}</span>
              </button>
            )
          })}
        </div>
      </Seccion>
      <Seccion titulo="Traer">
        <Boton onClick={alImportar} className="w-full">
          <Layers size={15} /> Importar STL, 3MF, GLB, OBJ o SVG
        </Boton>
        <p className="mt-2 text-[11px] leading-snug text-white/40">Tus archivos se abren en tu navegador: no se suben a ningún servidor.</p>
      </Seccion>
      <Seccion titulo="Atajos">
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px] text-white/50">
          {[['G', 'Mover'], ['R', 'Rotar'], ['S', 'Escalar'], ['M', 'Medir'], ['H', 'Sólido / hueco'], ['⌘G', 'Combinar'], ['⌘D', 'Duplicar'], ['⌘Z', 'Deshacer'], ['Supr', 'Borrar'], ['F', 'Encuadrar'], ['1 3 7', 'Frente, derecha, arriba'], ['B', 'Apoyar en cama']].map(([k, v]) => (
            <li key={k} className="flex items-center gap-2">
              <kbd className="min-w-7 rounded bg-white/[0.07] px-1.5 py-0.5 text-center font-chakra text-[10.5px] text-white/75">{k}</kbd>
              {v}
            </li>
          ))}
        </ul>
      </Seccion>
    </>
  )
}

/* ── Plantillas ───────────────────────────────────────────────────────── */

export function PanelPlantillas() {
  const [abierta, setAbierta] = useState<Plantilla | null>(null)
  const [valores, setValores] = useState<Params>({})
  const ocupado = useEditor((s) => s.ocupado)

  if (abierta)
    return (
      <>
        <Seccion titulo="Plantilla" extra={<button type="button" onClick={() => setAbierta(null)} className="text-[12px] text-white/50 hover:text-white">← Todas</button>}>
          <h2 className="font-flemin text-[19px] leading-tight text-white">{abierta.nombre}</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-white/55">{abierta.descripcion}</p>
        </Seccion>
        <Seccion titulo="Parámetros">
          <div className="space-y-4">
            {abierta.params.map((p) => (
              <ControlParametro key={p.clave} p={p} valor={valores[p.clave]} onCambio={(v) => setValores((x) => ({ ...x, [p.clave]: v }))} />
            ))}
          </div>
        </Seccion>
        <div className="sticky bottom-0 bg-[#120E1A]/95 p-4 backdrop-blur">
          <Boton activo className="h-11 w-full !text-[14px]" disabled={!!ocupado} onClick={() => agregarPlantilla(abierta.id, valores)}>
            <Sparkles size={16} /> Generar en la cama
          </Boton>
        </div>
      </>
    )

  return (
    <Seccion titulo="Plantillas listas para imprimir">
      <div className="space-y-2">
        {PLANTILLAS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setAbierta(p)
              setValores(paramsPlantilla(p))
            }}
            className="group block w-full rounded-xl bg-white/[0.04] p-3 text-left ring-1 ring-white/[0.05] transition hover:bg-white/[0.07] hover:ring-[#FF6A13]/40"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[13.5px] font-semibold text-white">{p.nombre}</span>
              <span className="shrink-0 rounded-full bg-[#FFC23D]/12 px-2 py-0.5 font-chakra text-[10.5px] text-[#FFC23D]">{p.etiqueta}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-white/45">{p.descripcion}</p>
          </button>
        ))}
      </div>
    </Seccion>
  )
}

/* ── Objetos (el "Outliner" de Blender) ───────────────────────────────── */

export function PanelObjetos() {
  const nodos = useEditor((s) => s.nodos)
  const seleccion = useEditor((s) => s.seleccion)
  if (!nodos.length)
    return (
      <Seccion titulo="Objetos">
        <p className="text-[12.5px] leading-relaxed text-white/45">La cama está vacía. Agrega una forma, genera una plantilla o importa un archivo.</p>
      </Seccion>
    )
  return (
    <Seccion titulo={`Objetos · ${nodos.length}`}>
      <ul className="space-y-1">
        {[...nodos].reverse().map((n) => {
          const sel = seleccion.includes(n.id)
          return (
            <li key={n.id}>
              <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${sel ? 'bg-[#FF6A13]/15 ring-1 ring-[#FF6A13]/50' : 'hover:bg-white/[0.05]'}`}>
                <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: n.hueco ? 'repeating-linear-gradient(45deg,#9AA5B1 0 2px,transparent 2px 4px)' : n.color }} />
                <button type="button" onClick={(e) => useEditor.getState().seleccionar([n.id], e.shiftKey || e.metaKey || e.ctrlKey)} className="min-w-0 flex-1 truncate text-left text-[12.5px] text-white/85">
                  {n.nombre}
                </button>
                {n.protegido && <Lock size={12} className="shrink-0 text-white/35" aria-label="Pieza del catálogo" />}
                <button type="button" title={n.visible ? 'Ocultar' : 'Mostrar'} onClick={() => actualizar(n.id, { visible: !n.visible })} className="text-white/40 hover:text-white">
                  {n.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </Seccion>
  )
}

/* ── Propiedades ──────────────────────────────────────────────────────── */

function Tamano({ n }: { n: NodoEditor }) {
  const { malla } = useMallaLocal(n)
  if (!malla) return null
  // Tamaño en mm a lo largo de los ejes del propio objeto (sin girar).
  const base = cajaMundo({ ...n, pos: [0, 0, 0], rot: [0, 0, 0], esc: [1, 1, 1] }, malla)
  const t: Vec3 = [base.max.x - base.min.x, base.max.y - base.min.y, base.max.z - base.min.z]
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {(['X', 'Y', 'Z'] as const).map((e, i) => (
        <CampoNumero
          key={e}
          etiqueta={e}
          valor={+(t[i] * Math.abs(n.esc[i])).toFixed(3)}
          min={0.05}
          onCambio={(v) => actualizar(n.id, { esc: n.esc.map((s, k) => (k === i ? Math.sign(s || 1) * (v / Math.max(1e-6, t[i])) : s)) as Vec3 })}
        />
      ))}
    </div>
  )
}

export function PanelPropiedades() {
  const nodos = useEditor((s) => s.nodos)
  const seleccion = useEditor((s) => s.seleccion)
  const elegidos = nodos.filter((n) => seleccion.includes(n.id))
  const ocupado = useEditor((s) => s.ocupado)

  if (!elegidos.length)
    return (
      <Seccion titulo="Propiedades">
        <p className="text-[12.5px] leading-relaxed text-white/45">Toca un objeto para editarlo. Con Mayús eliges varios para combinarlos, restarlos o alinearlos.</p>
      </Seccion>
    )

  if (elegidos.length > 1)
    return (
      <>
        <Seccion titulo={`${elegidos.length} objetos`}>
          <div className="grid grid-cols-2 gap-2">
            <Boton activo onClick={() => combinar('combinar')} disabled={!!ocupado} titulo="Une los sólidos y resta los huecos (⌘G)">
              <Combine size={15} /> Combinar
            </Boton>
            <Boton onClick={() => combinar('intersecar')} disabled={!!ocupado} titulo="Deja solo el volumen común">
              <Scissors size={15} /> Intersecar
            </Boton>
            <Boton onClick={duplicar}><Copy size={15} /> Duplicar</Boton>
            <Boton peligro onClick={eliminar}><Trash2 size={15} /> Borrar</Boton>
          </div>
          <p className="mt-3 text-[11.5px] leading-snug text-white/45">Marca como <b className="text-white/70">hueco</b> lo que quieras restar y pulsa Combinar: así se hacen agujeros, ranuras y grabados.</p>
        </Seccion>
        <Seccion titulo="Alinear">
          {(['X', 'Y', 'Z'] as const).map((e, i) => (
            <div key={e} className="mb-1.5 grid grid-cols-[20px_1fr_1fr_1fr] items-center gap-1.5">
              <span className="font-chakra text-[11px] font-semibold text-white/40">{e}</span>
              {(['min', 'centro', 'max'] as const).map((d) => (
                <Boton key={d} onClick={() => alinear(i as 0 | 1 | 2, d)} className="!min-h-8 !text-[11.5px]">
                  {d === 'min' ? 'Inicio' : d === 'centro' ? <><AlignCenterHorizontal size={13} /> Centro</> : 'Final'}
                </Boton>
              ))}
            </div>
          ))}
        </Seccion>
        <PanelColor ids={elegidos.map((n) => n.id)} actual={elegidos[0].color} />
      </>
    )

  const n = elegidos[0]
  const def = n.tipo !== 'malla' ? defForma(n.tipo) : null
  const lote = n.lote ? PLANTILLAS.find((p) => p.id === n.lote!.plantilla) : null
  return (
    <>
      <Seccion titulo="Objeto">
        <input value={n.nombre} onChange={(e) => actualizar(n.id, { nombre: e.target.value })} className="mb-3 h-9 w-full rounded-lg bg-white/[0.06] px-2.5 text-[14px] font-semibold text-white outline-none focus:ring-1 focus:ring-[#FF6A13]/70" aria-label="Nombre" />
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1">
          <button type="button" onClick={() => n.hueco && alternarHueco()} className={`h-8 rounded-lg text-[12.5px] font-medium transition ${!n.hueco ? 'bg-white text-[#0D0A14]' : 'text-white/60'}`}>Sólido</button>
          <button type="button" onClick={() => !n.hueco && alternarHueco()} className={`h-8 rounded-lg text-[12.5px] font-medium transition ${n.hueco ? 'bg-white text-[#0D0A14]' : 'text-white/60'}`}>Hueco</button>
        </div>
        {n.protegido && <p className="mt-3 flex items-start gap-2 text-[11.5px] leading-snug text-white/45"><Lock size={13} className="mt-0.5 shrink-0" /> Pieza del catálogo: puedes mirarla, medirla y combinarla, pero no descargarla.</p>}
      </Seccion>

      {def && (
        <Seccion titulo={def.nombre}>
          <div className="space-y-4">
            {def.params.map((p) => (
              <ControlParametro key={p.clave} p={p} valor={n.params[p.clave] ?? p.valor} onCambio={(v) => actualizar(n.id, { params: { ...n.params, [p.clave]: v } })} />
            ))}
          </div>
        </Seccion>
      )}

      {lote && <RegenerarLote n={n} plantilla={lote} />}

      <Seccion titulo="Tamaño">
        <Tamano n={n} />
      </Seccion>
      <Seccion titulo="Posición">
        <div className="grid grid-cols-3 gap-1.5">
          {(['X', 'Y', 'Z'] as const).map((e, i) => (
            <CampoNumero key={e} etiqueta={e} valor={n.pos[i]} onCambio={(v) => actualizar(n.id, { pos: n.pos.map((x, k) => (k === i ? v : x)) as Vec3 })} />
          ))}
        </div>
      </Seccion>
      <Seccion titulo="Rotación">
        <div className="grid grid-cols-3 gap-1.5">
          {(['X', 'Y', 'Z'] as const).map((e, i) => (
            <CampoNumero key={e} etiqueta={e} unidad="°" paso={15} valor={n.rot[i]} onCambio={(v) => actualizar(n.id, { rot: n.rot.map((x, k) => (k === i ? v : x)) as Vec3 })} />
          ))}
        </div>
      </Seccion>
      <PanelColor ids={[n.id]} actual={n.color} />
      <Seccion titulo="Acciones">
        <div className="grid grid-cols-2 gap-2">
          <Boton onClick={duplicar}><Copy size={15} /> Duplicar</Boton>
          <Boton onClick={apoyarEnCama}><ArrowDownToLine size={15} /> A la cama</Boton>
          <Boton onClick={() => espejo(0)}><FlipHorizontal2 size={15} /> Espejo X</Boton>
          <Boton onClick={() => espejo(1)}><FlipHorizontal2 size={15} className="rotate-90" /> Espejo Y</Boton>
          <Boton onClick={separarCuerpos} disabled={!!ocupado}><Shapes size={15} /> Separar</Boton>
          <Boton peligro onClick={eliminar}><Trash2 size={15} /> Borrar</Boton>
        </div>
      </Seccion>
    </>
  )
}

function RegenerarLote({ n, plantilla }: { n: NodoEditor; plantilla: Plantilla }) {
  const [valores, setValores] = useState<Params>(n.lote!.params)
  useEffect(() => setValores(n.lote!.params), [n.lote])
  const ocupado = useEditor((s) => s.ocupado)
  return (
    <Seccion titulo={`Plantilla · ${plantilla.nombre}`}>
      <div className="space-y-4">
        {plantilla.params.map((p) => (
          <ControlParametro key={p.clave} p={p} valor={valores[p.clave]} onCambio={(v) => setValores((x) => ({ ...x, [p.clave]: v }))} />
        ))}
      </div>
      <Boton activo className="mt-4 w-full" disabled={!!ocupado} onClick={() => agregarPlantilla(plantilla.id, valores, n.lote!.id)}>
        <RefreshCw size={15} /> Regenerar piezas
      </Boton>
    </Seccion>
  )
}

function PanelColor({ ids, actual }: { ids: string[]; actual: string }) {
  return (
    <Seccion titulo="Color / filamento">
      <div className="flex flex-wrap gap-2">
        {COLORES.map((c) => (
          <button
            key={c.color}
            type="button"
            title={c.nombre}
            aria-label={c.nombre}
            onClick={() => useEditor.getState().hacer((l) => l.map((n) => (ids.includes(n.id) ? { ...n, color: c.color } : n)))}
            className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-[#120E1A] transition hover:scale-110 ${actual.toLowerCase() === c.color.toLowerCase() ? 'ring-2 ring-white' : 'ring-1 ring-white/15'}`}
            style={{ background: c.color }}
          />
        ))}
        <label title="Otro color" className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full bg-[conic-gradient(#FF4D4D,#FFC23D,#1FBF8F,#2FA8FF,#8A3CFF,#FF4D4D)] ring-1 ring-white/15">
          <input type="color" value={actual} onChange={(e) => useEditor.getState().hacer((l) => l.map((n) => (ids.includes(n.id) ? { ...n, color: e.target.value } : n)))} className="absolute inset-0 opacity-0" />
        </label>
      </div>
    </Seccion>
  )
}

/* ── Imprimir ─────────────────────────────────────────────────────────── */

export function PanelImprimir() {
  const impresora = useEditor((s) => s.impresora)
  const voladizos = useEditor((s) => s.voladizos)
  const ocupado = useEditor((s) => s.ocupado)
  const nodos = useEditor((s) => s.nodos)
  const [informe, setInforme] = useState<(Analisis & { nombre: string })[] | null>(null)
  const [relleno, setRelleno] = useState(15)
  useEffect(() => setInforme(null), [nodos])
  const imp = IMPRESORAS.find((i) => i.id === impresora)!
  return (
    <>
      <Seccion titulo="Impresora">
        <select value={impresora} onChange={(e) => useEditor.getState().set({ impresora: e.target.value })} className="h-9 w-full rounded-lg bg-white/[0.06] px-2 text-[13px] text-white outline-none">
          {IMPRESORAS.map((i) => (
            <option key={i.id} value={i.id} className="bg-[#17121F]">
              {i.nombre} · {i.cama.join(' × ')} mm
            </option>
          ))}
        </select>
      </Seccion>
      <Seccion titulo="Preparar">
        <div className="grid grid-cols-2 gap-2">
          <Boton onClick={async () => setInforme((await analizarSeleccion()) ?? null)} disabled={!!ocupado}><Wrench size={15} /> Revisar malla</Boton>
          <Boton onClick={autoOrientar} disabled={!!ocupado}><Compass size={15} /> Auto-orientar</Boton>
          <Boton onClick={centrarEnCama} disabled={!!ocupado}><AlignCenterHorizontal size={15} /> Centrar</Boton>
          <Boton onClick={ajustarACama} disabled={!!ocupado}><Maximize size={15} /> Ajustar a cama</Boton>
          <Boton onClick={apoyarEnCama} disabled={!!ocupado}><ArrowDownToLine size={15} /> A la cama</Boton>
          <Boton activo={voladizos} onClick={() => useEditor.getState().set({ voladizos: !voladizos })}><Triangle size={15} className="rotate-180" /> Voladizos</Boton>
        </div>
        <p className="mt-3 text-[11.5px] leading-snug text-white/40">Sin nada elegido, se aplica a toda la cama. En rojo, las caras de más de 45° que piden soporte.</p>
      </Seccion>
      {informe && (
        <Seccion titulo="Informe" extra={<span className="font-chakra text-[11px] text-white/40">relleno {relleno}%</span>}>
          <input type="range" min={0} max={100} step={5} value={relleno} onChange={(e) => setRelleno(Number(e.target.value))} className="rango mb-3 w-full" aria-label="Relleno" />
          <div className="space-y-2.5">
            {informe.map((a, i) => {
              const t = [a.max[0] - a.min[0], a.max[1] - a.min[1], a.max[2] - a.min[2]]
              const cabe = t[0] <= imp.cama[0] && t[1] <= imp.cama[1] && t[2] <= imp.cama[2]
              const g = gramos(a.volumen, a.area, relleno / 100)
              return (
                <div key={i} className="rounded-xl bg-white/[0.04] p-3 text-[12px] ring-1 ring-white/[0.05]">
                  <p className="mb-2 truncate font-semibold text-white">{a.nombre}</p>
                  <ul className="space-y-1 text-white/65">
                    <Linea ok={a.estanca}>{a.estanca ? 'Malla cerrada (estanca)' : `${a.bordesAbiertos} bordes abiertos${a.aristasRaras ? ` · ${a.aristasRaras} aristas no-manifold` : ''}`}</Linea>
                    <Linea ok={cabe}>{t.map((x) => x.toFixed(1)).join(' × ')} mm {cabe ? `· cabe en la ${imp.nombre}` : '· no cabe en la cama'}</Linea>
                    <Linea ok={a.min[2] > -0.05 && a.min[2] < 0.05}>{Math.abs(a.min[2]) < 0.05 ? 'Apoyada en la cama' : `Base a ${a.min[2].toFixed(2)} mm de la cama`}</Linea>
                    <Linea ok={a.voladizo < 50}>{a.voladizo < 1 ? 'Sin voladizos' : `${Math.round(a.voladizo)} mm² de voladizo`}</Linea>
                    <Linea ok={a.cuerpos === 1}>{a.cuerpos === 1 ? '1 cuerpo' : `${a.cuerpos} cuerpos separados`}</Linea>
                  </ul>
                  <p className="mt-2 font-chakra text-[12px] text-[#FFC23D]">
                    ≈ {g.toFixed(1)} g · {metros(g).toFixed(2)} m de PLA · {(a.volumen / 1000).toFixed(2)} cm³
                  </p>
                </div>
              )
            })}
          </div>
          {informe.some((a) => !a.estanca) && (
            <Boton onClick={repararSeleccion} className="mt-3 w-full" disabled={!!ocupado}>
              <Wrench size={15} /> Intentar cerrar la malla
            </Boton>
          )}
        </Seccion>
      )}
    </>
  )
}

function Linea({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${ok ? 'bg-[#1FBF8F]' : 'bg-[#FFC23D]'}`} />
      {children}
    </li>
  )
}
