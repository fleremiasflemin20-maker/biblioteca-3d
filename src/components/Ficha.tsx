import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, FileText, Hand, Layers, X } from 'lucide-react'
import { Visor } from './Visor'
import type { Modo } from './Pieza'
import { CATEGORIAS, CORREO, enlaceCompra, peso, precio, rutaDescarga, triangulos, type Modelo3D } from '../lib/catalogo'
import { ICONO_CATEGORIA } from '../lib/iconos'
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

  const etiqueta = 'mb-2 block text-[12px] font-medium text-stone-500'
  const chip = 'rounded-full border px-3 py-1.5 text-[13px] transition-colors'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={modelo.nombre}
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 backdrop-blur-sm md:items-center md:p-6"
      onClick={onCerrar}
    >
      <div
        className="entra relative grid w-full max-w-6xl overflow-y-auto bg-superficie shadow-2xl ring-1 ring-stone-200/60 md:h-[min(92vh,780px)] md:grid-cols-[1.3fr_1fr] md:overflow-hidden md:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* El visor. En el móvil, el del llavero se queda arriba mientras se escribe el nombre. */}
        <div
          className={`relative bg-gradient-to-b from-stone-50 to-stone-100 md:h-auto md:min-h-0 ${
            modelo.personalizable ? 'sticky top-0 z-10 h-[34vh] min-h-[220px] md:static' : 'h-[50vh] min-h-[320px]'
          }`}
        >
          <div className="absolute inset-0" style={{ background: `radial-gradient(55% 45% at 50% 88%, ${cat.punto}1f, transparent 70%)` }} aria-hidden />
          <Visor modelo={modelo} modo={modo} tinta={cat.tinta} zoom margen={1.25} opciones={modelo.personalizable ? vista : undefined} separado={separado} />

          {modelo.piezas && (
            <button
              type="button"
              onClick={() => setSeparado((v) => !v)}
              aria-pressed={separado}
              className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-stone-200 bg-superficie/90 px-3 py-1.5 text-[13px] font-medium text-grafito shadow-sm backdrop-blur transition hover:bg-superficie"
            >
              <Layers size={15} /> {separado ? 'Ver armado' : 'Ver por partes'}
            </button>
          )}

          <p className="absolute left-4 top-4 rounded-full border border-stone-200 bg-superficie/80 px-2.5 py-1 text-[12px] tabular-nums text-stone-500 backdrop-blur">
            {String(numero).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </p>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 rounded-full border border-stone-200 bg-superficie/90 p-1 shadow-sm backdrop-blur">
            {MODOS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModo(m.id)}
                aria-pressed={modo === m.id}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${modo === m.id ? 'bg-grafito text-hueso' : 'text-stone-600 hover:text-grafito'}`}
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
              className={`absolute ${lado} top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-stone-200 bg-superficie/90 text-stone-700 shadow-sm backdrop-blur transition hover:bg-superficie`}
            >
              <Flecha size={18} />
            </button>
          ))}
        </div>

        {/* Los datos */}
        <div className="flex flex-col gap-6 p-6 md:overflow-y-auto md:p-9">
          <div className="flex items-start justify-between gap-4">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-stone-500">
              <Icono size={15} style={{ color: cat.punto }} /> {cat.nombre}
            </p>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="-m-2 rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-grafito">
              <X size={20} />
            </button>
          </div>

          <div>
            <h2 className="text-[clamp(1.75rem,3vw,2.4rem)] font-semibold leading-[1.08] tracking-[-0.03em]">{modelo.nombre}</h2>
            <p className="mt-3 leading-relaxed text-stone-600">{modelo.descripcion}</p>
          </div>

          {modelo.piezas && (
            <div>
              <p className={etiqueta}>Cómo se arma · {modelo.piezas.length} piezas</p>
              <ol className="flex flex-col gap-2">
                {modelo.piezas.map((p, i) => (
                  <li key={p.nombre} className="flex gap-3 rounded-xl border border-stone-200 px-3.5 py-2.5">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white ring-1 ring-black/10" style={{ background: p.color }}>
                      {i + 1}
                    </span>
                    <span className="text-[14px] leading-snug text-stone-600">
                      <span className="font-medium text-grafito">{p.nombre}.</span> {p.detalle}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {modelo.personalizable && (
            <div className="flex flex-col gap-5 rounded-2xl border border-stone-200 p-4">
              <label className="block">
                <span className={etiqueta}>
                  Tu nombre · {opciones.nombre.length}/{MEDIDAS.maxLetras}
                </span>
                <input
                  value={opciones.nombre}
                  maxLength={MEDIDAS.maxLetras}
                  placeholder={OPCIONES_INICIALES.nombre}
                  onChange={(e) => setOpciones((o) => ({ ...o, nombre: e.target.value }))}
                  className="w-full rounded-xl border border-stone-200 bg-superficie px-3.5 py-2.5 text-base outline-none transition placeholder:text-stone-300 focus:border-stone-400"
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
                      className={`${chip} ${opciones.icono === id ? 'border-grafito bg-grafito text-hueso' : 'border-stone-200 text-stone-700 hover:border-stone-300'}`}
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
                        className={`${chip} flex items-center gap-2 ${activa ? 'border-grafito text-grafito' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}
                      >
                        <span className="flex" aria-hidden>
                          {[p.placa, p.texto, p.icono].map((c) => (
                            <span key={c} className="-mr-1 h-3.5 w-3.5 rounded-full border-2 border-superficie" style={{ background: c }} />
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
                <span key={f} className="rounded-md bg-stone-100 px-2.5 py-1 font-mono text-[12px] text-stone-700">
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
                      className="flex items-center gap-2 rounded-xl border border-stone-200 px-3.5 py-2.5 text-[14px] text-grafito transition hover:border-stone-300 hover:bg-stone-50"
                    >
                      <FileText size={16} className="shrink-0 text-stone-500" />
                      <span className="flex-1">{d.nombre}</span>
                      <span className="font-mono text-[11px] uppercase text-stone-400">{d.archivo.split('.').pop()}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-stone-200 py-5">
            {datos.map((d) => (
              <div key={d.etiqueta}>
                <dt className="text-[12px] text-stone-500">{d.etiqueta}</dt>
                <dd className="mt-0.5 text-[14px] font-medium text-grafito">{d.valor}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-auto flex flex-col gap-3">
            <div className="flex items-end justify-between gap-4">
              <p className="text-4xl font-semibold tracking-tight">
                {precio(modelo.precio)}
                {modelo.precio > 0 && <span className="ml-1.5 text-sm font-normal text-stone-400">USD</span>}
              </p>
              <button type="button" onClick={onManos} className="pildora-clara">
                <Hand size={16} /> Ver con tus manos
              </button>
            </div>
            <a
              href={enlaceCompra(modelo, modelo.personalizable ? describirPedido(vista) : undefined)}
              target="_blank"
              rel="noreferrer"
              download={modelo.precio === 0 || undefined}
              className="pildora-negra w-full !py-3.5 text-[15px]"
            >
              {modelo.precio === 0 ? 'Descargar gratis' : modelo.personalizable ? 'Pedir por WhatsApp' : modelo.compra ? 'Comprar' : 'Comprar por WhatsApp'}
            </a>
            <p className="text-[12.5px] leading-relaxed text-stone-500">
              Entrega digital tras el pago. ¿Otro formato o una versión para impresión 3D? Escribe a{' '}
              <a href={`mailto:${CORREO}?subject=${encodeURIComponent(`Modelo 3D · ${modelo.nombre}`)}`} className="underline underline-offset-4 hover:text-grafito">
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
