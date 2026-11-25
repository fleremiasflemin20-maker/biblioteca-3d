import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { rutaPortada, textoArmado, type Modelo3D } from '../lib/catalogo'
import { BOCADILLOS, ONOMATOPEYAS, TAPAS, semilla } from '../lib/comic'
import { enlaceHistoria } from '../lib/historias'
import type { Grupo } from '../lib/orden'
import { sfx } from '../lib/consola'

/**
 * El catálogo como un cómic de verdad: cada sección es un capítulo y las
 * figuras salen en viñetas, página por página. Las hojas se pasan con giro 3D
 * (flechas, teclado, deslizar o tocar el borde de la página). En escritorio se
 * ve el libro abierto a doble página; en el móvil, una página.
 *
 * Las figuras a color salen en viñetas de cómic a color; las "para pintar",
 * en blanco y negro con trama, como un manga.
 */

type Pagina =
  | { tipo: 'portada' }
  | { tipo: 'indice' }
  | { tipo: 'capitulo'; grupo: Grupo; n: number }
  | { tipo: 'vinetas'; modelos: { m: Modelo3D; numero: number }[]; plantilla: number; grupo: Grupo }
  | { tipo: 'fin' }

/** Composiciones de página: cuántas viñetas y cómo se reparten (grid-template-areas). */
const PLANTILLAS: { n: number; areas: string; filas: string; cols: string }[] = [
  { n: 3, areas: '"a a" "b c"', filas: '1.15fr 1fr', cols: '1fr 1fr' },
  { n: 4, areas: '"a b" "c d"', filas: '1fr 1fr', cols: '1.1fr 1fr' },
  { n: 4, areas: '"a b" "a c" "d d"', filas: '1fr 1fr 1.05fr', cols: '1.15fr 1fr' },
  { n: 5, areas: '"a a b" "c d d" "e e e"', filas: '1fr 1fr 1fr', cols: '1fr 1fr 1fr' },
  { n: 3, areas: '"a" "b" "c"', filas: '1fr 1fr 1fr', cols: '1fr' },
  { n: 4, areas: '"a a" "b c" "d d"', filas: '1fr 1.1fr 1fr', cols: '1fr 1fr' },
]
// Orden en que se van usando: variado, sin repetir la misma dos veces seguidas.
const SECUENCIA = [1, 0, 3, 2, 5, 1, 4, 3, 0, 2]
const AREAS = 'abcde'

function paginar(grupos: Grupo[]): Pagina[] {
  const p: Pagina[] = [{ tipo: 'portada' }, { tipo: 'indice' }]
  let numero = 0
  let s = 0
  grupos.forEach((g, k) => {
    p.push({ tipo: 'capitulo', grupo: g, n: k + 1 })
    let i = 0
    while (i < g.modelos.length) {
      let pl = SECUENCIA[s++ % SECUENCIA.length]
      const quedan = g.modelos.length - i
      // La última página del capítulo usa una composición que encaje con las que quedan.
      if (quedan < PLANTILLAS[pl].n) pl = quedan === 1 ? -1 : quedan === 2 ? -2 : PLANTILLAS.findIndex((x) => x.n === quedan)
      const n = pl === -1 ? 1 : pl === -2 ? 2 : PLANTILLAS[pl].n
      p.push({ tipo: 'vinetas', modelos: g.modelos.slice(i, i + n).map((m, j) => ({ m, numero: numero + i + j + 1 })), plantilla: pl, grupo: g })
      i += n
    }
    numero += g.modelos.length
  })
  p.push({ tipo: 'fin' })
  if (p.length % 2) p.splice(p.length - 1, 0, { tipo: 'fin' })
  return p
}

const plantillaDe = (pl: number) =>
  pl === -1 ? { n: 1, areas: '"a"', filas: '1fr', cols: '1fr' } : pl === -2 ? { n: 2, areas: '"a" "b"', filas: '1fr 1fr', cols: '1fr' } : PLANTILLAS[pl]

/* ── Viñeta ───────────────────────────────────────────────────────────── */

