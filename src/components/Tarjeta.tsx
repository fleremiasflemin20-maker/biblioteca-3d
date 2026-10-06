import { Box } from 'lucide-react'
import { CATEGORIAS, precio, rutaPortada, triangulos, type Modelo3D } from '../lib/catalogo'
import { ICONO_CATEGORIA } from '../lib/iconos'

/**
 * Una pieza en la rejilla: la portada fotografiada (ver `Portadas.tsx`) sobre
 * blanco, y debajo solo lo que se mira antes de abrir — nombre, sección,
 * formatos y precio. El 3D de verdad se carga al abrir la ficha.
 */
export function Tarjeta({ modelo, onAbrir }: { modelo: Modelo3D; onAbrir: () => void }) {
  const cat = CATEGORIAS.find((c) => c.id === modelo.categoria) ?? CATEGORIAS[0]
  const Icono = ICONO_CATEGORIA[cat.id]
  const portada = rutaPortada(modelo)

  return (
    <button type="button" onClick={onAbrir} className="group block w-full text-left">
      <div className="tarjeta-img relative aspect-square overflow-hidden rounded-2xl border border-stone-200/80 bg-superficie">
        {portada ? (
          <img
            src={portada}
            alt={modelo.nombre}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain p-5 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-300">
            <Box size={48} strokeWidth={1.2} />
          </div>
        )}

        {modelo.destacado && (
          <span className="absolute left-3 top-3 rounded-full bg-grafito px-2.5 py-1 text-[11px] font-medium text-hueso">Destacado</span>
        )}
        {modelo.sinTextura && (
          <span className="absolute bottom-3 left-3 rounded-full border border-stone-200 bg-superficie/90 px-2.5 py-1 text-[11px] font-medium text-stone-600 backdrop-blur">
            Sin textura
          </span>
        )}
        <span className="absolute bottom-3 right-3 translate-y-1 rounded-full bg-grafito/90 px-3 py-1.5 text-[12px] font-medium text-hueso opacity-0 backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          Ver en 3D
        </span>
      </div>

      <div className="px-0.5 pt-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-[15px] font-medium leading-snug tracking-tight text-grafito">{modelo.nombre}</h3>
          <p className="shrink-0 text-[15px] font-semibold tabular-nums">{precio(modelo.precio)}</p>
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 truncate text-[12.5px] text-stone-500">
          <Icono size={13} style={{ color: cat.punto }} className="shrink-0" />
          <span className="truncate">
            {cat.nombre} · {modelo.formatos.join(', ')}
            {modelo.triangulos ? ` · ${triangulos(modelo.triangulos)} tris` : ''}
          </span>
        </p>
      </div>
    </button>
  )
}
