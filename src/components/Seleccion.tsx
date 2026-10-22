import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { ArrowDown, Box, Check, Hand, MessageCircle, Plus, Scissors, ShoppingBag, Star, Volume2, VolumeX, X } from 'lucide-react'
import { AlCargar, Pieza, type Modo } from './Pieza'
import { Normalizar } from './Visor'
import { AmbienteFlemin } from '../estudio/luces'
import { CATEGORIAS, WHATSAPP, enlaceCompra, precio, rutaPortada, triangulos, type Modelo3D } from '../lib/catalogo'
import { ICONO_CATEGORIA } from '../lib/iconos'
import { enlaceStudio } from '../lib/studio'
import { variantes, type Acabado, type Grupo } from '../lib/orden'

/**
 * La portada de la biblioteca como una pantalla de selección de personajes de
 * juego de pelea: la rejilla de retratos en un panel de cristal inclinado, la
 * figura elegida en 3D a la derecha, su nombre enorme, estrellas de detalle,
 * acabados como "transformaciones" y las acciones como lista de técnicas. El
 * "equipo" de arriba es el pedido: hasta cinco figuras que se piden juntas.
 *
 * Se maneja con mouse, teclado (flechas, Enter, Espacio, Q/E, 1-3) o mando.
 */
const COLUMNAS = 6
const MAX_PEDIDO = 5

const FILTROS: { id: Acabado; nombre: string }[] = [
  { id: 'todos', nombre: 'Todo' },
  { id: 'color', nombre: 'A color' },
  { id: 'sin-textura', nombre: 'Sin color' },
]

/** Recién subida: los últimos diez días llevan la etiqueta de nueva. */
const esNueva = (m: Modelo3D) => !!m.alta && Date.now() - Date.parse(m.alta) < 10 * 864e5

const ACABADOS: { modo: Modo; nombre: string }[] = [
  { modo: 'textura', nombre: 'A color' },
  { modo: 'arcilla', nombre: 'Arcilla' },
  { modo: 'malla', nombre: 'Malla' },
]

/** De 1 a 7 estrellas según los triángulos: cuánto detalle trae la pieza. */
function estrellas(m: Modelo3D) {
  if (!m.triangulos) return 3
  return Math.max(1, Math.min(7, Math.round(Math.log10(m.triangulos) * 2 - 6)))
}

/* ── Sonido de cursor (WebAudio, sin archivos) ─────────────────────────── */

let audio: AudioContext | null = null
function blip(agudo: boolean) {
  try {
    audio ??= new AudioContext()
    const o = audio.createOscillator()
    const g = audio.createGain()
    o.type = 'triangle'
    o.frequency.value = agudo ? 1320 : 660
    g.gain.setValueAtTime(0.06, audio.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + (agudo ? 0.18 : 0.07))
    o.connect(g).connect(audio.destination)
    o.start()
    o.stop(audio.currentTime + 0.2)
  } catch {
    /* sin audio: no pasa nada */
  }
}

/* ── Escenario 3D ─────────────────────────────────────────────────────── */

/** La figura con su entrada (sube y crece) y su "respiración" de pose de selección. */
function Figura({ modelo, modo, visible, onListo }: { modelo: Modelo3D; modo: Modo; visible: boolean; onListo: () => void }) {
  const g = useRef<THREE.Group>(null)
  const inicio = useRef<number | null>(null)
  useFrame(({ clock }) => {
    const grupo = g.current
    if (!grupo) return
    if (!visible) {
      inicio.current = null
      return
    }
    inicio.current ??= clock.elapsedTime
    const t = clock.elapsedTime
    const e = Math.min(1, (t - inicio.current) / 0.55)
    const k = 1 - (1 - e) ** 3
    grupo.scale.setScalar(0.82 + 0.18 * k)
    grupo.position.y = -0.35 * (1 - k) + Math.sin(t * 1.6) * 0.025
    // Se mece de un lado a otro, como un personaje esperando a ser elegido.
    grupo.rotation.y = -0.35 + Math.sin(t * 0.45) * 0.45 + (1 - k) * 1.4
  })
  return (
    <group ref={g} visible={visible}>
      <Normalizar>
        <Pieza modelo={modelo} modo={modo} />
      </Normalizar>
      <AlCargar onListo={onListo} />
    </group>
  )
}

