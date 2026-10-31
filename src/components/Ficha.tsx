import { useEffect, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, FileText, Hand, Layers, ShoppingBag, Star, Wand2, X } from 'lucide-react'
import { Visor } from './Visor'
import type { Modo } from './Pieza'
import { CATEGORIAS, CORREO, enlaceCompra, peso, precio, rutaDescarga, triangulos, type Modelo3D } from '../lib/catalogo'
import { ICONO_CATEGORIA } from '../lib/iconos'
import { coste, estrellas, rareza } from '../lib/rareza'
import { enlaceStudio } from '../lib/studio'
import { ICONOS, MEDIDAS, OPCIONES_INICIALES, PALETAS, describirPedido, type IconoId, type OpcionesLlavero, type PaletaId } from '../lib/llavero'

const MODOS: { id: Modo; nombre: string }[] = [
  { id: 'textura', nombre: 'Textura' },
  { id: 'arcilla', nombre: 'Arcilla' },
  { id: 'malla', nombre: 'Malla' },
]

/**
 * La ficha de producto: el modelo en 3D de verdad, que se puede girar y
 * acercar, y los datos que un comprador de 3D mira antes de pagar — formatos,
 * triángulos, peso y licencia. El modo "Malla" está ahí porque es lo primero
 * que pide alguien que va a usar la pieza en un juego.
 */
