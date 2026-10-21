import { useEffect, useRef, useState } from 'react'
import {
  Box, ChevronDown, Download, Grid3x3, Layers, Lightbulb, Magnet, Move, Printer, Redo2, RotateCw, Ruler, Scaling, Shapes, SlidersHorizontal,
  Sparkles, Undo2, X, Focus, Scan, FilePlus2, Wand2, Scissors,
} from 'lucide-react'
import type { Modelo3D } from '../../lib/catalogo'
import { abrirDelCatalogo, agregarPlantilla, enviarAlSeparador, navegacion, alternarHueco, apoyarEnCama, combinar, duplicar, eliminar, exportar, importar, nuevaEscena, ACEPTA } from './acciones.ts'
import { useEditor, type Herramienta, type Luz } from './estado.ts'
import { guardarEscena, leerEscena } from './guardado.ts'
import { PanelFormas, PanelImprimir, PanelObjetos, PanelPlantillas, PanelPropiedades } from './Paneles.tsx'
import { Vista } from './Vista.tsx'
import { camara } from './camara.ts'

/**
 * Flemin Studio · Editor 3D.
 *
 * Lo fácil de Tinkercad (formas, sólido/hueco, combinar), lo paramétrico de
 * Onshape (plantillas que se regeneran), los atajos y el outliner de Blender,
 * las luces de Spline y la preparación de un laminador (auto-orientar,
 * voladizos, cama de la K2 Plus), todo en el navegador.
 */
type PanelIzq = 'formas' | 'plantillas' | 'objetos'
type PanelDer = 'propiedades' | 'imprimir'
type PanelMovil = PanelIzq | PanelDer | null

const HERRAMIENTAS: { id: Herramienta; nombre: string; tecla: string; Icono: typeof Move }[] = [
  { id: 'mover', nombre: 'Mover', tecla: 'G', Icono: Move },
  { id: 'rotar', nombre: 'Rotar', tecla: 'R', Icono: RotateCw },
  { id: 'escalar', nombre: 'Escalar', tecla: 'S', Icono: Scaling },
  { id: 'medir', nombre: 'Medir', tecla: 'M', Icono: Ruler },
]
const LUCES: { id: Luz; nombre: string }[] = [
  { id: 'estudio', nombre: 'Estudio' },
  { id: 'atardecer', nombre: 'Atardecer' },
  { id: 'noche', nombre: 'Neón Flemin' },
  { id: 'neutra', nombre: 'Neutra' },
]
const REJILLAS = [0, 0.1, 0.5, 1, 5, 10]