function Vineta({ m, numero, area, grupo, onAbrir }: { m: Modelo3D; numero: number; area: string; grupo: Grupo; onAbrir: (m: Modelo3D) => void }) {
  const r = semilla(m.id)
  const r2 = semilla(m.id + 'b')
  const manga = !!m.sinTextura
  const portada = rutaPortada(m)
  const armado = textoArmado(m)
  // Bordes un poco torcidos, distintos en cada viñeta, como dibujados a mano.
  const k = (v: number) => (v * 3.5).toFixed(1)
  const forma = `polygon(${k(r)}% 0, 100% ${k(r2)}%, ${100 - +k(semilla(m.id + 'c'))}% 100%, 0 ${100 - +k(semilla(m.id + 'd'))}%)`
  const nueva = !!m.alta && Date.now() - Date.parse(m.alta) < 10 * 864e5
  const historia = !!enlaceHistoria(m)
  const centro = `${30 + r * 40}% ${45 + r2 * 25}%`
  return (
    <button
      type="button"
      onClick={() => onAbrir(m)}
      className={`vineta group ${manga ? 'vineta-manga' : ''}`}
      style={{ gridArea: area, '--forma': forma, '--d': grupo.categoria.desde, '--h': grupo.categoria.hasta, '--c': centro } as CSSProperties}
      aria-label={`${m.nombre}${historia ? ' · ver su historia' : ''}`}
    >
      <span className="vineta-dentro">
        <span aria-hidden className="vineta-rayos" />
        <span aria-hidden className="vineta-trama" />
        {portada && <img src={portada} alt="" loading="lazy" decoding="async" className="vineta-figura" style={{ '--giro': `${(r - 0.5) * 8}deg` } as CSSProperties} />}
        {/* Recuadro de narración: número y sección. */}
        <span className="cartela-comic vineta-cartela">
          No.{String(numero).padStart(3, '0')}
          {armado && <> · {armado}</>}
        </span>
        {r > 0.62 && <span aria-hidden className="vineta-onomatopeya rotulo-comic" style={{ '--r': `${(r2 - 0.5) * 30}deg` } as CSSProperties}>{ONOMATOPEYAS[Math.floor(r2 * ONOMATOPEYAS.length)]}</span>}
        {r < 0.42 && !manga && <span aria-hidden className="vineta-globo">{BOCADILLOS[Math.floor(r2 * BOCADILLOS.length)]}</span>}
        {nueva && <span className="vineta-nueva rotulo-comic">¡Nuevo!</span>}
        <span className="vineta-nombre">
          <span className="rotulo-comic">{m.nombre}</span>
          <span className="vineta-accion">{historia ? 'Ver su historia ↗' : manga ? 'Para pintar · ver en 3D' : 'Ver en 3D →'}</span>
        </span>
      </span>
    </button>
  )
}

/* ── Páginas ──────────────────────────────────────────────────────────── */

