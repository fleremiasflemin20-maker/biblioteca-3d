import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, MeshReflectorMaterial, OrbitControls, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { ChevronLeft, ChevronRight, Hammer, MessageCircle, Pause, Play, ShoppingBag, X, Lightbulb } from 'lucide-react'
import { CATALOGO, CATEGORIAS, enlaceCompra, peso, precio, rutaPortada, triangulos, type Modelo3D } from '../../lib/catalogo'
import { AlCargar, Pieza, type Modo } from '../../components/Pieza'
import { ICONO_CATEGORIA } from '../../lib/iconos'
import { AmbienteFlemin } from '../luces.tsx'

/**
 * Flemin Studio · la sala.
 *
 * Las obras en pedestales alrededor de un estudio circular, como entrar a una
 * galería: la cámara camina de una a otra, cada pieza se carga en 3D cuando
 * llegas a ella y las demás esperan como láminas con su portada.
 *
 * La sala es pública: aquí no entran Dragon Ball, Caballeros del Zodiaco ni
 * otra propiedad ajena; esas piezas siguen en la tienda.
 */
/** Secciones con personajes de terceros: se venden en la tienda, pero no se exhiben en la sala. */
const AJENAS = new Set<string>(['dragon-ball-z', 'caballeros-del-zodiaco'])

export const OBRAS_PUBLICAS: Modelo3D[] = (() => {
  const propias = CATALOGO.filter((m) => !AJENAS.has(m.categoria))
  const orden = (m: Modelo3D) => (m.categoria === 'seres-flemin' ? 0 : m.destacado ? 1 : 2)
  return [...propias].sort((a, b) => orden(a) - orden(b))
})()

type Luz = 'estudio' | 'atardecer' | 'neon' | 'noche'
const LUCES: { id: Luz; nombre: string }[] = [
  { id: 'estudio', nombre: 'Estudio' },
  { id: 'atardecer', nombre: 'Atardecer' },
  { id: 'neon', nombre: 'Neón Flemin' },
  { id: 'noche', nombre: 'Noche' },
]
const MODOS: { id: Modo; nombre: string }[] = [
  { id: 'textura', nombre: 'Color' },
  { id: 'arcilla', nombre: 'Arcilla' },
  { id: 'malla', nombre: 'Malla' },
]
const ACENTOS = ['#FF6A13', '#FFC23D', '#2FA8FF', '#1FBF8F', '#8A3CFF']

/* ── Geometría de la sala ─────────────────────────────────────────────── */

function radioSala(n: number) {
  return Math.max(9, (n * 4.2) / (2 * Math.PI))
}
function lugar(i: number, n: number) {
  const a = (i / n) * Math.PI * 2
  const R = radioSala(n)
  return { a, pos: new THREE.Vector3(Math.sin(a) * R, 0, -Math.cos(a) * R) }
}

/**
 * Como `Normalizar` del visor (2 de alto, base en y = -1), pero midiendo en el
 * espacio del pedestal: aquí el padre está girado y desplazado.
 */
function NormalizarLocal({ children }: { children: ReactNode }) {
  const grupo = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    const g = grupo.current!
    g.scale.setScalar(1)
    g.position.set(0, 0, 0)
    g.updateWorldMatrix(true, true)
    const caja = new THREE.Box3().setFromObject(g).applyMatrix4(g.matrixWorld.clone().invert())
    if (caja.isEmpty()) return
    const tam = caja.getSize(new THREE.Vector3())
    const centro = caja.getCenter(new THREE.Vector3())
    const k = 2 / Math.max(tam.x, tam.y, tam.z, 1e-6)
    g.scale.setScalar(k)
    g.position.set(-centro.x * k, -caja.min.y * k - 1, -centro.z * k)
  })
  return <group ref={grupo}>{children}</group>
}

/* ── Piezas ───────────────────────────────────────────────────────────── */