export default function Editor({ inicial, onCerrar, onTaller, onSeparador }: { inicial?: Modelo3D; onCerrar: () => void; onTaller?: () => void; onSeparador?: () => void }) {
  const [izq, setIzq] = useState<PanelIzq>('formas')
  const [der, setDer] = useState<PanelDer>('propiedades')
  const [movil, setMovil] = useState<PanelMovil>(null)
  const [menuExportar, setMenuExportar] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)
  const listo = useRef(false)

  const herramienta = useEditor((s) => s.herramienta)
  const rejilla = useEditor((s) => s.rejilla)
  const luz = useEditor((s) => s.luz)
  const ocupado = useEditor((s) => s.ocupado)
  const aviso = useEditor((s) => s.aviso)
  const nodos = useEditor((s) => s.nodos)
  const seleccion = useEditor((s) => s.seleccion)
  const puedeDeshacer = useEditor((s) => s.pasado.length > 0)
  const puedeRehacer = useEditor((s) => s.futuro.length > 0)

  useEffect(() => {
    if (onSeparador) navegacion.separador = onSeparador
  }, [onSeparador])

  /* La escena anterior vuelve al abrir; la pieza del catálogo, si viene, se suma. */
  useEffect(() => {
    let vivo = true
    leerEscena().then(async (l) => {
      if (!vivo) return
      if (l?.length) useEditor.getState().cargar(l)
      listo.current = true
      if (inicial) await abrirDelCatalogo(inicial)
      else if (!l?.length) await agregarPlantilla('funda-encendedor', {})
      setTimeout(() => camara.ir('iso'), 350)
    })
    return () => {
      vivo = false
    }
  }, [inicial])

  useEffect(() => {
    if (!listo.current) return
    const t = setTimeout(() => guardarEscena(nodos), 600)
    return () => clearTimeout(t)
  }, [nodos])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => useEditor.getState().set({ aviso: null }), aviso.tipo === 'error' ? 6000 : 3200)
    return () => clearTimeout(t)
  }, [aviso])

  // En el móvil, elegir un objeto abre sus propiedades.
  useEffect(() => {
    if (seleccion.length && window.innerWidth < 1024) setDer('propiedades')
  }, [seleccion])

  /* Atajos de teclado (los de Blender, más los de siempre). */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return
      const s = useEditor.getState()
      const cmd = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (cmd && k === 'z') return e.preventDefault(), e.shiftKey ? s.rehacer() : s.deshacer()
      if (cmd && k === 'y') return e.preventDefault(), s.rehacer()
      if (cmd && k === 'd') return e.preventDefault(), duplicar()
      if (cmd && k === 'g') return e.preventDefault(), combinar('combinar')
      if (cmd && k === 'a') return e.preventDefault(), s.seleccionar(s.nodos.filter((n) => n.visible).map((n) => n.id))
      if (cmd) return
      if (k === 'g') s.set({ herramienta: 'mover' })
      else if (k === 'r') s.set({ herramienta: 'rotar' })
      else if (k === 's') s.set({ herramienta: 'escalar' })
      else if (k === 'm') s.set({ herramienta: herramienta === 'medir' ? 'mover' : 'medir' })
      else if (k === 'h') alternarHueco()
      else if (k === 'b') apoyarEnCama()
      else if (k === 'f' || k === '.') camara.encuadrar()
      else if (k === '1') camara.ir('frente')
      else if (k === '3') camara.ir('derecha')
      else if (k === '7') camara.ir('arriba')
      else if (k === '0' || k === '5') camara.ir('iso')
      else if (k === 'delete' || k === 'backspace' || k === 'x') eliminar()
      else if (k === 'escape') (s.seleccionar([]), s.set({ herramienta: s.herramienta === 'medir' ? 'mover' : s.herramienta }))
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [herramienta])

  // El editor ocupa la pantalla: la página de debajo no se desplaza.
  useEffect(() => {
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = antes
    }
  }, [])

  const set = useEditor.getState().set
  const panelIzq = izq === 'formas' ? <PanelFormas alImportar={() => archivo.current?.click()} /> : izq === 'plantillas' ? <PanelPlantillas /> : <PanelObjetos />
  const panelDer = der === 'propiedades' ? <PanelPropiedades /> : <PanelImprimir />

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#0D0A14] font-sans text-white"
      onDragOver={(e) => {
        e.preventDefault()
        setArrastrando(true)
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault()
        setArrastrando(false)
        if (e.dataTransfer.files.length) importar(e.dataTransfer.files)
      }}
    >
      <input ref={archivo} type="file" accept={ACEPTA} multiple hidden onChange={(e) => e.target.files && (importar(e.target.files), (e.target.value = ''))} />

      {/* ── Barra superior ─────────────────────────────────────────── */}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#120E1A] px-3">
        <div className="flex shrink-0 items-center gap-2 pr-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#FF6A13] to-[#FFC23D] font-flemin text-[15px] text-[#0D0A14]">F</span>
          <span className="hidden leading-none sm:block">
            <span className="block font-flemin text-[14px] tracking-wide">Flemin Studio</span>
            <span className="font-chakra text-[10px] uppercase tracking-[0.22em] text-white/40">Editor 3D</span>
          </span>
        </div>
        <div className="mx-1 hidden h-6 w-px bg-white/10 md:block" />
        <BotonBarra titulo="Nuevo (vacía la cama)" onClick={nuevaEscena}><FilePlus2 size={17} /></BotonBarra>
        <BotonBarra titulo="Importar archivo" onClick={() => archivo.current?.click()}><Layers size={17} /></BotonBarra>
        <BotonBarra titulo="Deshacer (⌘Z)" onClick={() => useEditor.getState().deshacer()} disabled={!puedeDeshacer}><Undo2 size={17} /></BotonBarra>
        <BotonBarra titulo="Rehacer (⇧⌘Z)" onClick={() => useEditor.getState().rehacer()} disabled={!puedeRehacer}><Redo2 size={17} /></BotonBarra>
        {onSeparador && (
          <button type="button" onClick={() => enviarAlSeparador(onSeparador)} disabled={!!ocupado} className="ml-1 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-white/65 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-40">
            <Scissors size={15} /> <span className="hidden md:inline">Separar piezas</span>
          </button>
        )}
        {onTaller && (
          <button type="button" onClick={onTaller} className="ml-1 hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-white/65 transition hover:bg-white/[0.07] hover:text-white lg:inline-flex">
            <Wand2 size={15} /> Pintar y separar
          </button>
        )}
        <div className="flex-1" />
        <div className="relative">
          <button type="button" onClick={() => setMenuExportar((v) => !v)} disabled={!!ocupado} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#FF6A13] px-3 text-[13px] font-semibold text-[#0D0A14] transition hover:bg-[#FF8A3D] disabled:opacity-50">
            <Download size={16} /> <span className="hidden sm:inline">Exportar</span> <ChevronDown size={14} />
          </button>
          {menuExportar && (
            <div className="absolute right-0 top-11 w-64 overflow-hidden rounded-xl bg-[#1A1424] py-1 shadow-2xl ring-1 ring-white/10" onMouseLeave={() => setMenuExportar(false)}>
              {([
                ['3mf', '3MF multicolor', 'Una pieza por color · CrealityPrint, Bambu, Orca'],
                ['stl', 'STL', 'Malla única, el formato universal'],
                ['glb', 'GLB', 'Para web, AR, Blender o Meshy'],
              ] as const).map(([f, n, d]) => (
                <button key={f} type="button" onClick={() => (setMenuExportar(false), exportar(f))} className="block w-full px-4 py-2.5 text-left transition hover:bg-white/[0.06]">
                  <span className="block text-[13px] font-semibold">{n}</span>
                  <span className="block text-[11.5px] text-white/45">{d}</span>
                </button>
              ))}
              <p className="border-t border-white/[0.07] px-4 py-2 text-[11px] text-white/40">Con objetos elegidos, solo se exportan esos.</p>
            </div>
          )}
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar el editor" className="grid h-9 w-9 place-items-center rounded-lg text-white/60 transition hover:bg-white/[0.07] hover:text-white">
          <X size={19} />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* ── Panel izquierdo (escritorio) ───────────────────────────── */}
        <aside className="hidden w-[280px] shrink-0 flex-col border-r border-white/[0.07] bg-[#120E1A] lg:flex">
          <Pestanas valor={izq} onCambio={setIzq} opciones={[['formas', 'Formas', Shapes], ['plantillas', 'Plantillas', Sparkles], ['objetos', 'Objetos', Box]]} />
          <div className="min-h-0 flex-1 overflow-y-auto">{panelIzq}</div>
        </aside>

        {/* ── Visor ──────────────────────────────────────────────────── */}
        <main className="relative min-w-0 flex-1">
          <Vista />

          {/* Herramientas flotantes */}
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
            <div className="pointer-events-auto flex items-center gap-1 rounded-2xl bg-[#17121F]/90 p-1 shadow-xl ring-1 ring-white/10 backdrop-blur">
              {HERRAMIENTAS.map(({ id, nombre, tecla, Icono }) => (
                <button key={id} type="button" title={`${nombre} (${tecla})`} aria-label={nombre} onClick={() => set({ herramienta: id })} className={`grid h-9 w-9 place-items-center rounded-xl transition ${herramienta === id ? 'bg-[#FF6A13] text-[#0D0A14]' : 'text-white/70 hover:bg-white/[0.08]'}`}>
                  <Icono size={17} />
                </button>
              ))}
              <span className="mx-1 h-6 w-px bg-white/10" />
              <label title="Ajuste a la rejilla" className="flex h-9 items-center gap-1 rounded-xl px-2 text-white/70 hover:bg-white/[0.08]">
                <Magnet size={16} className={rejilla ? 'text-[#FFC23D]' : ''} />
                <select value={rejilla} onChange={(e) => set({ rejilla: Number(e.target.value) })} className="bg-transparent font-chakra text-[12px] outline-none" aria-label="Paso de la rejilla">
                  {REJILLAS.map((r) => (
                    <option key={r} value={r} className="bg-[#17121F]">
                      {r ? `${r} mm` : 'libre'}
                    </option>
                  ))}
                </select>
              </label>
              <label title="Iluminación" className="hidden h-9 items-center gap-1 rounded-xl px-2 text-white/70 hover:bg-white/[0.08] sm:flex">
                <Lightbulb size={16} />
                <select value={luz} onChange={(e) => set({ luz: e.target.value as Luz })} className="bg-transparent text-[12px] outline-none" aria-label="Iluminación">
                  {LUCES.map((l) => (
                    <option key={l.id} value={l.id} className="bg-[#17121F]">
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Vistas de cámara */}
          <div className="absolute bottom-3 left-3 hidden flex-col gap-1 rounded-2xl bg-[#17121F]/90 p-1 ring-1 ring-white/10 backdrop-blur md:flex">
            {([['iso', 'Iso', '0'], ['frente', 'Frente', '1'], ['derecha', 'Derecha', '3'], ['arriba', 'Arriba', '7']] as const).map(([v, n, t]) => (
              <button key={v} type="button" title={`${n} (${t})`} onClick={() => camara.ir(v)} className="h-8 rounded-xl px-3 text-left font-chakra text-[11.5px] text-white/65 transition hover:bg-white/[0.08] hover:text-white">
                {n}
              </button>
            ))}
            <button type="button" title="Encuadrar (F)" onClick={() => camara.encuadrar()} className="grid h-8 place-items-center rounded-xl text-white/65 hover:bg-white/[0.08]"><Focus size={15} /></button>
            <button type="button" title="Alambre" onClick={() => set({ alambre: !useEditor.getState().alambre })} className="grid h-8 place-items-center rounded-xl text-white/65 hover:bg-white/[0.08]"><Grid3x3 size={15} /></button>
          </div>

          {herramienta === 'medir' && (
            <p className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-[12px] text-white/80 backdrop-blur">Toca dos puntos para medir · Esc para salir</p>
          )}

          {arrastrando && (
            <div className="pointer-events-none absolute inset-3 grid place-items-center rounded-3xl border-2 border-dashed border-[#FF6A13] bg-[#FF6A13]/10">
              <p className="font-flemin text-xl">Suelta tu archivo 3D</p>
            </div>
          )}

          {ocupado && (
            <div className="pointer-events-none absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-[#17121F]/95 px-4 py-2.5 text-[13px] shadow-xl ring-1 ring-white/10 lg:bottom-6">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-[#FF6A13]" /> {ocupado}
            </div>
          )}
          {aviso && !ocupado && (
            <button type="button" onClick={() => set({ aviso: null })} className={`absolute bottom-20 left-1/2 max-w-[90%] -translate-x-1/2 rounded-2xl px-4 py-2.5 text-left text-[13px] shadow-xl ring-1 lg:bottom-6 ${aviso.tipo === 'error' ? 'bg-[#3A1418] text-[#FFB4A8] ring-[#FF4D4D]/30' : aviso.tipo === 'ok' ? 'bg-[#0F2A22] text-[#9BF0CF] ring-[#1FBF8F]/30' : 'bg-[#17121F] text-white/85 ring-white/10'}`}>
              {aviso.texto}
            </button>
          )}

          {!nodos.length && !ocupado && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
              <div className="pointer-events-auto max-w-sm rounded-3xl bg-[#17121F]/90 p-6 text-center ring-1 ring-white/10 backdrop-blur">
                <p className="font-flemin text-[20px]">La cama está lista</p>
                <p className="mt-2 text-[13px] leading-relaxed text-white/55">Empieza con una forma, una plantilla lista para imprimir o tu propio archivo.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => (setIzq('plantillas'), setMovil('plantillas'))} className="rounded-full bg-[#FF6A13] px-4 py-2 text-[13px] font-semibold text-[#0D0A14]">Ver plantillas</button>
                  <button type="button" onClick={() => archivo.current?.click()} className="rounded-full bg-white/[0.08] px-4 py-2 text-[13px]">Importar</button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ── Panel derecho (escritorio) ─────────────────────────────── */}
        <aside className="hidden w-[300px] shrink-0 flex-col border-l border-white/[0.07] bg-[#120E1A] lg:flex">
          <Pestanas valor={der} onCambio={setDer} opciones={[['propiedades', 'Propiedades', SlidersHorizontal], ['imprimir', 'Imprimir', Printer]]} />
          <div className="min-h-0 flex-1 overflow-y-auto">{panelDer}</div>
        </aside>

        {/* ── Hoja inferior (móvil y tableta) ────────────────────────── */}
        {movil && (
          <div className="absolute inset-x-0 bottom-0 z-10 flex max-h-[58vh] flex-col rounded-t-3xl bg-[#120E1A] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10 lg:hidden">
            <button type="button" onClick={() => setMovil(null)} className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-white/20" aria-label="Cerrar panel" />
            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              {movil === 'formas' ? <PanelFormas alImportar={() => archivo.current?.click()} /> : movil === 'plantillas' ? <PanelPlantillas /> : movil === 'objetos' ? <PanelObjetos /> : movil === 'propiedades' ? <PanelPropiedades /> : <PanelImprimir />}
            </div>
          </div>
        )}
      </div>

      <nav className="relative z-20 grid shrink-0 grid-cols-5 border-t border-white/[0.07] bg-[#120E1A] pb-[env(safe-area-inset-bottom)] lg:hidden">
        {([
          ['formas', 'Formas', Shapes],
          ['plantillas', 'Plantillas', Sparkles],
          ['objetos', 'Objetos', Box],
          ['propiedades', 'Editar', SlidersHorizontal],
          ['imprimir', 'Imprimir', Printer],
        ] as const).map(([id, n, I]) => (
          <button key={id} type="button" onClick={() => setMovil(movil === id ? null : id)} className={`flex h-14 flex-col items-center justify-center gap-1 text-[10.5px] ${movil === id ? 'text-[#FF6A13]' : 'text-white/55'}`}>
            <I size={19} /> {n}
          </button>
        ))}
      </nav>
      <button type="button" title="Encuadrar" onClick={() => camara.encuadrar()} className="absolute bottom-[72px] right-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-[#17121F]/90 text-white/75 ring-1 ring-white/10 backdrop-blur lg:hidden" style={{ display: movil ? 'none' : undefined }}>
        <Scan size={18} />
      </button>
    </div>
  )
}

function BotonBarra({ children, titulo, onClick, disabled }: { children: React.ReactNode; titulo: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" title={titulo} aria-label={titulo} onClick={onClick} disabled={disabled} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/70 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-30">
      {children}
    </button>
  )
}

function Pestanas<T extends string>({ valor, onCambio, opciones }: { valor: T; onCambio: (v: T) => void; opciones: readonly (readonly [T, string, typeof Box])[] }) {
  return (
    <div className="flex shrink-0 gap-1 border-b border-white/[0.07] p-2">
      {opciones.map(([id, n, I]) => (
        <button key={id} type="button" onClick={() => onCambio(id)} className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-medium transition ${valor === id ? 'bg-white/[0.09] text-white' : 'text-white/50 hover:text-white/80'}`}>
          <I size={15} /> {n}
        </button>
      ))}
    </div>
  )
}
