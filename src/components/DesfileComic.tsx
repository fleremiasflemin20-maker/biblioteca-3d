import { Suspense, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ChevronDown, Star } from 'lucide-react'
import { AlCargar, Pieza } from './Pieza'
import { Normalizar } from './Visor'
import { DRACO, rutaModelo, rutaPortada, type Modelo3D } from '../lib/catalogo'
import { ONOMATOPEYAS, BOCADILLOS, semilla } from '../lib/comic'
import { enlaceHistoria } from '../lib/historias'
import { estrellas, rareza } from '../lib/rareza'
import type { Grupo } from '../lib/orden'

/**
 * «Uno por uno» como las páginas de historia de Dragon Ball: la escena se queda
 * quieta (sticky) y, al bajar, las figuras pasan de una en una. Cada figura
 * tiene su tramo de scroll: entra desde abajo girando, da su vuelta al ritmo
 * del dedo o de la rueda, y sale por arriba para dejar sitio a la siguiente.
 *
 * Para que vaya fino también en el móvil:
 * - Un solo lienzo WebGL para todo el desfile, y solo existe mientras la
 *   sección está a la vista (o casi).
 * - Solo se pinta la figura actual. Se adelanta la descarga de la siguiente
 *   (y de la otra en ordenador) y se sueltan de memoria las que quedan lejos.
 * - Mientras el .glb llega se ve su portada, así nunca hay un hueco vacío.
 * - El scroll vive en un objeto mutable: React solo se entera cuando cambia
 *   de figura, no a cada píxel.
 */

type Paso = { m: Modelo3D; g: Grupo; n: number }

/** Scroll suavizado que comparten el lienzo y el texto. `p` va de 0 a N (figura + avance dentro de ella). */
type Estado = { objetivo: number; p: number }

const MOVIL = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
/** Alto de scroll que le toca a cada figura. */
const TRAMO = MOVIL ? 62 : 72
/** Cuántas figuras de más se descargan por delante. */
const ADELANTO = MOVIL ? 1 : 2

/** El llavero con nombre se construye en el navegador: no tiene .glb que descargar. */
const tieneGlb = (m: Modelo3D) => !m.personalizable

// ── El lienzo ───────────────────────────────────────────────────────────────

const facil = (x: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(x, 0, 1), 3)

/** La figura actual, animada según cuánto se ha bajado dentro de su tramo. */
const Figura = memo(function Figura({ m, i, estado, onListo }: { m: Modelo3D; i: number; estado: { current: Estado }; onListo: (id: string) => void }) {
  const g = useRef<THREE.Group>(null)
  const listo = useCallback(() => onListo(m.id), [m.id, onListo])
  // Al irse, se libera su memoria de vídeo (si vuelve, three.js la sube otra vez sola).
  useEffect(() => {
    const o = g.current
    return () =>
      o?.traverse((x) => {
        const mesh = x as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.geometry?.dispose()
        for (const mat of ([] as THREE.Material[]).concat(mesh.material ?? []))
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose()
      })
  }, [])
  useFrame(({ clock }) => {
    const o = g.current
    if (!o) return
    const t = THREE.MathUtils.clamp(estado.current.p - i, 0, 1)
    // Entrada (0 → 0,2): sube desde abajo, crece y llega girando.
    const e = facil(t / 0.2)
    // Salida (0,82 → 1): se va hacia arriba y se encoge.
    const s = facil((t - 0.82) / 0.18)
    const flota = Math.sin(clock.elapsedTime * 1.6) * 0.03
    o.position.y = (1 - e) * -2.4 + s * 2.6 + flota
    o.scale.setScalar(0.55 + 0.45 * e - 0.35 * s)
    // Gira con el scroll de un lado a otro (de frente a mitad del tramo), más el giro de llegada y de salida.
    o.rotation.y = (1 - e) * -2.6 + (t - 0.5) * 2.4 + s * 1.6
    o.rotation.z = (1 - e) * 0.25 - s * 0.2
  })
  return (
    <group ref={g}>
      {/* Antes de que Normalizar mida, este grupo vuelve a su sitio: si no, mide la figura ya movida y encogida. */}
      <EnReposo destino={g} />
      <Normalizar>
        <Pieza modelo={m} />
      </Normalizar>
      <AlCargar onListo={listo} />
    </group>
  )
})