function Lamina({ modelo, acento }: { modelo: Modelo3D; acento: string }) {
  const url = rutaPortada(modelo)
  const tex = useTexture(url ?? `${import.meta.env.BASE_URL}favicon.svg`)
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace
  }, [tex])
  return (
    <group position={[0, 1.95, 0]}>
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[1.62, 1.62]} />
        <meshStandardMaterial color={acento} emissive={acento} emissiveIntensity={0.25} />
      </mesh>
      <mesh>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={url ? tex : null} color={url ? '#ffffff' : '#2A2235'} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Pedestal({ i, n, modelo, enfocada, modo, giro, alElegir, alCargar }: { i: number; n: number; modelo: Modelo3D; enfocada: boolean; modo: Modo; giro: boolean; alElegir: () => void; alCargar: () => void }) {
  const { a, pos } = lugar(i, n)
  const acento = ACENTOS[i % ACENTOS.length]
  const pieza = useRef<THREE.Group>(null)
  const [cargada, setCargada] = useState(false)
  useEffect(() => setCargada(false), [modelo.id])
  const listo = useCallback(() => {
    setCargada(true)
    alCargar()
  }, [alCargar])
  useFrame((_, dt) => {
    if (pieza.current && enfocada && giro) pieza.current.rotation.y += dt * 0.45
  })

  return (
    // El pedestal mira al centro de la sala.
    <group position={pos} rotation={[0, -a, 0]}>
      <mesh position={[0, 0.5, 0]} onClick={(e) => (e.stopPropagation(), alElegir())}>
        <cylinderGeometry args={[0.85, 0.95, 1, 48]} />
        <meshStandardMaterial color="#1A1424" roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[0, 1.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 0.85, 64]} />
        <meshBasicMaterial color={acento} toneMapped={false} />
      </mesh>
      {enfocada ? (
        <>
          <Suspense fallback={null}>
            <group ref={pieza} position={[0, 1.85, 0]} scale={0.85}>
              <NormalizarLocal>
                <Pieza modelo={modelo} modo={modo} />
              </NormalizarLocal>
            </group>
            <AlCargar onListo={listo} />
          </Suspense>
          {!cargada && (
            <Suspense fallback={null}>
              <Lamina modelo={modelo} acento={acento} />
            </Suspense>
          )}
          <pointLight position={[0, 4.6, 1.8]} intensity={18} distance={9} color="#FFF4E6" />
        </>
      ) : (
        <group onClick={(e) => (e.stopPropagation(), alElegir())}>
          <Suspense fallback={null}>
            <Lamina modelo={modelo} acento={acento} />
          </Suspense>
        </group>
      )}
    </group>
  )
}

/* ── Arquitectura ─────────────────────────────────────────────────────── */

function Arquitectura({ n, luz, movil }: { n: number; luz: Luz; movil: boolean }) {
  const R = radioSala(n) + 5
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[R + 2, 96]} />
        {movil ? (
          <meshStandardMaterial color="#0F0B16" roughness={0.6} metalness={0.3} />
        ) : (
          <MeshReflectorMaterial resolution={512} blur={[300, 80]} mixBlur={1} mixStrength={luz === 'estudio' ? 6 : 14} roughness={0.75} depthScale={0.8} minDepthThreshold={0.4} maxDepthThreshold={1.4} color="#0F0B16" metalness={0.5} mirror={0.45} />
        )}
      </mesh>
      {/* Muro circular con franjas de luz en los colores Flemin. */}
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[R, R, 8, 96, 1, true]} />
        <meshStandardMaterial color="#120E1A" side={THREE.BackSide} roughness={0.9} />
      </mesh>
      {[0.35, 6.2].map((y, k) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[R - 0.05, R - 0.05, k ? 0.06 : 0.04, 96, 1, true]} />
          <meshBasicMaterial color={luz === 'neon' ? (k ? '#8A3CFF' : '#2FA8FF') : '#FF6A13'} side={THREE.BackSide} toneMapped={false} />
        </mesh>
      ))}
      {/* Anillo de luz en el techo. */}
      <mesh position={[0, 7.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radioSala(n) - 1.2, 0.05, 8, 128]} />
        <meshBasicMaterial color={luz === 'atardecer' ? '#FFC23D' : '#FFFFFF'} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Luces({ luz }: { luz: Luz }) {
  return (
    <>
      <ambientLight intensity={luz === 'noche' ? 0.08 : 0.3} />
      {luz === 'neon' && (
        <>
          <pointLight position={[6, 4, 0]} intensity={40} color="#8A3CFF" />
          <pointLight position={[-6, 4, 0]} intensity={40} color="#2FA8FF" />
          <pointLight position={[0, 3, 6]} intensity={30} color="#FF6A13" />
        </>
      )}
      {luz === 'atardecer' && <directionalLight position={[-8, 5, 4]} intensity={2.2} color="#FF9A4D" />}
      {luz === 'estudio' && <directionalLight position={[3, 8, 4]} intensity={1.2} />}
      <AmbienteFlemin ambiente={luz} intensidad={luz === 'noche' ? 0.4 : luz === 'neon' ? 0.7 : 1} />
    </>
  )
}

