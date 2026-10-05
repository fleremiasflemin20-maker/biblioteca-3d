import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, useGLTF } from '@react-three/drei'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import * as THREE from 'three'
import { ArrowLeftRight, ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  CONEXIONES,
  Deslizamiento,
  FiltroEuro,
  IdentidadManos,
  MaquinaGestos,
  pinza,
  referenciaValida,
  zoomDesdePinza,
  RUTA_MODELO_MANO,
  RUTA_WASM,
  type Gesto,
  type Punto,
} from '../lib/manos'
import { DRACO, precio, rutaModelo, rutaPortada, type Modelo3D } from '../lib/catalogo'
import { Pieza } from './Pieza'

/* ── Ajustes ─────────────────────────────────────────────────────────────
 * Las de posición, tamaño y cámara son las del portafolio; el resto es lo
 * nuevo: filtrado, agarre con inercia y transiciones.
 */
const ACENTO = '#5EEAD4'
const TAMANO_OBJETIVO = 1.1
const TAMANO_TESSERACT = TAMANO_OBJETIVO * 1.55
const ALTURA_SOBRE_PALMA = 0.15
const ASPECTO_CAMARA = 640 / 480
const DISTANCIA_CAMARA_BASE = 5
/** Con la señal ya filtrada, la amortiguación de render puede ser alta: respuesta inmediata sin temblor. */
const LAMBDA_POSICION = 22
const LAMBDA_ROTACION = 16
const LAMBDA_ZOOM = 6
/** Radianes de giro por cada ancho de pantalla arrastrado en el agarre. */
const GIRO_POR_ANCHO = 7
/** Inclinación máxima arriba/abajo en el agarre: más allá se ve la base y desorienta. */
const INCLINACION_MAX = 0.75
/** Cuánto tarda la inercia en apagarse tras soltar (1/s). */
const FRICCION = 2.4
/** Giro de cortesía cuando nadie toca la figura. */
const GIRO_REPOSO = 0.22
const ESPERA_REPOSO = 2.5
/** Segundos que la figura sigue en pantalla tras perder la mano: un fotograma sin detección no la hace parpadear. */
const GRACIA = 0.3
/** Recorrido de las figuras al entrar y salir, en unidades de mundo. */
const RECORRIDO_TRANSICION = 1.8
const DURACION_ENTRA = 0.55
const DURACION_SALE = 0.38

type Estado = 'arrancando' | 'activo' | 'error' | 'demo'

/**
 * Lo que comparte el bucle de detección con el de render. Objeto mutable y no
 * estado de React —el mismo patrón que el portafolio—: lo escriben ~30
 * detecciones por segundo y lo leen 60–120 fotogramas por segundo, y nada de
 * eso debe repintar el árbol.
 */
type Senal = {
  visible: boolean
  /** Centro de la palma filtrado, en coordenadas del sensor (sin espejar). */
  x: number
  y: number
  gesto: Gesto
  /** Rotación objetivo de la figura. */
  rotY: number
  rotX: number
  /** Velocidad angular heredada del agarre al soltar. */
  velY: number
  velX: number
  /** Última vez (s, `performance.now`) que alguien tocó la figura, para el giro de reposo. */
  ultimoToque: number
  zoom: number
}

const nuevaSenal = (): Senal => ({ visible: false, x: 0.5, y: 0.5, gesto: 'neutra', rotY: 0, rotX: 0, velY: 0, velX: 0, ultimoToque: 0, zoom: 1 })

function corregirRecorte(x: number, y: number, aspectoHueco: number): { x: number; y: number } {
  if (aspectoHueco > ASPECTO_CAMARA) {
    const fraccion = ASPECTO_CAMARA / aspectoHueco
    return { x, y: (y - (1 - fraccion) / 2) / fraccion }
  }
  const fraccion = aspectoHueco / ASPECTO_CAMARA
  return { x: (x - (1 - fraccion) / 2) / fraccion, y }
}

/* ── Sonido ──────────────────────────────────────────────────────────── */

function tono(ctx: AudioContext, tipo: OscillatorType, f0: number, f1: number, inicio: number, pico: number, fin: number, volumen = 0.16) {
  const ahora = ctx.currentTime
  const maestro = ctx.createGain()
  maestro.gain.value = volumen
  maestro.connect(ctx.destination)
  const osc = ctx.createOscillator()
  osc.type = tipo
  osc.frequency.setValueAtTime(f0, ahora + inicio)
  osc.frequency.exponentialRampToValueAtTime(f1, ahora + inicio + 0.07)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, ahora + inicio)
  g.gain.linearRampToValueAtTime(pico, ahora + inicio + 0.008)
  g.gain.exponentialRampToValueAtTime(0.001, ahora + fin)
  osc.connect(g)
  g.connect(maestro)
  osc.start(ahora + inicio)
  osc.stop(ahora + fin + 0.02)
}

