import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft, Box, Check, Eraser, Hand, ImagePlus, Layers, LoaderCircle, MessageCircle, PaintBucket, Paintbrush,
  Pipette, Plus, Redo2, Rotate3d, Scissors, Search, ShieldCheck, Sparkles, Undo2, Upload, Wand2, X,
} from 'lucide-react'
import { Lienzo, type Herramienta } from './Lienzo'
import { CATALOGO, WHATSAPP, rutaModelo, rutaPortada, type Modelo3D } from '../../lib/catalogo'
import { FORMATOS, MAX_TRIANGULOS, aFilamentos, importarArchivo, importarGLB, importarURL, type Proyecto } from '../../lib/taller/importar'
import { areas, quitarIslas, region, subdividir, suavizar, topologia, type Filamento, type Pieza, type Tapa, type Topologia } from '../../lib/taller/malla'
import { FILAMENTOS } from '../../lib/taller/tresmf'
import { fotoA3D, iaDisponible, prepararFoto } from '../../lib/taller/ia'
import type { Pedido } from '../../lib/taller/separar.worker'

/**
 * El Taller 3D: una vitrina para jugar, no una fábrica de archivos.
 *
 * El visitante abre una pieza de la biblioteca, un modelo suyo o una foto
 * que la IA convierte en 3D; la pinta con filamentos y ve cómo se separaría
 * en piezas imprimibles, con los números de ingeniería de cada una. Nada se
 * descarga: si le gusta cómo queda, el botón es pedirla impresa.
 */
type Vista = 'pintar' | 'separar'
type Carga = { texto: string; progreso?: number; cancelar?: () => void }
type Resultado = { piezas: Pieza[]; original: number; ms: number }
type Instantanea = { color: Uint8Array; paleta: Filamento[] }

const DENSIDAD = { PLA: 1.24, PETG: 1.27, ABS: 1.04, TPU: 1.21 } as const
type Material = keyof typeof DENSIDAD

const TAPAS: { id: Tapa; nombre: string; texto: string }[] = [
  { id: 'auto', nombre: 'Auto', texto: 'Plana donde el corte es plano, abanico donde se alabea.' },
  { id: 'plana', nombre: 'Plana', texto: 'Triangulación por orejas sobre el plano medio del corte.' },
  { id: 'centroide', nombre: 'Centroide', texto: 'Abanico desde el centro del borde: cierra cualquier corte.' },
]

const HERRAMIENTAS: { id: Herramienta; nombre: string; tecla: string; Icono: typeof Paintbrush }[] = [
  { id: 'pincel', nombre: 'Pincel', tecla: 'B', Icono: Paintbrush },
  { id: 'relleno', nombre: 'Relleno', tecla: 'G', Icono: PaintBucket },
  { id: 'gotero', nombre: 'Gotero', tecla: 'I', Icono: Pipette },
  { id: 'girar', nombre: 'Girar', tecla: 'V', Icono: Rotate3d },
]

const mm = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1))
const cm3 = (mm3: number) => (mm3 / 1000).toFixed(mm3 < 10000 ? 2 : 1)

