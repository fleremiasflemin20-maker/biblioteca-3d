import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Visor } from './Visor'
import type { Modo } from './Pieza'
import { CATEGORIAS, CORREO, enlaceCompra, peso, precio, triangulos, type Modelo3D } from '../lib/catalogo'

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
}: {
  modelo: Modelo3D
  numero: number
  total: number
  onCerrar: () => void
  onMover: (paso: 1 | -1) => void
}) {
  const [modo, setModo] = useState<Modo>('textura')
  const cat = CATEGORIAS.find((c) => c.id === modelo.categoria) ?? CATEGORIAS[0]

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
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
    { etiqueta: 'Triángulos', valor: triangulos(modelo.triangulos) },
    { etiqueta: 'Vista previa', valor: peso(modelo.peso) },
    { etiqueta: 'Origen', valor: modelo.origen ?? '—' },
    { etiqueta: 'Licencia', valor: modelo.licencia ?? 'Uso personal y comercial' },
    ...(modelo.autor ? [{ etiqueta: 'Diseño original', valor: modelo.autor }] : []),
  ]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={modelo.nombre}
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/80 backdrop-blur-md md:items-center md:p-8"
      style={{ ['--t' as string]: cat.tinta }}
      onClick={onCerrar}
    >
      <div
        className="entra relative grid w-full max-w-6xl overflow-y-auto border border-paper/10 bg-ink md:h-[min(92vh,760px)] md:grid-cols-[1.25fr_1fr] md:overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* El visor */}
        <div className="relative h-[52vh] min-h-[320px] md:h-auto md:min-h-0">
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(90% 70% at 50% 100%, ${cat.desde}55 0%, ${cat.hasta}22 45%, transparent 75%)` }}
            aria-hidden
          />
          <Visor modelo={modelo} modo={modo} tinta={cat.tinta} zoom margen={1.25} />

          <p className="absolute left-4 top-4 font-mono text-[0.68rem] uppercase tracking-[0.2em]" style={{ color: cat.tinta }}>
            {String(numero).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </p>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 border border-paper/15 bg-ink/70 backdrop-blur-sm">
            {MODOS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModo(m.id)}
                aria-pressed={modo === m.id}
                className="px-3.5 py-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] transition-colors"
                style={modo === m.id ? { background: cat.tinta, color: '#0A0A0B' } : { color: '#F5F4F199' }}
              >
                {m.nombre}
              </button>
            ))}
          </div>

          {[
            { paso: -1 as const, Icono: ChevronLeft, lado: 'left-3', nombre: 'Modelo anterior' },
            { paso: 1 as const, Icono: ChevronRight, lado: 'right-3', nombre: 'Modelo siguiente' },
          ].map(({ paso, Icono, lado, nombre }) => (
            <button
              key={paso}
              type="button"
              aria-label={nombre}
              onClick={() => onMover(paso)}
              className={`flecha absolute ${lado} top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center border bg-ink/70 text-paper/70 backdrop-blur-sm`}
            >
              <Icono size={22} strokeWidth={2.5} />
            </button>
          ))}
        </div>

        {/* Los datos */}
        <div className="flex flex-col gap-6 p-6 md:overflow-y-auto md:p-9">
          <div className="flex items-start justify-between gap-4">
            <p className="font-mono text-caption uppercase" style={{ color: cat.tinta }}>
              {cat.clave} · {cat.nombre}
            </p>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="-m-2 p-2 text-paper/50 transition-colors hover:text-paper">
              <X size={22} />
            </button>
          </div>

          <h2 className="rotulo font-display text-headline uppercase">{modelo.nombre}</h2>
          <p className="text-body text-paper/70">{modelo.descripcion}</p>

          <div>
            <p className="mb-2.5 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-paper/40">Formatos incluidos</p>
            <div className="flex flex-wrap gap-2">
              {modelo.formatos.map((f) => (
                <span key={f} className="border border-paper/15 px-2.5 py-1 font-mono text-[0.7rem] tracking-[0.12em] text-paper/80">
                  {f}
                </span>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-paper/10 py-5">
            {datos.map((d) => (
              <div key={d.etiqueta}>
                <dt className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-paper/40">{d.etiqueta}</dt>
                <dd className="mt-1 font-mono text-sm text-paper/85">{d.valor}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-4">
            <p className="font-display text-4xl" style={{ color: cat.tinta }}>
              {precio(modelo.precio)}
              {modelo.precio > 0 && <span className="ml-1.5 font-mono text-xs text-paper/40">USD</span>}
            </p>
            <a
              href={enlaceCompra(modelo)}
              target="_blank"
              rel="noreferrer"
              download={modelo.precio === 0 || undefined}
              className="boton inline-block border-2 px-9 py-3.5 font-mono text-caption font-bold uppercase"
            >
              {modelo.precio === 0 ? 'Descargar gratis' : modelo.compra ? 'Comprar' : 'Comprar por WhatsApp'}
            </a>
          </div>
          <p className="font-mono text-[0.62rem] leading-relaxed tracking-[0.08em] text-paper/35">
            Entrega digital tras el pago. ¿Otro formato o una versión para impresión 3D? Escribe a{' '}
            <a href={`mailto:${CORREO}?subject=${encodeURIComponent(`Modelo 3D · ${modelo.nombre}`)}`} className="underline underline-offset-4 hover:text-paper">
              {CORREO}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