/** El pitido de cambio de figura del portafolio. */
const sonidoCambio = (ctx: AudioContext) => {
  tono(ctx, 'sine', 620, 1180, 0, 1, 0.22)
  tono(ctx, 'triangle', 1860, 2400, 0.03, 0.5, 0.18)
}
/** Un clic corto al agarrar y otro más grave al soltar: la confirmación táctil que la mano no siente. */
const sonidoAgarre = (ctx: AudioContext, agarra: boolean) =>
  agarra ? tono(ctx, 'sine', 900, 1300, 0, 0.6, 0.07, 0.1) : tono(ctx, 'sine', 700, 480, 0, 0.5, 0.08, 0.08)

function precargar(m: Modelo3D | undefined) {
  if (m && !m.personalizable) useGLTF.preload(rutaModelo(m), DRACO)
}

/* ── Escena 3D ───────────────────────────────────────────────────────── */

/** Centra la pieza en su origen y la lleva a un tamaño común (hay piezas de 2 cm y escaneos de 2 m). */
function ModeloEscalado({ modelo, onListo }: { modelo: Modelo3D; onListo: () => void }) {
  const grupo = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    const g = grupo.current
    if (!g) return
    g.scale.setScalar(1)
    g.position.set(0, 0, 0)
    // Se mide suelta, sin padres: `Box3.setFromObject` trabaja en coordenadas
    // de mundo, y la capa que la contiene arranca a escala 0 hasta que la
    // pieza carga. Medida ahí dentro, la caja sale de tamaño 0 y la figura,
    // escalada por mil.
    const padre = g.parent
    padre?.remove(g)
    g.updateMatrixWorld(true)
    const caja = new THREE.Box3().setFromObject(g)
    padre?.add(g)
    const tam = caja.getSize(new THREE.Vector3())
    const c = caja.getCenter(new THREE.Vector3())
    const k = TAMANO_OBJETIVO / Math.max(tam.x, tam.y, tam.z, 1e-3)
    g.scale.setScalar(k)
    g.position.set(-c.x * k, -c.y * k, -c.z * k)
    onListo()
  }, [modelo, onListo])
  return (
    <group ref={grupo}>
      <Pieza modelo={modelo} />
    </group>
  )
}

const easeOutBack = (t: number) => {
  const c1 = 1.4
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
const easeInCubic = (t: number) => t * t * t

type Capa = { modelo: Modelo3D; clave: number; tipo: 'entra' | 'sale'; dir: number }

/**
 * Una figura de la transición. La que entra arranca su animación cuando
 * termina de cargar —no cuando se pide—, así una pieza pesada no aparece de
 * golpe a mitad de camino.
 *
 * `dir` está en coordenadas de pantalla (+1 = derecha). El lienzo vive dentro
 * del contenedor espejado, así que en el mundo va al revés.
 */
function CapaFigura({ capa }: { capa: Capa }) {
  const g = useRef<THREE.Group>(null)
  const inicio = useRef<number | null>(capa.tipo === 'sale' ? -1 : null)
  const listo = useCallback(() => {
    if (inicio.current === null) inicio.current = -1
  }, [])

  useFrame(({ clock }) => {
    const grupo = g.current
    if (!grupo) return
    if (inicio.current === null) {
      grupo.scale.setScalar(0)
      return
    }
    if (inicio.current === -1) inicio.current = clock.elapsedTime
    const t = clock.elapsedTime - inicio.current
    const mundo = -capa.dir * RECORRIDO_TRANSICION
    if (capa.tipo === 'entra') {
      const k = Math.min(1, t / DURACION_ENTRA)
      const e = easeOutBack(k)
      grupo.position.x = -mundo * (1 - e)
      grupo.scale.setScalar(0.55 + 0.45 * e)
      grupo.rotation.y = (1 - e) * capa.dir * 0.9
    } else {
      const k = Math.min(1, t / DURACION_SALE)
      const e = easeInCubic(k)
      grupo.position.x = mundo * e
      grupo.scale.setScalar(1 - 0.6 * e)
      grupo.rotation.y = -e * capa.dir * 0.9
    }
  })

  return (
    <group ref={g}>
      <Suspense fallback={null}>
        <ModeloEscalado modelo={capa.modelo} onListo={listo} />
      </Suspense>
    </group>
  )
}

/** La jaula tesseract del portafolio: dos cubos y las ocho aristas que los unen. Se tensa al agarrar. */
function Tesseract({ tamano, senal }: { tamano: number; senal: MutableRefObject<Senal> }) {
  const grupo = useRef<THREE.Group>(null)
  const materiales = useRef<THREE.LineBasicMaterial[]>([])
  const energia = useRef(0)
  const { exterior, interior, conectores } = useMemo(() => {
    const mitad = tamano / 2
    const mitadInt = tamano * 0.27
    const exterior = new THREE.EdgesGeometry(new THREE.BoxGeometry(tamano, tamano, tamano))
    const interior = new THREE.EdgesGeometry(new THREE.BoxGeometry(mitadInt * 2, mitadInt * 2, mitadInt * 2))
    const puntos: number[] = []
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      puntos.push(sx * mitad, sy * mitad, sz * mitad, sx * mitadInt, sy * mitadInt, sz * mitadInt)
    }
    const conectores = new THREE.BufferGeometry()
    conectores.setAttribute('position', new THREE.Float32BufferAttribute(puntos, 3))
    return { exterior, interior, conectores }
  }, [tamano])

  useFrame((_, dtBruto) => {
    const g = grupo.current
    if (!g) return
    const dt = Math.min(dtBruto, 1 / 20)
    const agarrada = senal.current.gesto === 'agarre' ? 1 : 0
    energia.current = THREE.MathUtils.damp(energia.current, agarrada, 10, dt)
    const e = energia.current
    g.rotation.y += dt * (0.18 + e * 0.9)
    g.rotation.x += dt * 0.07
    g.scale.setScalar(1 - e * 0.08)
    const base = [0.32, 0.58, 0.14]
    materiales.current.forEach((m, i) => {
      if (m) m.opacity = base[i] + e * 0.35
    })
  })

  return (
    <group ref={grupo}>
      {[exterior, interior, conectores].map((geo, i) => (
        <lineSegments key={i} geometry={geo}>
          <lineBasicMaterial
            ref={(m) => {
              if (m) materiales.current[i] = m
            }}
            color={ACENTO}
            transparent
          />
        </lineSegments>
      ))}
    </group>
  )
}

