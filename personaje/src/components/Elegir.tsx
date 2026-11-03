import { CATALOGO, rutaPortada } from '../../../src/lib/catalogo'
import { enlaceHistoria, HISTORIA_DE } from '../../../src/lib/historias'
import { PERSONAJES } from '../lib/personajes'

/**
 * Sin `?id=` válido en la URL no hay a quién contar. En vez de una página en
 * blanco, la lista de figuras que sí tienen historia.
 */
export function Elegir() {
  const figuras = CATALOGO.filter((m) => HISTORIA_DE[m.id] && !m.sinTextura)

  return (
    <main className="mx-auto max-w-6xl px-6 py-16 md:px-12">
      <p className="text-caption uppercase text-saiyan">Biblioteca 3D · Dragon Ball</p>
      <h1 className="dbz mt-4 font-display text-headline uppercase text-saiyan">Elige a tu guerrero</h1>
      <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {figuras.map((m) => (
          <li key={m.id}>
            <a
              href={enlaceHistoria(m)}
              className="block border border-paper/10 bg-paper/[0.03] p-3 transition-colors hover:border-saiyan"
            >
              {rutaPortada(m) && (
                <img src={rutaPortada(m)} alt="" loading="lazy" className="aspect-square w-full object-contain" />
              )}
              <span className="mt-2 block text-caption uppercase text-saiyan">
                {PERSONAJES[HISTORIA_DE[m.id]].titulo.join(' ')}
              </span>
              <span className="mt-1 block text-sm text-paper/60">{m.nombre}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