function Hoja({ p, num, lado, total, onAbrir, irA, capitulos }: { p: Pagina | undefined; num: number; lado: 'izq' | 'der'; total: number; onAbrir: (m: Modelo3D) => void; irA: (n: number) => void; capitulos: { n: number; grupo: Grupo; pagina: number }[] }) {
  let dentro: ReactNode = null
  if (!p) dentro = null
  else if (p.tipo === 'portada') {
    const tapa = TAPAS[0]
    dentro = (
      <div className="hoja-portada">
        {tapa && <img src={tapa.url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      </div>
    )
  } else if (p.tipo === 'indice') {
    dentro = (
      <div className="flex h-full flex-col p-[7%] text-[#121019]">
        <p className="font-comic text-[11cqw] leading-none">Índice</p>
        <p className="mt-1 font-chakra text-[2.6cqw] font-bold uppercase tracking-[0.25em] text-[#121019]/60">Capítulos de esta edición</p>
        <ol className={`mt-[5%] grid flex-1 content-start gap-x-[5%] gap-y-[1.2cqw] overflow-hidden ${capitulos.length > 12 ? 'grid-cols-2 [--t:0.62]' : '[--t:1]'}`}>
          {capitulos.map((c) => (
            <li key={c.n}>
              <button type="button" onClick={() => irA(c.pagina)} className="indice-linea group flex w-full items-baseline gap-2 text-left">
                <span className="font-comic text-[calc(4.6cqw*var(--t))] leading-none" style={{ color: c.grupo.categoria.desde }}>{c.n}.</span>
                <span className="truncate font-chakra text-[calc(3.3cqw*var(--t))] font-bold uppercase tracking-wide group-hover:underline">
                  {c.grupo.categoria.nombre}
                  <span className="font-semibold text-[#121019]/50"> · {c.grupo.blanco ? 'para pintar' : 'a color'}</span>
                </span>
                <span className="mb-[0.6cqw] flex-1 border-b-2 border-dotted border-[#121019]/30" />
                <span className="font-comic text-[calc(4cqw*var(--t))] tabular-nums">{c.pagina + 1}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-3 font-chakra text-[2.5cqw] uppercase tracking-[0.2em] text-[#121019]/55">Toca una viñeta para ver la figura en 3D</p>
      </div>
    )
  } else if (p.tipo === 'capitulo') {
    const g = p.grupo
    const fotos = g.modelos.filter((m) => m.portada).slice(0, 3)
    dentro = (
      <div className="hoja-capitulo" style={{ '--d': g.categoria.desde, '--h': g.categoria.hasta } as CSSProperties}>
        <span aria-hidden className="vineta-rayos" style={{ '--c': '50% 62%' } as CSSProperties} />
        <span aria-hidden className="vineta-trama" />
        <div className="relative z-[2] p-[7%]">
          <p className="cartela-comic inline-block -rotate-2 px-2.5 py-0.5 font-comic text-[4.4cqw] uppercase tracking-widest">Capítulo {p.n}</p>
          <h3 className="rotulo-comic mt-[3%] text-[clamp(1rem,11cqw,6rem)] uppercase leading-[0.92] text-white">{g.categoria.nombre}</h3>
          <p className="mt-[2%] inline-block bg-[#121019] px-2 py-0.5 font-chakra text-[2.8cqw] font-bold uppercase tracking-[0.2em] text-white">
            {g.modelos.length} figuras · {g.blanco ? 'para pintar' : 'a color'}
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-[6%] top-[38%] z-[1]">
          {fotos.map((m, i) => (
            <img
              key={m.id}
              src={rutaPortada(m)}
              alt=""
              loading="lazy"
              className={`vineta-figura absolute bottom-0 h-[82%] w-[58%] object-contain ${g.blanco ? 'grayscale' : ''}`}
              style={{ left: `${[21, -4, 46][i]}%`, zIndex: [3, 1, 2][i], height: `${[96, 72, 78][i]}%` }}
            />
          ))}
        </div>
        <p className="absolute bottom-[3%] right-[5%] z-[4] font-comic text-[4cqw] uppercase text-white [text-shadow:2px_2px_0_#121019]">Pasa la página →</p>
      </div>
    )
  } else if (p.tipo === 'vinetas') {
    const pl = plantillaDe(p.plantilla)
    dentro = (
      <div className="hoja-vinetas" style={{ gridTemplateAreas: pl.areas, gridTemplateRows: pl.filas, gridTemplateColumns: pl.cols }}>
        {p.modelos.map(({ m, numero }, i) => (
          <Vineta key={m.id} m={m} numero={numero} area={AREAS[i]} grupo={p.grupo} onAbrir={onAbrir} />
        ))}
      </div>
    )
  } else {
    dentro = (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-[8%] text-center text-[#121019]">
        <p className="rotulo-comic text-[14cqw] leading-none text-[#FFE45C]">¿Fin?</p>
        <p className="font-chakra text-[3.4cqw] font-bold uppercase tracking-[0.2em]">Continuará con las próximas figuras…</p>
        <p className="max-w-[80%] text-[3.2cqw] text-[#121019]/70">¿Quieres un personaje que no está? Te lo modelamos a medida.</p>
      </div>
    )
  }
  return (
    <div className={`hoja hoja-${lado} ${p?.tipo === 'portada' ? 'hoja-tapa' : ''}`}>
      {dentro}
      {p && p.tipo !== 'portada' && <span className="hoja-numero">{num + 1} / {total}</span>}
      <span aria-hidden className="hoja-pliegue" />
    </div>
  )
}

/* ── Libro ────────────────────────────────────────────────────────────── */

type Giro = { dir: 1 | -1; destino: number }

export function LibroComic({ grupos, onAbrir }: { grupos: Grupo[]; onAbrir: (m: Modelo3D) => void }) {
  const paginas = useMemo(() => paginar(grupos), [grupos])
  const capitulos = useMemo(() => paginas.flatMap((p, i) => (p.tipo === 'capitulo' ? [{ n: p.n, grupo: p.grupo, pagina: i }] : [])), [paginas])
  const [doble, setDoble] = useState(() => matchMedia('(min-width: 900px)').matches)
  const paso = doble ? 2 : 1
  const [vista, setVista] = useState(0)
  const [giro, setGiro] = useState<Giro | null>(null)
  const raiz = useRef<HTMLDivElement>(null)
  const visible = useRef(false)

  useEffect(() => {
    const mq = matchMedia('(min-width: 900px)')
    const c = () => setDoble(mq.matches)
    mq.addEventListener('change', c)
    return () => mq.removeEventListener('change', c)
  }, [])
  // Con doble página la vista siempre empieza en página par (izquierda).
  useEffect(() => setVista((v) => (doble ? v - (v % 2) : v)), [doble])
  // Al cambiar filtros o búsqueda el libro se abre otra vez por el principio.
  useEffect(() => {
    setVista(0)
    setGiro(null)
  }, [paginas])

  const ultima = doble ? paginas.length - 2 : paginas.length - 1
  const pasar = useCallback(
    (dir: 1 | -1, destino?: number) => {
      if (giro) return
      const d = destino ?? vista + dir * paso
      if (d < 0 || d > ultima || d === vista) return
      sfx.hoja()
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setVista(d)
      setGiro({ dir, destino: d })
    },
    [giro, vista, paso, ultima],
  )
  const irA = useCallback(
    (n: number) => {
      const d = Math.min(ultima, doble ? n - (n % 2) : n)
      pasar(d > vista ? 1 : -1, d)
    },
    [doble, pasar, ultima, vista],
  )
  const fin = useCallback(() => {
    if (!giro) return
    setVista(giro.destino)
    setGiro(null)
  }, [giro])

  // Teclado: flechas cuando el libro está a la vista.
  useEffect(() => {
    const el = raiz.current
    if (!el) return
    const o = new IntersectionObserver(([e]) => (visible.current = e.intersectionRatio > 0.55), { threshold: [0, 0.55, 1] })
    o.observe(el)
    const tecla = (e: KeyboardEvent) => {
      if (!visible.current || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowRight') (e.preventDefault(), e.stopPropagation(), pasar(1))
      if (e.key === 'ArrowLeft') (e.preventDefault(), e.stopPropagation(), pasar(-1))
    }
    addEventListener('keydown', tecla, true)
    return () => (o.disconnect(), removeEventListener('keydown', tecla, true))
  }, [pasar])

  // Precarga las portadas de la siguiente doble página para que el giro no muestre huecos.
  useEffect(() => {
    for (const p of paginas.slice(vista + paso, vista + paso * 3)) if (p.tipo === 'vinetas') p.modelos.forEach(({ m }) => m.portada && (new Image().src = rutaPortada(m)!))
  }, [vista, paso, paginas])

  // Deslizar con el dedo o arrastrar con el ratón pasa la hoja.
  const toque = useRef<{ x: number; y: number } | null>(null)

  const pag = (i: number, lado: 'izq' | 'der') => <Hoja key={i} p={paginas[i]} num={i} lado={lado} total={paginas.length} onAbrir={onAbrir} irA={irA} capitulos={capitulos} />

  // Lo que se ve debajo de la hoja que gira, y las dos caras de la hoja.
  let base: ReactNode
  let hoja: ReactNode = null
  if (doble) {
    const [i, d] = giro ? (giro.dir > 0 ? [vista, giro.destino + 1] : [giro.destino, vista + 1]) : [vista, vista + 1]
    base = (
      <>
        {pag(i, 'izq')}
        {pag(d, 'der')}
      </>
    )
    if (giro)
      hoja =
        giro.dir > 0 ? (
          <div key={`g${vista}`} className="hoja-giro hoja-giro-der" onAnimationEnd={fin}>
            <div className="cara">{pag(vista + 1, 'der')}</div>
            <div className="cara cara-atras">{pag(giro.destino, 'izq')}</div>
          </div>
        ) : (
          <div key={`g${vista}`} className="hoja-giro hoja-giro-izq" onAnimationEnd={fin}>
            <div className="cara">{pag(vista, 'izq')}</div>
            <div className="cara cara-atras">{pag(giro.destino + 1, 'der')}</div>
          </div>
        )
  } else {
    base = pag(giro ? (giro.dir > 0 ? giro.destino : vista) : vista, 'der')
    if (giro)
      hoja =
        giro.dir > 0 ? (
          <div key={`g${vista}`} className="hoja-giro hoja-giro-sola" onAnimationEnd={fin}>
            <div className="cara">{pag(vista, 'der')}</div>
            <div className="cara cara-atras hoja-reverso" />
          </div>
        ) : (
          <div key={`g${vista}`} className="hoja-giro hoja-giro-sola-vuelve" onAnimationEnd={fin}>
            <div className="cara">{pag(giro.destino, 'der')}</div>
            <div className="cara cara-atras hoja-reverso" />
          </div>
        )
  }

  const pagina = Math.min(paginas.length, vista + 1)
  const capActual = capitulos.filter((c) => c.pagina <= vista + paso - 1).at(-1)
  return (
    <div ref={raiz} className="libro-zona">
      <div
        className={`libro ${doble ? 'libro-doble' : 'libro-simple'}`}
        onPointerDown={(e) => (toque.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const t = toque.current
          toque.current = null
          if (!t) return
          const dx = e.clientX - t.x
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - t.y)) pasar(dx < 0 ? 1 : -1)
        }}
      >
        {base}
        {hoja}
        <span aria-hidden className="libro-lomo" />
        {/* Esquinas para pasar la hoja con un toque. */}
        <button type="button" aria-label="Página anterior" className="libro-esquina libro-esquina-izq" onClick={() => pasar(-1)} disabled={vista === 0} />
        <button type="button" aria-label="Página siguiente" className="libro-esquina libro-esquina-der" onClick={() => pasar(1)} disabled={vista >= ultima} />
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 sm:gap-3">
        <button type="button" onClick={() => pasar(-1)} disabled={vista === 0} className="libro-boton" aria-label="Página anterior">
          <ChevronLeft size={20} /> <span className="hidden sm:inline">Atrás</span>
        </button>
        <select
          value={capActual?.pagina ?? 0}
          onChange={(e) => irA(+e.target.value)}
          aria-label="Ir a un capítulo"
          className="libro-capitulos"
        >
          <option value={0}>Portada e índice</option>
          {capitulos.map((c) => (
            <option key={c.n} value={c.pagina}>
              Cap. {c.n} · {c.grupo.categoria.nombre}
              {c.grupo.blanco ? ' (para pintar)' : ''}
            </option>
          ))}
        </select>
        <span className="shrink-0 whitespace-nowrap font-comic text-[18px] tabular-nums tracking-wider text-white">
          {doble && vista + 2 <= paginas.length ? `${pagina}-${pagina + 1}` : pagina} <span className="text-white/45">/ {paginas.length}</span>
        </span>
        <button type="button" onClick={() => pasar(1)} disabled={vista >= ultima} className="libro-boton libro-boton-sig" aria-label="Página siguiente">
          <span className="hidden sm:inline">Siguiente</span> <ChevronRight size={20} />
        </button>
      </div>
      <p className="mt-2 text-center font-chakra text-[11px] uppercase tracking-[0.22em] text-white/45">Desliza, usa las flechas ← → o toca la esquina de la hoja</p>
    </div>
  )
}
