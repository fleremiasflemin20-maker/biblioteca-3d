import type { CSSProperties } from 'react'
import { Box, Star } from 'lucide-react'
import { CATEGORIAS, precio, rutaPortada, triangulos, type Modelo3D } from '../lib/catalogo'
import { ICONO_CATEGORIA } from '../lib/iconos'
import { coste, estrellas, rareza } from '../lib/rareza'

/**
 * Una pieza en la rejilla, como la carta de un personaje de colección: marco
 * del color de su rareza (las legendarias con un aro de luz que gira), la
 * figura sobre los rayos de su sección, reflejo holográfico al pasar, coste
 * DP, nombre y detalle en estrellas. El 3D de verdad se carga al abrir la ficha.
 */
export function Tarjeta({ modelo, numero, onAbrir }: { modelo: Modelo3D; numero?: number; onAbrir: () => void }) {
  const cat = CATEGORIAS.find((c) => c.id === modelo.categoria) ?? CATEGORIAS[0]
  const Icono = ICONO_CATEGORIA[cat.id]
  const portada = rutaPortada(modelo)
  const r = rareza(modelo)
  const leg = r.nombre === 'Legendaria'
  const detalle = estrellas(modelo)

  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`carta group ${leg ? 'carta-leg' : ''}`}
      style={{ '--r1': r.marco[0], '--r2': r.marco[1], '--r3': r.marco[2], '--d': cat.desde, '--h': cat.hasta } as CSSProperties}
    >
      <div className="carta-dentro">
        <div className="carta-escena">
          {portada ? (
            <img src={portada} alt={modelo.nombre} loading="lazy" decoding="async" className="h-full w-full object-contain p-4" />
          ) : (
            <div className="relative z-[1] flex h-full items-center justify-center text-white/25">
              <Box size={48} strokeWidth={1.2} />
            </div>
          )}
          <span className="holo" aria-hidden />

          {/* Coste DP arriba a la izquierda, rareza y número arriba a la derecha. */}
          <span className="hexagono absolute left-2 top-2 z-[3] grid h-9 w-10 place-items-center bg-gradient-to-b from-[#FFE08A] to-[#E08A10] font-flemin text-[15px] leading-none text-[#1a1033] shadow-lg">
            {coste(modelo)}
            <span className="absolute -bottom-[1px] font-chakra text-[7px] font-bold tracking-wider">DP</span>
          </span>
          <span className="rareza absolute right-2 top-2 z-[3] px-2 py-0.5 font-chakra text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#0b0716]" style={{ background: r.sello }}>
            {r.nombre}
          </span>
          {numero !== undefined && (
            <span className="absolute right-2.5 top-8 z-[3] font-chakra text-[10px] font-semibold tabular-nums tracking-wider text-white/45">No.{String(numero).padStart(3, '0')}</span>
          )}
          {modelo.sinTextura && (
            <span className="absolute bottom-2 left-2 z-[3] bg-black/60 px-2 py-0.5 font-chakra text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/80 ring-1 ring-white/25">Sin color</span>
          )}
          <span className="btn-fuego absolute bottom-2 right-2 z-[3] translate-y-2 px-2.5 py-1 font-chakra text-[10.5px] font-bold uppercase tracking-[0.12em] opacity-0 transition-all duration-300 [clip-path:polygon(6px_0,100%_0,calc(100%-6px)_100%,0_100%)] group-hover:translate-y-0 group-hover:opacity-100">
            Ver en 3D
          </span>
        </div>

        {/* Placa del nombre: franja del color de la sección y los datos como atributos. */}
        <div className="relative border-t border-white/10 px-3 pb-3 pt-2.5">
          <span aria-hidden className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${cat.desde}, ${cat.hasta}, transparent)` }} />
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 font-chakra text-[14px] font-bold uppercase leading-tight tracking-wide text-white">{modelo.nombre}</h3>
            <p className="shrink-0 bg-gradient-to-b from-[#FFE08A] to-[#FF8A2F] bg-clip-text font-flemin text-[17px] leading-none text-transparent">{precio(modelo.precio)}</p>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 truncate font-chakra text-[11px] uppercase tracking-[0.1em] text-white/55">
            <Icono size={12} style={{ color: cat.tinta }} className="shrink-0" />
            <span className="truncate">{cat.nombre}</span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex gap-px" title={modelo.triangulos ? `${triangulos(modelo.triangulos)} triángulos` : undefined}>
              {Array.from({ length: 7 }, (_, k) => (
                <Star key={k} size={10} className={k < detalle ? 'fill-[#FFC23D] text-[#FFC23D]' : 'text-white/20'} />
              ))}
            </span>
            <span className="ml-auto truncate font-chakra text-[10px] uppercase tracking-wider text-white/40">{modelo.formatos.join(' · ')}</span>
          </div>
        </div>
      </div>
    </button>
  )
}
