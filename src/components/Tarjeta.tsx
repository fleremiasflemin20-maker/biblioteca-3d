import { Box } from 'lucide-react'
import { CATEGORIAS, precio, rutaPortada, triangulos, type Modelo3D } from '../lib/catalogo'

/**
 * Una pieza en la rejilla. Enseña la portada fotografiada (ver `Portadas.tsx`),
 * no un lienzo 3D: el 3D se carga al abrir la ficha.
 */
export function Tarjeta({ modelo, numero, onAbrir }: { modelo: Modelo3D; numero: number; onAbrir: () => void }) {
  const cat = CATEGORIAS.find((c) => c.id === modelo.categoria) ?? CATEGORIAS[0]
  const portada = rutaPortada(modelo)

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="tarjeta group relative flex flex-col overflow-hidden border border-paper/10 bg-ink/60 text-left backdrop-blur-sm"
      style={{ ['--t' as string]: cat.tinta }}
    >
      <div className="relative aspect-square overflow-hidden">
        <div
          className="absolute inset-0 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: `radial-gradient(85% 65% at 50% 100%, ${cat.desde}66 0%, ${cat.hasta}26 45%, transparent 75%)` }}
          aria-hidden
        />
        {portada ? (
          <img
            src={portada}
            alt=""
            loading="lazy"
            className="relative h-full w-full object-contain p-4 transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="relative flex h-full items-center justify-center text-paper/20">
            <Box size={56} strokeWidth={1} />
          </div>
        )}

        <div className="absolute inset-x-3 top-3 flex justify-between font-mono text-[0.62rem] uppercase tracking-[0.2em]">
          <span className="text-paper/45">N° {String(numero).padStart(2, '0')}</span>
          <span style={{ color: cat.tinta }}>{cat.clave}</span>
        </div>
        {modelo.destacado && (
          <span className="absolute bottom-3 left-3 bg-paper px-2 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.18em] text-ink">
            Destacado
          </span>
        )}
        <span className="absolute bottom-3 right-3 translate-y-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100" style={{ color: cat.tinta }}>
          Ver en 3D →
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 border-t border-paper/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-base uppercase leading-tight md:text-lg">{modelo.nombre}</h3>
          <p className="shrink-0 font-display text-lg" style={{ color: cat.tinta }}>
            {precio(modelo.precio)}
          </p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-paper/40">
          <span>{modelo.formatos.join(' · ')}</span>
          {modelo.triangulos && <span>▲ {triangulos(modelo.triangulos)}</span>}
        </div>
      </div>
    </button>
  )
}