/** Pedestal: disco oscuro, aro de energía que gira y una onda al cambiar de figura. */
function Pedestal({ tinta, pulso }: { tinta: string; pulso: number }) {
  const aro = useRef<THREE.Mesh>(null)
  const onda = useRef<THREE.Mesh>(null)
  const desde = useRef(0)
  const ultimo = useRef(pulso)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (aro.current) aro.current.rotation.z = t * 0.6
    if (ultimo.current !== pulso) {
      ultimo.current = pulso
      desde.current = t
    }
    const o = onda.current
    if (o) {
      const e = Math.min(1, (t - desde.current) / 0.9)
      o.scale.setScalar(0.5 + e * 1.8)
      ;(o.material as THREE.MeshBasicMaterial).opacity = (1 - e) * 0.8
    }
  })
  return (
    <group position={[0, -1.005, 0]} rotation-x={-Math.PI / 2}>
      <mesh>
        <circleGeometry args={[1.02, 64]} />
        <meshStandardMaterial color="#0d0b16" roughness={0.6} metalness={0.4} transparent opacity={0.85} />
      </mesh>
      <mesh ref={aro} position-z={0.002}>
        <ringGeometry args={[1.0, 1.06, 64, 1, 0, Math.PI * 1.6]} />
        <meshBasicMaterial color={tinta} toneMapped={false} />
      </mesh>
      <mesh position-z={0.001}>
        <ringGeometry args={[1.1, 1.125, 64]} />
        <meshBasicMaterial color={tinta} transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <mesh ref={onda} position-z={0.003}>
        <ringGeometry args={[0.95, 1, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Escenario({ modelo, modo, tinta, onMostrado }: { modelo: Modelo3D; modo: Modo; tinta: string; onMostrado: (id: string) => void }) {
  // La figura anterior sigue en pantalla hasta que la nueva termina de cargar.
  const [mostrado, setMostrado] = useState<Modelo3D>(modelo)
  const [pulso, setPulso] = useState(0)
  const listo = useCallback(() => {
    setMostrado(modelo)
    setPulso((p) => p + 1)
    onMostrado(modelo.id)
  }, [modelo, onMostrado])
  const figuras = mostrado.id === modelo.id ? [modelo] : [mostrado, modelo]

  return (
    <Canvas dpr={[1, 1.75]} camera={{ fov: 30, position: [0, 0.3, 6.6] }} gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}>
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 5, 3]} intensity={1.5} />
      <spotLight position={[-3.5, 3, -2.5]} intensity={45} angle={0.8} penumbra={1} color={tinta} />
      <spotLight position={[3.5, 2, -3]} intensity={25} angle={0.8} penumbra={1} color="#8A3CFF" />
      <AmbienteFlemin ambiente="estudio" intensidad={0.8} />
      {figuras.map((m) => (
        <Suspense key={m.id} fallback={null}>
          <Figura modelo={m} modo={modo} visible={m.id === mostrado.id} onListo={m.id === modelo.id ? listo : noop} />
        </Suspense>
      ))}
      <Pedestal tinta={tinta} pulso={pulso} />
      <ContactShadows position={[0, -0.995, 0]} opacity={0.6} scale={5} blur={2.4} far={3} />
      <Sparkles count={60} scale={[4, 3, 2]} position={[0, 0.2, 0]} size={2.2} speed={0.35} color={tinta} opacity={0.8} />
    </Canvas>
  )
}
const noop = () => {}

/* ── Pantalla de selección ────────────────────────────────────────────── */

