import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { Grano, Palmeras, Puesta, Velo } from './components/Atmosfera'
import { Visor } from './components/Visor'
import { Tarjeta } from './components/Tarjeta'
import { Ficha } from './components/Ficha'
import { Subir } from './components/Subir'
import { Portadas } from './components/Portadas'
import { CATALOGO, CATEGORIAS, CORREO, WHATSAPP, precio } from './lib/catalogo'

type Orden = 'recientes' | 'barato' | 'caro' | 'nombre'

const FORMATOS = [...new Set(CATALOGO.flatMap((m) => m.formatos))]
const DESTACADOS = CATALOGO.filter((m) => m.destacado).length ? CATALOGO.filter((m) => m.destacado) : CATALOGO.slice(0, 3)

export default function App() {
  const [cat, setCat] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('recientes')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [destacado, setDestacado] = useState(0)
  const [subiendo, setSubiendo] = useState(false)
  const [sinPortada, setSinPortada] = useState(0)

  const c = CATEGORIAS[cat]

  /* La paleta viaja por variables CSS, igual que en el portafolio. */
  useEffect(() => {
    const r = document.documentElement.style
    r.setProperty('--desde', c.desde)
    r.setProperty('--hasta', c.hasta)
    r.setProperty('--tinta', c.tinta)
  }, [c])

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const l = CATALOGO.filter(
      (m) =>
        (c.id === 'todo' || m.categoria === c.id) &&
        (!q || `${m.nombre} ${m.descripcion} ${m.formatos.join(' ')}`.toLowerCase().includes(q)),
    )
    if (orden === 'barato') l.sort((a, b) => a.precio - b.precio)
    if (orden === 'caro') l.sort((a, b) => b.precio - a.precio)
    if (orden === 'nombre') l.sort((a, b) => a.nombre.localeCompare(b.nombre))
    return l
  }, [c, busqueda, orden])

  const indiceAbierto = lista.findIndex((m) => m.id === abierto)
  const mover = useCallback(
    (paso: 1 | -1) => {
      if (indiceAbierto < 0) return
      setAbierto(lista[(indiceAbierto + paso + lista.length) % lista.length].id)
    },
    [indiceAbierto, lista],
  )
  const cerrar = useCallback(() => setAbierto(null), [])

  const estrella = DESTACADOS[destacado % DESTACADOS.length]
  const catEstrella = CATEGORIAS.find((x) => x.id === estrella.categoria) ?? c
  const pendientes = useMemo(() => (import.meta.env.DEV ? CATALOGO.filter((m) => !m.portada) : []), [])

  const pasos = [
    { n: '01', titulo: 'Gíralo', texto: 'Cada pieza se carga en 3D. Mírala por todos lados, en textura, arcilla o malla, antes de pagar.' },
    { n: '02', titulo: 'Pídelo', texto: 'Botón de compra: te lleva al pago o abre WhatsApp con el pedido ya escrito.' },
    { n: '03', titulo: 'Úsalo', texto: 'Entrega digital en los formatos de la ficha. Uso personal y comercial incluido.' },
  ]

  return (
    <>
      {/* HUD: el mismo marco de videojuego que el portafolio. */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between bg-gradient-to-b from-ink/90 via-ink/50 to-transparent p-5 pb-10 md:p-8 md:pb-12">
        <a href="#" className="pointer-events-auto font-mono text-caption uppercase text-paper/80">
          Fleremiasflemin <span className="text-paper/35">· Biblioteca 3D</span>
        </a>
        <div className="pointer-events-auto flex items-center gap-4">
          {import.meta.env.DEV && (
            <button type="button" onClick={() => setSubiendo(true)} className="boton flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em]">
              <Plus size={14} strokeWidth={3} /> Subir modelo
            </button>
          )}
          <p className="hidden font-mono text-caption uppercase sm:block" style={{ color: 'var(--tinta)' }}>
            Tienda · en línea
          </p>
        </div>
      </header>
      <div className="pointer-events-none fixed inset-0 z-40 hidden md:block" aria-hidden>
        <span className="absolute bottom-6 left-6 h-8 w-8 border-b border-l border-paper/30" />
        <span className="absolute bottom-6 right-6 h-8 w-8 border-b border-r border-paper/30" />
      </div>

      <main>
        {/* ── Portada ─────────────────────────────────────────── */}
        <section className="scene relative flex items-center overflow-hidden">
          <Puesta />
          <Palmeras />
          <Velo />
          <Grano />

          <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-8 px-5 pb-16 pt-28 md:grid-cols-[1.05fr_1fr] md:px-10">
            <div>
              <p className="entra font-mono text-caption uppercase" style={{ color: 'var(--tinta)' }}>
                Catálogo 2026 · {CATALOGO.length} modelos
              </p>
              <h1 className="rotulo mt-4 font-display text-[clamp(3rem,7.4vw,7.5rem)] uppercase leading-[0.9] tracking-[-0.03em]">
                Biblioteca
                <br />
                <span className="degradado">3D</span>
              </h1>
              <p className="mt-6 max-w-md text-body text-paper/75">
                Personajes, criaturas y props listos para tu juego, tu render o tu impresora. Cada pieza se gira aquí mismo
                en 3D antes de comprarla — lo que ves es lo que te llevas.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <a href="#catalogo" className="boton inline-block border-2 px-9 py-3.5 font-mono text-caption font-bold uppercase">
                  Ver catálogo
                </a>
                <a
                  href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola, quiero un modelo 3D a medida.')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-caption uppercase text-paper/55 underline decoration-paper/20 underline-offset-[6px] transition-colors hover:text-paper hover:decoration-current"
                >
                  Pedir uno a medida
                </a>
              </div>

              <dl className="mt-12 grid max-w-md grid-cols-3 gap-4 border-t border-paper/10 pt-5">
                {[
                  { etiqueta: 'Modelos', valor: String(CATALOGO.length) },
                  { etiqueta: 'Formatos', valor: FORMATOS.slice(0, 3).join(' · ') },
                  { etiqueta: 'Desde', valor: precio(Math.min(...CATALOGO.map((m) => m.precio))) },
                ].map((s) => (
                  <div key={s.etiqueta}>
                    <dt className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-paper/40">{s.etiqueta}</dt>
                    <dd className="mt-1 font-mono text-sm" style={{ color: 'var(--tinta)' }}>{s.valor}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* El destacado, girando. */}
            <div className="relative">
              <div className="relative h-[420px] border border-paper/10 bg-ink/40 backdrop-blur-[2px] md:h-[560px]">
                <Visor modelo={estrella} tinta={catEstrella.tinta} />
                <div className="pointer-events-none absolute inset-x-4 top-4 flex justify-between font-mono text-[0.62rem] uppercase tracking-[0.2em]">
                  <span className="text-paper/45">Destacado</span>
                  <span style={{ color: catEstrella.tinta }}>
                    {String((destacado % DESTACADOS.length) + 1).padStart(2, '0')} / {String(DESTACADOS.length).padStart(2, '0')}
                  </span>
                </div>
                {DESTACADOS.length > 1 &&
                  [
                    { paso: -1, Icono: ChevronLeft, lado: 'left-3', nombre: 'Destacado anterior' },
                    { paso: 1, Icono: ChevronRight, lado: 'right-3', nombre: 'Destacado siguiente' },
                  ].map(({ paso, Icono, lado, nombre }) => (
                    <button
                      key={paso}
                      type="button"
                      aria-label={nombre}
                      onClick={() => setDestacado((d) => (d + paso + DESTACADOS.length) % DESTACADOS.length)}
                      className={`flecha absolute ${lado} top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center border bg-ink/70 text-paper/70 backdrop-blur-sm`}
                    >
                      <Icono size={22} strokeWidth={2.5} />
                    </button>
                  ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCat(0)
                  setAbierto(estrella.id)
                }}
                className="group flex w-full items-baseline justify-between gap-3 border border-t-0 border-paper/10 bg-ink/70 px-4 py-3.5 text-left backdrop-blur-sm"
              >
                <span className="font-display text-lg uppercase leading-none md:text-xl">{estrella.nombre}</span>
                <span className="shrink-0 font-mono text-caption uppercase" style={{ color: catEstrella.tinta }}>
                  {precio(estrella.precio)} · Ver ficha →
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* ── Catálogo ────────────────────────────────────────── */}
        <section id="catalogo" className="relative scroll-mt-16 border-t border-paper/10 px-5 py-20 md:px-10 md:py-28">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] opacity-40 transition-[background] duration-700"
            style={{ background: 'radial-gradient(70% 60% at 50% 0%, color-mix(in oklab, var(--desde) 45%, transparent), transparent 70%)' }}
            aria-hidden
          />
          <div className="relative mx-auto max-w-7xl">
            <p className="font-mono text-caption uppercase text-paper/45">El catálogo</p>
            <h2 className="rotulo mt-3 font-display text-headline uppercase">
              Elige tu <span className="degradado">próxima pieza</span>
            </h2>

            {/* Categorías: como la rueda del portafolio, elegir una tiñe la página. */}
            <div className="mt-10 flex flex-wrap gap-2" role="tablist" aria-label="Categorías">
              {CATEGORIAS.map((x, i) => {
                const n = x.id === 'todo' ? CATALOGO.length : CATALOGO.filter((m) => m.categoria === x.id).length
                const activa = i === cat
                return (
                  <button
                    key={x.id}
                    type="button"
                    role="tab"
                    aria-selected={activa}
                    onClick={() => setCat(i)}
                    className="flex items-baseline gap-2 border px-4 py-2.5 font-mono text-xs uppercase tracking-[0.14em] transition-all duration-300"
                    style={
                      activa
                        ? { background: `linear-gradient(90deg, ${x.desde}, ${x.hasta})`, borderColor: 'transparent', color: '#0A0A0B', fontWeight: 700 }
                        : { borderColor: '#F5F4F122', color: '#F5F4F1AA' }
                    }
                  >
                    <span style={activa ? undefined : { color: x.tinta }}>{x.clave}</span>
                    {x.nombre}
                    <span className={activa ? 'opacity-60' : 'text-paper/30'}>{n}</span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label className="flex flex-1 items-center gap-2.5 border border-paper/15 bg-ink/60 px-3.5 focus-within:border-[var(--tinta)]">
                <Search size={16} className="text-paper/40" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar dragón, trono, STL…"
                  className="w-full bg-transparent py-3 font-mono text-sm text-paper outline-none placeholder:text-paper/30"
                />
              </label>
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as Orden)}
                aria-label="Ordenar"
                className="border border-paper/15 bg-ink px-3.5 py-3 font-mono text-xs uppercase tracking-[0.12em] text-paper/80 outline-none focus:border-[var(--tinta)]"
              >
                <option value="recientes">Más recientes</option>
                <option value="barato">Precio: menor a mayor</option>
                <option value="caro">Precio: mayor a menor</option>
                <option value="nombre">Nombre A–Z</option>
              </select>
            </div>

            {lista.length ? (
              <div key={c.id} className="mt-8 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {lista.map((m, i) => (
                  <div key={m.id} className="entra" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                    <Tarjeta modelo={m} numero={CATALOGO.indexOf(m) + 1} onAbrir={() => setAbierto(m.id)} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-16 text-center font-mono text-sm uppercase tracking-[0.14em] text-paper/40">
                Nada por aquí todavía. {c.id !== 'todo' && 'Pronto habrá piezas en esta categoría.'}
              </p>
            )}
          </div>
        </section>

        {/* ── Cómo comprar ────────────────────────────────────── */}
        <section className="border-t border-paper/10 px-5 py-20 md:px-10 md:py-28">
          <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-3">
            {pasos.map((p) => (
              <div key={p.n}>
                <p className="font-display text-6xl text-paper/10">{p.n}</p>
                <h3 className="mt-2 font-display text-title uppercase">{p.titulo}</h3>
                <p className="mt-3 max-w-xs text-paper/60">{p.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Contacto ────────────────────────────────────────── */}
        <footer className="relative overflow-hidden border-t border-paper/10 px-5 pb-16 pt-20 md:px-10 md:pt-28">
          <Puesta />
          <Grano />
          <div className="relative mx-auto max-w-7xl">
            <h2 className="rotulo font-display text-headline uppercase">
              ¿Buscas algo
              <br />
              <span className="degradado">que no está aquí?</span>
            </h2>
            <p className="mt-5 max-w-lg text-body text-paper/70">
              Modelos a medida, adaptaciones para impresión 3D o retopología para juego. Cuéntame qué necesitas.
            </p>
            <div className="mt-10 grid max-w-2xl gap-6 sm:grid-cols-2">
              <div>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-paper/40">Correo</p>
                <a href={`mailto:${CORREO}`} className="mt-1 inline-block font-mono text-sm underline underline-offset-4" style={{ color: 'var(--tinta)' }}>
                  {CORREO}
                </a>
              </div>
              <div>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-paper/40">WhatsApp</p>
                <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer" className="mt-1 inline-block font-mono text-sm underline underline-offset-4" style={{ color: 'var(--tinta)' }}>
                  +593 979 523 040
                </a>
              </div>
            </div>
            <div className="mt-10 flex flex-wrap gap-4">
              <a href="https://fleremiasflemin20-maker.github.io/Portafolio-fleremiasflemin/" target="_blank" rel="noreferrer" className="boton inline-block border-2 px-9 py-3.5 font-mono text-caption font-bold uppercase">
                Portafolio
              </a>
              <a href="https://www.linkedin.com/in/fleremahiaslenin" target="_blank" rel="noreferrer" className="boton inline-block border-2 px-9 py-3.5 font-mono text-caption font-bold uppercase">
                LinkedIn
              </a>
            </div>
            <p className="mt-16 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-paper/30">
              © 2026 Lenin Bonilla · Quito, EC
            </p>
          </div>
        </footer>
      </main>

      {indiceAbierto >= 0 && (
        <Ficha modelo={lista[indiceAbierto]} numero={indiceAbierto + 1} total={lista.length} onCerrar={cerrar} onMover={mover} />
      )}
      {subiendo && <Subir onCerrar={() => setSubiendo(false)} />}

      {/* Solo en desarrollo: fotografía las piezas que aún no tienen portada. */}
      {pendientes.length > 0 && <Portadas pendientes={pendientes} alAvanzar={setSinPortada} />}
      {sinPortada > 0 && (
        <p className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 border border-paper/15 bg-ink/90 px-4 py-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-paper/70">
          Generando portadas · faltan {sinPortada}
        </p>
      )}
    </>
  )
}