export function Ficha({
  modelo,
  numero,
  total,
  onCerrar,
  onMover,
  onManos,
}: {
  modelo: Modelo3D
  numero: number
  total: number
  onCerrar: () => void
  onMover: (paso: 1 | -1) => void
  onManos: () => void
}) {
  const [modo, setModo] = useState<Modo>('textura')
  const [separado, setSeparado] = useState(false)
  const [opciones, setOpciones] = useState<OpcionesLlavero>({ ...OPCIONES_INICIALES, nombre: '' })
  // Lo que se dibuja: con el campo vacío se enseña el ejemplo, no una placa en blanco.
  const vista = { ...opciones, nombre: opciones.nombre.trim() || OPCIONES_INICIALES.nombre }
  const cat = CATEGORIAS.find((c) => c.id === modelo.categoria) ?? CATEGORIAS[0]
  const Icono = ICONO_CATEGORIA[cat.id]

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
      // Mientras se escribe el nombre, las flechas mueven el cursor, no la ficha.
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      if (e.key === 'ArrowRight') onMover(1)
      if (e.key === 'ArrowLeft') onMover(-1)
    }
    window.addEventListener('keydown', teclas)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', teclas)
      document.documentElement.style.overflow = ''
    }
  }, [onCerrar, onMover])

  const datos = [
    ...(modelo.personalizable
      ? [{ etiqueta: 'Tamaño', valor: '~19 mm de alto · largo según el nombre' }]
      : [
          { etiqueta: 'Triángulos', valor: triangulos(modelo.triangulos) },
          { etiqueta: 'Vista previa', valor: peso(modelo.peso) },
        ]),
    { etiqueta: 'Origen', valor: modelo.origen ?? '—' },
    { etiqueta: 'Licencia', valor: modelo.licencia ?? 'Uso personal y comercial' },
    ...(modelo.autor ? [{ etiqueta: 'Diseño original', valor: modelo.autor }] : []),
  ]

  const r = rareza(modelo)
  const etiqueta = 'mb-2 block font-chakra text-[11px] font-semibold uppercase tracking-[0.22em] text-[#FFC23D]'
  const chip = 'pestana px-3 py-1.5 font-chakra text-[12.5px] font-semibold transition-colors'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={modelo.nombre}
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#07050d]/75 text-white backdrop-blur-md md:items-center md:p-6"
      onClick={onCerrar}
    >
      <div
        className="entra cristal relative grid w-full max-w-6xl overflow-y-auto md:corte md:h-[min(92vh,800px)] md:grid-cols-[1.3fr_1fr] md:overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* El visor. En el móvil, el del llavero se queda arriba mientras se escribe el nombre. */}
        <div
          className={`relative overflow-hidden bg-[#0B0912] md:h-auto md:min-h-0 ${
            modelo.personalizable ? 'sticky top-0 z-10 h-[34vh] min-h-[220px] md:static' : 'h-[50vh] min-h-[320px]'
          }`}
        >
          <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(60% 55% at 50% 62%, ${cat.tinta}45, transparent 70%), linear-gradient(180deg, #120d24, #1b1238 45%, ${cat.desde}30 75%, #0B0912)` }} />
          <div aria-hidden className="rayos absolute left-1/2 top-[60%] h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2 opacity-[0.14]" style={{ background: `repeating-conic-gradient(from 0deg, ${cat.tinta} 0deg 2deg, transparent 2deg 14deg)`, maskImage: 'radial-gradient(circle, black 0%, transparent 40%)', WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 40%)' }} />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-[38%] opacity-40 [mask-image:linear-gradient(to_top,black,transparent)]" style={{ background: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px) 0 0 / 100% 40px, linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px) 0 0 / 40px 100%', transform: 'perspective(500px) rotateX(55deg)', transformOrigin: 'bottom' }} />
          <div aria-hidden className="hud-esquinas pointer-events-none absolute inset-0 z-[1]">
            <i /><i /><i /><i />
          </div>
          <Visor modelo={modelo} modo={modo} tinta={cat.tinta} zoom margen={1.25} opciones={modelo.personalizable ? vista : undefined} separado={separado} />

          {modelo.piezas && (
            <button
              type="button"
              onClick={() => setSeparado((v) => !v)}
              aria-pressed={separado}
              className="btn-juego absolute right-5 top-5 z-10 !h-9"
            >
              <Layers size={15} /> {separado ? 'Ver armado' : 'Ver por partes'}
            </button>
          )}

          <p className="absolute left-5 top-5 z-10 flex items-center gap-2 font-chakra text-[12px] font-semibold uppercase tracking-[0.2em] text-white/70">
            <span className="rareza px-2 py-0.5 text-[#0b0716]" style={{ background: r.sello }}>{r.nombre}</span>
            <span className="tabular-nums">No.{String(numero).padStart(3, '0')} / {String(total).padStart(3, '0')}</span>
          </p>

          <div className="corte-sm absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 bg-black/55 p-1 ring-1 ring-inset ring-white/15 backdrop-blur">
            {MODOS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModo(m.id)}
                aria-pressed={modo === m.id}
                className={`pestana px-4 py-1.5 font-chakra text-[12px] font-bold uppercase tracking-wider transition-colors ${modo === m.id ? 'bg-[#FFC23D] text-[#140f22]' : 'text-white/65 hover:text-white'}`}
              >
                {m.nombre}
              </button>
            ))}
          </div>

          {[
            { paso: -1 as const, Icono: ChevronLeft, lado: 'left-3', nombre: 'Modelo anterior' },
            { paso: 1 as const, Icono: ChevronRight, lado: 'right-3', nombre: 'Modelo siguiente' },
          ].map(({ paso, Icono: Flecha, lado, nombre }) => (
            <button
              key={paso}
              type="button"
              aria-label={nombre}
              onClick={() => onMover(paso)}
              className={`hexagono absolute ${lado} top-1/2 z-10 grid h-11 w-12 -translate-y-1/2 place-items-center bg-white/15 text-white backdrop-blur transition hover:bg-[#FFC23D] hover:text-[#140f22]`}
            >
              <Flecha size={18} />
            </button>
          ))}
        </div>

        {/* Los datos */}
        <div className="flex min-w-0 flex-col gap-6 overflow-x-hidden p-6 md:overflow-y-auto md:p-9">
          <div className="flex items-start justify-between gap-4">
            <p className="flex items-center gap-1.5 font-chakra text-[12px] font-semibold uppercase tracking-[0.2em] text-white/70">
              <Icono size={15} style={{ color: cat.tinta }} /> {cat.nombre}
            </p>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="-m-2 p-2 text-white/50 transition hover:rotate-90 hover:text-[#FFC23D]">
              <X size={20} />
            </button>
          </div>

          <div>
            <div className="flex items-start gap-3">
              <h2 className="nombre-figura flex-1 font-flemin text-[clamp(1.6rem,2.8vw,2.3rem)] leading-[1.05]">{modelo.nombre}</h2>
              <span className="hexagono relative grid h-14 w-16 shrink-0 place-items-center bg-gradient-to-b from-[#FFE08A] via-[#FFC23D] to-[#E07A10] font-flemin text-[24px] leading-none text-[#1a1033]" title="Coste en puntos de equipo">
                {coste(modelo)}
                <span className="absolute bottom-1 font-chakra text-[8px] font-bold tracking-[0.2em]">DP</span>
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="font-chakra text-[10.5px] uppercase tracking-[0.2em] text-white/55">Detalle</span>
              <span className="flex gap-0.5">
                {Array.from({ length: 7 }, (_, k) => (
                  <Star key={k} size={13} className={k < estrellas(modelo) ? 'fill-[#FFC23D] text-[#FFC23D] drop-shadow-[0_0_4px_rgba(255,194,61,0.8)]' : 'text-white/25'} />
                ))}
              </span>
            </div>
            <p className="mt-4 leading-relaxed text-white/70">{modelo.descripcion}</p>
          </div>

          {modelo.piezas && (
            <div>
              <p className={etiqueta}>Cómo se arma · {modelo.piezas.length} piezas</p>
              <ol className="flex flex-col gap-2">
                {modelo.piezas.map((p, i) => (
                  <li key={p.nombre} className="corte-sm flex gap-3 bg-white/[0.05] px-3.5 py-2.5 ring-1 ring-inset ring-white/10">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white ring-1 ring-black/10" style={{ background: p.color }}>
                      {i + 1}
                    </span>
                    <span className="text-[14px] leading-snug text-white/65">
                      <span className="font-semibold text-white">{p.nombre}.</span> {p.detalle}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {modelo.personalizable && (
            <div className="corte flex flex-col gap-5 bg-white/[0.04] p-4 ring-1 ring-inset ring-white/10">
              <label className="block">
                <span className={etiqueta}>
                  Tu nombre · {opciones.nombre.length}/{MEDIDAS.maxLetras}
                </span>
                <input
                  value={opciones.nombre}
                  maxLength={MEDIDAS.maxLetras}
                  placeholder={OPCIONES_INICIALES.nombre}
                  onChange={(e) => setOpciones((o) => ({ ...o, nombre: e.target.value }))}
                  className="corte-sm w-full bg-white/[0.07] px-3.5 py-2.5 text-base text-white outline-none ring-1 ring-inset ring-white/15 transition placeholder:text-white/30 focus:ring-[#FFC23D]/70"
                />
              </label>
              <div>
                <p className={etiqueta}>Icono</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(ICONOS) as IconoId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={opciones.icono === id}
                      onClick={() => setOpciones((o) => ({ ...o, icono: id }))}
                      className={`${chip} ${opciones.icono === id ? 'bg-[#FFC23D] text-[#140f22]' : 'bg-white/[0.07] text-white/75 hover:bg-white/15'}`}
                    >
                      {ICONOS[id]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className={etiqueta}>Colores</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(PALETAS) as PaletaId[]).map((id) => {
                    const p = PALETAS[id]
                    const activa = opciones.paleta === id
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={activa}
                        onClick={() => setOpciones((o) => ({ ...o, paleta: id }))}
                        className={`${chip} flex items-center gap-2 ${activa ? 'bg-white text-[#140f22]' : 'bg-white/[0.07] text-white/75 hover:bg-white/15'}`}
                      >
                        <span className="flex" aria-hidden>
                          {[p.placa, p.texto, p.icono].map((c) => (
                            <span key={c} className="-mr-1 h-3.5 w-3.5 rounded-full border-2 border-[#1a1033]" style={{ background: c }} />
                          ))}
                        </span>
                        <span className="ml-1">{p.nombre}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <div>
            <p className={etiqueta}>Formatos incluidos</p>
            <div className="flex flex-wrap gap-1.5">
              {modelo.formatos.map((f) => (
                <span key={f} className="chapa bg-white/10 font-chakra text-[12px] font-bold tracking-wider text-white ring-1 ring-inset ring-white/15">
                  {f}
                </span>
              ))}
            </div>
          </div>

          {modelo.documentos && modelo.documentos.length > 0 && (
            <div>
              <p className={etiqueta}>Planos y documentación</p>
              <ul className="flex flex-col gap-1.5">
                {modelo.documentos.map((d) => (
                  <li key={d.archivo}>
                    <a
                      href={rutaDescarga(d.archivo)}
                      target="_blank"
                      rel="noreferrer"
                      className="corte-sm flex items-center gap-2 bg-white/[0.05] px-3.5 py-2.5 text-[14px] text-white ring-1 ring-inset ring-white/10 transition hover:bg-white/10"
                    >
                      <FileText size={16} className="shrink-0 text-[#FFC23D]" />
                      <span className="flex-1">{d.nombre}</span>
                      <span className="font-mono text-[11px] uppercase text-white/40">{d.archivo.split('.').pop()}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-white/10 py-5" style={{ '--d': cat.desde, '--h': cat.hasta } as CSSProperties}>
            {datos.map((d) => (
              <div key={d.etiqueta}>
                <dt className="font-chakra text-[10.5px] font-semibold uppercase tracking-[0.2em] text-white/45">{d.etiqueta}</dt>
                <dd className="mt-0.5 text-[14px] font-medium text-white">{d.valor}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-auto flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <p className="bg-gradient-to-b from-[#FFE08A] to-[#FF8A2F] bg-clip-text font-flemin text-5xl leading-none text-transparent [filter:drop-shadow(0_3px_0_#1a1033)]">
                {precio(modelo.precio)}
                {modelo.precio > 0 && <span className="ml-1.5 font-chakra text-sm font-semibold tracking-widest text-white/45">USD</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {!modelo.personalizable && (
                  <a href={enlaceStudio(modelo)} className="btn-juego" title="Píntalo y míralo separado en piezas en Flemin Studio 3D">
                    <Wand2 size={16} /> <span className="hidden sm:inline">Pintar y separar</span>
                  </a>
                )}
                <button type="button" onClick={onManos} className="btn-juego">
                  <Hand size={16} /> <span className="hidden sm:inline">Ver con tus manos</span>
                </button>
              </div>
            </div>
            <a
              href={enlaceCompra(modelo, modelo.personalizable ? describirPedido(vista) : undefined)}
              target="_blank"
              rel="noreferrer"
              download={modelo.precio === 0 || undefined}
              className="btn-juego btn-fuego pedido-brillo !h-14 w-full !text-[15px]"
            >
              <ShoppingBag size={18} />
              {modelo.precio === 0 ? 'Descargar gratis' : modelo.personalizable ? 'Pedir por WhatsApp' : modelo.compra ? 'Comprar' : 'Comprar por WhatsApp'}
            </a>
            <p className="text-[12.5px] leading-relaxed text-white/50">
              Entrega digital tras el pago. ¿Otro formato o una versión para impresión 3D? Escribe a{' '}
              <a href={`mailto:${CORREO}?subject=${encodeURIComponent(`Modelo 3D · ${modelo.nombre}`)}`} className="underline underline-offset-4 hover:text-[#FFC23D]">
                {CORREO}
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