/** Deja el grupo animado sin mover ni escalar (corre antes que el efecto de Normalizar, que es su hermano siguiente). */
function EnReposo({ destino }: { destino: { current: THREE.Group | null } }) {
  useLayoutEffect(() => {
    const o = destino.current
    if (!o) return
    o.position.set(0, 0, 0)
    o.rotation.set(0, 0, 0)
    o.scale.setScalar(1)
    o.updateMatrixWorld(true)
  })
  return null
}

/** Suelta de memoria las figuras que ya quedaron lejos (geometría, texturas y la caché de useGLTF). */
function useMemoriaCorta(pasos: Paso[], indice: number, actualLista: boolean) {
  const cargadas = useRef(new Set<string>())
  useEffect(() => {
    const cerca = new Set<string>()
    for (let k = indice - 1; k <= indice + ADELANTO; k++) {
      const m = pasos[k]?.m
      if (!m || !tieneGlb(m)) continue
      const url = rutaModelo(m)
      cerca.add(url)
      // Las de delante, solo cuando la actual ya está: primero lo que se ve.
      if (k !== indice && !actualLista) continue
      if (!cargadas.current.has(url)) {
        cargadas.current.add(url)
        if (k !== indice) useGLTF.preload(url, DRACO)
      }
    }
    // Se espera un poco: si el usuario vuelve atrás enseguida, la figura sigue ahí.
    const id = setTimeout(() => {
      for (const url of [...cargadas.current]) {
        if (cerca.has(url)) continue
        cargadas.current.delete(url)
        useGLTF.clear(url)
      }
    }, 2500)
    return () => clearTimeout(id)
  }, [pasos, indice, actualLista])
}

/**
 * Sombra fija en el suelo: un degradado en un plano. ContactShadows volvería a
 * pintar la escena cada fotograma, y en el móvil eso se nota.
 */
function SombraSuelo() {
  const textura = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    r.addColorStop(0, 'rgba(18,16,25,0.4)')
    r.addColorStop(1, 'rgba(18,16,25,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }, [])
  useEffect(() => () => textura.dispose(), [textura])
  return (
    <mesh position={[0, -1.02, 0]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[2.4, 1.2]} />
      <meshBasicMaterial map={textura} transparent depthWrite={false} />
    </mesh>
  )
}

function Lienzo({ pasos, indice, estado, listo, onListo }: { pasos: Paso[]; indice: number; estado: { current: Estado }; listo: string | null; onListo: (id: string) => void }) {
  const m = pasos[indice]?.m
  useMemoriaCorta(pasos, indice, listo === m?.id)
  return (
    <Canvas
      dpr={MOVIL ? [1, 1.5] : [1, 1.75]}
      camera={{ fov: 34, position: [0, 0.15, 5.2] }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08, powerPreference: 'high-performance' }}
      className="uxu-lienzo"
      style={{ position: 'absolute', width: 'auto', height: 'auto' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 3]} intensity={1.5} />
      <directionalLight position={[-4, 2, -3]} intensity={0.9} color={pasos[indice]?.g.categoria.hasta ?? '#ffffff'} />
      {/* Sin mapa HDR: se ahorra una descarga y el cómic pide luz más plana. */}
      <hemisphereLight args={['#ffffff', '#5a4a6a', 1.1]} />
      {m && (
        <Suspense key={m.id} fallback={null}>
          <Figura m={m} i={indice} estado={estado} onListo={onListo} />
        </Suspense>
      )}
      <SombraSuelo />
    </Canvas>
  )
}

// ── La sección ──────────────────────────────────────────────────────────────

