import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Box, Gamepad2, Hand, MessageCircle, Plus, Scissors, Search, Sparkles, Trophy, Zap } from 'lucide-react'
import { Tarjeta } from './components/Tarjeta'
import { Ficha } from './components/Ficha'
import { Seleccion } from './components/Seleccion'
import { Subir } from './components/Subir'
import { Portadas } from './components/Portadas'
import { ModoManos } from './components/ModoManos'
import { Inicio, useInicio } from './components/Inicio'
import { Avisos, PanelLogros } from './components/Trofeos'
import { CATALOGO, CATEGORIAS, CORREO, WHATSAPP, type Modelo3D } from './lib/catalogo'
import { ICONO_CATEGORIA } from './lib/iconos'
import { agrupar, type Acabado } from './lib/orden'
import { enlaceStudio } from './lib/studio'
import { nivel, useProgreso } from './lib/consola'

// La sala del estudio carga three.js con su arquitectura: también bajo demanda.
const Sala = lazy(() => import('./estudio/sala/Sala'))

/** La sala vive en #estudio. El separador y el editor son Flemin Studio 3D, una web aparte. */
type Estudio = { vista: 'sala' }
const estudioDesdeHash = (): Estudio | null => (location.hash === '#estudio' ? { vista: 'sala' } : null)

// Enlaces viejos a las herramientas (#separador, #editor) siguen funcionando: van a la portada del Studio.
if (location.hash === '#separador' || location.hash === '#editor') location.replace(enlaceStudio())

type Orden = 'recientes' | 'barato' | 'caro' | 'nombre'
type Manos = { lista: Modelo3D[]; indice: number; desdeFicha: boolean }

const ENLACE_MEDIDA = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola, quiero un modelo 3D a medida.')}`