/** Camina a la pieza elegida: la cámara se coloca frente al pedestal, del lado del centro. */
function Paseo({ indice, n, entrada }: { indice: number; n: number; entrada: boolean }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: { target: THREE.Vector3; update: () => void } | null }
  const viaje = useRef(0)
  const desde = useRef({ pos: new THREE.Vector3(), objetivo: new THREE.Vector3() })
  useEffect(() => {
    viaje.current = 0.0001
    desde.current = { pos: camera.position.clone(), objetivo: controls?.target.clone() ?? new THREE.Vector3(0, 1.6, 0) }
  }, [indice, entrada, camera, controls])
  useFrame((_, dt) => {
    if (!viaje.current || !controls) return
    viaje.current = Math.min(1, viaje.current + dt / (entrada ? 1.4 : 2.6))
    const k = viaje.current
    const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2
    const { a, pos } = lugar(indice, n)
    // El objetivo va algo por debajo de la pieza: así queda en la mitad de
    // arriba de la pantalla, sobre la ficha.
    const objetivo = pos.clone().setY(1.3)
    const destino = pos.clone().add(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(5.8)).setY(2.5)
    camera.position.lerpVectors(desde.current.pos, destino, e)
    // Al cruzar la sala la cámara sube un poco, como quien camina mirando.
    camera.position.y += Math.sin(e * Math.PI) * 0.6
    controls.target.lerpVectors(desde.current.objetivo, objetivo, e)
    controls.update()
    if (k >= 1) viaje.current = 0
  })
  return null
}

/* ── La sala ──────────────────────────────────────────────────────────── */

