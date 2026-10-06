import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Hand, MessageCircle, Moon, Plus, Search, Sun } from 'lucide-react'
import { Visor } from './components/Visor'
import { Tarjeta } from './components/Tarjeta'
import { Ficha } from './components/Ficha'
import { Subir } from './components/Subir'
import { Portadas } from './components/Portadas'
import { ModoManos } from './components/ModoManos'
import { CATALOGO, CATEGORIAS, CORREO, WHATSAPP, precio, type Modelo3D } from './lib/catalogo'
import { ICONO_CATEGORIA } from './lib/iconos'
import { useTema } from './lib/tema'

type Orden = 'recientes' | 'barato' | 'caro' | 'nombre'
type Acabado = 'todos' | 'color' | 'sin-textura'
type Manos = { lista: Modelo3D[]; indice: number; desdeFicha: boolean }

const DESTACADOS = CATALOGO.filter((m) => m.destacado).length ? CATALOGO.filter((m) => m.destacado) : CATALOGO.slice(0, 3)
const ENLACE_MEDIDA = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola, quiero un modelo 3D a medida.')}`

export default function App() {
  const [cat, setCat] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('recientes')
  const [acabado, setAcabado] = useState<Acabado>('todos')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [destacado, setDestacado] = useState(0)
  const [subiendo, setSubiendo] = useState(false)
  const [sinPortada, setSinPortada] = useState(0)
  const [manos, setManos] = useState<Manos | null>(null)
  const { tema, alternar } = useTema()

  const c = CATEGORIAS[cat]
  const barra = useRef<HTMLElement>(null)

  /* La barra de secciones se pega justo debajo de la superior, que cambia de alto entre móvil y escritorio. */
  useEffect(() => {
    const b = barra.current
    if (!b) return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--alto-barra', `${b.offsetHeight}px`))
    ro.observe(b)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--tinta', c.punto)
  }, [c])

  const base = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const l = CATALOGO.filter(
      (m) =>
        (c.id === 'todo' || m.categoria === c.id) &&
        (!q || `${m.nombre} ${m.descripcion} ${m.formatos.join(' ')} ${m.origen ?? ''}`.toLowerCase().includes(q)),
    )
    if (orden === 'recientes') l.reverse()
    if (orden === 'barato') l.sort((a, b) => a.precio - b.precio)
    if (orden === 'caro') l.sort((a, b) => b.precio - a.precio)
    if (orden === 'nombre') l.sort((a, b) => a.nombre.localeCompare(b.nombre))
    // Las de color primero y las sin textura al final, sin romper el orden
    // elegido dentro de cada grupo (`sort` es estable).
    l.sort((a, b) => Number(!!a.sinTextura) - Number(!!b.sinTextura))
    return l
  }, [c, busqueda, orden])
  const nSinTextura = base.filter((m) => m.sinTextura).length
  const lista = useMemo(
    () => (acabado === 'todos' ? base : base.filter((m) => (acabado === 'sin-textura') === !!m.sinTextura)),
    [base, acabado],
  )
  const conColor = lista.filter((m) => !m.sinTextura)
  const sinTextura = lista.filter((m) => m.sinTextura)

  const indiceAbierto = lista.findIndex((m) => m.id === abierto)
  const mover = useCallback(
    (paso: 1 | -1) => {
      if (indiceAbierto < 0) return
      setAbierto(lista[(indiceAbierto + paso + lista.length) % lista.length].id)
    },
    [indiceAbierto, lista],
  )
  const cerrar = useCallback(() => setAbierto(null), [])

  /** El modo manos recorre lo que se está viendo: la sección y la búsqueda activas. */
  const abrirManos = useCallback(
    (id?: string) => {
      const l = lista.length ? lista : CATALOGO
      const i = id ? Math.max(0, l.findIndex((m) => m.id === id)) : 0
      setManos({ lista: l, indice: i, desdeFicha: !!id })
      setAbierto(null)
    },
    [lista],
  )
  /** Abre la ficha de una pieza aunque los filtros actuales la escondan. */
  const verFicha = useCallback(
    (id: string) => {
      if (!lista.some((m) => m.id === id)) {
        setCat(0)
        setBusqueda('')
      }
      setAbierto(id)
    },
    [lista],
  )
  const cerrarManos = useCallback(
    (id: string) => {
      const volver = manos?.desdeFicha
      setManos(null)
      if (volver) verFicha(id)
    },
    [manos, verFicha],
  )

  const estrella = DESTACADOS[destacado % DESTACADOS.length]
  const catEstrella = CATEGORIAS.find((x) => x.id === estrella.categoria) ?? c
  const pendientes = useMemo(() => (import.meta.env.DEV ? CATALOGO.filter((m) => !m.portada) : []), [])

  const irAlCatalogo = () => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <>
      {/* ── Barra superior ─────────────────────────────────────── */}
      <header ref={barra} className="sticky top-0 z-40 border-b border-stone-200/80 bg-hueso/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 md:flex-nowrap md:px-8">
          <a href="#" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-grafito text-[13px] font-bold text-hueso">F</span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-tight">Biblioteca 3D</span>
              <span className="block text-[11px] text-stone-500">por Fleremiasflemin</span>
            </span>
          </a>

          <form
            className="order-last w-full md:order-none md:mx-auto md:max-w-xl"
            onSubmit={(e) => {
              e.preventDefault()
              irAlCatalogo()
            }}
          >
            <label className="flex items-center gap-2.5 rounded-full border border-stone-200 bg-superficie px-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition focus-within:border-stone-400 focus-within:shadow-[0_0_0_4px_rgba(24,24,27,0.06)]">
              <Search size={17} className="shrink-0 text-stone-400" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Busca figuras, piezas, formatos…"
                aria-label="Buscar modelos"
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-stone-400"
              />
            </label>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
            {import.meta.env.DEV && (
              <button type="button" onClick={() => setSubiendo(true)} className="pildora-clara !px-3.5">
                <Plus size={16} /> <span className="hidden lg:inline">Subir</span>
              </button>
            )}
            <button type="button" onClick={() => abrirManos()} className="pildora-clara !px-3.5">
              <Hand size={16} /> <span className="hidden sm:inline">Modo manos</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                alternar({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
              }}
              aria-label={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              title={tema === 'oscuro' ? 'Modo claro' : 'Modo oscuro'}
              className="pildora-clara relative h-10 w-10 overflow-hidden !p-0"
            >
              {/* Sol y luna giran al cruzarse: uno sale mientras entra el otro. */}
              <Sun size={17} className={`absolute transition-all duration-500 ${tema === 'oscuro' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'}`} />
              <Moon size={17} className={`absolute transition-all duration-500 ${tema === 'oscuro' ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'}`} />
            </button>
            <a href={ENLACE_MEDIDA} target="_blank" rel="noreferrer" className="pildora-negra hidden !px-4 sm:inline-flex">
              A medida
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* ── Portada ─────────────────────────────────────────── */}
        <section className="mx-auto grid max-w-[1400px] items-center gap-10 px-4 pb-12 pt-10 md:grid-cols-[1fr_1.15fr] md:px-8 md:pb-20 md:pt-16">
          <div className="entra">
            <button
              type="button"
              onClick={() => abrirManos()}
              className="group inline-flex items-center gap-2 rounded-full border border-stone-200 bg-superficie py-1 pl-1 pr-3 text-[13px] text-stone-600 transition hover:border-stone-300"
            >
              <span className="rounded-full bg-grafito px-2 py-0.5 text-[11px] font-medium text-hueso">Nuevo</span>
              Sostén las figuras con tu mano
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <h1 className="mt-6 text-[clamp(2.6rem,5.6vw,5rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
              Modelos 3D <span className="font-serif font-normal italic tracking-[-0.01em]">listos</span> para imprimir, renderizar y jugar.
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-stone-600">
              Tecnología, mecánica, autos, anime, manga y los Seres Flemin. Gira cada pieza en 3D antes de comprarla, o tómala con la mano desde tu cámara.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" onClick={irAlCatalogo} className="pildora-negra !px-6 !py-3">
                Explorar catálogo
              </button>
              <button type="button" onClick={() => abrirManos()} className="pildora-clara !px-6 !py-3">
                <Hand size={17} /> Probar con tus manos
              </button>
            </div>
            <dl className="mt-10 flex gap-10 text-sm">
              {[
                { etiqueta: 'Modelos', valor: String(CATALOGO.length) },
                { etiqueta: 'Secciones', valor: String(CATEGORIAS.length - 1) },
                { etiqueta: 'Desde', valor: precio(Math.min(...CATALOGO.map((m) => m.precio))) },
              ].map((s) => (
                <div key={s.etiqueta}>
                  <dd className="text-2xl font-semibold tracking-tight">{s.valor}</dd>
                  <dt className="mt-0.5 text-stone-500">{s.etiqueta}</dt>
                </div>
              ))}
            </dl>
          </div>

          {/* El destacado, girando. */}
          <div className="entra relative" style={{ animationDelay: '80ms' }}>
            <div className="relative h-[420px] overflow-hidden rounded-[28px] border border-stone-200 bg-gradient-to-b from-superficie to-stone-100 md:h-[560px]">
              <div
                className="absolute inset-0 opacity-60"
                style={{ background: `radial-gradient(60% 45% at 50% 85%, ${catEstrella.punto}22, transparent 70%)` }}
                aria-hidden
              />
              <Visor modelo={estrella} tinta={catEstrella.tinta} />
              <div className="pointer-events-none absolute inset-x-5 top-5 flex items-center justify-between text-[12px] text-stone-500">
                <span className="rounded-full border border-stone-200 bg-superficie/80 px-2.5 py-1 backdrop-blur">Destacado</span>
                <span className="tabular-nums">
                  {String((destacado % DESTACADOS.length) + 1).padStart(2, '0')} / {String(DESTACADOS.length).padStart(2, '0')}
                </span>
              </div>
              <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-superficie/85 p-2 pl-4 shadow-sm backdrop-blur-md">
                <button type="button" onClick={() => verFicha(estrella.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[15px] font-semibold tracking-tight">{estrella.nombre}</p>
                  <p className="text-[13px] text-stone-500">
                    {catEstrella.nombre} · {precio(estrella.precio)}
                  </p>
                </button>
                {DESTACADOS.length > 1 && (
                  <div className="flex gap-1.5">
                    {[
                      { paso: -1, Icono: ChevronLeft, nombre: 'Destacado anterior' },
                      { paso: 1, Icono: ChevronRight, nombre: 'Destacado siguiente' },
                    ].map(({ paso, Icono, nombre }) => (
                      <button
                        key={paso}
                        type="button"
                        aria-label={nombre}
                        onClick={() => setDestacado((d) => (d + paso + DESTACADOS.length) % DESTACADOS.length)}
                        className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 bg-superficie text-stone-700 transition hover:bg-stone-50"
                      >
                        <Icono size={18} />
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => verFicha(estrella.id)} className="pildora-negra hidden !py-2.5 sm:inline-flex">
                  Ver ficha
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Catálogo ────────────────────────────────────────── */}
        <section id="catalogo" className="scroll-mt-20">
          {/* Secciones: fijas bajo la barra al bajar. */}
          <div className="sticky top-[var(--alto-barra,64px)] z-30 border-y border-stone-200/80 bg-hueso/85 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 md:px-8">
              <div className="sin-barra -mx-1 flex flex-1 gap-2 overflow-x-auto px-1" role="tablist" aria-label="Secciones">
                {CATEGORIAS.map((x, i) => {
                  const n = x.id === 'todo' ? CATALOGO.length : CATALOGO.filter((m) => m.categoria === x.id).length
                  const activa = i === cat
                  const Icono = ICONO_CATEGORIA[x.id]
                  return (
                    <button
                      key={x.id}
                      type="button"
                      role="tab"
                      aria-selected={activa}
                      onClick={() => setCat(i)}
                      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all duration-200 ${
                        activa ? 'border-grafito bg-grafito text-hueso' : 'border-stone-200 bg-superficie text-stone-700 hover:border-stone-300'
                      }`}
                    >
                      <Icono size={15} style={activa ? undefined : { color: x.punto }} />
                      {x.nombre}
                      <span className={`tabular-nums ${activa ? 'text-hueso/55' : 'text-stone-400'}`}>{n}</span>
                    </button>
                  )
                })}
              </div>
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as Orden)}
                aria-label="Ordenar"
                className="hidden shrink-0 rounded-full border border-stone-200 bg-superficie px-3.5 py-2 text-[13px] text-stone-700 outline-none transition hover:border-stone-300 sm:block"
              >
                <option value="recientes">Más recientes</option>
                <option value="barato">Precio: menor a mayor</option>
                <option value="caro">Precio: mayor a menor</option>
                <option value="nombre">Nombre A–Z</option>
              </select>
            </div>
          </div>

          <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 md:px-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                {c.id === 'todo' ? 'Todo el catálogo' : c.nombre}
                {busqueda.trim() && <span className="font-normal text-stone-400"> · “{busqueda.trim()}”</span>}
              </h2>
              <div className="flex items-center gap-3">
                {/* Acabado: con color o sin textura. Se combina con la sección y la búsqueda. */}
                <div className="flex rounded-full border border-stone-200 bg-superficie p-1" role="tablist" aria-label="Acabado">
                  {(
                    [
                      { id: 'todos', nombre: 'Todos', n: base.length },
                      { id: 'color', nombre: 'A color', n: base.length - nSinTextura },
                      { id: 'sin-textura', nombre: 'Sin textura', n: nSinTextura },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="tab"
                      aria-selected={acabado === o.id}
                      onClick={() => setAcabado(o.id)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                        acabado === o.id ? 'bg-grafito text-hueso' : 'text-stone-600 hover:text-grafito'
                      }`}
                    >
                      {o.id === 'color' && <span className="h-2 w-2 rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-sky-500" aria-hidden />}
                      {o.id === 'sin-textura' && <span className="h-2 w-2 rounded-full border border-current opacity-70" aria-hidden />}
                      {o.nombre}
                      <span className={`tabular-nums ${acabado === o.id ? 'text-hueso/55' : 'text-stone-400'}`}>{o.n}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {lista.length ? (
              <div key={`${c.id}-${orden}-${acabado}`}>
                {[conColor, sinTextura].map((grupo, g) =>
                  grupo.length ? (
                    <div key={g}>
                      {/* Separador del bloque sin textura, solo cuando conviven los dos. */}
                      {g === 1 && conColor.length > 0 && (
                        <div className="mb-6 mt-14 flex items-center gap-4">
                          <h3 className="shrink-0 text-lg font-semibold tracking-tight">Sin textura</h3>
                          <p className="hidden shrink-0 text-sm text-stone-500 sm:block">Mallas en blanco, listas para pintar o imprimir · {grupo.length}</p>
                          <span className="h-px flex-1 bg-stone-200" />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                        {grupo.map((m, i) => (
                          <div key={m.id} className="entra" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                            <Tarjeta modelo={m} onAbrir={() => setAbierto(m.id)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-stone-300 px-6 py-20 text-center">
                <p className="text-lg font-medium">Nada por aquí todavía</p>
                <p className="mt-1 text-stone-500">Prueba con otra búsqueda o pide un modelo a medida.</p>
                <a href={ENLACE_MEDIDA} target="_blank" rel="noreferrer" className="pildora-negra mt-6">
                  Pedir a medida
                </a>
              </div>
            )}
          </div>
        </section>

        {/* ── Cómo funciona ───────────────────────────────────── */}
        <section className="border-t border-stone-200 bg-superficie">
          <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-20 md:grid-cols-3 md:px-8">
            {[
              { n: '1', titulo: 'Gíralo', texto: 'Cada pieza se carga en 3D: textura, arcilla o malla. O sostenla en tu mano con el modo manos.' },
              { n: '2', titulo: 'Pídelo', texto: 'El botón de compra te lleva al pago o abre WhatsApp con el pedido ya escrito.' },
              { n: '3', titulo: 'Úsalo', texto: 'Entrega digital en los formatos de la ficha, con uso personal y comercial.' },
            ].map((p) => (
              <div key={p.n}>
                <p className="font-serif text-5xl italic text-stone-300">{p.n}</p>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">{p.titulo}</h3>
                <p className="mt-2 max-w-xs leading-relaxed text-stone-600">{p.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Contacto ────────────────────────────────────────── */}
        <footer className="bg-[#18181B] text-white dark:border-t dark:border-white/[0.06] dark:bg-[#0E0E0F]">
          <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-20 md:px-8">
            <h2 className="max-w-2xl text-[clamp(2rem,4.2vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
              ¿Buscas algo <span className="font-serif font-normal italic">que no está aquí?</span>
            </h2>
            <p className="mt-4 max-w-lg text-white/60">Modelos a medida, adaptaciones para impresión 3D o retopología para juego. Cuéntame qué necesitas.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={ENLACE_MEDIDA} target="_blank" rel="noreferrer" className="pildora bg-white text-[#18181B] hover:bg-[#E7E5E4]">
                <MessageCircle size={16} /> WhatsApp
              </a>
              <a href={`mailto:${CORREO}`} className="pildora border border-white/20 text-white hover:bg-superficie/10">
                {CORREO}
              </a>
            </div>
            <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm text-white/45">
              <p>© 2026 Lenin Bonilla · Quito, EC</p>
              <div className="flex gap-5">
                <a href="https://fleremiasflemin20-maker.github.io/Portafolio-fleremiasflemin/" target="_blank" rel="noreferrer" className="hover:text-white">
                  Portafolio
                </a>
                <a href="https://www.linkedin.com/in/fleremahiaslenin" target="_blank" rel="noreferrer" className="hover:text-white">
                  LinkedIn
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {indiceAbierto >= 0 && (
        <Ficha
          modelo={lista[indiceAbierto]}
          numero={indiceAbierto + 1}
          total={lista.length}
          onCerrar={cerrar}
          onMover={mover}
          onManos={() => abrirManos(lista[indiceAbierto].id)}
        />
      )}
      {manos && (
        <ModoManos
          lista={manos.lista}
          indiceInicial={manos.indice}
          onCerrar={cerrarManos}
          onFicha={(id) => {
            setManos(null)
            verFicha(id)
          }}
        />
      )}
      {subiendo && <Subir onCerrar={() => setSubiendo(false)} />}

      {/* Solo en desarrollo: fotografía las piezas que aún no tienen portada. */}
      {pendientes.length > 0 && <Portadas pendientes={pendientes} alAvanzar={setSinPortada} />}
      {sinPortada > 0 && (
        <p className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-grafito px-4 py-2 text-xs text-hueso">
          Generando portadas · faltan {sinPortada}
        </p>
      )}
    </>
  )
}