export default function Taller({ inicial, oscuro, onCerrar }: { inicial?: Modelo3D; oscuro: boolean; onCerrar: () => void }) {
  const [proyecto, setProyecto] = useState<Proyecto | null>(null)
  const [carga, setCarga] = useState<Carga | null>(null)
  const [error, setError] = useState('')
  const [vista, setVista] = useState<Vista>('pintar')

  // Pintar
  const [herramienta, setHerramienta] = useState<Herramienta>('pincel')
  const [activo, setActivo] = useState(0)
  const [radio, setRadio] = useState(3)
  const [version, setVersion] = useState(0)
  const [nFilamentos, setNFilamentos] = useState(6)
  const pila = useRef<{ atras: Instantanea[]; adelante: Instantanea[] }>({ atras: [], adelante: [] })
  const topo = useRef<{ pos: Float32Array; t: Topologia } | null>(null)

  // Separar
  const [tapa, setTapa] = useState<Tapa>('auto')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [explosion, setExplosion] = useState(0.5)
  const [verCortes, setVerCortes] = useState(true)
  const [enfocada, setEnfocada] = useState<number | null>(null)
  const [altura, setAltura] = useState(0)
  const [material, setMaterial] = useState<Material>('PLA')

  const abrir = useCallback(async (tarea: (señal: AbortSignal) => Promise<Proyecto>, texto: string) => {
    const control = new AbortController()
    setError('')
    setCarga({ texto, cancelar: () => control.abort() })
    try {
      // Un respiro para que el aviso de carga se pinte antes del trabajo pesado.
      await new Promise((r) => setTimeout(r, 30))
      const p = await tarea(control.signal)
      pila.current = { atras: [], adelante: [] }
      topo.current = null
      setProyecto(p)
      setResultado(null)
      setActivo(0)
      setVista('pintar')
      setNFilamentos(Math.max(1, p.paleta.length))
      let alto = 0
      for (let i = 2; i < p.malla.pos.length; i += 3) alto = Math.max(alto, p.malla.pos[i])
      setAltura(Math.round(alto))
    } catch (e) {
      if (!control.signal.aborted) setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCarga(null)
    }
  }, [])

  const abrirCatalogo = useCallback((m: Modelo3D) => abrir(() => importarURL(rutaModelo(m), m.nombre), `Abriendo ${m.nombre}…`), [abrir])
  const abrirArchivo = (f: File) => abrir(() => importarArchivo(f), `Leyendo ${f.name}…`)
  const abrirFoto = (f: File) =>
    abrir(async (señal) => {
      const imagen = await prepararFoto(f)
      setCarga((c) => c && { ...c, texto: 'Subiendo la foto…' })
      const glb = await fotoA3D(
        imagen,
        (e) => setCarga((c) => c && { ...c, texto: e.estado === 'PENDING' ? 'En cola…' : 'La IA está modelando tu foto…', progreso: e.progreso }),
        señal,
      )
      setCarga((c) => c && { ...c, texto: 'Preparando los colores…', progreso: 100 })
      return importarGLB(glb, f.name.replace(/\.[^.]+$/, '') || 'Tu foto en 3D', 'ia')
    }, 'Preparando la foto…')

  useEffect(() => {
    if (inicial) abrirCatalogo(inicial)
  }, [inicial, abrirCatalogo])

  /* ── Historia y topología ───────────────────────────────────────────── */

  const conTopologia = () => {
    if (!proyecto) throw new Error('sin proyecto')
    if (topo.current?.pos !== proyecto.malla.pos) topo.current = { pos: proyecto.malla.pos, t: topologia(proyecto.malla.pos) }
    return topo.current.t
  }
  const guardar = useCallback(() => {
    if (!proyecto) return
    const h = pila.current
    h.atras.push({ color: proyecto.malla.color.slice(), paleta: proyecto.paleta })
    if (h.atras.length > 40) h.atras.shift()
    h.adelante = []
  }, [proyecto])
  const viajar = useCallback(
    (desde: 'atras' | 'adelante') => {
      if (!proyecto) return
      const h = pila.current
      const destino = h[desde].pop()
      if (!destino) return
      h[desde === 'atras' ? 'adelante' : 'atras'].push({ color: proyecto.malla.color.slice(), paleta: proyecto.paleta })
      proyecto.malla.color.set(destino.color)
      if (destino.paleta !== proyecto.paleta) setProyecto({ ...proyecto, paleta: destino.paleta })
      setVersion((v) => v + 1)
    },
    [proyecto],
  )

  const transformar = (f: (t: Topologia) => number) => {
    if (!proyecto) return
    guardar()
    if (f(conTopologia()) === 0) pila.current.atras.pop() // nada cambió: no ensuciar la historia
    setVersion((v) => v + 1)
  }

  const cambiarPaleta = (paleta: Filamento[]) => proyecto && setProyecto({ ...proyecto, paleta })

  const reagrupar = (k: number) => {
    if (!proyecto?.rgb) return
    setNFilamentos(k)
    guardar()
    const r = aFilamentos(proyecto.rgb, proyecto.malla.pos, k)
    proyecto.malla.color.set(r.color)
    setProyecto({ ...proyecto, paleta: r.paleta })
    setActivo(0)
    setVersion((v) => v + 1)
  }

  const masDetalle = () => {
    if (!proyecto) return
    const malla = subdividir(proyecto.malla)
    const rgb = proyecto.rgb && new Float32Array(malla.color.length * 3).map((_, i) => proyecto.rgb![Math.floor(i / 12) * 3 + (i % 3)])
    pila.current = { atras: [], adelante: [] }
    setProyecto({ ...proyecto, malla, rgb })
    setVersion((v) => v + 1)
  }

  /* ── Separación en segundo plano ────────────────────────────────────── */

  const trabajador = useRef<Worker | null>(null)
  const pedido = useRef(0)
  useEffect(() => () => trabajador.current?.terminate(), [])

  useEffect(() => {
    if (vista !== 'separar' || !proyecto) return
    const w = (trabajador.current ??= new Worker(new URL('../../lib/taller/separar.worker.ts', import.meta.url), { type: 'module' }))
    const id = ++pedido.current
    setCalculando(true)
    w.onmessage = (e: MessageEvent<Resultado & { id: number }>) => {
      if (e.data.id !== pedido.current) return
      setResultado(e.data)
      setCalculando(false)
    }
    w.onerror = () => {
      setCalculando(false)
      setError('No se pudo separar esta malla')
    }
    const datos: Pedido = { id, pos: proyecto.malla.pos.slice(), color: proyecto.malla.color.slice(), tapa }
    w.postMessage(datos, [datos.pos.buffer, datos.color.buffer])
  }, [vista, proyecto, version, tapa])

  /* ── Teclado y arrastrar archivos ───────────────────────────────────── */

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      const mod = e.metaKey || e.ctrlKey
      if (e.key === 'Escape') return onCerrar()
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        return viajar(e.shiftKey ? 'adelante' : 'atras')
      }
      if (mod && e.key.toLowerCase() === 'y') return viajar('adelante')
      if (mod) return
      const h = HERRAMIENTAS.find((x) => x.tecla.toLowerCase() === e.key.toLowerCase())
      if (h) setHerramienta(h.id)
      if (e.key === '[') setRadio((r) => Math.max(0.5, +(r / 1.25).toFixed(2)))
      if (e.key === ']') setRadio((r) => Math.min(40, +(r * 1.25).toFixed(2)))
    }
    window.addEventListener('keydown', teclas)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', teclas)
      document.documentElement.style.overflow = ''
    }
  }, [onCerrar, viajar])

  const [encima, setEncima] = useState(false)
  const soltar = (f?: File) => {
    if (!f || carga) return
    if (f.type.startsWith('image/')) {
      if (iaDisponible) abrirFoto(f)
      else setError('El generador de foto a 3D estará disponible pronto.')
    } else abrirArchivo(f)
  }

  /* ── Datos derivados ────────────────────────────────────────────────── */

  const pos = proyecto?.malla.pos
  const areaTri = useMemo(() => (pos ? areas(pos) : null), [pos])
  const uso = useMemo(() => {
    if (!proyecto || !areaTri || version < 0) return []
    const s = new Float64Array(proyecto.paleta.length)
    let total = 0
    proyecto.malla.color.forEach((c, t) => {
      s[c] += areaTri[t]
      total += areaTri[t]
    })
    return [...s].map((x) => x / (total || 1))
    // `version` cuenta como dependencia: el pincel cambia los colores en el sitio.
  }, [proyecto, areaTri, version])

  const ingenieria = useMemo(() => {
    if (!resultado || !proyecto) return null
    let alto = 0
    for (const p of resultado.piezas) alto = Math.max(alto, p.max[2])
    const k = altura > 0 && alto > 0 ? altura / alto : 1
    const densidad = DENSIDAD[material]
    const piezas = resultado.piezas.map((p, i) => ({
      i,
      p,
      nombre: proyecto.paleta[p.color]?.nombre ?? `Color ${p.color + 1}`,
      color: proyecto.paleta[p.color]?.color ?? '#ccc',
      volumen: p.volumen * k ** 3,
      gramos: ((p.volumen * k ** 3) / 1000) * densidad,
      medidas: [0, 1, 2].map((e) => (p.max[e] - p.min[e]) * k),
    }))
    const suma = resultado.piezas.reduce((s, p) => s + p.volumen, 0)
    return {
      piezas,
      cerradas: resultado.piezas.every((p) => p.cerrada),
      conservacion: resultado.original > 0 ? suma / resultado.original : null,
      gramos: piezas.reduce((s, p) => s + p.gramos, 0),
      triangulos: resultado.piezas.reduce((s, p) => s + p.triangulos + p.tapas, 0),
      tapas: resultado.piezas.reduce((s, p) => s + p.tapas, 0),
    }
  }, [resultado, proyecto, altura, material])

  const pedirImpresa = () => {
    if (!proyecto) return
    const lineas = ingenieria
      ? ingenieria.piezas.map((x) => `• ${x.nombre} (${x.color}): ${x.gramos.toFixed(1)} g`).join('\n')
      : proyecto.paleta.map((f) => `• ${f.nombre} (${f.color})`).join('\n')
    const texto = `Hola, probé "${proyecto.nombre}" en el Taller 3D y lo quiero impreso${altura ? ` a ${altura} mm de alto` : ''} en ${material}:\n${lineas}`
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`
  }

  /* ── Interfaz ───────────────────────────────────────────────────────── */

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Taller 3D"
      className="fixed inset-0 z-50 flex flex-col bg-hueso"
      onDragOver={(e) => {
        e.preventDefault()
        setEncima(true)
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setEncima(false)}
      onDrop={(e) => {
        e.preventDefault()
        setEncima(false)
        soltar(e.dataTransfer.files[0])
      }}
    >
      {/* Barra */}
      <header className="flex shrink-0 items-center gap-3 border-b border-stone-200/80 bg-hueso/85 px-4 py-3 backdrop-blur-xl md:px-6">
        {proyecto ? (
          <button type="button" onClick={() => setProyecto(null)} className="pildora-clara !h-10 !w-10 !p-0" aria-label="Elegir otro modelo" title="Elegir otro modelo">
            <ArrowLeft size={17} />
          </button>
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-grafito text-hueso">
            <Wand2 size={18} />
          </span>
        )}
        <div className="min-w-0 leading-tight">
          <p className="text-[15px] font-semibold tracking-tight">Taller 3D</p>
          <p className="truncate text-[12px] text-stone-500">{proyecto ? proyecto.nombre : 'Pinta, separa en piezas y mira cómo quedaría impreso'}</p>
        </div>

        {proyecto && (
          <div className="mx-auto flex rounded-full border border-stone-200 bg-superficie p-1" role="tablist" aria-label="Modo">
            {([
              { id: 'pintar', nombre: 'Pintar', Icono: Paintbrush },
              { id: 'separar', nombre: 'Separar piezas', Icono: Scissors },
            ] as const).map(({ id, nombre, Icono }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={vista === id}
                onClick={() => setVista(id)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${vista === id ? 'bg-grafito text-hueso' : 'text-stone-600 hover:text-grafito'}`}
              >
                <Icono size={15} /> <span className={id === 'separar' ? 'hidden sm:inline' : ''}>{nombre}</span>
                {id === 'separar' && <span className="sm:hidden">Separar</span>}
              </button>
            ))}
          </div>
        )}

        <button type="button" onClick={onCerrar} aria-label="Cerrar el taller" className={`pildora-clara !h-10 !w-10 !p-0 ${proyecto ? '' : 'ml-auto'}`}>
          <X size={18} />
        </button>
      </header>

      {error && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[13px] text-red-700 dark:text-red-300 md:px-6">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Cerrar aviso">
            <X size={15} />
          </button>
        </div>
      )}

      {proyecto ? (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Visor */}
          <div className="relative h-[52vh] shrink-0 bg-gradient-to-b from-stone-50 to-stone-100 md:h-auto md:flex-1" onContextMenu={(e) => e.preventDefault()}>
            <Lienzo
              proyecto={proyecto}
              version={version}
              vista={vista}
              herramienta={herramienta}
              activo={activo}
              radio={radio}
              piezas={resultado?.piezas ?? null}
              explosion={explosion}
              verCortes={verCortes}
              enfocada={enfocada}
              oscuro={oscuro}
              alEmpezarTrazo={guardar}
              alTerminarTrazo={() => setVersion((v) => v + 1)}
              alRellenar={(tri) =>
                transformar((t) => {
                  if (proyecto.malla.color[tri] === activo) return 0
                  const r = region(proyecto.malla, t, tri)
                  for (const x of r) proyecto.malla.color[x] = activo
                  return r.length
                })
              }
              alGotear={(tri) => {
                setActivo(proyecto.malla.color[tri])
                setHerramienta('pincel')
              }}
            />

            {/* Barra flotante de herramientas */}
            {vista === 'pintar' && (
              <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1 rounded-full border border-stone-200 bg-superficie/90 p-1 shadow-sm backdrop-blur">
                {HERRAMIENTAS.map(({ id, nombre, tecla, Icono }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setHerramienta(id)}
                    aria-pressed={herramienta === id}
                    title={`${nombre} (${tecla})`}
                    className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${herramienta === id ? 'bg-grafito text-hueso' : 'text-stone-600 hover:bg-stone-100 hover:text-grafito'}`}
                  >
                    <Icono size={16} />
                  </button>
                ))}
                <span className="mx-1 h-5 w-px bg-stone-200" />
                <button type="button" onClick={() => viajar('atras')} title="Deshacer (⌘Z)" className="grid h-9 w-9 place-items-center rounded-full text-stone-600 hover:bg-stone-100 hover:text-grafito">
                  <Undo2 size={16} />
                </button>
                <button type="button" onClick={() => viajar('adelante')} title="Rehacer (⇧⌘Z)" className="grid h-9 w-9 place-items-center rounded-full text-stone-600 hover:bg-stone-100 hover:text-grafito">
                  <Redo2 size={16} />
                </button>
              </div>
            )}

            {vista === 'separar' && calculando && (
              <p className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full border border-stone-200 bg-superficie/90 px-3.5 py-2 text-[13px] text-stone-600 shadow-sm backdrop-blur">
                <LoaderCircle size={15} className="animate-spin" /> Separando y cerrando piezas…
              </p>
            )}

            <p className="pointer-events-none absolute bottom-4 left-4 hidden rounded-full border border-stone-200 bg-superficie/80 px-3 py-1.5 text-[12px] text-stone-500 backdrop-blur md:block">
              {vista === 'pintar' && herramienta !== 'girar' ? 'Clic izquierdo pinta · derecho gira · rueda acerca · [ ] tamaño' : 'Arrastra para girar · rueda para acercar'}
            </p>
            <p className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full border border-stone-200 bg-superficie/80 px-3 py-1.5 text-[12px] text-stone-500 backdrop-blur">
              <ShieldCheck size={13} /> Solo vista previa · sin descarga
            </p>
          </div>

          {/* Panel */}
          <aside className="min-h-0 flex-1 overflow-y-auto border-stone-200 bg-superficie md:w-[380px] md:flex-none md:border-l">
            {vista === 'pintar' ? (
              <div className="flex flex-col gap-6 p-5">
                {herramienta === 'pincel' && (
                  <Bloque titulo="Pincel" detalle={`${mm(radio)} mm`}>
                    <input type="range" min={-1} max={3.7} step={0.01} value={Math.log2(radio)} onChange={(e) => setRadio(+(2 ** +e.target.value).toFixed(2))} className="w-full accent-[rgb(var(--grafito))]" aria-label="Tamaño del pincel" />
                  </Bloque>
                )}

                <Bloque titulo="Filamentos" detalle={`${proyecto.paleta.length} de 16`}>
                  <ul className="flex flex-col gap-1.5">
                    {proyecto.paleta.map((f, i) => (
                      <li key={i}>
                        <div
                          className={`flex items-center gap-3 rounded-xl border px-2.5 py-2 transition-colors ${activo === i ? 'border-grafito bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}
                        >
                          <label className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ring-black/10" style={{ background: f.color }} title="Cambiar color">
                            <input
                              type="color"
                              value={f.color.toLowerCase()}
                              onChange={(e) => cambiarPaleta(proyecto.paleta.map((x, j) => (j === i ? { ...x, color: e.target.value.toUpperCase() } : x)))}
                              className="absolute inset-0 cursor-pointer opacity-0"
                              aria-label={`Color de ${f.nombre}`}
                            />
                          </label>
                          <button type="button" onClick={() => setActivo(i)} className="min-w-0 flex-1 text-left" aria-pressed={activo === i}>
                            <span className="flex items-center justify-between gap-2 text-[13.5px] font-medium">
                              <span className="truncate">{f.nombre}</span>
                              <span className="tabular-nums text-[12px] font-normal text-stone-500">{((uso[i] ?? 0) * 100).toFixed(1)} %</span>
                            </span>
                            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-stone-100">
                              <span className="block h-full rounded-full" style={{ width: `${(uso[i] ?? 0) * 100}%`, background: f.color }} />
                            </span>
                          </button>
                          {activo === i && <Check size={15} className="shrink-0 text-stone-500" />}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {proyecto.paleta.length < 16 && (
                    <button
                      type="button"
                      onClick={() => {
                        const usados = new Set(proyecto.paleta.map((f) => f.color))
                        const color = FILAMENTOS.find((c) => !usados.has(c)) ?? '#888888'
                        cambiarPaleta([...proyecto.paleta, { color, nombre: `Filamento ${proyecto.paleta.length + 1}` }])
                        setActivo(proyecto.paleta.length)
                      }}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 py-2 text-[13px] text-stone-600 transition hover:border-stone-400 hover:text-grafito"
                    >
                      <Plus size={15} /> Añadir filamento
                    </button>
                  )}
                </Bloque>

                {proyecto.rgb && (
                  <Bloque titulo="Colores desde la textura" detalle={`${nFilamentos}`}>
                    <input type="range" min={1} max={12} step={1} value={nFilamentos} onChange={(e) => reagrupar(+e.target.value)} className="w-full accent-[rgb(var(--grafito))]" aria-label="Número de filamentos" />
                    <p className="mt-1.5 text-[12px] leading-relaxed text-stone-500">Agrupa la textura en los filamentos que tendría tu impresora (AMS, MMU…). Rehace la pintura.</p>
                  </Bloque>
                )}

                <Bloque titulo="Limpieza">
                  <div className="grid grid-cols-2 gap-2">
                    <Accion Icono={Sparkles} onClick={() => transformar((t) => suavizar(proyecto.malla, t, 4))}>Suavizar bordes</Accion>
                    <Accion Icono={Eraser} onClick={() => transformar((t) => quitarIslas(proyecto.malla, t, Math.max(12, Math.round(proyecto.malla.color.length / 2500))))}>
                      Quitar manchas
                    </Accion>
                    {proyecto.malla.color.length * 4 <= MAX_TRIANGULOS && (
                      <Accion Icono={Layers} onClick={masDetalle} ancho>
                        Más detalle para pintar · {((proyecto.malla.color.length * 4) / 1000).toFixed(0)} K triángulos
                      </Accion>
                    )}
                  </div>
                </Bloque>

                <Datos
                  filas={[
                    ['Triángulos', proyecto.malla.color.length.toLocaleString('es')],
                    ['Origen', proyecto.origen === 'catalogo' ? 'Biblioteca' : proyecto.origen === 'ia' ? 'Foto con IA' : 'Tu archivo (solo en tu navegador)'],
                  ]}
                />

                <button type="button" onClick={() => setVista('separar')} className="pildora-negra w-full !py-3">
                  <Scissors size={16} /> Ver separación en piezas
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-6 p-5">
                {ingenieria ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <Cifra valor={String(ingenieria.piezas.length)} etiqueta="piezas" />
                      <Cifra valor={`${ingenieria.gramos.toFixed(ingenieria.gramos < 100 ? 1 : 0)} g`} etiqueta={material} />
                      <Cifra valor={ingenieria.cerradas ? '100 %' : 'Revisar'} etiqueta="cerradas" ok={ingenieria.cerradas} />
                    </div>
                    <p className="-mt-3 text-[12px] leading-relaxed text-stone-500">
                      Cada color se corta por su frontera de pintura y se tapa: {ingenieria.tapas.toLocaleString('es')} triángulos de cierre, todas las aristas compartidas por dos caras opuestas
                      {ingenieria.conservacion !== null && ` · volumen conservado ${(ingenieria.conservacion * 100).toFixed(2)} %`} · {resultado!.ms.toFixed(0)} ms.
                    </p>
                  </>
                ) : (
                  <p className="flex items-center gap-2 text-[13px] text-stone-500">
                    <LoaderCircle size={15} className="animate-spin" /> Calculando piezas…
                  </p>
                )}

                <Bloque titulo="Despiece" detalle={`${Math.round(explosion * 100)} %`}>
                  <input type="range" min={0} max={1} step={0.01} value={explosion} onChange={(e) => setExplosion(+e.target.value)} className="w-full accent-[rgb(var(--grafito))]" aria-label="Separación del despiece" />
                  <label className="mt-3 flex items-center gap-2.5 text-[13px] text-stone-600">
                    <input type="checkbox" checked={verCortes} onChange={(e) => setVerCortes(e.target.checked)} className="accent-[#FF5A1F]" />
                    Resaltar las caras de corte
                  </label>
                </Bloque>

                <Bloque titulo="Cierre de los cortes">
                  <div className="flex rounded-full border border-stone-200 p-1">
                    {TAPAS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTapa(t.id)}
                        aria-pressed={tapa === t.id}
                        className={`flex-1 rounded-full py-1.5 text-[13px] font-medium transition-colors ${tapa === t.id ? 'bg-grafito text-hueso' : 'text-stone-600 hover:text-grafito'}`}
                      >
                        {t.nombre}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-stone-500">{TAPAS.find((t) => t.id === tapa)!.texto}</p>
                </Bloque>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-medium text-stone-500">Altura impresa (mm)</span>
                    <input
                      type="number"
                      min={5}
                      max={500}
                      value={altura || ''}
                      onChange={(e) => setAltura(Math.max(0, Math.min(500, +e.target.value)))}
                      className="w-full rounded-xl border border-stone-200 bg-superficie px-3 py-2 text-sm tabular-nums outline-none focus:border-stone-400"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-medium text-stone-500">Material</span>
                    <select value={material} onChange={(e) => setMaterial(e.target.value as Material)} className="w-full rounded-xl border border-stone-200 bg-superficie px-3 py-2 text-sm outline-none focus:border-stone-400">
                      {Object.entries(DENSIDAD).map(([m, d]) => (
                        <option key={m} value={m}>
                          {m} · {d} g/cm³
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {ingenieria && (
                  <Bloque titulo="Piezas">
                    <ul className="flex flex-col gap-1.5" onMouseLeave={() => setEnfocada(null)}>
                      {ingenieria.piezas.map((x) => (
                        <li
                          key={x.i}
                          onMouseEnter={() => setEnfocada(x.i)}
                          onClick={() => setEnfocada((f) => (f === x.i ? null : x.i))}
                          className={`cursor-default rounded-xl border px-3 py-2.5 transition-colors ${enfocada === x.i ? 'border-grafito bg-stone-50' : 'border-stone-200'}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="h-4 w-4 shrink-0 rounded-[5px] ring-1 ring-black/10" style={{ background: x.color }} />
                            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{x.nombre}</span>
                            <span className="text-[13px] font-semibold tabular-nums">{x.gramos.toFixed(1)} g</span>
                          </div>
                          <dl className="mt-1.5 grid grid-cols-3 gap-x-2 text-[11.5px] tabular-nums text-stone-500">
                            <div><dt className="sr-only">Volumen</dt><dd>{cm3(x.volumen)} cm³</dd></div>
                            <div><dt className="sr-only">Medidas</dt><dd>{x.medidas.map(mm).join('×')}</dd></div>
                            <div className="text-right">
                              <dt className="sr-only">Estado</dt>
                              <dd className={x.p.cerrada ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}>{x.p.cerrada ? '✓ cerrada' : '⚠ abierta'}</dd>
                            </div>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  </Bloque>
                )}

                <a href={pedirImpresa()} target="_blank" rel="noreferrer" className="pildora-negra w-full !py-3">
                  <MessageCircle size={16} /> Lo quiero impreso así
                </a>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <Inicio onCatalogo={abrirCatalogo} onArchivo={soltar} />
      )}

      {/* Carga */}
      {carga && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-hueso/70 backdrop-blur-sm">
          <div className="entra w-[min(90vw,360px)] rounded-3xl border border-stone-200 bg-superficie p-6 text-center shadow-xl">
            <LoaderCircle size={26} className="mx-auto animate-spin text-stone-400" />
            <p className="mt-4 text-[15px] font-medium">{carga.texto}</p>
            {carga.progreso !== undefined && (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-grafito transition-[width] duration-700" style={{ width: `${Math.max(4, carga.progreso)}%` }} />
              </div>
            )}
            {carga.cancelar && (
              <button type="button" onClick={carga.cancelar} className="mt-5 text-[13px] text-stone-500 underline underline-offset-4 hover:text-grafito">
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {encima && (
        <div className="pointer-events-none absolute inset-3 z-30 grid place-items-center rounded-[28px] border-2 border-dashed border-grafito/40 bg-hueso/80 backdrop-blur-sm">
          <p className="text-lg font-semibold tracking-tight">Suelta tu modelo o tu foto</p>
        </div>
      )}
    </div>
  )
}

/* ── Pantalla de inicio: de dónde sale la pieza ─────────────────────────── */

function Inicio({ onCatalogo, onArchivo }: { onCatalogo: (m: Modelo3D) => void; onArchivo: (f?: File) => void }) {
  const [q, setQ] = useState('')
  const piezas = useMemo(() => {
    const t = q.trim().toLowerCase()
    return CATALOGO.filter((m) => !m.personalizable && (!t || m.nombre.toLowerCase().includes(t)))
  }, [q])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-8 md:grid-cols-[1.5fr_1fr] md:px-8 md:py-12">
        <section className="entra">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Nuestros proyectos</h2>
              <p className="mt-1 text-[14px] text-stone-500">Elige una pieza, píntala con filamentos y mírala separada en piezas imprimibles.</p>
            </div>
            <label className="flex items-center gap-2 rounded-full border border-stone-200 bg-superficie px-3.5">
              <Search size={15} className="text-stone-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar en la biblioteca" className="w-36 bg-transparent py-2 text-sm outline-none placeholder:text-stone-400" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {piezas.map((m) => {
              const portada = rutaPortada(m)
              return (
                <button key={m.id} type="button" onClick={() => onCatalogo(m)} className="group text-left">
                  <div className="tarjeta-img aspect-square overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-b from-stone-50 to-stone-100">
                    {portada ? (
                      <img src={portada} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full place-items-center text-stone-300">
                        <Box size={28} />
                      </span>
                    )}
                  </div>
                  <p className="mt-2 truncate text-[13px] font-medium">{m.nombre}</p>
                </button>
              )
            })}
          </div>
        </section>

        <div className="flex flex-col gap-4 md:sticky md:top-0 md:self-start">
          <Fuente
            Icono={Upload}
            titulo="Tu modelo"
            texto={`Arrastra un ${FORMATOS.join(', ')}. Lee la pintura de Bambu Studio, OrcaSlicer y PrusaSlicer. Se procesa en tu navegador: no se sube ni se guarda.`}
            aceptar={FORMATOS.join(',')}
            onArchivo={onArchivo}
          />
          <Fuente
            Icono={ImagePlus}
            titulo="Tu foto en 3D"
            texto={
              iaDisponible
                ? 'Sube la foto de un objeto o personaje y la IA lo modela en 3D en un par de minutos, para pintarlo y verlo en piezas.'
                : 'Pronto: sube una foto y la IA la convierte en un modelo 3D para pintarlo aquí mismo.'
            }
            aceptar="image/png,image/jpeg,image/webp"
            onArchivo={onArchivo}
            desactivado={!iaDisponible}
            etiqueta="IA"
          />
          <div className="rounded-3xl border border-stone-200 bg-superficie p-5 text-[13px] leading-relaxed text-stone-500">
            <p className="flex items-center gap-2 font-medium text-grafito">
              <Hand size={15} /> Cómo se usa
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Pinta con el pincel, el relleno o el gotero.</li>
              <li>Pasa a <b className="font-medium text-grafito">Separar piezas</b>: cada color se corta y se cierra como sólido.</li>
              <li>Mira volumen, medidas y gramos de cada pieza, y pídela impresa.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Piezas pequeñas de interfaz ─────────────────────────────────────────── */

function Fuente({
  Icono, titulo, texto, aceptar, onArchivo, desactivado, etiqueta,
}: { Icono: typeof Upload; titulo: string; texto: string; aceptar: string; onArchivo: (f?: File) => void; desactivado?: boolean; etiqueta?: string }) {
  return (
    <label
      className={`entra group relative flex flex-col gap-3 rounded-3xl border-2 border-dashed p-5 transition-colors ${
        desactivado ? 'cursor-not-allowed border-stone-200 opacity-60' : 'cursor-pointer border-stone-300 hover:border-grafito/50 hover:bg-superficie'
      }`}
    >
      <span className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-grafito text-hueso">
          <Icono size={18} />
        </span>
        <span className="text-[16px] font-semibold tracking-tight">{titulo}</span>
        {etiqueta && <span className="ml-auto rounded-full border border-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-500">{desactivado ? 'Próximamente' : etiqueta}</span>}
      </span>
      <span className="text-[13px] leading-relaxed text-stone-500">{texto}</span>
      <input
        type="file"
        accept={aceptar}
        disabled={desactivado}
        className="sr-only"
        onChange={(e) => {
          onArchivo(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </label>
  )
}

function Bloque({ titulo, detalle, children }: { titulo: string; detalle?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">{titulo}</h3>
        {detalle && <span className="text-[12px] tabular-nums text-stone-500">{detalle}</span>}
      </div>
      {children}
    </section>
  )
}

function Accion({ Icono, onClick, children, ancho }: { Icono: typeof Upload; onClick: () => void; children: ReactNode; ancho?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-[13px] text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 active:scale-[0.98] ${ancho ? 'col-span-2' : ''}`}
    >
      <Icono size={15} /> {children}
    </button>
  )
}

function Cifra({ valor, etiqueta, ok }: { valor: string; etiqueta: string; ok?: boolean }) {
  return (
    <div className="rounded-2xl border border-stone-200 px-3 py-3">
      <p className={`text-lg font-semibold tabular-nums tracking-tight ${ok === false ? 'text-amber-600' : ''}`}>{valor}</p>
      <p className="text-[11.5px] text-stone-500">{etiqueta}</p>
    </div>
  )
}

function Datos({ filas }: { filas: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-stone-200 p-4">
      {filas.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11.5px] text-stone-500">{k}</dt>
          <dd className="mt-0.5 text-[13px] font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
