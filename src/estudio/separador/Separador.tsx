import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Box, Combine, Download, Eraser, Eye, EyeOff, Layers, Lock, PaintBucket, Paintbrush, Palette, Pipette, Plus, Redo2, Rotate3d, Scissors,
  Shapes, Sparkles, Trash2, Undo2, Upload, X, Hammer, Grid2x2, PenLine, Spline, ArrowUpToLine, ArrowDownToLine, ZoomIn,
} from 'lucide-react'
import { Lienzo, type Herramienta } from '../../components/taller/Lienzo'
import { FORMATOS } from '../../lib/taller/importar'
import { FILAMENTOS } from '../../lib/taller/tresmf'
import { rutaPortada, type Modelo3D } from '../../lib/catalogo'
import { gramos } from '../geo/impresion.ts'
import { IMPRESORAS } from '../geo/tipos.ts'
import type { TipoConector } from '../geo/separador.ts'
import { Boton, Seccion } from '../editor/Paneles.tsx'
import { OBRAS_PUBLICAS } from '../sala/Sala.tsx'
import {
  abrirArchivo, abrirCatalogo, abrirEntrada, agregarColor, borrarSeleccion, cambiarColorPaleta, cortar, cuerposSueltos, deshacerPintura, dividirCama,
  cortarConBoceto, ordenarEnCama, reagrupar, editarPieza, escalarA, exportar, fronteraSuave, guardarPintura, limpiarPintura, masDetalle, pintarAltura, rellenar, separarColor, superficiePorColor, unir,
} from './acciones.ts'
import { medir, useSeparador, type Paso } from './estado.ts'
import { VisorPiezas } from './Visor.tsx'

/**
 * Flemin Studio · Separador.
 *
 * Separa un modelo en piezas imprimibles, como Split3MF o la herramienta de
 * corte de Bambu Studio, en el navegador y sin subir nada:
 *   1. Color: pinta (o trae un 3MF pintado) y cada color sale como pieza,
 *      cortada por su frontera o incrustada con una profundidad fija.
 *   2. Corte: planos en cualquier ángulo con conectores y tolerancia, o
 *      "dividir para la cama" cuando no cabe en la impresora.
 *   3. Partes: cuerpos sueltos, unir, renombrar, recolorear y exportar.
 */
const HERRAMIENTAS: { id: Herramienta; nombre: string; tecla: string; Icono: typeof Paintbrush }[] = [
  { id: 'pincel', nombre: 'Pincel', tecla: 'B', Icono: Paintbrush },
  { id: 'relleno', nombre: 'Relleno', tecla: 'F', Icono: PaintBucket },
  { id: 'gotero', nombre: 'Gotero', tecla: 'I', Icono: Pipette },
  { id: 'girar', nombre: 'Girar', tecla: 'V', Icono: Rotate3d },
]

const CONECTORES: { id: TipoConector; nombre: string }[] = [
  { id: 'ninguno', nombre: 'Sin conector' },
  { id: 'cilindro', nombre: 'Espiga redonda' },
  { id: 'cuadrado', nombre: 'Espiga cuadrada' },
  { id: 'triangulo', nombre: 'Espiga triangular' },
  { id: 'clavija', nombre: 'Clavija suelta' },
]

/**
 * Piezas de muestra para probar sin archivo propio: obras del estudio,
 * primero los diseños multicolor por piezas (los que mejor enseñan el
 * separador) y luego las figuras Flemin.
 */
const MUESTRAS = OBRAS_PUBLICAS.filter((m) => m.archivo && !m.personalizable && (m.peso ?? 0) < 6_000_000)
  .sort((a, b) => Number(!!b.piezas) - Number(!!a.piezas))
  .slice(0, 6)