export function DesfileComic({ grupos, onAbrir }: { grupos: Grupo[]; onAbrir: (m: Modelo3D) => void }) {
  const pasos = useMemo<Paso[]>(() => {
    let n = 0
    return grupos.flatMap((g) => g.modelos.map((m) => ({ m, g, n: ++n })))
  }, [grupos])
  const total = pasos.length

  const zona = useRef<HTMLDivElement>(null)
  const barra = useRef<HTMLSpanElement>(null)
  const ref = useRef<Estado>({ objetivo: 0, p: 0 })
  const [indice, setIndice] = useState(0)
  const [cerca, setCerca] = useState(false)
  const [listo, setListo] = useState<string | null>(null)

  // El lienzo solo existe cuando la sección está a la vista (con margen para que llegue cargado).
  useEffect(() => {
    const el = zona.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setCerca(e.isIntersecting), { rootMargin: '400px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Scroll → objetivo; un bucle propio lo suaviza mientras la sección está cerca.
  useEffect(() => {
    const el = zona.current
    if (!el || !cerca || !total) return
    const estado = ref.current
    const medir = () => {
      const r = el.getBoundingClientRect()
      const recorrido = r.height - innerHeight
      const f = recorrido > 0 ? THREE.MathUtils.clamp(-r.top / recorrido, 0, 1) : 0
      estado.objetivo = f * total
    }
    medir()
    estado.p = estado.objetivo
    let antes = performance.now()
    let raf = 0
    const bucle = (ahora: number) => {
      const dt = Math.min(0.1, (ahora - antes) / 1000)
      antes = ahora
      estado.p += (estado.objetivo - estado.p) * (1 - Math.exp(-dt * (MOVIL ? 10 : 7)))
      const i = THREE.MathUtils.clamp(Math.floor(estado.p), 0, total - 1)
      setIndice((x) => (x === i ? x : i))
      if (barra.current) barra.current.style.transform = `scaleY(${Math.min(1, estado.p / total)})`
      raf = requestAnimationFrame(bucle)
    }
    raf = requestAnimationFrame(bucle)
    addEventListener('scroll', medir, { passive: true })
    addEventListener('resize', medir)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('scroll', medir)
      removeEventListener('resize', medir)
    }
  }, [cerca, total])

  const irA = (k: number) => {
    const el = zona.current
    if (!el) return
    const recorrido = el.offsetHeight - innerHeight
    const y = el.getBoundingClientRect().top + scrollY + ((k + 0.45) / total) * recorrido
    scrollTo({ top: y, behavior: Math.abs(k - indice) > 6 ? 'auto' : 'smooth' })
  }
  const saltar = () => {
    const el = zona.current
    if (el) scrollTo({ top: el.getBoundingClientRect().bottom + scrollY - 80, behavior: 'auto' })
  }

  // Primera figura de cada sección, para el índice de capítulos.
  const capitulos = useMemo(() => {
    const l: { k: number; g: Grupo }[] = []
    pasos.forEach((p, k) => {
      if (!k || p.g !== pasos[k - 1].g) l.push({ k, g: p.g })
    })
    return l
  }, [pasos])

  if (!total) return null
  const { m, g, n } = pasos[indice]
  const cat = g.categoria
  const r = rareza(m)
  const s = semilla(m.id)
  const historia = enlaceHistoria(m)
  const portada = rutaPortada(m)
  const capitulo = [...capitulos].reverse().find((c) => c.k <= indice)!

  return (
    <div ref={zona} className="uxu relative" style={{ height: `calc(${total} * ${TRAMO}svh + 100svh)` }}>
      <div
        className="uxu-escena sticky top-[calc(var(--alto-barra,64px)+var(--alto-filtros,0px))] h-[calc(100svh-var(--alto-barra,64px)-var(--alto-filtros,0px))] overflow-hidden"
        style={{ '--d': cat.desde, '--h': cat.hasta } as CSSProperties}
      >
        <div className="uxu-fondo" aria-hidden />
        <div className="uxu-trama" aria-hidden />

        {/* Nombre de la sección en eco gigante. */}
        <p key={`eco-${capitulo.k}`} aria-hidden className="uxu-eco rotulo-comic">{cat.nombre}</p>

        {/* La portada sostiene el sitio mientras llega el 3D. */}
        {portada && (
          <img
            key={`p-${m.id}`}
            src={portada}
            alt=""
            aria-hidden
            decoding="async"
            className={`uxu-portada ${listo === m.id ? 'opacity-0' : 'opacity-100'}`}
          />
        )}
        {cerca && <Lienzo pasos={pasos} indice={indice} estado={ref} listo={listo} onListo={setListo} />}
        {listo !== m.id && (
          <p className="pointer-events-none absolute left-1/2 top-[46%] z-[3] -translate-x-1/2 font-chakra text-[11px] font-bold uppercase tracking-[0.25em] text-[#121019]/70 md:left-[62%]">
            Cargando 3D…
          </p>
        )}

        {/* Onomatopeya y bocadillo, que saltan con cada figura nueva. */}
        <span key={`o-${m.id}`} aria-hidden className="uxu-onomatopeya rotulo-comic" style={{ '--r': `${-14 + s * 22}deg` } as CSSProperties}>
          {ONOMATOPEYAS[Math.floor(s * ONOMATOPEYAS.length)]}
        </span>
        <span key={`b-${m.id}`} aria-hidden className="uxu-globo">
          {BOCADILLOS[Math.floor(semilla(m.id + 'b') * BOCADILLOS.length)]}
        </span>

        {/* La cartela de datos: abajo en el móvil, a la izquierda en ordenador. */}
        <div key={`t-${m.id}`} className="uxu-texto">
          <p className="flex flex-wrap items-center gap-2">
            <span className="cartela-comic px-2 py-0.5 font-comic text-[15px] uppercase leading-none tracking-wider">
              No.{String(n).padStart(3, '0')} <span className="opacity-60">/ {total}</span>
            </span>
            <span className="rareza border-2 border-[#121019] px-2 py-0.5 font-chakra text-[10px] font-bold uppercase tracking-[0.14em] text-[#0b0716]" style={{ background: r.sello }}>
              {r.nombre}
            </span>
            <span className="border-2 border-[#121019] bg-white px-2 py-0.5 font-chakra text-[10px] font-bold uppercase tracking-[0.14em] text-[#121019]">
              {g.blanco ? 'Para pintar' : 'A color'}
            </span>
          </p>
          <h3 className="uxu-nombre rotulo-comic">{m.nombre}</h3>
          <p className="font-chakra text-[12px] font-semibold uppercase tracking-[0.18em] text-[#121019]/75">
            {cat.nombre}
            <span className="ml-2 inline-flex translate-y-[1px] gap-px align-middle">
              {Array.from({ length: 7 }, (_, k) => (
                <Star key={k} size={11} className={k < estrellas(m) ? 'fill-[#FF8A00] text-[#121019]' : 'text-[#121019]/20'} />
              ))}
            </span>
          </p>
          <p className="uxu-descripcion">{m.descripcion}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => onAbrir(m)} className="libro-boton libro-boton-sig">
              Verla en 3D
            </button>
            {historia && (
              <a href={historia} target="_blank" rel="noopener" className="libro-boton">
                Su historia ↗
              </a>
            )}
          </div>
        </div>

        {/* Riel de avance con los capítulos (secciones) para saltar. */}
        <div className="uxu-riel" aria-hidden>
          <span ref={barra} className="uxu-riel-lleno" />
          {capitulos.length > 1 &&
            capitulos.map((c) => (
              <i key={c.k} style={{ top: `${(c.k / total) * 100}%`, background: c.g.categoria.desde }} />
            ))}
        </div>
        <div className="uxu-mandos">
          {capitulos.length > 1 && (
            <select
              aria-label="Ir a la sección"
              className="libro-capitulos"
              value={capitulo.k}
              onChange={(e) => irA(Number(e.target.value))}
            >
              {capitulos.map((c) => (
                <option key={c.k} value={c.k}>
                  {c.g.categoria.nombre}
                  {c.g.blanco ? ' · para pintar' : ''}
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={saltar} className="libro-capitulos inline-flex items-center gap-1">
            Saltar <ChevronDown size={14} />
          </button>
        </div>
        {indice === 0 && (
          <p className="uxu-pista font-comic text-[18px] uppercase tracking-wider">
            Baja para verlas una por una <ChevronDown className="inline animate-bounce" size={18} />
          </p>
        )}
      </div>
    </div>
  )
}