export function Seleccion({
  lista,
  grupos,
  acabado,
  setAcabado,
  conteo,
  cat,
  setCat,
  activo,
  onFicha,
  onManos,
  onCatalogo,
}: {
  /** Ya ordenada: es `grupos` aplanado. */
  lista: Modelo3D[]
  /** Los bloques sección × acabado que la rejilla enseña con su rótulo. */
  grupos: Grupo[]
  acabado: Acabado
  setAcabado: (a: Acabado) => void
  conteo: Record<Acabado, number>
  cat: number
  setCat: (i: number) => void
  /** Falso mientras hay una ficha, el modo manos u otra capa abierta: el teclado es suyo. */
  activo: boolean
  onFicha: (id: string) => void
  onManos: (id: string) => void
  onCatalogo: () => void
}) {
  const [cursor, setCursor] = useState(() => Math.max(0, lista.findIndex((m) => m.destacado)))
  const [elegido, setElegido] = useState<string | null>(null)
  const [mostrado, setMostrado] = useState<string | null>(null)
  const [modo, setModo] = useState<Modo>('textura')
  const [pedido, setPedido] = useState<string[]>([])
  const [sonido, setSonido] = useState(false)
  const [enVista, setEnVista] = useState(true)
  const raiz = useRef<HTMLElement>(null)
  const rejilla = useRef<HTMLDivElement>(null)

  const i = Math.min(cursor, Math.max(0, lista.length - 1))
  const actual = lista[i]
  // La figura en 3D sigue al cursor con un respiro: recorrer la rejilla rápido no carga cada modelo.
  useEffect(() => {
    if (!actual) return
    const t = setTimeout(() => setElegido(actual.id), 160)
    return () => clearTimeout(t)
  }, [actual])
  const enEscena = lista.find((m) => m.id === elegido) ?? actual
  const catEscena = CATEGORIAS.find((c) => c.id === enEscena?.categoria) ?? CATEGORIAS[0]
  const cargando = !!enEscena && mostrado !== enEscena.id

  const mover = useCallback(
    (paso: number) => {
      if (!lista.length) return
      setCursor((c) => {
        const n = Math.min(lista.length - 1, Math.max(0, Math.min(c, lista.length - 1) + paso))
        if (n !== c && sonido) blip(false)
        return n
      })
    },
    [lista.length, sonido],
  )
  // Cada bloque empieza fila nueva bajo su rótulo, así que arriba/abajo no es
  // ±6: se busca la pieza de la fila vecina más cercana a la misma columna.
  const celdas = useMemo(() => {
    const r: { fila: number; col: number }[] = []
    let fila = 0
    for (const g of grupos) {
      g.modelos.forEach((_, k) => r.push({ fila: fila + Math.floor(k / COLUMNAS), col: k % COLUMNAS }))
      fila += Math.ceil(g.modelos.length / COLUMNAS)
    }
    return r
  }, [grupos])
  const moverFila = useCallback(
    (paso: number) => {
      setCursor((c) => {
        const a = celdas[Math.min(c, celdas.length - 1)]
        if (!a) return c
        let n = c
        celdas.forEach((x, k) => {
          if (x.fila === a.fila + paso && (n === c || Math.abs(x.col - a.col) < Math.abs(celdas[n].col - a.col))) n = k
        })
        if (n !== c && sonido) blip(false)
        return n
      })
    },
    [celdas, sonido],
  )
  const alternarPedido = useCallback(
    (id: string) => {
      setPedido((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_PEDIDO ? p : [...p, id]))
      if (sonido) blip(true)
    },
    [sonido],
  )
  const cambiarSeccion = useCallback(
    (paso: number) => {
      const visibles = CATEGORIAS.map((_, k) => k)
      setCat(visibles[(cat + paso + visibles.length) % visibles.length])
      setCursor(0)
    },
    [cat, setCat],
  )

  // El retrato con el cursor siempre a la vista dentro de la rejilla.
  useEffect(() => {
    rejilla.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [i])

  // ¿La pantalla de selección está a la vista? Solo entonces es suyo el teclado.
  useEffect(() => {
    const el = raiz.current
    if (!el) return
    const o = new IntersectionObserver(([e]) => setEnVista(e.intersectionRatio > 0.5), { threshold: [0, 0.5, 1] })
    o.observe(el)
    return () => o.disconnect()
  }, [])

  const manda = activo && enVista
  useEffect(() => {
    if (!manda) return
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      const acciones: Record<string, () => void> = {
        arrowleft: () => mover(-1),
        arrowright: () => mover(1),
        arrowup: () => moverFila(-1),
        arrowdown: () => moverFila(1),
        enter: () => actual && onFicha(actual.id),
        ' ': () => actual && alternarPedido(actual.id),
        q: () => cambiarSeccion(-1),
        e: () => cambiarSeccion(1),
        m: () => actual && onManos(actual.id),
        '1': () => setModo('textura'),
        '2': () => setModo('arcilla'),
        '3': () => setModo('malla'),
      }
      const f = acciones[k]
      if (!f) return
      e.preventDefault()
      f()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [manda, mover, moverFila, actual, onFicha, onManos, alternarPedido, cambiarSeccion])

  // Mando: cruceta para moverse, A ficha, X pedido, Y manos, LB/RB sección.
  useEffect(() => {
    if (!manda || !('getGamepads' in navigator)) return
    let raf = 0
    let espera = 0
    const antes: boolean[] = []
    const ciclo = (t: number) => {
      raf = requestAnimationFrame(ciclo)
      const p = [...navigator.getGamepads()].find(Boolean)
      if (!p) return
      const b = (n: number) => !!p.buttons[n]?.pressed
      const pulsado = (n: number) => b(n) && !antes[n]
      const eje = (n: number) => p.axes[n] ?? 0
      if (t > espera) {
        const dx = (b(15) || eje(0) > 0.6 ? 1 : 0) - (b(14) || eje(0) < -0.6 ? 1 : 0)
        const dy = (b(13) || eje(1) > 0.6 ? 1 : 0) - (b(12) || eje(1) < -0.6 ? 1 : 0)
        if (dx || dy) {
          if (dy) moverFila(dy)
          else mover(dx)
          espera = t + 170
        }
      }
      if (pulsado(0) && actual) onFicha(actual.id)
      if (pulsado(2) && actual) alternarPedido(actual.id)
      if (pulsado(3) && actual) onManos(actual.id)
      if (pulsado(4)) cambiarSeccion(-1)
      if (pulsado(5)) cambiarSeccion(1)
      p.buttons.forEach((x, n) => (antes[n] = x.pressed))
    }
    raf = requestAnimationFrame(ciclo)
    return () => cancelAnimationFrame(raf)
  }, [manda, mover, moverFila, actual, onFicha, onManos, alternarPedido, cambiarSeccion])

  const enPedido = useMemo(() => pedido.map((id) => lista.find((m) => m.id === id) ?? null).filter(Boolean) as Modelo3D[], [pedido, lista])
  const total = enPedido.reduce((s, m) => s + m.precio, 0)
  const enlacePedido = useMemo(() => {
    const lineas = enPedido.map((m) => `• ${m.nombre} (${precio(m.precio)})`).join('\n')
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola, armé mi equipo en la Biblioteca 3D y quiero pedir estas figuras:\n${lineas}\nTotal: ${precio(total)}`)}`
  }, [enPedido, total])

  const c = CATEGORIAS[cat]
  const tinta = catEscena.tinta
  // Las otras versiones de la figura elegida, como los trajes alternativos de un personaje.
  const versiones = useMemo(() => (actual ? variantes(actual, lista) : []), [actual, lista])
  const grupoActual = grupos.find((g) => actual && g.modelos.includes(actual))

  return (
    <section
      ref={raiz}
      aria-label="Elige tu figura"
      className="seleccion relative isolate flex flex-col overflow-hidden bg-[#0B0912] text-white lg:block lg:h-[calc(100svh-var(--alto-barra,64px))] lg:min-h-[680px]"
    >
      {/* Cielo de arena: degradado de la sección, rayos de energía y rejilla de suelo. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 transition-[background] duration-700" style={{ background: `radial-gradient(70% 60% at 54% 62%, ${tinta}40, transparent 70%), linear-gradient(180deg, #120d24 0%, #1b1238 38%, ${catEscena.desde}2e 64%, #0B0912 100%)` }} />
        <div className="rayos absolute left-[54%] top-[58%] h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2 opacity-[0.16]" style={{ background: `repeating-conic-gradient(from 0deg, ${tinta} 0deg 2deg, transparent 2deg 14deg)`, maskImage: 'radial-gradient(circle, black 0%, transparent 45%)', WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 45%)' }} />
        <div className="absolute inset-x-0 bottom-0 h-[42%] opacity-40 [mask-image:linear-gradient(to_top,black,transparent)]" style={{ background: 'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px) 0 0 / 100% 44px, linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px) 0 0 / 44px 100%', transform: 'perspective(500px) rotateX(55deg)', transformOrigin: 'bottom' }} />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,transparent_55%,rgba(0,0,0,0.65))]" />
      </div>

      {/* La sección escrita en grande detrás de la figura, en contorno, como el escenario de un combate. */}
      {(() => {
        const marca = catEscena.id === 'todo' ? 'Flemin' : catEscena.nombre
        // En una sola línea: el tamaño baja con lo largo del nombre para caber detrás de la figura.
        return (
          <p key={catEscena.id} aria-hidden className="marca-seccion pointer-events-none absolute left-[28%] right-[20%] top-[30%] -z-[5] hidden whitespace-nowrap text-center font-flemin leading-none lg:block" style={{ WebkitTextStroke: `1.5px ${tinta}80`, fontSize: `min(8rem, ${72 / marca.length}vw)` }}>
            {marca}
          </p>
        )
      })()}

      {/* ── Figura en 3D ─────────────────────────────────────────── */}
      <div className="relative h-[54svh] min-h-[340px] lg:absolute lg:inset-y-0 lg:left-[30%] lg:right-[22%] lg:h-auto">
        {/* Mira del escenario: cuatro esquinas que encuadran a la figura elegida. */}
        <div aria-hidden className="mira pointer-events-none absolute inset-x-[12%] bottom-[14%] top-[16%] hidden lg:block" style={{ '--c': tinta } as CSSProperties}>
          <i /><i /><i /><i />
        </div>
        {enEscena && <Escenario modelo={enEscena} modo={modo} tinta={tinta} onMostrado={setMostrado} />}
        {cargando && (
          <p className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-3.5 py-1.5 font-chakra text-[12px] uppercase tracking-[0.18em] text-white/80 ring-1 ring-white/15 backdrop-blur">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" /> Cargando figura
          </p>
        )}
      </div>

      {/* ── Nombre, estrellas, acabados y acciones (derecha) ─────── */}
      {actual && (
        <div className="pointer-events-none absolute right-4 top-4 z-10 flex max-w-[min(92vw,560px)] flex-col items-end text-right lg:right-8 lg:top-7">
          <p className="font-chakra text-[11px] font-semibold uppercase tracking-[0.32em] text-[#FFC23D]">Flemin · Jugador 1</p>
          <h2 key={actual.id} className="nombre-figura entra-nombre mt-1 line-clamp-2 font-flemin text-[clamp(1.6rem,3.6vw,3.3rem)] leading-[1.02]">
            {actual.nombre}
          </h2>
          <p key={`${actual.id}-s`} className="entra-nombre mt-1.5 font-chakra text-[13px] font-semibold italic tracking-wide text-white/80 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)] sm:text-[15px]" style={{ animationDelay: '60ms' }}>
            {(CATEGORIAS.find((x) => x.id === actual.categoria) ?? CATEGORIAS[0]).nombre} · {precio(actual.precio)}
          </p>
          <div className="mt-2 flex items-center gap-2" title={actual.triangulos ? `${triangulos(actual.triangulos)} triángulos` : undefined}>
            <span className="font-chakra text-[10.5px] uppercase tracking-[0.2em] text-white/60">Detalle</span>
            <span className="flex gap-0.5">
              {Array.from({ length: 7 }, (_, k) => (
                <Star key={k} size={14} className={k < estrellas(actual) ? 'fill-[#FFC23D] text-[#FFC23D] drop-shadow-[0_0_4px_rgba(255,194,61,0.8)]' : 'text-white/30'} />
              ))}
            </span>
          </div>
          {/* Ficha técnica en chapas, como los atributos de un luchador. */}
          <div key={`${actual.id}-f`} className="entra-nombre mt-2.5 flex flex-wrap justify-end gap-1.5 font-chakra text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ animationDelay: '120ms' }}>
            {esNueva(actual) && <span className="chapa bg-[#FF2D8A] text-white">Nuevo</span>}
            <span className={`chapa ${actual.sinTextura ? 'text-white/85 ring-1 ring-white/40' : 'bg-white/90 text-[#140f22]'}`}>{actual.sinTextura ? 'Sin color' : 'A color'}</span>
            {actual.triangulos ? <span className="chapa bg-black/45 text-white/80 ring-1 ring-white/15">{triangulos(actual.triangulos)} tris</span> : null}
            <span className="chapa bg-black/45 text-white/80 ring-1 ring-white/15">{actual.formatos.join(' · ')}</span>
          </div>
        </div>
      )}

      {actual && (
        <div className="absolute bottom-24 right-4 z-10 hidden w-[340px] flex-col items-end gap-4 lg:right-8 lg:flex">
          {versiones.length > 1 && (
            <div className="w-full">
              <p className="mb-2 flex justify-between border-b border-white/25 pb-1 font-chakra text-[11px] uppercase tracking-[0.22em] text-white/75">
                <span className="tabular-nums text-white/45">{versiones.indexOf(actual) + 1} / {versiones.length}</span> Versiones
              </p>
              <div className="flex flex-wrap justify-end gap-1.5">
                {versiones.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setCursor(lista.indexOf(v))}
                    title={v.nombre}
                    aria-pressed={v === actual}
                    className={`relative h-11 w-11 overflow-hidden transition [clip-path:polygon(7px_0,100%_0,100%_calc(100%-7px),calc(100%-7px)_100%,0_100%,0_7px)] ${v === actual ? 'bg-[#FFC23D]/90' : 'bg-white/10 hover:bg-white/25'}`}
                  >
                    {rutaPortada(v) && <img src={rutaPortada(v)} alt="" className="absolute inset-[2px] h-[calc(100%-4px)] w-[calc(100%-4px)] bg-[#1a1430] object-contain" />}
                    {v.sinTextura && <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full border border-white bg-[#1a1430]" />}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="w-full">
            <p className="mb-2 border-b border-white/25 pb-1 text-right font-chakra text-[11px] uppercase tracking-[0.22em] text-white/75">Acabado</p>
            <div className="flex justify-end gap-2">
              {ACABADOS.map((a, k) => (
                <button
                  key={a.modo}
                  type="button"
                  onClick={() => setModo(a.modo)}
                  title={`${a.nombre} (${k + 1})`}
                  aria-pressed={modo === a.modo}
                  className={`grid h-12 w-12 place-items-center overflow-hidden rounded-full ring-2 transition ${modo === a.modo ? 'scale-110 ring-[#FFC23D] shadow-[0_0_18px_rgba(255,194,61,0.6)]' : 'ring-white/25 hover:ring-white/60'}`}
                  style={{ background: a.modo === 'textura' ? `linear-gradient(135deg, ${catEscena.desde}, ${catEscena.hasta})` : a.modo === 'arcilla' ? '#d9d4cc' : '#0b3b38' }}
                >
                  {a.modo === 'textura' && rutaPortada(actual) ? (
                    <img src={rutaPortada(actual)} alt="" className="h-full w-full scale-150 object-contain" />
                  ) : (
                    <span className={`font-chakra text-[10px] font-bold uppercase ${a.modo === 'malla' ? 'text-[#4DE8D6]' : 'text-[#3a3530]'}`}>{a.nombre}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full">
            <p className="mb-2 border-b border-white/25 pb-1 text-right font-chakra text-[11px] uppercase tracking-[0.22em] text-white/75">Opciones</p>
            <ul className="flex flex-col items-end gap-1.5">
              <Opcion onClick={() => onFicha(actual.id)} tecla="Enter" Icono={Box}>Ver ficha completa</Opcion>
              <Opcion onClick={() => onManos(actual.id)} tecla="M" Icono={Hand}>Tómala con tus manos</Opcion>
              {!actual.personalizable && (
                <Opcion href={enlaceStudio('separador', actual)} Icono={Scissors}>Pintar y separar en piezas</Opcion>
              )}
              <Opcion onClick={() => alternarPedido(actual.id)} tecla="Espacio" Icono={pedido.includes(actual.id) ? Check : Plus}>
                {pedido.includes(actual.id) ? 'Quitar del pedido' : 'Agregar al pedido'}
              </Opcion>
              <Opcion href={enlaceCompra(actual)} externo Icono={ShoppingBag} especial>
                {actual.precio === 0 ? 'Obtener gratis' : `Comprar · ${precio(actual.precio)}`}
              </Opcion>
            </ul>
          </div>
        </div>
      )}

      {/* ── Panel de selección (izquierda) ──────────────────────── */}
      <div className="relative z-20 px-3 pb-4 lg:absolute lg:bottom-20 lg:left-6 lg:top-6 lg:w-[min(36vw,500px)] lg:px-0 lg:pb-0 lg:[perspective:1400px]">
        <div className="panel-sel flex h-full flex-col gap-3 bg-[#140f22]/70 p-3 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/15 backdrop-blur-md lg:[transform:rotateY(13deg)] lg:[transform-origin:left_center]">
          {/* El equipo: el pedido, con huecos como en la selección de un combate. */}
          <div className="flex items-center gap-2">
            {Array.from({ length: MAX_PEDIDO }, (_, k) => {
              const m = enPedido[k]
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => (m ? alternarPedido(m.id) : actual && alternarPedido(actual.id))}
                  title={m ? `Quitar ${m.nombre}` : 'Agregar la figura elegida'}
                  className={`group relative grid aspect-square w-11 place-items-center overflow-hidden ring-1 transition sm:w-12 ${m ? 'bg-gradient-to-b from-white/20 to-white/5 ring-[#FFC23D]/70' : k === enPedido.length ? 'bg-white/10 ring-white/40 hover:bg-white/20' : 'bg-white/[0.04] ring-white/15'}`}
                >
                  {m ? (
                    <>
                      {rutaPortada(m) && <img src={rutaPortada(m)} alt={m.nombre} className="h-full w-full object-contain p-0.5" />}
                      <X size={14} className="absolute right-0.5 top-0.5 opacity-0 transition group-hover:opacity-100" />
                    </>
                  ) : (
                    <Plus size={18} className={k === enPedido.length ? 'text-white' : 'text-white/25'} />
                  )}
                </button>
              )
            })}
            <div className="ml-auto text-right leading-tight">
              <p className="font-chakra text-[10px] uppercase tracking-[0.2em] text-white/50">Mi pedido</p>
              <p className="font-chakra text-[15px] font-semibold tabular-nums">{enPedido.length ? precio(total) : '—'}</p>
            </div>
          </div>

          {/* Secciones: Q / E, como los gatillos de un mando. */}
          <div className="flex items-center gap-1.5">
            <kbd className="tecla hidden lg:inline-grid">Q</kbd>
            <div className="sin-barra flex flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Secciones">
              {CATEGORIAS.map((x, k) => {
                const Icono = ICONO_CATEGORIA[x.id]
                return (
                  <button
                    key={x.id}
                    type="button"
                    role="tab"
                    aria-selected={k === cat}
                    title={x.nombre}
                    onClick={() => (setCat(k), setCursor(0))}
                    className={`flex h-8 shrink-0 items-center gap-1.5 px-2.5 font-chakra text-[11.5px] font-semibold uppercase tracking-wider transition ${k === cat ? 'bg-[#FFC23D] text-[#140f22]' : 'bg-white/[0.06] text-white/70 hover:bg-white/15 hover:text-white'}`}
                  >
                    <Icono size={14} /> {k === cat ? x.nombre : x.clave}
                  </button>
                )
              })}
            </div>
            <kbd className="tecla hidden lg:inline-grid">E</kbd>
          </div>

          {/* Acabado: a color o sin color, como elegir el traje antes del combate. */}
          <div className="flex gap-1" role="tablist" aria-label="Acabado">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={acabado === f.id}
                onClick={() => (setAcabado(f.id), setCursor(0))}
                className={`flex h-7 flex-1 items-center justify-center gap-1.5 font-chakra text-[11px] font-semibold uppercase tracking-wider transition [clip-path:polygon(6px_0,100%_0,calc(100%-6px)_100%,0_100%)] ${acabado === f.id ? 'bg-white text-[#140f22]' : 'bg-white/[0.06] text-white/60 hover:bg-white/15 hover:text-white'}`}
              >
                {f.id === 'color' && <span className="h-2 w-2 rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-sky-500" aria-hidden />}
                {f.id === 'sin-textura' && <span className="h-2 w-2 rounded-full border border-current" aria-hidden />}
                {f.nombre}
                <span className="tabular-nums opacity-60">{conteo[f.id]}</span>
              </button>
            ))}
          </div>

          {/* La rejilla de retratos, en bloques por sección y acabado: cada figura en su sitio. */}
          <div ref={rejilla} className="sin-barra -mx-1 max-h-[46svh] min-h-0 flex-1 overflow-y-auto px-1 pb-1 lg:max-h-none">
            {lista.length ? (
              <div className="grid grid-cols-6 gap-1.5">
                {grupos.map((g, gi) => {
                  const desde = grupos.slice(0, gi).reduce((n, x) => n + x.modelos.length, 0)
                  const Icono = ICONO_CATEGORIA[g.categoria.id]
                  // Un rótulo por sección; el bloque sin color de una sección que también tiene color va con una línea fina.
                  const sigue = gi > 0 && grupos[gi - 1].categoria.id === g.categoria.id
                  const enSeccion = grupos.filter((x) => x.categoria.id === g.categoria.id).reduce((n, x) => n + x.modelos.length, 0)
                  const sello = (
                    <span className={`shrink-0 px-1.5 py-px text-[9.5px] tracking-[0.12em] ${g.blanco ? 'text-white/70 ring-1 ring-white/30' : 'bg-white/90 text-[#140f22]'}`}>{g.blanco ? 'Sin color' : 'A color'}</span>
                  )
                  return [
                    sigue ? (
                      <div key={`${g.categoria.id}-${g.blanco}`} className="col-span-full mt-1 flex items-center gap-2 font-chakra text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                        {sello}
                        <span className="h-px flex-1 border-t border-dashed border-white/20" />
                        <span className="tabular-nums">{g.modelos.length}</span>
                      </div>
                    ) : (
                      <div
                        key={`${g.categoria.id}-${g.blanco}`}
                        className={`rotulo sticky top-0 z-20 col-span-full flex items-center gap-2 bg-[#171127]/95 py-1.5 pl-2 pr-2.5 font-chakra text-[11px] font-semibold uppercase tracking-[0.16em] backdrop-blur ${gi ? 'mt-2' : ''}`}
                        style={{ '--c': g.categoria.desde } as CSSProperties}
                      >
                        <Icono size={13} style={{ color: g.categoria.tinta }} />
                        <span className="truncate text-white">{g.categoria.nombre}</span>
                        {sello}
                        <span className="h-px flex-1 bg-gradient-to-r from-white/25 to-transparent" />
                        <span className="tabular-nums text-white/45">{enSeccion}</span>
                      </div>
                    ),
                    ...g.modelos.map((m, j) => {
                      const k = desde + j
                      const sel = k === i
                      const port = rutaPortada(m)
                      return (
                        <button
                          key={m.id}
                          data-i={k}
                          type="button"
                          onMouseEnter={() => k !== i && (setCursor(k), sonido && blip(false))}
                          onFocus={() => setCursor(k)}
                          onClick={() => (k === i ? onFicha(m.id) : setCursor(k))}
                          onDoubleClick={() => alternarPedido(m.id)}
                          title={m.nombre}
                          aria-label={m.nombre}
                          aria-current={sel}
                          className={`retrato relative aspect-square overflow-hidden ${sel ? 'retrato-sel z-10' : ''}`}
                          style={{ background: m.sinTextura ? 'linear-gradient(160deg, #3a3550, #1a1430 75%)' : `linear-gradient(160deg, ${g.categoria.desde}55, #1a1430 70%)` }}
                        >
                          {port ? (
                            <img src={port} alt="" loading="lazy" decoding="async" draggable={false} className={`h-full w-full object-contain p-0.5 transition duration-300 ${sel ? 'scale-110' : 'opacity-85 saturate-[0.85]'}`} />
                          ) : (
                            <Box size={18} className="m-auto text-white/30" />
                          )}
                          {esNueva(m) && <span className="absolute left-0 top-0 bg-[#FF2D8A] px-1 font-chakra text-[8px] font-bold uppercase leading-[13px] tracking-wider">Nuevo</span>}
                          {pedido.includes(m.id) && (
                            <span className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#FFC23D] text-[#140f22]">
                              <Check size={11} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      )
                    }),
                  ]
                })}
              </div>
            ) : (
              <p className="py-10 text-center text-[13px] text-white/50">Ninguna figura con esa búsqueda en {c.nombre}.</p>
            )}
          </div>
          <p className="flex items-center justify-between gap-3 font-chakra text-[11px] uppercase tracking-[0.18em] text-white/45">
            <span className="truncate">
              {grupoActual ? `${grupoActual.categoria.nombre} · ${grupoActual.blanco ? 'Sin color' : 'A color'}` : c.nombre}
            </span>
            <span className="shrink-0 tabular-nums">{lista.length ? `${i + 1} / ${lista.length}` : '0'}</span>
          </p>
        </div>
      </div>

      {/* Acciones en móvil, bajo la rejilla. */}
      {actual && (
        <div className="relative z-20 grid grid-cols-2 gap-2 px-3 pb-5 lg:hidden">
          <button type="button" onClick={() => onFicha(actual.id)} className="flex h-11 items-center justify-center gap-2 bg-white/10 text-[13px] font-semibold ring-1 ring-white/15">
            <Box size={16} /> Ficha
          </button>
          <button type="button" onClick={() => alternarPedido(actual.id)} className="flex h-11 items-center justify-center gap-2 bg-white/10 text-[13px] font-semibold ring-1 ring-white/15">
            {pedido.includes(actual.id) ? <Check size={16} /> : <Plus size={16} />} Pedido
          </button>
          <a href={enlaceCompra(actual)} target="_blank" rel="noreferrer" className="col-span-2 flex h-11 items-center justify-center gap-2 bg-gradient-to-r from-[#8A3CFF] to-[#FF2D8A] text-[14px] font-semibold">
            <ShoppingBag size={16} /> {actual.precio === 0 ? 'Obtener gratis' : `Comprar · ${precio(actual.precio)}`}
          </a>
        </div>
      )}

      {/* ── Barra de controles (abajo) ───────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 z-20 hidden h-16 items-center gap-5 border-t border-white/10 bg-black/45 px-6 font-chakra text-[12px] uppercase tracking-[0.14em] text-white/70 backdrop-blur-md lg:flex">
        <span className="flex items-center gap-1.5"><kbd className="tecla">←→↑↓</kbd> Mover</span>
        <span className="flex items-center gap-1.5"><kbd className="tecla">Enter</kbd> Ficha</span>
        <span className="flex items-center gap-1.5"><kbd className="tecla">Espacio</kbd> Pedido</span>
        <span className="flex items-center gap-1.5"><kbd className="tecla">1 2 3</kbd> Acabado</span>
        <span className="hidden items-center gap-1.5 xl:flex"><kbd className="tecla">M</kbd> Manos</span>
        <button type="button" onClick={() => setSonido(!sonido)} className="flex items-center gap-1.5 transition hover:text-white" aria-pressed={sonido} title="Sonido de selección">
          {sonido ? <Volume2 size={15} /> : <VolumeX size={15} />} Sonido
        </button>
        <span className="flex-1" />
        <button type="button" onClick={onCatalogo} className="flex items-center gap-1.5 transition hover:text-white">
          Catálogo completo <ArrowDown size={14} />
        </button>
        {enPedido.length > 0 && (
          <a href={enlacePedido} target="_blank" rel="noreferrer" className="pedido-brillo flex h-10 items-center gap-2 bg-gradient-to-r from-[#FF6A13] to-[#FFC23D] px-5 font-semibold normal-case tracking-normal text-[#140f22] [clip-path:polygon(10px_0,100%_0,calc(100%-10px)_100%,0_100%)]">
            <MessageCircle size={16} /> Pedir mi equipo ({enPedido.length}) · {precio(total)}
          </a>
        )}
      </div>
    </section>
  )
}

/** Una fila de la lista de opciones, como la lista de técnicas de un personaje. */
function Opcion({
  children,
  onClick,
  href,
  externo,
  tecla,
  Icono,
  especial,
}: {
  children: ReactNode
  onClick?: () => void
  href?: string
  externo?: boolean
  tecla?: string
  Icono: typeof Box
  especial?: boolean
}) {
  const clase = `opcion pointer-events-auto flex h-9 w-full items-center gap-2.5 pl-4 pr-3 text-left text-[13px] font-semibold transition ${
    especial ? 'bg-gradient-to-r from-[#8A3CFF]/0 via-[#8A3CFF]/70 to-[#FF2D8A]/80 text-white hover:to-[#FF2D8A]' : 'bg-gradient-to-r from-black/0 via-black/45 to-black/60 text-white/90 hover:via-white/10 hover:to-white/20'
  }`
  const contenido = (
    <>
      <span className={`h-2.5 w-2.5 shrink-0 rotate-45 ${especial ? 'bg-[#FFC23D]' : 'bg-white/80'}`} />
      <Icono size={15} className="shrink-0 opacity-80" />
      <span className="flex-1 truncate">{children}</span>
      {tecla && <kbd className="tecla">{tecla}</kbd>}
    </>
  )
  return (
    <li className="w-full">
      {href ? (
        <a href={href} target={externo ? '_blank' : undefined} rel={externo ? 'noreferrer' : undefined} className={clase}>
          {contenido}
        </a>
      ) : (
        <button type="button" onClick={onClick} className={clase}>
          {contenido}
        </button>
      )}
    </li>
  )
}