export default function App() {
  const [cat, setCat] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('recientes')
  const [acabado, setAcabado] = useState<Acabado>('todos')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [sinPortada, setSinPortada] = useState(0)
  const [manos, setManos] = useState<Manos | null>(null)
  const [estudio, setEstudioCrudo] = useState<Estudio | null>(estudioDesdeHash)
  const { puntos, nVistas } = useProgreso()
  const inicio = useInicio()
  const [logros, setLogros] = useState(false)
  const abrirLogros = useCallback(() => setLogros(true), [])

  const setEstudio = useCallback((e: Estudio | null) => {
    setEstudioCrudo(e)
    const hash = e ? '#estudio' : ''
    if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname + location.search)
  }, [])
  useEffect(() => {
    const cambio = () => setEstudioCrudo(estudioDesdeHash())
    window.addEventListener('hashchange', cambio)
    return () => window.removeEventListener('hashchange', cambio)
  }, [])

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
    // Por fecha de alta, lo último arriba; `sort` es estable y respeta el orden del JSON en el mismo día.
    if (orden === 'recientes') l.sort((a, b) => (b.alta ?? '').localeCompare(a.alta ?? ''))
    if (orden === 'barato') l.sort((a, b) => a.precio - b.precio)
    if (orden === 'caro') l.sort((a, b) => b.precio - a.precio)
    if (orden === 'nombre') l.sort((a, b) => a.nombre.localeCompare(b.nombre))
    return l
  }, [c, busqueda, orden])
  const nSinTextura = base.filter((m) => m.sinTextura).length
  // Cada pieza en su sitio: sección, luego color / sin textura, y las variantes de una figura juntas.
  const grupos = useMemo(
    () => agrupar(acabado === 'todos' ? base : base.filter((m) => (acabado === 'sin-textura') === !!m.sinTextura)),
    [base, acabado],
  )
  const lista = useMemo(() => grupos.flatMap((g) => g.modelos), [grupos])
  const conteo = { todos: base.length, color: base.length - nSinTextura, 'sin-textura': nSinTextura }

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

  const pendientes = useMemo(() => (import.meta.env.DEV ? CATALOGO.filter((m) => !m.portada) : []), [])

  const irAlCatalogo = () => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <>
      {/* El mundo: nebulosa, auroras, rejilla hexagonal y estrellas, detrás de toda la web. */}
      <div aria-hidden className="mundo">
        <div className="aurora" />
        <div className="aurora" />
        <div className="aurora" />
        <div className="estrellas" />
        <div className="hex" />
      </div>
      <div aria-hidden className="grano" />

      {/* ── Barra superior: el HUD de la consola ───────────────── */}
      <header ref={barra} className="filo-luz sticky top-0 z-40 bg-[#0b0718]/80 text-white backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-2.5 md:px-6 xl:flex-nowrap">
          <a href="#" className="group flex shrink-0 items-center gap-3">
            <span className="hexagono relative grid h-10 w-11 place-items-center bg-gradient-to-br from-[#FFC23D] via-[#FF6A13] to-[#FF2D8A] font-flemin text-[18px] text-[#1a1033] shadow-[0_0_24px_rgba(255,106,19,0.6)] transition group-hover:scale-105">
              F
            </span>
            <span className="leading-none">
              <span className="block font-flemin text-[17px] tracking-wide [text-shadow:0_2px_0_#1a1033,0_0_18px_rgba(255,106,19,0.45)]">
                Biblioteca <span className="bg-gradient-to-r from-[#FFC23D] to-[#FF2D8A] bg-clip-text text-transparent">3D</span>
              </span>
              <span className="mt-1 block font-chakra text-[10px] font-semibold uppercase tracking-[0.32em] text-white/50">Flemin · Edición coleccionista</span>
            </span>
          </a>

          <form
            className="order-last w-full xl:order-none xl:mx-auto xl:max-w-xl"
            onSubmit={(e) => {
              e.preventDefault()
              irAlCatalogo()
            }}
          >
            <label className="corte-sm flex items-center gap-2.5 bg-white/[0.07] px-4 ring-1 ring-inset ring-white/15 transition focus-within:bg-white/[0.11] focus-within:ring-[#FFC23D]/70">
              <Search size={17} className="shrink-0 text-[#FFC23D]" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Busca figuras, máscaras, soportes…"
                aria-label="Buscar modelos"
                className="w-full bg-transparent py-2.5 font-chakra text-[14px] tracking-wide text-white outline-none placeholder:text-white/40"
              />
              <span className="hidden font-chakra text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35 2xl:inline">{CATALOGO.length} figuras</span>
            </label>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-2 xl:ml-0">
            {import.meta.env.DEV && (
              <button type="button" onClick={() => setSubiendo(true)} className="btn-juego !px-3">
                <Plus size={16} /> <span className="hidden lg:inline">Subir</span>
              </button>
            )}
            {/* Recorrido 3D: la sala con las figuras en pedestales. Flemin Studio: la web aparte, por su portada. */}
            <button type="button" onClick={() => setEstudio({ vista: 'sala' })} className="btn-juego btn-plasma !px-3.5" title="Recorre la sala de figuras en 3D">
              <Box size={16} /> <span className="hidden sm:inline">Recorrido 3D</span>
            </button>
            <a href={enlaceStudio()} className="btn-juego !px-3.5" title="Abrir Flemin Studio 3D">
              <Scissors size={16} /> <span className="hidden xl:inline">Flemin Studio</span>
            </a>
            <button type="button" onClick={() => abrirManos()} className="btn-juego !px-3.5" title="Modo manos">
              <Hand size={16} /> <span className="hidden xl:inline">Modo manos</span>
            </button>
            {/* Nivel de jugador, como el perfil de la consola. */}
            <button type="button" onClick={abrirLogros} className="hidden items-center gap-2 pl-1 font-chakra lg:flex" title="Logros y colección">
              <span className="hexagono grid h-9 w-10 place-items-center bg-gradient-to-b from-[#8A3CFF] to-[#3b1a6e] text-[13px] font-bold text-white">
                {nivel(puntos).nivel}
              </span>
              <span className="text-left leading-tight">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#FFC23D]">
                  <Trophy size={11} /> Nivel
                </span>
                <span className="block text-[11px] tabular-nums text-white/55">
                  {nVistas}/{CATALOGO.length} vistas
                </span>
              </span>
            </button>
            <a href={ENLACE_MEDIDA} target="_blank" rel="noreferrer" className="btn-juego btn-fuego hidden !px-4 sm:inline-flex">
              <Zap size={15} /> A medida
            </a>
          </div>
        </div>
      </header>

      <main className="text-white">
        {/* ── Selección de figuras ────────────────────────────── */}
        <Seleccion
          lista={lista}
          grupos={grupos}
          acabado={acabado}
          setAcabado={setAcabado}
          conteo={conteo}
          cat={cat}
          setCat={setCat}
          activo={!abierto && !manos && !estudio && !subiendo && !logros && !inicio.ver}
          onFicha={verFicha}
          onManos={abrirManos}
          onCatalogo={irAlCatalogo}
          onLogros={abrirLogros}
        />

        {/* Cinta de secciones que desfila entre la arena y el catálogo. */}
        <div aria-hidden className="relative overflow-hidden border-y border-white/10 bg-gradient-to-r from-[#8A3CFF] via-[#FF2D8A] to-[#FF6A13] py-2.5">
          <div className="cinta gap-10 font-flemin text-[15px] uppercase tracking-wide text-[#140f22]">
            {[0, 1].map((k) => (
              <span key={k} className="flex gap-10">
                {CATEGORIAS.filter((x) => x.id !== 'todo').map((x) => (
                  <span key={x.id} className="flex items-center gap-10 whitespace-nowrap">
                    {x.nombre} <Sparkles size={14} />
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* ── Catálogo ────────────────────────────────────────── */}
        <section id="catalogo" className="relative scroll-mt-20">
          {/* Secciones: fijas bajo la barra al bajar, como las pestañas de un menú. */}
          <div className="sticky top-[var(--alto-barra,64px)] z-30 border-b border-white/10 bg-[#0b0718]/85 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5 md:px-6">
              <div className="sin-barra -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Secciones">
                {CATEGORIAS.map((x, i) => {
                  const n = x.id === 'todo' ? CATALOGO.length : CATALOGO.filter((m) => m.categoria === x.id).length
                  const activa = i === cat
                  // Una sección sin modelos no se enseña (salvo que sea la activa).
                  if (n === 0 && !activa) return null
                  const Icono = ICONO_CATEGORIA[x.id]
                  return (
                    <button
                      key={x.id}
                      type="button"
                      role="tab"
                      aria-selected={activa}
                      onClick={() => setCat(i)}
                      className={`pestana flex h-9 shrink-0 items-center gap-2 px-4 font-chakra text-[12px] font-bold uppercase tracking-[0.1em] transition-all duration-200 ${
                        activa ? 'pestana-activa' : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.14] hover:text-white'
                      }`}
                      style={{ '--d': x.desde, '--h': x.hasta } as CSSProperties}
                    >
                      <Icono size={15} style={activa ? undefined : { color: x.tinta }} />
                      {x.nombre}
                      <span className={`tabular-nums ${activa ? 'opacity-60' : 'text-white/35'}`}>{n}</span>
                    </button>
                  )
                })}
              </div>
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as Orden)}
                aria-label="Ordenar"
                className="corte-sm hidden shrink-0 bg-white/[0.07] px-3.5 py-2 font-chakra text-[12px] font-semibold uppercase tracking-wider text-white outline-none ring-1 ring-inset ring-white/15 transition hover:bg-white/[0.12] sm:block [&>option]:bg-[#140f22]"
              >
                <option value="recientes">Más recientes</option>
                <option value="barato">Precio: menor a mayor</option>
                <option value="caro">Precio: mayor a menor</option>
                <option value="nombre">Nombre A–Z</option>
              </select>
            </div>
          </div>

          <div className="mx-auto max-w-[1600px] px-4 pb-28 pt-12 md:px-6">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-x-4 gap-y-4">
              <div className="relative min-w-0">
                <p className="font-chakra text-[11px] font-semibold uppercase tracking-[0.4em] text-[#FFC23D]">Colección · {lista.length} figuras</p>
                <h2 className="titulo-seccion mt-2 text-[clamp(2rem,5vw,4.2rem)]" style={{ '--d': c.desde } as CSSProperties}>
                  {c.id === 'todo' ? 'Todo el catálogo' : c.nombre}
                </h2>
                {busqueda.trim() && <p className="mt-2 font-chakra text-[14px] uppercase tracking-wider text-white/55">Buscando “{busqueda.trim()}”</p>}
              </div>
              {/* Acabado: con color o sin textura. Se combina con la sección y la búsqueda. */}
              <div className="corte-sm flex bg-white/[0.06] p-1 ring-1 ring-inset ring-white/15" role="tablist" aria-label="Acabado">
                {(
                  [
                    { id: 'todos', nombre: 'Todos', n: conteo.todos },
                    { id: 'color', nombre: 'A color', n: conteo.color },
                    { id: 'sin-textura', nombre: 'Sin textura', n: conteo['sin-textura'] },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="tab"
                    aria-selected={acabado === o.id}
                    onClick={() => setAcabado(o.id)}
                    className={`pestana flex items-center gap-1.5 px-3.5 py-1.5 font-chakra text-[12px] font-bold uppercase tracking-wider transition-colors ${
                      acabado === o.id ? 'bg-white text-[#140f22]' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {o.id === 'color' && <span className="h-2 w-2 rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-sky-500" aria-hidden />}
                    {o.id === 'sin-textura' && <span className="h-2 w-2 rounded-full border border-current opacity-70" aria-hidden />}
                    {o.nombre}
                    <span className={`tabular-nums ${acabado === o.id ? 'opacity-50' : 'text-white/35'}`}>{o.n}</span>
                  </button>
                ))}
              </div>
            </div>

            {lista.length ? (
              <div key={`${c.id}-${orden}-${acabado}`}>
                {grupos.map((g, k) => {
                  const Icono = ICONO_CATEGORIA[g.categoria.id]
                  // Con una sola sección y un solo acabado el título de arriba ya lo dice todo.
                  const conTitulo = grupos.length > 1
                  const desde = grupos.slice(0, k).reduce((n, x) => n + x.modelos.length, 0)
                  return (
                    <div key={`${g.categoria.id}-${g.blanco}`} className={`relative ${k ? 'mt-20' : ''}`}>
                      {conTitulo && (
                        <div className="relative mb-8">
                          {/* El nombre de la sección en eco gigante detrás del rótulo. */}
                          <p aria-hidden className="eco-seccion pointer-events-none absolute -top-7 left-16 hidden text-[clamp(3rem,7vw,6.5rem)] md:block" style={{ '--d': g.categoria.desde } as CSSProperties}>
                            {g.categoria.nombre}
                          </p>
                          <div className="relative flex items-center gap-4">
                            <span
                              className="hexagono grid h-14 w-16 shrink-0 place-items-center text-white"
                              style={{ background: `linear-gradient(135deg, ${g.categoria.desde}, ${g.categoria.hasta})` }}
                            >
                              <Icono size={24} />
                            </span>
                            <div className="min-w-0">
                              <h3 className="titulo-seccion truncate text-[clamp(1.4rem,3vw,2.4rem)]" style={{ '--d': g.categoria.desde } as CSSProperties}>
                                {g.categoria.nombre}
                              </h3>
                              <p className="mt-1.5 flex items-center gap-2 font-chakra text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                                <span className={`rareza px-2 py-0.5 ${g.blanco ? 'text-white/80 ring-1 ring-white/30' : 'bg-white text-[#140f22]'}`}>{g.blanco ? 'Sin textura' : 'A color'}</span>
                                <span className="tabular-nums">{g.modelos.length} figuras</span>
                              </p>
                            </div>
                            <span className="ml-2 hidden h-[2px] flex-1 sm:block" style={{ background: `linear-gradient(90deg, ${g.categoria.desde}, ${g.categoria.hasta}55, transparent)` }} />
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-5 sm:gap-y-7 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                        {g.modelos.map((m, i) => (
                          <div key={m.id} className="entra" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                            <Tarjeta modelo={m} numero={desde + i + 1} onAbrir={() => setAbierto(m.id)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="cristal corte px-6 py-20 text-center">
                <p className="font-flemin text-2xl">Nada por aquí todavía</p>
                <p className="mt-2 font-chakra uppercase tracking-wider text-white/55">Prueba con otra búsqueda o pide un modelo a medida.</p>
                <a href={ENLACE_MEDIDA} target="_blank" rel="noreferrer" className="btn-juego btn-fuego mt-6">
                  Pedir a medida
                </a>
              </div>
            )}
          </div>
        </section>

        {/* ── Cómo funciona: tres misiones ────────────────────── */}
        <section className="relative overflow-hidden border-t border-white/10">
          <div aria-hidden className="haces absolute inset-0" />
          <div className="relative mx-auto max-w-[1600px] px-4 py-24 md:px-6">
            <p className="font-chakra text-[11px] font-semibold uppercase tracking-[0.4em] text-[#FFC23D]">Modo historia</p>
            <h2 className="titulo-seccion mt-2 text-[clamp(2rem,4.5vw,3.6rem)]" style={{ '--d': '#FF6A13' } as CSSProperties}>
              Tres misiones
            </h2>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                { n: '01', titulo: 'Gíralo', texto: 'Cada pieza se carga en 3D: textura, arcilla o malla. O sostenla en tu mano con el modo manos.', Icono: Box, d: '#8A3CFF' },
                { n: '02', titulo: 'Pídelo', texto: 'Arma tu equipo de hasta cinco figuras. El botón de compra abre WhatsApp con el pedido ya escrito.', Icono: Gamepad2, d: '#FF2D8A' },
                { n: '03', titulo: 'Úsalo', texto: 'Entrega digital en los formatos de la ficha, lista para imprimir o renderizar, con uso personal y comercial.', Icono: Trophy, d: '#FF6A13' },
              ].map((p) => (
                <div key={p.n} className="cristal corte group relative overflow-hidden p-7 transition hover:-translate-y-1">
                  <span aria-hidden className="absolute -right-4 -top-8 font-flemin text-[8rem] leading-none text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.12)]">{p.n}</span>
                  <span className="hexagono grid h-14 w-16 place-items-center text-white" style={{ background: `linear-gradient(135deg, ${p.d}, #1a1033)` }}>
                    <p.Icono size={24} />
                  </span>
                  <p className="mt-6 font-chakra text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">Misión {p.n}</p>
                  <h3 className="mt-1 font-flemin text-[28px] leading-tight">{p.titulo}</h3>
                  <p className="mt-3 max-w-sm leading-relaxed text-white/65">{p.texto}</p>
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100" style={{ background: `linear-gradient(90deg, ${p.d}, #FFC23D)` }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Contacto ────────────────────────────────────────── */}
        <footer className="relative overflow-hidden border-t border-white/10 bg-[#07050d]/80">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-10 overflow-hidden opacity-60">
            <div className="cinta gap-12 font-flemin text-[clamp(4rem,12vw,10rem)] uppercase leading-none text-transparent [-webkit-text-stroke:1.5px_rgba(255,194,61,0.18)]">
              {[0, 1].map((k) => (
                <span key={k} className="flex gap-12 whitespace-nowrap">
                  <span>Biblioteca 3D</span>
                  <span>Flemin</span>
                  <span>Edición coleccionista</span>
                </span>
              ))}
            </div>
          </div>
          <div className="relative mx-auto max-w-[1600px] px-4 pb-12 pt-40 md:px-6">
            <h2 className="titulo-seccion max-w-3xl text-[clamp(2.2rem,5vw,4.4rem)]" style={{ '--d': '#FF2D8A' } as CSSProperties}>
              ¿Buscas algo que no está aquí?
            </h2>
            <p className="mt-5 max-w-lg text-white/65">Modelos a medida, adaptaciones para impresión 3D o retopología para juego. Cuéntame qué necesitas.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={ENLACE_MEDIDA} target="_blank" rel="noreferrer" className="btn-juego btn-fuego !h-12 !px-6">
                <MessageCircle size={17} /> WhatsApp
              </a>
              <a href={`mailto:${CORREO}`} className="btn-juego !h-12 !px-6 !normal-case">
                {CORREO}
              </a>
            </div>
            <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 font-chakra text-[12px] uppercase tracking-[0.2em] text-white/45">
              <p>© 2026 Lenin Bonilla · Quito, EC</p>
              <div className="flex gap-5">
                <a href="https://fleremiasflemin20-maker.github.io/Portafolio-fleremiasflemin/" target="_blank" rel="noreferrer" className="hover:text-[#FFC23D]">
                  Portafolio
                </a>
                <a href="https://www.linkedin.com/in/fleremahiaslenin" target="_blank" rel="noreferrer" className="hover:text-[#FFC23D]">
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
      {logros && <PanelLogros onCerrar={() => setLogros(false)} />}
      {inicio.ver && <Inicio onEntrar={inicio.cerrar} />}
      <Avisos />

      {estudio && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 grid place-items-center bg-[#0D0A14]">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-[#FF6A13]" />
            </div>
          }
        >
          <Sala
            onCerrar={() => setEstudio(null)}
            onEditor={(m) => location.assign(enlaceStudio(m))}
            onSeparador={() => location.assign(enlaceStudio())}
            onFicha={(id) => {
              setEstudio(null)
              verFicha(id)
            }}
          />
        </Suspense>
      )}

      {/* Solo en desarrollo: fotografía las piezas que aún no tienen portada. */}
      {pendientes.length > 0 && <Portadas pendientes={pendientes} alAvanzar={setSinPortada} />}
      {sinPortada > 0 && (
        <p className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 bg-black/80 px-4 py-2 font-chakra text-xs uppercase tracking-wider text-white ring-1 ring-white/20">
          Generando portadas · faltan {sinPortada}
        </p>
      )}
    </>
  )
}
