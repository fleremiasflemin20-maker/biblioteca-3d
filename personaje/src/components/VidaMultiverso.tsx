import { enlaceOva, imagenVineta, vinetasDe, CAPITULOS } from '../../../src/lib/ova'

/**
 * "Su vida en el multiverso": las viñetas de la OVA La Incursión (y las escenas
 * sueltas) donde sale este personaje. Son imágenes 4K renderizadas desde las
 * figuras de la Biblioteca, no arte oficial. Cada una abre la OVA en esa hoja.
 */
export function VidaMultiverso({ historia }: { historia: string }) {
  // Una por capítulo primero (variedad: pelea, tregua, final), luego el resto.
  const todas = vinetasDe(historia)
  const unaPorCap = todas.filter((v, i) => todas.findIndex((o) => o.cap === v.cap) === i)
  const vinetas = [...unaPorCap, ...todas.filter((v) => !unaPorCap.includes(v))].slice(0, 6)
  if (!vinetas.length) return null
  const capitulo = (n: number) => (n === 8 ? 'Escena extra' : (CAPITULOS.find((c) => c.num === n)?.titulo ?? ''))

  return (
    <>
      <ul className="mt-8 grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {vinetas.map((v) => (
          <li key={v.id}>
            <a
              href={enlaceOva(v.id)}
              target="_blank"
              rel="noopener"
              className="group block border-[3px] border-ink bg-ink shadow-[0.3rem_0.35rem_0_#FFDE00] transition-transform duration-300 hover:-rotate-1 hover:scale-[1.02]"
            >
              <img
                src={imagenVineta(v.id, 'movil')}
                alt={v.narra || v.globos.map((g) => g.quien).join(', ')}
                loading="lazy"
                width={1280}
                height={720}
                className="block aspect-video w-full object-cover"
              />
              <span className="block px-3 py-2 text-caption uppercase text-saiyan">{capitulo(v.cap)}</span>
              {v.narra && <span className="block px-3 pb-3 text-[0.9rem] leading-snug text-paper/70 line-clamp-2">{v.narra}</span>}
            </a>
          </li>
        ))}
      </ul>
      <a
        href={enlaceOva()}
        target="_blank"
        rel="noopener"
        className="mt-8 inline-block border-2 border-ink bg-saiyan px-8 py-4 text-caption uppercase text-ink shadow-[0.25rem_0.3rem_0_#0A0A0B] transition-transform duration-300 hover:scale-[1.03]"
      >
        Leer la OVA «La Incursión» →
      </a>
    </>
  )
}