export default function Sala({ onCerrar, onEditor, onFicha }: { onCerrar: () => void; onEditor: (m?: Modelo3D) => void; onFicha: (id: string) => void }) {
  const [filtro, setFiltro] = useState<string>('todo')
  const obras = useMemo(() => OBRAS_PUBLICAS.filter((m) => filtro === 'todo' || m.categoria === filtro), [filtro])
  const [indice, setIndice] = useState(0)
  const [luz, setLuz] = useState<Luz>('estudio')
  const [modo, setModo] = useState<Modo>('textura')
  const [giro, setGiro] = useState(true)
  const [dentro, setDentro] = useState(false)
  const [cargando, setCargando] = useState(true)
  const movil = useMemo(() => window.matchMedia('(pointer: coarse)').matches, [])
  const actual = obras[Math.min(indice, obras.length - 1)]
  const cat = CATEGORIAS.find((c) => c.id === actual?.categoria) ?? CATEGORIAS[0]
  const secciones = useMemo(() => CATEGORIAS.filter((c) => c.id === 'todo' || OBRAS_PUBLICAS.some((m) => m.categoria === c.id)), [])

  const mover = useCallback((paso: number) => {
    setIndice((i) => (i + paso + obras.length) % obras.length)
    setCargando(true)
  }, [obras.length])
  const listo = useCallback(() => setCargando(false), [])

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
      if (e.key === 'ArrowRight') mover(1)
      if (e.key === 'ArrowLeft') mover(-1)
    }
    window.addEventListener('keydown', teclas)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', teclas)
      document.body.style.overflow = antes
    }
  }, [onCerrar, mover])

  // Deslizar con el dedo sobre la ficha cambia de pieza.
  const toque = useRef<number | null>(null)

  if (!actual) return null
  const Icono = ICONO_CATEGORIA[cat.id]
  return (
    <div className="fixed inset-0 z-50 bg-[#0D0A14] font-sans text-white">
      <Canvas dpr={[1, movil ? 1.5 : 2]} camera={{ position: [0, 14, 0.01], fov: 50, near: 0.1, far: 200 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={['#0D0A14']} />
        <fog attach="fog" args={['#0D0A14', 12, 38]} />
        <Luces luz={luz} />
        <Arquitectura n={obras.length} luz={luz} movil={movil} />
        {obras.map((m, i) => (
          <Pedestal key={m.id} i={i} n={obras.length} modelo={m} enfocada={i === indice} modo={modo} giro={giro} alElegir={() => (i !== indice && (setIndice(i), setCargando(true)))} alCargar={listo} />
        ))}
        <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={radioSala(obras.length) * 2.4} blur={2.4} far={4} resolution={movil ? 256 : 512} />
        <OrbitControls makeDefault enablePan={false} minDistance={2.2} maxDistance={9} minPolarAngle={Math.PI / 5} maxPolarAngle={Math.PI / 2.05} enableDamping />
        <Paseo indice={indice} n={obras.length} entrada={!dentro} />
      </Canvas>

      {/* ── Barra superior ────────────────────────────────────────── */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-3 p-3 sm:p-5">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl bg-[#120E1A]/80 py-2 pl-2 pr-4 ring-1 ring-white/10 backdrop-blur">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#FF6A13] to-[#FFC23D] font-flemin text-[16px] text-[#0D0A14]">F</span>
          <span className="whitespace-nowrap leading-none">
            <span className="block font-flemin text-[15px]">Flemin Studio</span>
            <span className="hidden font-chakra text-[10px] uppercase tracking-[0.24em] text-white/45 sm:inline">La sala · {obras.length} obras</span>
          </span>
        </div>
        <div className="flex-1" />
        <button type="button" onClick={() => onEditor()} className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-2xl bg-[#FF6A13] px-4 text-[13.5px] font-semibold text-[#0D0A14] shadow-lg transition hover:bg-[#FF8A3D]">
          <Hammer size={17} /> <span className="hidden sm:inline">Modela en el estudio</span><span className="sm:hidden">Modelar</span>
        </button>
        <button type="button" onClick={onCerrar} aria-label="Salir de la sala" className="pointer-events-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#120E1A]/80 text-white/70 ring-1 ring-white/10 backdrop-blur transition hover:text-white">
          <X size={19} />
        </button>
      </header>

      {/* ── Secciones ─────────────────────────────────────────────── */}
      {dentro && (
        <div className="sin-barra absolute inset-x-0 top-[76px] flex gap-2 overflow-x-auto px-3 sm:top-[92px] sm:justify-center sm:px-5">
          {secciones.map((c) => {
            const I = ICONO_CATEGORIA[c.id]
            const activa = filtro === c.id
            return (
              <button key={c.id} type="button" onClick={() => (setFiltro(c.id), setIndice(0), setCargando(true))} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium ring-1 backdrop-blur transition ${activa ? 'bg-white text-[#0D0A14] ring-white' : 'bg-[#120E1A]/70 text-white/70 ring-white/10 hover:text-white'}`}>
                <I size={14} /> {c.id === 'todo' ? 'Todas' : c.nombre}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Entrada ───────────────────────────────────────────────── */}
      {!dentro && (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-[#0D0A14]/40 via-[#0D0A14]/70 to-[#0D0A14]/95 p-6">
          <div className="max-w-xl text-center">
            <p className="font-chakra text-[12px] uppercase tracking-[0.35em] text-[#FFC23D]">Estudio de modelado e impresión 3D</p>
            <h1 className="mt-4 font-flemin text-[clamp(2.4rem,8vw,5rem)] leading-[0.95]">
              Bienvenido a <span className="bg-gradient-to-r from-[#FF6A13] via-[#FFC23D] to-[#2FA8FF] bg-clip-text text-transparent">Flemin Studio</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-white/65">
              Recorre las obras del estudio en sus pedestales, gíralas, cambia la luz y mira su malla. Después, modela la tuya en el editor y llévatela lista para la impresora.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => setDentro(true)} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold text-[#0D0A14] transition hover:bg-[#FFC23D]">
                Entrar a la sala <ChevronRight size={18} />
              </button>
              <button type="button" onClick={() => onEditor()} className="inline-flex h-12 items-center gap-2 rounded-full bg-white/[0.08] px-6 text-[15px] ring-1 ring-white/15 transition hover:bg-white/[0.14]">
                <Hammer size={17} /> Ir al editor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ficha de la obra ──────────────────────────────────────── */}
      {dentro && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-3 sm:p-5">
          <div className="pointer-events-auto flex items-center gap-1 rounded-2xl bg-[#120E1A]/80 p-1 ring-1 ring-white/10 backdrop-blur">
            {MODOS.map((m) => (
              <button key={m.id} type="button" onClick={() => setModo(m.id)} className={`h-8 rounded-xl px-3 text-[12px] font-medium transition ${modo === m.id ? 'bg-white text-[#0D0A14]' : 'text-white/65 hover:text-white'}`}>
                {m.nombre}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-white/10" />
            <button type="button" onClick={() => setGiro((g) => !g)} title={giro ? 'Detener el giro' : 'Girar'} className="grid h-8 w-8 place-items-center rounded-xl text-white/70 hover:text-white">
              {giro ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <label className="flex h-8 items-center gap-1 rounded-xl px-2 text-white/70" title="Iluminación">
              <Lightbulb size={15} />
              <select value={luz} onChange={(e) => setLuz(e.target.value as Luz)} className="bg-transparent text-[12px] outline-none" aria-label="Iluminación">
                {LUCES.map((l) => (
                  <option key={l.id} value={l.id} className="bg-[#17121F]">
                    {l.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            className="pointer-events-auto w-full max-w-3xl rounded-3xl bg-[#120E1A]/85 p-4 shadow-2xl ring-1 ring-white/10 backdrop-blur-md sm:p-5"
            onTouchStart={(e) => (toque.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (toque.current === null) return
              const dx = e.changedTouches[0].clientX - toque.current
              if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1)
              toque.current = null
            }}
          >
            <div className="flex items-start gap-3">
              <button type="button" onClick={() => mover(-1)} aria-label="Obra anterior" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-white/80 transition hover:bg-white/[0.12]">
                <ChevronLeft size={20} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-chakra text-[11px] uppercase tracking-[0.2em] text-white/45">
                  <Icono size={13} style={{ color: cat.tinta }} /> {cat.nombre} · {String(indice + 1).padStart(2, '0')}/{String(obras.length).padStart(2, '0')}
                  {cargando && <span className="ml-1 h-3 w-3 animate-spin rounded-full border border-white/20 border-t-[#FF6A13]" />}
                </p>
                <h2 className="mt-1 truncate font-flemin text-[clamp(1.1rem,3vw,1.6rem)] leading-tight">{actual.nombre}</h2>
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-chakra text-[12px] text-white/60">
                  <div><dt className="inline text-white/35">Triángulos </dt><dd className="inline tabular-nums">{triangulos(actual.triangulos)}</dd></div>
                  <div><dt className="inline text-white/35">Peso </dt><dd className="inline tabular-nums">{peso(actual.peso)}</dd></div>
                  {actual.piezas && <div><dt className="inline text-white/35">Piezas </dt><dd className="inline">{actual.piezas.length}</dd></div>}
                  <div><dt className="inline text-white/35">Formatos </dt><dd className="inline">{actual.formatos.join(' · ')}</dd></div>
                  {actual.origen && <div className="hidden sm:block"><dt className="inline text-white/35">Origen </dt><dd className="inline">{actual.origen}</dd></div>}
                </dl>
              </div>
              <button type="button" onClick={() => mover(1)} aria-label="Obra siguiente" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-white/80 transition hover:bg-white/[0.12]">
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-auto font-flemin text-[20px] text-[#FFC23D]">{precio(actual.precio)}</span>
              <button type="button" onClick={() => onFicha(actual.id)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[13px] ring-1 ring-white/10 transition hover:bg-white/[0.14]">
                <ShoppingBag size={15} /> Ver ficha
              </button>
              {!actual.personalizable && (
                <button type="button" onClick={() => onEditor(actual)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[13px] ring-1 ring-white/10 transition hover:bg-white/[0.14]">
                  <Hammer size={15} /> Abrir en el editor
                </button>
              )}
              <a href={enlaceCompra(actual)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#FF6A13] px-4 text-[13px] font-semibold text-[#0D0A14] transition hover:bg-[#FF8A3D]">
                <MessageCircle size={15} /> Pedir
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