function ControlCamara({ senal }: { senal: MutableRefObject<Senal> }) {
  const suave = useRef(1)
  const { camera } = useThree()
  useFrame((_, dtBruto) => {
    const dt = Math.min(dtBruto, 1 / 20)
    suave.current = THREE.MathUtils.damp(suave.current, senal.current.zoom, LAMBDA_ZOOM, dt)
    camera.position.z = DISTANCIA_CAMARA_BASE * suave.current
    ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
  })
  return null
}

/**
 * La figura en la mano. Posición: la palma filtrada, 1:1. Rotación: la que
 * deja el agarre, con inercia al soltar y un giro lento cuando nadie la toca.
 */
function AnclaMano({ capas, senal }: { capas: Capa[]; senal: MutableRefObject<Senal> }) {
  const grupo = useRef<THREE.Group>(null)
  const giro = useRef<THREE.Group>(null)
  const s = useRef({ x: 0, y: ALTURA_SOBRE_PALMA, escala: 0, rotX: 0, rotY: 0 })
  const { camera, size } = useThree()

  useFrame((_, dtBruto) => {
    const g = grupo.current
    const r = giro.current
    if (!g || !r) return
    const dt = Math.min(dtBruto, 1 / 20)
    const sen = senal.current
    const cam = camera as THREE.PerspectiveCamera
    const aspecto = size.width / size.height
    const { x, y } = corregirRecorte(sen.x, sen.y, aspecto)
    const alto = 2 * Math.tan((cam.fov * Math.PI) / 360) * cam.position.z
    const v = s.current
    v.x = THREE.MathUtils.damp(v.x, (x - 0.5) * alto * aspecto, LAMBDA_POSICION, dt)
    v.y = THREE.MathUtils.damp(v.y, -(y - 0.5) * alto + ALTURA_SOBRE_PALMA, LAMBDA_POSICION, dt)
    v.escala = THREE.MathUtils.damp(v.escala, sen.visible ? 1 : 0, 9, dt)
    g.position.set(v.x, v.y, 0)
    g.scale.setScalar(v.escala)

    v.rotY = THREE.MathUtils.damp(v.rotY, sen.rotY, LAMBDA_ROTACION, dt)
    v.rotX = THREE.MathUtils.damp(v.rotX, sen.rotX, LAMBDA_ROTACION, dt)
    r.rotation.set(v.rotX, v.rotY, 0)
  })

  return (
    <group ref={grupo} scale={0}>
      <group ref={giro}>
        {capas.map((c) => (
          <CapaFigura key={c.clave} capa={c} />
        ))}
      </group>
      <Tesseract tamano={TAMANO_TESSERACT} senal={senal} />
    </group>
  )
}

/* ── El modo manos ───────────────────────────────────────────────────── */

const ETIQUETA_GESTO: Record<Gesto, string> = {
  abierta: 'Mano abierta · desliza para cambiar',
  agarre: 'Agarrada · arrastra para girar',
  puno: 'Puño · muévela sin cambiar',
  neutra: 'Siguiendo tu mano',
}