export default function Separador({ onCerrar, onEditor }: { onCerrar: () => void; onEditor?: () => void }) {
  const archivo = useRef<HTMLInputElement>(null)
  const [encima, setEncima] = useState(false)
  const [movil, setMovil] = useState<Paso | 'piezas' | null>(null)
  const [herramienta, setHerramienta] = useState<Herramienta>('pincel')
  const [activo, setActivo] = useState(0)
  const [radio, setRadio] = useState(3)

  const proyecto = useSeparador((s) => s.proyecto)
  const piezas = useSeparador((s) => s.piezas)
  const paso = useSeparador((s) => s.paso)
  const version = useSeparador((s) => s.version)
  const ocupado = useSeparador((s) => s.ocupado)
  const aviso = useSeparador((s) => s.aviso)
  const nombre = useSeparador((s) => s.nombre)
  const puedeDeshacer = useSeparador((s) => s.pasado.length > 0)
  const puedeRehacer = useSeparador((s) => s.futuro.length > 0)
  const set = useSeparador.getState().set

  useEffect(() => {
    abrirEntrada()
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => set({ aviso: null }), aviso.tipo === 'error' ? 7000 : 4000)
    return () => clearTimeout(t)
  }, [aviso, set])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      const s = useSeparador.getState()
      const cmd = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      const pintando = s.paso === 'color' && !!s.proyecto
      if (cmd && k === 'z') return e.preventDefault(), pintando ? deshacerPintura(e.shiftKey) : e.shiftKey ? s.rehacer() : s.deshacer()
      if (cmd && k === 'y') return e.preventDefault(), pintando ? deshacerPintura(true) : s.rehacer()
      if (cmd) return
      if (k === 'escape') return s.seleccion.length ? s.set({ seleccion: [] }) : onCerrar()
      if (pintando) {
        const h = HERRAMIENTAS.find((x) => x.tecla.toLowerCase() === k)
        if (h) setHerramienta(h.id)
        if (k === '[') setRadio((r) => Math.max(0.5, +(r / 1.25).toFixed(2)))
        if (k === ']') setRadio((r) => Math.min(40, +(r * 1.25).toFixed(2)))
      } else if (k === 'delete' || k === 'backspace') borrarSeleccion()
    }
    window.addEventListener('keydown', tecla)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = antes
    }
  }, [onCerrar])

  const abrir = (f?: File) => f && !ocupado && abrirArchivo(f)
  const pintar = paso === 'color' && !!proyecto

  const pasos: [Paso, string, typeof Palette][] = [
    ['color', 'Color', Palette],
    ['corte', 'Corte', Scissors],
    ['partes', 'Partes', Shapes],
  ]
  const panelPaso = paso === 'color' ? <PanelColor activo={activo} setActivo={setActivo} herramienta={herramienta} setHerramienta={setHerramienta} radio={radio} setRadio={setRadio} /> : paso === 'corte' ? <PanelCorte /> : <PanelPartes />

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#0D0A14] font-sans text-white"
      onDragOver={(e) => (e.preventDefault(), setEncima(true))}
      onDragLeave={(e) => e.currentTarget === e.target && setEncima(false)}
      onDrop={(e) => {
        e.preventDefault()
        setEncima(false)
        abrir(e.dataTransfer.files[0])
      }}
    >
      <input ref={archivo} type="file" accept={FORMATOS.join(',')} hidden onChange={(e) => (abrir(e.target.files?.[0]), (e.target.value = ''))} />

      {/* ── Barra superior ─────────────────────────────────────────── */}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#120E1A] px-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#FF6A13] to-[#8A3CFF] text-[#0D0A14]">
          <Scissors size={16} strokeWidth={2.4} />
        </span>
        <span className="hidden shrink-0 leading-none sm:block">
          <span className="block font-flemin text-[14px] tracking-wide">Flemin Studio</span>
          <span className="font-chakra text-[10px] uppercase tracking-[0.22em] text-white/40">Separador de piezas</span>
        </span>
        <div className="mx-1 hidden h-6 w-px bg-white/10 md:block" />
        <BotonBarra titulo="Abrir modelo" onClick={() => archivo.current?.click()}><Upload size={17} /></BotonBarra>
        <BotonBarra titulo="Deshacer (⌘Z)" onClick={() => (pintar ? deshacerPintura() : useSeparador.getState().deshacer())} disabled={!pintar && !puedeDeshacer}><Undo2 size={17} /></BotonBarra>
        <BotonBarra titulo="Rehacer (⇧⌘Z)" onClick={() => (pintar ? deshacerPintura(true) : useSeparador.getState().rehacer())} disabled={!pintar && !puedeRehacer}><Redo2 size={17} /></BotonBarra>
        {nombre && <span className="ml-1 hidden min-w-0 truncate text-[13px] text-white/50 md:block">{nombre}</span>}
        <div className="flex-1" />
        {piezas.length > 0 && (
          <div className="hidden rounded-xl bg-white/[0.05] p-1 md:flex">
            {pasos.map(([id, n, I]) => (
              <button key={id} type="button" onClick={() => set({ paso: id })} className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium transition ${paso === id ? 'bg-white text-[#0D0A14]' : 'text-white/60 hover:text-white'}`}>
                <I size={14} /> {n}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        {onEditor && (
          <button type="button" onClick={onEditor} className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-white/60 transition hover:bg-white/[0.07] hover:text-white lg:inline-flex">
            <Hammer size={15} /> Editor
          </button>
        )}
        <button type="button" onClick={onCerrar} aria-label="Cerrar el separador" className="grid h-9 w-9 place-items-center rounded-lg text-white/60 transition hover:bg-white/[0.07] hover:text-white">
          <X size={19} />
        </button>
      </header>

      {piezas.length === 0 ? (
        <Inicio onArchivo={() => archivo.current?.click()} ocupado={!!ocupado} />
      ) : (
        <div className="relative flex min-h-0 flex-1">
          <aside className="hidden w-[300px] shrink-0 flex-col overflow-y-auto border-r border-white/[0.07] bg-[#120E1A] lg:flex">{panelPaso}</aside>

          <main className="relative min-w-0 flex-1" onContextMenu={(e) => e.preventDefault()}>
            {pintar ? (
              <Lienzo
                proyecto={proyecto!}
                version={version}
                vista="pintar"
                herramienta={herramienta}
                activo={activo}
                radio={radio}
                piezas={null}
                explosion={0}
                verCortes={false}
                enfocada={null}
                oscuro
                alEmpezarTrazo={guardarPintura}
                alTerminarTrazo={() => set({ version: useSeparador.getState().version + 1 })}
                alRellenar={(tri) => rellenar(tri, activo)}
                alGotear={(tri) => {
                  setActivo(proyecto!.malla.color[tri])
                  setHerramienta('pincel')
                }}
              />
            ) : (
              <VisorPiezas />
            )}

            {pintar && (
              <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-[#17121F]/90 p-1 shadow-xl ring-1 ring-white/10 backdrop-blur">
                {HERRAMIENTAS.map(({ id, nombre: n, tecla, Icono }) => (
                  <button key={id} type="button" title={`${n} (${tecla})`} aria-label={n} onClick={() => setHerramienta(id)} className={`grid h-9 w-9 place-items-center rounded-xl transition ${herramienta === id ? 'bg-[#FF6A13] text-[#0D0A14]' : 'text-white/70 hover:bg-white/[0.08]'}`}>
                    <Icono size={17} />
                  </button>
                ))}
                <span className="mx-1 h-6 w-px bg-white/10" />
                <span className="h-6 w-6 rounded-full ring-2 ring-white/70" style={{ background: proyecto!.paleta[activo]?.color }} title="Color activo" />
                <label className="flex items-center gap-1.5 px-2 font-chakra text-[11px] text-white/60" title="Radio del pincel ([ y ])">
                  <input type="range" min={0.5} max={30} step={0.5} value={radio} onChange={(e) => setRadio(Number(e.target.value))} className="rango w-20" aria-label="Radio del pincel" />
                  {radio} mm
                </label>
              </div>
            )}

            {!pintar && paso === 'corte' && <CapaBoceto />}

            {!pintar && (
              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-2xl bg-[#17121F]/90 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
                <span className="font-chakra text-[11px] uppercase tracking-[0.15em] text-white/45">Despiece</span>
                <input type="range" min={0} max={1.5} step={0.01} value={useSeparador.getState().explosion} onChange={(e) => set({ explosion: Number(e.target.value) })} className="rango w-28 sm:w-40" aria-label="Despiece" />
              </div>
            )}

            {encima && (
              <div className="pointer-events-none absolute inset-3 grid place-items-center rounded-3xl border-2 border-dashed border-[#FF6A13] bg-[#FF6A13]/10">
                <p className="font-flemin text-xl">Suelta tu modelo</p>
              </div>
            )}
            {ocupado && (
              <div className="pointer-events-none absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-[#17121F]/95 px-4 py-2.5 text-[13px] shadow-xl ring-1 ring-white/10 lg:bottom-6">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-[#FF6A13]" /> {ocupado}
              </div>
            )}
            {aviso && !ocupado && (
              <button type="button" onClick={() => set({ aviso: null })} className={`absolute bottom-20 left-1/2 max-w-[92%] -translate-x-1/2 rounded-2xl px-4 py-2.5 text-left text-[13px] shadow-xl ring-1 lg:bottom-6 ${aviso.tipo === 'error' ? 'bg-[#3A1418] text-[#FFB4A8] ring-[#FF4D4D]/30' : aviso.tipo === 'ok' ? 'bg-[#0F2A22] text-[#9BF0CF] ring-[#1FBF8F]/30' : 'bg-[#17121F] text-white/85 ring-white/10'}`}>
                {aviso.texto}
              </button>
            )}
          </main>

          <aside className="hidden w-[310px] shrink-0 flex-col overflow-y-auto border-l border-white/[0.07] bg-[#120E1A] lg:flex">
            <PanelPiezas />
          </aside>

          {movil && (
            <div className="absolute inset-x-0 bottom-0 z-10 flex max-h-[60vh] flex-col rounded-t-3xl bg-[#120E1A] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10 lg:hidden">
              <button type="button" onClick={() => setMovil(null)} className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-white/20" aria-label="Cerrar panel" />
              <div className="min-h-0 flex-1 overflow-y-auto pb-2">{movil === 'piezas' ? <PanelPiezas /> : panelPaso}</div>
            </div>
          )}
        </div>
      )}

      {piezas.length > 0 && (
        <nav className="relative z-20 grid shrink-0 grid-cols-4 border-t border-white/[0.07] bg-[#120E1A] pb-[env(safe-area-inset-bottom)] lg:hidden">
          {[...pasos, ['piezas', 'Piezas', Layers] as const].map(([id, n, I]) => {
            const activoMovil = movil === id || (id !== 'piezas' && !movil && paso === id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id !== 'piezas') set({ paso: id as Paso })
                  setMovil(movil === id ? null : (id as Paso | 'piezas'))
                }}
                className={`flex h-14 flex-col items-center justify-center gap-1 text-[10.5px] ${activoMovil ? 'text-[#FF6A13]' : 'text-white/55'}`}
              >
                <I size={19} /> {n}
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}

/* ── Inicio ───────────────────────────────────────────────────────────── */

function Inicio({ onArchivo, ocupado }: { onArchivo: () => void; ocupado: boolean }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:py-16">
        <p className="font-chakra text-[12px] uppercase tracking-[0.3em] text-[#FFC23D]">Flemin Studio · Separador</p>
        <h1 className="mt-3 font-flemin text-[clamp(2rem,6vw,3.6rem)] leading-[1]">
          Separa tu modelo en <span className="bg-gradient-to-r from-[#FF6A13] via-[#FFC23D] to-[#2FA8FF] bg-clip-text text-transparent">piezas imprimibles</span>
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
          Por colores, por cortes en cualquier ángulo con conectores y tolerancia, por cuerpos sueltos o para que quepa en tu cama. Cada pieza sale cerrada y lista para CrealityPrint, Bambu Studio u Orca. Todo pasa en tu navegador: tu archivo no se sube a ningún lado.
        </p>
        <button
          type="button"
          onClick={onArchivo}
          disabled={ocupado}
          className="mt-8 flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center transition hover:border-[#FF6A13]/60 hover:bg-[#FF6A13]/[0.06] disabled:opacity-50"
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#FF6A13] text-[#0D0A14]">
            {ocupado ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#0D0A14]/30 border-t-[#0D0A14]" /> : <Upload size={24} />}
          </span>
          <span className="text-[16px] font-semibold">Abre o arrastra tu modelo</span>
          <span className="text-[13px] text-white/45">3MF pintado (Bambu, Orca, Prusa), STL, OBJ o GLB con textura · hasta 150 MB</span>
        </button>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            { I: Palette, t: 'Por color', d: 'Cada color pintado es una pieza: cortada por su frontera o incrustada a la profundidad que elijas.' },
            { I: Scissors, t: 'Por plano', d: 'Cortes en X, Y, Z o inclinados, con espigas, clavijas sueltas y holgura de encaje.' },
            { I: Grid2x2, t: 'Para tu cama', d: 'Si no cabe en la K2 Plus o la SPARKX i7, lo divide solo y lo reparte por la cama.' },
          ].map(({ I, t, d }) => (
            <div key={t} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.06]">
              <I size={20} className="text-[#FF6A13]" />
              <p className="mt-3 font-semibold">{t}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-white/50">{d}</p>
            </div>
          ))}
        </div>

        {MUESTRAS.length > 0 && (
          <>
            <p className="mt-10 font-chakra text-[11px] uppercase tracking-[0.2em] text-white/40">O prueba con una obra del estudio (solo vista)</p>
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {MUESTRAS.map((m: Modelo3D) => (
                <button key={m.id} type="button" disabled={ocupado} onClick={() => abrirCatalogo(m)} className="group overflow-hidden rounded-xl bg-white/[0.04] text-left ring-1 ring-white/[0.06] transition hover:ring-[#FF6A13]/50">
                  {rutaPortada(m) && <img src={rutaPortada(m)} alt="" className="aspect-square w-full object-cover transition group-hover:scale-105" loading="lazy" />}
                  <span className="block truncate px-2 py-1.5 text-[11px] text-white/65">{m.nombre}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Paso 1: color ────────────────────────────────────────────────────── */

function PanelColor(p: { activo: number; setActivo: (i: number) => void; herramienta: Herramienta; setHerramienta: (h: Herramienta) => void; radio: number; setRadio: (r: number) => void }) {
  const proyecto = useSeparador((s) => s.proyecto)
  const version = useSeparador((s) => s.version)
  const modo = useSeparador((s) => s.modoColor)
  const tapa = useSeparador((s) => s.tapa)
  const profundidad = useSeparador((s) => s.profundidad)
  const base = useSeparador((s) => s.base)
  const ocupado = useSeparador((s) => s.ocupado)
  const suavizado = useSeparador((s) => s.suavizado)
  const rellenoAngulo = useSeparador((s) => s.rellenoAngulo)
  const angulo = useSeparador((s) => s.angulo)
  const [altura, setAltura] = useState(10)
  const [nColores, setNColores] = useState(proyecto?.paleta.length ?? 6)
  const set = useSeparador.getState().set

  if (!proyecto)
    return (
      <Seccion titulo="Por color">
        <p className="text-[12.5px] leading-relaxed text-white/50">Estas piezas no traen pintura. Para separar por color, abre un 3MF pintado, un GLB con textura o un STL y píntalo aquí.</p>
      </Seccion>
    )

  // Superficie de cada color, para que se vea qué tanto cubre (`version`: la pintura cambia en el sitio).
  const cuenta = version >= 0 ? superficiePorColor(proyecto) : []
  const total = cuenta.reduce((a, b) => a + b, 0) || 1

  return (
    <>
      {proyecto.rgb && (
        <Seccion titulo="Colores de la textura">
          <Deslizador etiqueta="Filamentos" valor={nColores} min={2} max={12} paso={1} unidad="" onCambio={setNColores} />
          <Boton className="mt-3 w-full" disabled={!!ocupado || nColores === proyecto.paleta.length} onClick={() => reagrupar(nColores)}>
            <Palette size={15} /> Sacar {nColores} colores
          </Boton>
          <p className="mt-2 text-[11px] leading-snug text-white/40">El modelo trae textura (Meshy, escaneo): se agrupa en filamentos parecidos. Pocos colores, piezas grandes; muchos, más detalle y más cambios de filamento.</p>
        </Seccion>
      )}

      <Seccion titulo="1 · Pinta los colores">
        <ul className="space-y-1.5">
          {proyecto.paleta.map((f, i) => (
            <li key={i}>
              <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${p.activo === i ? 'bg-white/[0.08] ring-1 ring-white/20' : 'hover:bg-white/[0.04]'}`}>
                <label className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-white/20" style={{ background: f.color }} title="Cambiar color">
                  <input type="color" value={f.color} onChange={(e) => cambiarColorPaleta(i, e.target.value.toUpperCase())} className="absolute inset-0 opacity-0" />
                </label>
                <button type="button" onClick={() => (p.setActivo(i), p.setHerramienta(p.herramienta === 'girar' ? 'pincel' : p.herramienta))} className="min-w-0 flex-1 truncate text-left text-[12.5px]">
                  {f.nombre}
                </button>
                <span className="font-chakra text-[11px] tabular-nums text-white/40">{((cuenta[i] / total) * 100).toFixed(cuenta[i] / total < 0.1 ? 1 : 0)}%</span>
                <button type="button" title="Este color es el cuerpo" onClick={() => set({ base: i })} className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${base === i ? 'bg-[#FFC23D] text-[#0D0A14]' : 'text-white/30 hover:text-white/70'}`}>
                  Cuerpo
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILAMENTOS.filter((c) => !proyecto.paleta.some((f) => f.color.toUpperCase() === c.toUpperCase()))
            .slice(0, 8)
            .map((c) => (
              <button key={c} type="button" title="Agregar filamento" onClick={() => (agregarColor(c), p.setActivo(proyecto.paleta.length))} className="grid h-6 w-6 place-items-center rounded-full ring-1 ring-white/15 transition hover:scale-110" style={{ background: c }}>
                <Plus size={11} className="text-black/40" />
              </button>
            ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Boton onClick={() => limpiarPintura('bordes')}><Sparkles size={15} /> Enderezar bordes</Boton>
          <Boton onClick={() => limpiarPintura('manchas')}><Eraser size={15} /> Quitar manchas</Boton>
          <Boton onClick={masDetalle} titulo="Parte cada triángulo en cuatro para pintar detalles finos"><ZoomIn size={15} /> Más detalle</Boton>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-white/40">Pincel, relleno (F) y gotero (I) sobre el modelo. "Cuerpo" es el color que recibe a los demás.</p>
      </Seccion>

      <Seccion titulo="Relleno inteligente">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1">
          {([[false, 'Por color'], [true, 'Por ángulo']] as const).map(([v, n]) => (
            <button key={n} type="button" onClick={() => set({ rellenoAngulo: v })} className={`h-8 rounded-lg text-[12.5px] font-medium transition ${rellenoAngulo === v ? 'bg-white text-[#0D0A14]' : 'text-white/60'}`}>
              {n}
            </button>
          ))}
        </div>
        {rellenoAngulo && (
          <div className="mt-3">
            <Deslizador etiqueta="Se detiene en aristas de más de" valor={angulo} min={5} max={90} paso={1} unidad="°" onCambio={(v) => set({ angulo: v })} />
            <p className="mt-2 text-[11px] leading-snug text-white/40">El relleno se extiende por la superficie hasta un pliegue: pinta caras, tapas y zonas de una pieza mecánica de un toque.</p>
          </div>
        )}
        <div className="mt-4">
          <Deslizador etiqueta="Pintar por altura" valor={altura} min={0} max={100} paso={1} unidad="%" onCambio={setAltura} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Boton onClick={() => pintarAltura(altura / 100, true, p.activo)}><ArrowUpToLine size={15} /> Encima</Boton>
            <Boton onClick={() => pintarAltura(altura / 100, false, p.activo)}><ArrowDownToLine size={15} /> Debajo</Boton>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Frontera suave">
        <Deslizador etiqueta="Suavizado" valor={suavizado} min={0} max={10} paso={1} unidad="pasadas" onCambio={(v) => set({ suavizado: v })} />
        <Boton className="mt-3 w-full" onClick={fronteraSuave} disabled={!!ocupado}><Spline size={15} /> Suavizar frontera</Boton>
        <p className="mt-2 text-[11px] leading-snug text-white/40">La pintura va por triángulos y deja bordes en escalera. Esto los vuelve a trazar como curvas que cruzan los triángulos (unas 8 veces más fiel con 2 pasadas). Muchas pasadas redondean de más.</p>
      </Seccion>

      <Seccion titulo="2 · Cómo se separan">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1">
          {([['frontera', 'Por frontera'], ['incrustar', 'Incrustados']] as const).map(([id, n]) => (
            <button key={id} type="button" onClick={() => set({ modoColor: id })} className={`h-8 rounded-lg text-[12.5px] font-medium transition ${modo === id ? 'bg-white text-[#0D0A14]' : 'text-white/60'}`}>
              {n}
            </button>
          ))}
        </div>
        {modo === 'frontera' ? (
          <>
            <p className="mt-3 text-[11.5px] leading-snug text-white/45">Cada región se corta por su borde de pintura y el hueco se tapa. Sirve con cualquier malla.</p>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-[12.5px] text-white/70">Tapa del corte</span>
              <select value={tapa} onChange={(e) => set({ tapa: e.target.value as typeof tapa })} className="h-9 w-full rounded-lg bg-white/[0.06] px-2 text-[13px] text-white outline-none">
                <option value="auto" className="bg-[#17121F]">Auto (plana o abanico)</option>
                <option value="plana" className="bg-[#17121F]">Plana (cortes planos)</option>
                <option value="centroide" className="bg-[#17121F]">Centroide (cierra todo)</option>
                <option value="membrana" className="bg-[#17121F]">Membrana (película curva)</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <p className="mt-3 text-[11.5px] leading-snug text-white/45">Cada color se vuelve una placa metida en el cuerpo, con su hueco exacto: el color no atraviesa la figura. Necesita un modelo cerrado.</p>
            <div className="mt-3">
              <div className="mb-1.5 flex justify-between text-[12.5px] text-white/70">
                <span>Profundidad</span>
                <span className="font-chakra tabular-nums">{profundidad} mm</span>
              </div>
              <input type="range" min={0.4} max={6} step={0.2} value={profundidad} onChange={(e) => set({ profundidad: Number(e.target.value) })} className="rango w-full" aria-label="Profundidad" />
            </div>
          </>
        )}
      </Seccion>
      <div className="p-4">
        <Boton activo className="h-11 w-full !text-[14px]" disabled={!!ocupado || proyecto.paleta.length < 2} onClick={separarColor}>
          <Palette size={16} /> Separar por color
        </Boton>
      </div>
    </>
  )
}

/* ── Paso 2: corte ────────────────────────────────────────────────────── */

function Deslizador({ etiqueta, valor, min, max, paso, unidad, onCambio }: { etiqueta: string; valor: number; min: number; max: number; paso: number; unidad: string; onCambio: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[12.5px] text-white/70">
        <span>{etiqueta}</span>
        <span className="font-chakra tabular-nums">
          {+valor.toFixed(2)} {unidad}
        </span>
      </div>
      <input type="range" min={min} max={max} step={paso} value={valor} onChange={(e) => onCambio(Number(e.target.value))} className="rango w-full" aria-label={etiqueta} />
    </div>
  )
}

function PanelCorte() {
  const corte = useSeparador((s) => s.corte)
  const c = useSeparador((s) => s.conector)
  const ocupado = useSeparador((s) => s.ocupado)
  const seleccion = useSeparador((s) => s.seleccion)
  const impresora = useSeparador((s) => s.impresora)
  const set = useSeparador.getState().set
  const setCorte = (x: Partial<typeof corte>) => set({ corte: { ...corte, ...x } })
  const setC = (x: Partial<typeof c>) => set({ conector: { ...c, ...x } })
  const modoCorte = useSeparador((s) => s.modoCorte)
  const boceto = useSeparador((s) => s.boceto)
  const selector = (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1">
      {([['plano', 'Plano', Scissors], ['boceto', 'Boceto', PenLine]] as const).map(([id, n, I]) => (
        <button key={id} type="button" onClick={() => set({ modoCorte: id, boceto: [] })} className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-medium transition ${modoCorte === id ? 'bg-white text-[#0D0A14]' : 'text-white/60'}`}>
          <I size={14} /> {n}
        </button>
      ))}
    </div>
  )
  if (modoCorte === 'boceto')
    return (
      <>
        <Seccion titulo="Cómo cortar">{selector}</Seccion>
        <Seccion titulo="Corte con boceto">
          <p className="text-[12.5px] leading-relaxed text-white/60">Gira la vista para mirar de frente lo que quieres separar y toca alrededor para dibujar el contorno. Lo que quede dentro sale como pieza aparte, atravesando todo el modelo en esa dirección.</p>
          <p className="mt-3 font-chakra text-[12px] text-[#FFC23D]">{boceto.length} punto{boceto.length === 1 ? '' : 's'}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Boton onClick={() => set({ boceto: boceto.slice(0, -1) })} disabled={!boceto.length}><Undo2 size={15} /> Quitar punto</Boton>
            <Boton peligro onClick={() => set({ boceto: [] })} disabled={!boceto.length}><Trash2 size={15} /> Borrar</Boton>
          </div>
        </Seccion>
        <div className="p-4">
          <Boton activo className="h-11 w-full !text-[14px]" disabled={!!ocupado || boceto.length < 3} onClick={cortarConBoceto}>
            <PenLine size={16} /> Cortar con el boceto
          </Boton>
        </div>
      </>
    )
  return (
    <>
      <Seccion titulo="Cómo cortar">{selector}</Seccion>
      <Seccion titulo="Plano de corte">
        <div className="grid grid-cols-3 gap-1.5">
          {(['X', 'Y', 'Z'] as const).map((e, i) => (
            <Boton key={e} activo={corte.eje === i} onClick={() => setCorte({ eje: i as 0 | 1 | 2 })}>
              Eje {e}
            </Boton>
          ))}
        </div>
        <div className="mt-4 space-y-4">
          <Deslizador etiqueta="Posición" valor={corte.t * 100} min={0} max={100} paso={0.5} unidad="%" onCambio={(v) => setCorte({ t: v / 100 })} />
          <Deslizador etiqueta="Inclinación" valor={corte.inclinacion} min={-60} max={60} paso={1} unidad="°" onCambio={(v) => setCorte({ inclinacion: v })} />
          <Deslizador etiqueta="Giro" valor={corte.giro} min={-90} max={90} paso={1} unidad="°" onCambio={(v) => setCorte({ giro: v })} />
        </div>
        <p className="mt-3 text-[11.5px] text-white/40">{seleccion.length ? `Corta ${seleccion.length} pieza${seleccion.length > 1 ? 's' : ''} elegida${seleccion.length > 1 ? 's' : ''}.` : 'Sin elegir nada, corta todas las piezas que atraviese.'}</p>
      </Seccion>
      <Seccion titulo="Conectores">
        <select value={c.tipo} onChange={(e) => setC({ tipo: e.target.value as TipoConector })} className="h-9 w-full rounded-lg bg-white/[0.06] px-2 text-[13px] text-white outline-none" aria-label="Tipo de conector">
          {CONECTORES.map((x) => (
            <option key={x.id} value={x.id} className="bg-[#17121F]">
              {x.nombre}
            </option>
          ))}
        </select>
        {c.tipo !== 'ninguno' && (
          <div className="mt-4 space-y-4">
            <Deslizador etiqueta="Cantidad" valor={c.cantidad} min={1} max={6} paso={1} unidad="" onCambio={(v) => setC({ cantidad: v })} />
            <Deslizador etiqueta="Diámetro" valor={c.diametro} min={2} max={20} paso={0.5} unidad="mm" onCambio={(v) => setC({ diametro: v })} />
            <Deslizador etiqueta="Largo" valor={c.alto} min={2} max={20} paso={0.5} unidad="mm" onCambio={(v) => setC({ alto: v })} />
            <Deslizador etiqueta="Tolerancia por lado" valor={c.tolerancia} min={0} max={0.6} paso={0.05} unidad="mm" onCambio={(v) => setC({ tolerancia: v })} />
            {c.tipo !== 'clavija' && (
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1">
                {([['abajo', 'Espiga abajo'], ['arriba', 'Espiga arriba']] as const).map(([id, n]) => (
                  <button key={id} type="button" onClick={() => setC({ lado: id })} className={`h-8 rounded-lg text-[12px] font-medium transition ${c.lado === id ? 'bg-white text-[#0D0A14]' : 'text-white/60'}`}>
                    {n}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] leading-snug text-white/40">0,15–0,2 mm encaja a presión en PLA en la K2 Plus; 0,3 mm entra suelto. La punta lleva chaflán de 0,4 mm y el hueco 0,4 mm de fondo extra.</p>
          </div>
        )}
      </Seccion>
      <div className="space-y-2 p-4">
        <Boton activo className="h-11 w-full !text-[14px]" disabled={!!ocupado} onClick={cortar}>
          <Scissors size={16} /> Cortar
        </Boton>
        <div className="flex gap-2">
          <select value={impresora} onChange={(e) => set({ impresora: e.target.value })} className="h-9 min-w-0 flex-1 rounded-lg bg-white/[0.06] px-2 text-[12px] text-white outline-none" aria-label="Impresora">
            {IMPRESORAS.map((i) => (
              <option key={i.id} value={i.id} className="bg-[#17121F]">
                {i.nombre}
              </option>
            ))}
          </select>
          <Boton onClick={dividirCama} disabled={!!ocupado} titulo="Corta lo que no cabe en la cama, con conectores">
            <Grid2x2 size={15} /> Dividir
          </Boton>
        </div>
      </div>
    </>
  )
}

/* ── Paso 3: partes ───────────────────────────────────────────────────── */

function PanelPartes() {
  const ocupado = useSeparador((s) => s.ocupado)
  const seleccion = useSeparador((s) => s.seleccion)
  const [alto, setAlto] = useState('')
  return (
    <>
      <Seccion titulo="Partes">
        <div className="grid grid-cols-2 gap-2">
          <Boton onClick={cuerposSueltos} disabled={!!ocupado} titulo="Cada pedazo sin contacto con los demás, como pieza aparte"><Shapes size={15} /> Cuerpos sueltos</Boton>
          <Boton onClick={unir} disabled={!!ocupado || seleccion.length < 2} titulo="Une las piezas elegidas en una sola"><Combine size={15} /> Unir</Boton>
          <Boton peligro onClick={borrarSeleccion} disabled={!seleccion.length}><Trash2 size={15} /> Borrar</Boton>
          <Boton activo onClick={ordenarEnCama} disabled={!!ocupado} titulo="Reparte las piezas por la cama, apoyadas por su mejor cara"><Grid2x2 size={15} /> Ordenar en cama</Boton>
        </div>
        <p className="mt-3 text-[11.5px] leading-snug text-white/45">Toca piezas en el visor o en la lista (Mayús para varias). Lo que eliges es lo que se corta, se une o se exporta.</p>
      </Seccion>
      <Seccion titulo="Escala">
        <div className="flex gap-2">
          <input inputMode="decimal" placeholder="Alto total en mm" value={alto} onChange={(e) => setAlto(e.target.value)} className="h-9 min-w-0 flex-1 rounded-lg bg-white/[0.06] px-2.5 text-[13px] text-white outline-none focus:ring-1 focus:ring-[#FF6A13]/70" />
          <Boton onClick={() => escalarA(Number(alto.replace(',', '.')))} disabled={!Number(alto.replace(',', '.'))}>Aplicar</Boton>
        </div>
        <p className="mt-2 text-[11px] text-white/40">Los GLB llegan a 120 mm de alto: ajusta antes de cortar si lo quieres de otro tamaño.</p>
      </Seccion>
    </>
  )
}

/* ── Lista de piezas y exportación ────────────────────────────────────── */

function PanelPiezas() {
  const piezas = useSeparador((s) => s.piezas)
  const seleccion = useSeparador((s) => s.seleccion)
  const ocupado = useSeparador((s) => s.ocupado)
  const set = useSeparador.getState().set
  const total = piezas.reduce((s, p) => s + (p.visible ? gramos(medir(p.malla).volumen, medir(p.malla).area) : 0), 0)
  const protegida = piezas.some((p) => p.protegida)
  return (
    <>
      <Seccion titulo={`Piezas · ${piezas.length}`} extra={<span className="font-chakra text-[11px] text-[#FFC23D]">≈ {total.toFixed(0)} g PLA</span>}>
        <ul className="space-y-1.5">
          {piezas.map((p) => {
            const a = medir(p.malla)
            const t = [0, 1, 2].map((i) => a.max[i] - a.min[i])
            const sel = seleccion.includes(p.id)
            return (
              <li key={p.id} className={`rounded-xl px-2.5 py-2 transition ${sel ? 'bg-[#FF6A13]/15 ring-1 ring-[#FF6A13]/50' : 'bg-white/[0.03] hover:bg-white/[0.06]'}`}>
                <div className="flex items-center gap-2">
                  <label className="relative h-5 w-5 shrink-0 cursor-pointer overflow-hidden rounded-md ring-1 ring-white/20" style={{ background: p.color }} title="Color de la pieza">
                    <input type="color" value={p.color} onChange={(e) => editarPieza(p.id, { color: e.target.value })} className="absolute inset-0 opacity-0" />
                  </label>
                  <button
                    type="button"
                    onClick={(e) => set({ seleccion: e.shiftKey || e.metaKey || e.ctrlKey ? (sel ? seleccion.filter((x) => x !== p.id) : [...seleccion, p.id]) : [p.id] })}
                    className="min-w-0 flex-1 truncate text-left text-[12.5px] font-medium"
                  >
                    {p.nombre}
                  </button>
                  {p.protegida && <Lock size={12} className="shrink-0 text-white/35" />}
                  <button type="button" title={p.visible ? 'Ocultar' : 'Mostrar'} onClick={() => editarPieza(p.id, { visible: !p.visible })} className="text-white/40 hover:text-white">
                    {p.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
                <p className="mt-1 pl-7 font-chakra text-[11px] tabular-nums text-white/45">
                  {t.map((x) => x.toFixed(1)).join(' × ')} mm · {(a.volumen / 1000).toFixed(1)} cm³ ·{' '}
                  <span className={p.estanca ? 'text-[#1FBF8F]' : 'text-[#FFC23D]'}>{p.estanca ? 'cerrada' : 'abierta'}</span>
                </p>
              </li>
            )
          })}
        </ul>
      </Seccion>
      <Seccion titulo="Exportar">
        {protegida ? (
          <p className="flex items-start gap-2 text-[12px] leading-snug text-white/50"><Lock size={14} className="mt-0.5 shrink-0" /> Obra del catálogo: puedes separarla para ver cómo quedaría, pero no descargarla. Pídela desde su ficha.</p>
        ) : (
          <div className="space-y-2">
            {([
              ['3mf-montado', '3MF montado', 'Cada pieza en su sitio y su color: multicolor o ensamblado', Box],
              ['3mf-cama', '3MF en la cama', 'Cada pieza apoyada por su cara de corte y repartida', Grid2x2],
              ['stl-zip', 'STL por pieza (.zip)', 'Un STL por pieza, apoyadas en la cama', Download],
            ] as const).map(([f, n, d, I]) => (
              <button key={f} type="button" disabled={!!ocupado} onClick={() => exportar(f)} className="flex w-full items-start gap-3 rounded-xl bg-white/[0.04] p-3 text-left ring-1 ring-white/[0.06] transition hover:bg-white/[0.08] hover:ring-[#FF6A13]/40 disabled:opacity-50">
                <I size={17} className="mt-0.5 shrink-0 text-[#FF6A13]" />
                <span>
                  <span className="block text-[13px] font-semibold">{n}</span>
                  <span className="block text-[11.5px] leading-snug text-white/45">{d}</span>
                </span>
              </button>
            ))}
            <p className="text-[11px] text-white/40">Con piezas elegidas, solo se exportan esas.</p>
          </div>
        )}
      </Seccion>
    </>
  )
}

function BotonBarra({ children, titulo, onClick, disabled }: { children: ReactNode; titulo: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" title={titulo} aria-label={titulo} onClick={onClick} disabled={disabled} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/70 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-30">
      {children}
    </button>
  )
}

/**
 * Capa transparente sobre el visor para dibujar el boceto. "Dibujar" toma los
 * toques como puntos; "Girar" la aparta para mover la cámara.
 */
function CapaBoceto() {
  const modo = useSeparador((s) => s.modoCorte)
  const boceto = useSeparador((s) => s.boceto)
  const [dibujando, setDibujando] = useState(true)
  const capa = useRef<HTMLDivElement>(null)
  if (modo !== 'boceto') return null
  const r = capa.current?.getBoundingClientRect()
  const aPantalla = ([x, y]: [number, number]) => (r ? `${((x + 1) / 2) * r.width},${((1 - y) / 2) * r.height}` : '0,0')
  return (
    <>
      <div
        ref={capa}
        className={`absolute inset-0 ${dibujando ? 'cursor-crosshair' : 'pointer-events-none'}`}
        onClick={(e) => {
          const b = e.currentTarget.getBoundingClientRect()
          const p: [number, number] = [((e.clientX - b.left) / b.width) * 2 - 1, -(((e.clientY - b.top) / b.height) * 2 - 1)]
          useSeparador.getState().set({ boceto: [...useSeparador.getState().boceto, p] })
        }}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {boceto.length > 1 && <polygon points={boceto.map(aPantalla).join(' ')} fill="rgba(255,106,19,0.14)" stroke="#FF6A13" strokeWidth={2} strokeDasharray={boceto.length > 2 ? undefined : '6 4'} />}
          {boceto.map((p, i) => {
            const [x, y] = aPantalla(p).split(',').map(Number)
            return <circle key={i} cx={x} cy={y} r={i === 0 ? 6 : 4} fill={i === 0 ? '#FFC23D' : '#FF6A13'} />
          })}
        </svg>
      </div>
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-[#17121F]/90 p-1 shadow-xl ring-1 ring-white/10 backdrop-blur">
        {([[true, 'Dibujar', PenLine], [false, 'Girar vista', Rotate3d]] as const).map(([v, n, I]) => (
          <button key={n} type="button" onClick={() => setDibujando(v)} className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-medium transition ${dibujando === v ? 'bg-[#FF6A13] text-[#0D0A14]' : 'text-white/70 hover:bg-white/[0.08]'}`}>
            <I size={15} /> {n}
          </button>
        ))}
      </div>
    </>
  )
}