/**
 * Modo manos: el catálogo entero sobre la palma, con la cámara del equipo.
 * Es el sistema de la sección 3D del portafolio llevado a un catálogo de
 * decenas de piezas:
 *
 * - Mano derecha: la figura la sigue. Mano abierta y deslizada rápido, pasa
 *   de figura. Pinza con los otros dedos abiertos (el "OK"): la agarra, y
 *   arrastrar la gira — con inercia al soltar. Puño: la lleva sin cambiar.
 * - Mano izquierda: pinza para acercar o alejar, como en el portafolio.
 *
 * Bajo el capó: detección sincronizada con cada fotograma de la cámara, filtro
 * One Euro en cada señal, gestos con histéresis, identidad de las manos por
 * continuidad y un margen de gracia al perderlas. Ver `lib/manos.ts`.
 */
export function ModoManos({
  lista,
  indiceInicial,
  onCerrar,
  onFicha,
}: {
  lista: Modelo3D[]
  indiceInicial: number
  onCerrar: (id: string) => void
  onFicha: (id: string) => void
}) {
  const [estado, setEstado] = useState<Estado>('arrancando')
  const [fallo, setFallo] = useState('')
  const [indice, setIndice] = useState(indiceInicial)
  const [capas, setCapas] = useState<Capa[]>(() => [{ modelo: lista[indiceInicial], clave: 0, tipo: 'entra', dir: 0 }])
  const actual = lista[indice]

  const [invertido, setInvertido] = useState(() => {
    try {
      return localStorage.getItem('manos-invertido') === '1'
    } catch {
      return false
    }
  })
  const invRef = useRef(invertido)
  useEffect(() => {
    invRef.current = invertido
  }, [invertido])

  const video = useRef<HTMLVideoElement>(null)
  const lienzo2d = useRef<HTMLCanvasElement>(null)
  const flujo = useRef<MediaStream | null>(null)
  const detector = useRef<HandLandmarker | null>(null)
  const audioCtx = useRef<AudioContext | null>(null)
  const senal = useRef<Senal>(nuevaSenal())
  const zoomTexto = useRef<HTMLSpanElement>(null)
  const gestoTexto = useRef<HTMLSpanElement>(null)
  const gestoPunto = useRef<HTMLSpanElement>(null)
  const barraDesliz = useRef<HTMLDivElement>(null)
  const claveCapa = useRef(1)

  const indiceRef = useRef(indiceInicial)

  /** Cambia de figura animando la transición. `dir`: hacia dónde sale la actual en pantalla. */
  const mover = useCallback(
    (paso: number, dir: number) => {
      const n = (indiceRef.current + paso + lista.length) % lista.length
      indiceRef.current = n
      const clave = claveCapa.current++
      setIndice(n)
      setCapas((cs) => [
        ...cs.filter((c) => c.tipo === 'entra').map((c) => ({ ...c, tipo: 'sale' as const, dir })),
        { modelo: lista[n], clave, tipo: 'entra', dir: -dir },
      ])
      // La que sale se retira cuando termina su animación.
      window.setTimeout(() => setCapas((cs) => cs.filter((c) => c.tipo === 'entra' || c.clave >= clave)), DURACION_SALE * 1000 + 60)
      if (audioCtx.current) sonidoCambio(audioCtx.current)
    },
    [lista],
  )
  const siguiente = useCallback(() => mover(1, -1), [mover])
  const anterior = useCallback(() => mover(-1, 1), [mover])
  const moverRef = useRef(mover)
  useEffect(() => {
    moverRef.current = mover
  }, [mover])

  useEffect(() => {
    precargar(lista[(indice + 1) % lista.length])
    precargar(lista[(indice - 1 + lista.length) % lista.length])
  }, [indice, lista])

  useEffect(() => {
    let cancelado = false
    let rafId = 0
    let vfcId = 0

    async function crearDetector(delegate: 'GPU' | 'CPU') {
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks(RUTA_WASM)
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: RUTA_MODELO_MANO, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      })
    }

    async function arrancar() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no da acceso a la cámara.')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60, min: 24 }, facingMode: 'user' },
        })
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        flujo.current = stream
        const v = video.current!
        v.srcObject = stream
        await v.play()

        try {
          audioCtx.current = new AudioContext()
        } catch {
          /* Sin audio: el resto sigue igual. */
        }

        // GPU primero; si el equipo no la ofrece a WebGL, CPU. Más lento, pero funciona.
        try {
          detector.current = await crearDetector('GPU')
        } catch {
          detector.current = await crearDetector('CPU')
        }
        if (cancelado) return
        setEstado('activo')

        const identidad = new IdentidadManos()
        const maquina = new MaquinaGestos()
        const desliz = new Deslizamiento()
        // Corte bajo y beta alta en la posición: quieta como una piedra en
        // reposo y pegada a la mano en movimiento. La pinza del zoom, más suave.
        const fx = new FiltroEuro(1.2, 0.9)
        const fy = new FiltroEuro(1.2, 0.9)
        const fPinza = new FiltroEuro(0.8, 0.3)
        /** Un juego de filtros por articulación y por mano, solo para el esqueleto en pantalla. */
        const fEsqueleto = [0, 1].map(() => Array.from({ length: 21 }, () => [new FiltroEuro(1.5, 0.6), new FiltroEuro(1.5, 0.6)]))
        let refPinza: number | null = null
        let ultimaVista = -Infinity
        let gestoPrevio: Gesto = 'neutra'
        let agarreDesde = { x: 0, y: 0, rotY: 0, rotX: 0 }
        let ultimaMarca = 0
        const relojInicio = performance.now()
        let tPrevio = 0

        const dibujarEsqueleto = (manos: (Punto[] | undefined)[], t: number) => {
          const c = lienzo2d.current
          if (!c) return
          const ancho = c.clientWidth
          const alto = c.clientHeight
          const dpr = Math.min(2, window.devicePixelRatio || 1)
          if (c.width !== Math.round(ancho * dpr)) {
            c.width = Math.round(ancho * dpr)
            c.height = Math.round(alto * dpr)
          }
          const ctx = c.getContext('2d')
          if (!ctx) return
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          ctx.clearRect(0, 0, ancho, alto)
          const aspecto = ancho / alto
          manos.forEach((p, h) => {
            if (!p) {
              for (const [a, b] of fEsqueleto[h]) {
                a.reiniciar()
                b.reiniciar()
              }
              return
            }
            const pts = p.map((q, i) => {
              const { x, y } = corregirRecorte(fEsqueleto[h][i][0].filtrar(q.x, t), fEsqueleto[h][i][1].filtrar(q.y, t), aspecto)
              return [(1 - x) * ancho, y * alto] as const
            })
            const color = h === 0 ? ACENTO : '#ffffff'
            ctx.lineWidth = 1.25
            ctx.strokeStyle = h === 0 ? 'rgba(94,234,212,0.38)' : 'rgba(255,255,255,0.28)'
            ctx.beginPath()
            for (const [a, b] of CONEXIONES) {
              ctx.moveTo(pts[a][0], pts[a][1])
              ctx.lineTo(pts[b][0], pts[b][1])
            }
            ctx.stroke()
            ctx.fillStyle = color
            for (const i of [4, 8, 12, 16, 20]) {
              ctx.beginPath()
              ctx.arc(pts[i][0], pts[i][1], 2.6, 0, Math.PI * 2)
              ctx.fill()
            }
            // En el agarre, un anillo entre pulgar e índice: se ve qué está sujetando la figura.
            if (h === 0 && senal.current.gesto === 'agarre') {
              const mx = (pts[4][0] + pts[8][0]) / 2
              const my = (pts[4][1] + pts[8][1]) / 2
              ctx.strokeStyle = ACENTO
              ctx.lineWidth = 1.5
              ctx.beginPath()
              ctx.arc(mx, my, 14, 0, Math.PI * 2)
              ctx.stroke()
            }
          })
        }

        const procesar = (ahoraMs: number) => {
          const det = detector.current
          const v2 = video.current
          if (!det || !v2 || v2.readyState < 2 || document.hidden) return
          // MediaPipe exige marcas de tiempo estrictamente crecientes.
          const marca = Math.max(ahoraMs, ultimaMarca + 1)
          ultimaMarca = marca
          const r = det.detectForVideo(v2, marca)
          const t = (performance.now() - relojInicio) / 1000
          const dt = Math.min(0.1, Math.max(0, t - tPrevio))
          tPrevio = t
          const sen = senal.current

          const { principal, secundaria } = identidad.asignar(
            r.landmarks.map((p, i) => ({
              puntos: p as Punto[],
              etiqueta: (r.handedness[i]?.[0]?.categoryName ?? 'Right') as 'Left' | 'Right',
              confianza: r.handedness[i]?.[0]?.score ?? 0,
            })),
            t,
            invRef.current,
          )

          if (principal) {
            ultimaVista = t
            const c = { x: principal[9].x, y: principal[9].y }
            const gesto = maquina.actualizar(principal)
            const px = fx.filtrar(c.x, t)
            const py = fy.filtrar(c.y, t)
            // En pantalla la imagen va espejada: x de pantalla = 1 - x del sensor.
            const xPantalla = 1 - px

            if (gesto === 'agarre') {
              if (gestoPrevio !== 'agarre') {
                agarreDesde = { x: xPantalla, y: py, rotY: sen.rotY, rotX: sen.rotX }
                sen.velY = 0
                sen.velX = 0
                if (audioCtx.current) sonidoAgarre(audioCtx.current, true)
              }
              // Agarrada: la figura se queda donde se cogió y el arrastre la gira.
              sen.rotY = agarreDesde.rotY + (xPantalla - agarreDesde.x) * GIRO_POR_ANCHO
              sen.rotX = THREE.MathUtils.clamp(agarreDesde.rotX + (py - agarreDesde.y) * GIRO_POR_ANCHO * 0.6, -INCLINACION_MAX, INCLINACION_MAX)
              sen.ultimoToque = performance.now() / 1000
            } else {
              if (gestoPrevio === 'agarre') {
                // Al soltar, la figura hereda la velocidad del arrastre: un lanzamiento.
                sen.velY = -fx.velocidad * GIRO_POR_ANCHO
                sen.velX = fy.velocidad * GIRO_POR_ANCHO * 0.6
                sen.ultimoToque = performance.now() / 1000
                if (audioCtx.current) sonidoAgarre(audioCtx.current, false)
              }
              sen.x = px
              sen.y = py
            }

            if (gesto === 'abierta') {
              const d = desliz.leer(t, xPantalla, -fx.velocidad)
              // Como en un móvil: la mano hacia la izquierda trae la siguiente.
              if (d) moverRef.current(-d, d)
              if (barraDesliz.current) {
                const pr = desliz.progreso()
                barraDesliz.current.style.transform = `translateX(${pr * 50}%) scaleX(${0.15 + Math.abs(pr) * 0.35})`
                barraDesliz.current.style.opacity = String(Math.min(1, Math.abs(pr) * 1.6))
              }
            } else {
              desliz.reiniciar()
              if (barraDesliz.current) barraDesliz.current.style.opacity = '0'
            }

            if (gesto !== gestoPrevio) {
              if (gestoTexto.current) gestoTexto.current.textContent = ETIQUETA_GESTO[gesto]
              if (gestoPunto.current) gestoPunto.current.style.background = gesto === 'agarre' ? ACENTO : 'rgba(255,255,255,0.7)'
            }
            gestoPrevio = gesto
            sen.gesto = gesto
          } else {
            maquina.reiniciar()
            desliz.reiniciar()
            if (gestoPrevio === 'agarre') sen.ultimoToque = performance.now() / 1000
            if (gestoPrevio !== 'neutra' && gestoTexto.current) gestoTexto.current.textContent = 'Levanta la mano derecha'
            gestoPrevio = 'neutra'
            sen.gesto = 'neutra'
            // Pasada la gracia se olvida la posición: si la mano vuelve por
            // otro lado, la figura no cruza la pantalla arrastrándose.
            if (t - ultimaVista > GRACIA) {
              fx.reiniciar()
              fy.reiniciar()
            }
            if (barraDesliz.current) barraDesliz.current.style.opacity = '0'
          }
          sen.visible = t - ultimaVista < GRACIA

          // Fuera del agarre la rotación la lleva la inercia del lanzamiento,
          // que se apaga con fricción exponencial; la inclinación vuelve sola a
          // recta; y tras un rato sin tocarla, la figura gira despacio. El
          // render solo lee `rotY`/`rotX` y los suaviza.
          if (sen.gesto !== 'agarre') {
            sen.rotY += sen.velY * dt
            sen.rotX += sen.velX * dt
            const f = Math.exp(-FRICCION * dt)
            sen.velY *= f
            sen.velX *= f
            if (Math.abs(sen.velX) < 0.05) sen.rotX = THREE.MathUtils.damp(sen.rotX, 0, 1.5, dt)
            if (performance.now() / 1000 - sen.ultimoToque > ESPERA_REPOSO) sen.rotY += GIRO_REPOSO * dt
          }

          if (secundaria) {
            const p = fPinza.filtrar(pinza(secundaria), t)
            if (refPinza === null) refPinza = referenciaValida(p)
            sen.zoom = zoomDesdePinza(p, refPinza)
          } else {
            refPinza = null
            fPinza.reiniciar()
          }
          if (zoomTexto.current) {
            zoomTexto.current.textContent = `${Math.round(100 / sen.zoom)}%`
            zoomTexto.current.style.color = secundaria ? ACENTO : ''
          }

          dibujarEsqueleto([principal, secundaria], t)
        }

        // Un análisis por cada fotograma real de la cámara: ni uno repetido ni
        // uno perdido. Donde no exista `requestVideoFrameCallback`, a ritmo de pantalla.
        const vfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (ahora: number) => void) => number }).requestVideoFrameCallback?.bind(v)
        if (vfc) {
          const cb = (ahora: number) => {
            if (cancelado) return
            procesar(ahora)
            vfcId = vfc(cb)
          }
          vfcId = vfc(cb)
        } else {
          const cb = (ahora: number) => {
            if (cancelado) return
            procesar(ahora)
            rafId = requestAnimationFrame(cb)
          }
          rafId = requestAnimationFrame(cb)
        }
      } catch (e) {
        if (cancelado) return
        flujo.current?.getTracks().forEach((t) => t.stop())
        flujo.current = null
        const msg = e instanceof Error ? e.message : String(e)
        setFallo(
          /denied|not allowed|permission/i.test(msg)
            ? 'No diste permiso de cámara. Vuelve a permitirlo desde el candado de la barra de direcciones.'
            : /not found|no device|overconstrained/i.test(msg)
              ? 'No se encontró ninguna cámara. Conecta una webcam y vuelve a abrir el modo manos.'
              : /in use|could not start|not readable/i.test(msg)
                ? 'La cámara está ocupada por otra aplicación. Ciérrala y vuelve a intentarlo.'
                : `No se pudo arrancar: ${msg}`,
        )
        setEstado('error')
      }
    }

    arrancar()
    const v = video.current
    return () => {
      cancelado = true
      cancelAnimationFrame(rafId)
      ;(v as (HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void }) | null)?.cancelVideoFrameCallback?.(vfcId)
      flujo.current?.getTracks().forEach((t) => t.stop())
      flujo.current = null
      detector.current?.close()
      detector.current = null
      audioCtx.current?.close()
      audioCtx.current = null
    }
  }, [])

  /*
   * Demostración sin cámara: una mano simulada que recorre la pantalla,
   * agarra la figura, la gira, la suelta con inercia y desliza para cambiar.
   * Sirve a quien no tiene webcam y escribe exactamente la misma `Senal` que
   * la detección real, así que lo que se ve es el mismo motor de render.
   */
  useEffect(() => {
    if (estado !== 'demo') return
    let id = 0
    const t0 = performance.now()
    let cambio = 0
    let soltado = false
    const sen = senal.current
    if (gestoTexto.current) gestoTexto.current.textContent = 'Demostración · mano simulada'
    const paso = (ahora: number) => {
      id = requestAnimationFrame(paso)
      const t = (ahora - t0) / 1000
      const ciclo = t % 6
      sen.visible = true
      sen.gesto = ciclo > 2 && ciclo < 3.6 ? 'agarre' : 'abierta'
      if (sen.gesto === 'agarre') {
        sen.rotY = Math.sin((ciclo - 2) * 2) * 1.6
        soltado = false
      } else {
        if (!soltado && ciclo >= 3.6) {
          sen.velY = 3
          sen.ultimoToque = performance.now() / 1000
          soltado = true
        }
        sen.x = 0.5 + Math.sin(t * 0.7) * 0.18
        sen.y = 0.5 + Math.cos(t * 0.9) * 0.08
        sen.rotY += sen.velY / 60
        sen.velY *= Math.exp(-FRICCION / 60)
      }
      if (gestoTexto.current) gestoTexto.current.textContent = `Demostración · ${ETIQUETA_GESTO[sen.gesto]}`
      if (Math.floor(t / 6) > cambio) {
        cambio = Math.floor(t / 6)
        moverRef.current(1, -1)
      }
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [estado])

  const cerrar = useCallback(() => onCerrar(actual.id), [onCerrar, actual.id])

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
      if (e.key === 'ArrowRight') siguiente()
      if (e.key === 'ArrowLeft') anterior()
    }
    window.addEventListener('keydown', teclas)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', teclas)
      document.documentElement.style.overflow = ''
    }
  }, [cerrar, siguiente, anterior])

  const boton =
    'flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-[13px] font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-white hover:text-black'
  const vecinos = [-2, -1, 0, 1, 2].map((d) => ({ d, m: lista[(indice + d + lista.length * 3) % lista.length] }))

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-hidden bg-black text-white" role="dialog" aria-modal="true" aria-label="Modo manos">
      {/* Vídeo y lienzo 3D en el mismo contenedor espejado: el punto de MediaPipe sirve tal cual para los dos. */}
      <div className="pointer-events-none absolute inset-0" style={{ transform: 'scaleX(-1)' }}>
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0" style={{ backgroundColor: '#0b1514', mixBlendMode: 'color', opacity: 0.65 }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.7)_100%)]" />
        {(estado === 'activo' || estado === 'demo') && (
          <Canvas className="absolute inset-0" dpr={[1, 2]} camera={{ fov: 45, position: [0, 0, 5] }} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[3, 5, 2]} intensity={1.3} />
            <spotLight position={[-3, 4, -3]} intensity={40} angle={0.9} penumbra={1} color={ACENTO} />
            <Suspense fallback={null}>
              <Environment preset="city" />
            </Suspense>
            <ControlCamara senal={senal} />
            <AnclaMano capas={capas} senal={senal} />
          </Canvas>
        )}
      </div>

      {/* El esqueleto de las manos: fuera del espejo, ya volteado en el dibujo. */}
      <canvas ref={lienzo2d} className="pointer-events-none absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 md:p-7">
        <div className="pointer-events-auto flex items-start justify-between gap-4">
          <div key={actual.id} className="min-w-0 animate-[entra_0.45s_cubic-bezier(0.16,1,0.3,1)_both]">
            <p className="text-[12px] tabular-nums text-white/50">
              {String(indice + 1).padStart(2, '0')} / {String(lista.length).padStart(2, '0')}
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight md:text-2xl">{actual.nombre}</h2>
            <p className="text-sm text-white/60">{precio(actual.precio)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              title="Si las manos van cambiadas, púlsalo"
              className={boton}
              onClick={() => {
                const n = !invertido
                setInvertido(n)
                try {
                  localStorage.setItem('manos-invertido', n ? '1' : '0')
                } catch {
                  /* Modo privado: se pierde al recargar. */
                }
              }}
            >
              <ArrowLeftRight size={15} /> <span className="hidden sm:inline">Cambiar manos</span>
            </button>
            <button type="button" className={boton} onClick={() => onFicha(actual.id)}>
              Ver ficha
            </button>
            <button type="button" aria-label="Salir" className={boton} onClick={cerrar}>
              <X size={16} /> <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {estado === 'arrancando' && (
          <div className="flex flex-col items-center gap-3 self-center">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white/80" />
            <p className="text-sm text-white/70">Encendiendo la cámara y el rastreo de manos…</p>
          </div>
        )}
        {estado === 'error' && (
          <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-4 self-center rounded-2xl border border-white/10 bg-black/70 px-6 py-5 text-center backdrop-blur-md">
            <p className="text-sm leading-relaxed text-white/80">{fallo}</p>
            <button type="button" onClick={() => setEstado('demo')} className="rounded-full bg-white px-4 py-2 text-[13px] font-medium text-black transition hover:bg-white/85">
              Ver demostración sin cámara
            </button>
          </div>
        )}

        <div className="pointer-events-auto flex flex-col items-center gap-4">
          {(estado === 'activo' || estado === 'demo') && (
            <div className="flex flex-col items-center gap-2">
              <p className="flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3.5 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur-md">
                <span ref={gestoPunto} className="h-1.5 w-1.5 rounded-full bg-white/70 transition-colors" />
                <span ref={gestoTexto}>Levanta la mano derecha</span>
                <span className="text-white/35">·</span>
                <span className="tabular-nums text-white/60">
                  Zoom <span ref={zoomTexto}>100%</span>
                </span>
              </p>
              {/* Avance del deslizamiento: se llena hacia donde va la mano. */}
              <div className="relative h-[3px] w-40 overflow-hidden rounded-full bg-white/10">
                <div ref={barraDesliz} className="absolute inset-y-0 left-1/4 w-1/2 rounded-full opacity-0" style={{ background: ACENTO }} />
              </div>
            </div>
          )}

          <div className="flex w-full items-center justify-center gap-3">
            <button type="button" aria-label="Figura anterior" onClick={anterior} className={`${boton} h-11 w-11 justify-center !px-0`}>
              <ChevronLeft size={20} />
            </button>
            {/* La tira de vecinas: dónde estás en el catálogo. */}
            <div className="flex items-center gap-2">
              {vecinos.map(({ d, m }) => {
                const portada = rutaPortada(m)
                return (
                  <button
                    key={`${d}-${m.id}`}
                    type="button"
                    aria-label={m.nombre}
                    onClick={() => d && mover(d, d > 0 ? -1 : 1)}
                    className={`overflow-hidden rounded-xl border bg-white transition-all duration-300 ${
                      d === 0 ? 'h-16 w-16 border-white shadow-[0_0_0_3px_rgba(94,234,212,0.35)]' : 'h-11 w-11 border-white/20 opacity-55 hover:opacity-100'
                    } ${Math.abs(d) === 2 ? 'hidden sm:block' : ''}`}
                  >
                    {portada && <img src={portada} alt="" className="h-full w-full object-contain p-1" />}
                  </button>
                )
              })}
            </div>
            <button type="button" aria-label="Figura siguiente" onClick={siguiente} className={`${boton} h-11 w-11 justify-center !px-0`}>
              <ChevronRight size={20} />
            </button>
          </div>

          <ul className="hidden max-w-3xl flex-wrap justify-center gap-x-5 gap-y-1 text-center text-[12px] text-white/50 md:flex">
            <li><b className="font-medium text-white/85">Mano derecha</b> · la figura te sigue</li>
            <li><b className="font-medium text-white/85">Abierta + deslizar</b> · cambia de figura</li>
            <li><b className="font-medium text-white/85">Pinza (👌)</b> · agárrala y arrastra para girar</li>
            <li><b className="font-medium text-white/85">Puño</b> · muévela sin cambiar</li>
            <li><b className="font-medium text-white/85">Pinza izquierda</b> · zoom</li>
          </ul>
          <p className="text-[11px] text-white/30">El vídeo se procesa en tu equipo y no se envía a ningún sitio.</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
