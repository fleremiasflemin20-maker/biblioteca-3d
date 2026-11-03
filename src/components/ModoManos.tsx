import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as EventoPuntero } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, useGLTF } from '@react-three/drei'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import * as THREE from 'three'
import { ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react'
import {
  Agarre,
  CONEXIONES,
  Deslizamiento,
  FiltroEuro,
  PistasManos,
  centroPalma,
  cierre,
  cuaternionPalma,
  ejesPalma,
  escalaAparente,
  recorta,
  RUTA_MODELO_MANO,
  RUTA_WASM,
  type Punto,
} from '../lib/manos'
import { Estela, colocarEnReposo, extension, nuevoCuerpo, paso, type Cuerpo, type Limites } from '../lib/fisica'
import { DRACO, precio, rutaModelo, rutaPortada, type Modelo3D } from '../lib/catalogo'
import { Pieza } from './Pieza'

/* ── Ajustes ─────────────────────────────────────────────────────────── */

const ACENTO = '#5EEAD4'
const TAMANO_OBJETIVO = 1.3
const ASPECTO_CAMARA = 640 / 480
const CAMARA_Z = 5
const FOV = 45
/** Qué fracción de la altura de pantalla, desde abajo, queda bajo el suelo si aún no se midieron los controles. */
const FRACCION_SUELO = 0.3
const FONDO = -3
const FRENTE = 1.8
/** Margen alrededor de la pieza dentro del cual una mano que se cierra la coge (mundo). */
const ALCANCE_EXTRA = 0.4
/** Con la pieza en la mano: cuánto la sigue (1/s). Alto = pegada a la mano; el filtro ya quitó el temblor. */
const LAMBDA_SUJETA = 28
const LAMBDA_GIRO = 22
/** Cuánto se acerca o aleja la pieza al acercar o alejar la mano de la cámara (mundo por cada e-veces de tamaño). */
const PROFUNDIDAD = 3.2
/** Hasta cuánto se adelanta la posición de la mano entre dos detecciones (s): oculta la latencia de la cámara. */
const EXTRAPOLA = 0.045
/** Segundos que se espera a una mano perdida antes de dar la pieza por soltada. */
const GRACIA = 0.28
/** Tras soltar, este rato no se puede deslizar para cambiar de figura: el lanzamiento no cuenta como deslizar. */
const BLOQUEO_DESLIZ = 0.9
const DURACION_ENTRA = 0.32
const DURACION_SALE = 0.28

type Estado = 'arrancando' | 'activo' | 'error' | 'demo'

/**
 * Una mano (o el puntero) tal como la ve la escena. La escribe el bucle de
 * detección ~30–60 veces por segundo y la lee el de render a 60–120: objeto
 * mutable y no estado de React, para que nada de eso repinte el árbol.
 */
type ManoViva = {
  visible: boolean
  /** El ratón o el dedo en la pantalla: sin giro ni profundidad. */
  puntero: boolean
  /** Momento de la última detección (s, `performance.now`). */
  t: number
  /** Centro de la palma ya espejado, en coordenadas del vídeo (0..1). Para el puntero, de la pantalla. */
  x: number
  y: number
  vx: number
  vy: number
  /** Tamaño aparente de la palma: crece al acercarla a la cámara. */
  escala: number
  /** Orientación de la palma en la escena. */
  q: THREE.Quaternion
  cerrada: boolean
  cierre: number
}

const nuevaMano = (puntero = false): ManoViva => ({
  visible: false,
  puntero,
  t: 0,
  x: 0.5,
  y: 0.5,
  vx: 0,
  vy: 0,
  escala: 1,
  q: new THREE.Quaternion(),
  cerrada: false,
  cierre: 0,
})

/** Lo que la escena cuenta al resto: quién sujeta la pieza y qué manos la tienen al alcance. */
type Interaccion = {
  /** Índice de la mano que sujeta la pieza (0 y 1 manos, 2 puntero), o -1. */
  sujeta: number
  cerca: boolean[]
  previa: boolean[]
  ultimaSuelta: number
  ultimoGolpe: number
  reiniciar: boolean
  giroRueda: number
}

const nuevaInteraccion = (): Interaccion => ({
  sujeta: -1,
  cerca: [false, false, false],
  previa: [false, false, false],
  ultimaSuelta: -10,
  ultimoGolpe: 0,
  reiniciar: true,
  giroRueda: 0,
})

/** El vídeo se muestra con `object-cover`: lo que se ve es un recorte del fotograma. */
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

const sonidoCambio = (ctx: AudioContext) => {
  tono(ctx, 'sine', 620, 1180, 0, 1, 0.22)
  tono(ctx, 'triangle', 1860, 2400, 0.03, 0.5, 0.18)
}
/** Un clic al agarrar y otro más grave al soltar: la confirmación que la mano no siente. */
const sonidoAgarre = (ctx: AudioContext, agarra: boolean) =>
  agarra ? tono(ctx, 'sine', 900, 1300, 0, 0.6, 0.07, 0.1) : tono(ctx, 'sine', 700, 480, 0, 0.5, 0.08, 0.08)
/** El "toc" de la pieza contra el suelo o una pared, más fuerte cuanto más fuerte el golpe. */
const sonidoGolpe = (ctx: AudioContext, fuerza: number) => {
  const f = recorta(fuerza / 9, 0.08, 1)
  tono(ctx, 'triangle', 240 + f * 120, 90, 0, 1, 0.09 + f * 0.06, 0.06 + f * 0.14)
}

function precargar(m: Modelo3D | undefined) {
  if (m && !m.personalizable) useGLTF.preload(rutaModelo(m), DRACO)
}

/* ── Escena 3D ───────────────────────────────────────────────────────── */

/**
 * Centra la pieza en su origen y la lleva a un tamaño común (hay piezas de
 * 2 cm y escaneos de 2 m). Avisa con los semiejes de su caja ya escalada:
 * la física los necesita para apoyarla en el suelo y hacerla chocar.
 */
function ModeloEscalado({ modelo, onListo }: { modelo: Modelo3D; onListo: (semi: THREE.Vector3) => void }) {
  const grupo = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    const g = grupo.current
    if (!g) return
    g.scale.setScalar(1)
    g.position.set(0, 0, 0)
    // Se mide suelta, sin padres: `Box3.setFromObject` trabaja en coordenadas
    // de mundo y la capa que la contiene puede estar girada o a escala 0.
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
    onListo(tam.multiplyScalar(k / 2))
  }, [modelo, onListo])
  return (
    <group ref={grupo}>
      <Pieza modelo={modelo} />
    </group>
  )
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/** Una figura en pantalla. La que sale se queda donde estaba y se encoge; la que entra aparece ya quieta. */
type Capa = { modelo: Modelo3D; clave: number; tipo: 'entra' | 'sale'; p?: THREE.Vector3; q?: THREE.Quaternion }

function CapaFigura({ capa, onListo }: { capa: Capa; onListo?: (semi: THREE.Vector3) => void }) {
  const g = useRef<THREE.Group>(null)
  const inicio = useRef<number | null>(capa.tipo === 'sale' ? -1 : null)
  const listo = useCallback(
    (semi: THREE.Vector3) => {
      if (inicio.current === null) inicio.current = -1
      onListo?.(semi)
    },
    [onListo],
  )

  useLayoutEffect(() => {
    if (capa.tipo === 'sale' && g.current && capa.p && capa.q) {
      g.current.position.copy(capa.p)
      g.current.quaternion.copy(capa.q)
    }
  }, [capa])

  useFrame(({ clock }) => {
    const grupo = g.current
    if (!grupo) return
    if (inicio.current === null) {
      grupo.scale.setScalar(0)
      return
    }
    if (inicio.current === -1) inicio.current = clock.elapsedTime
    const t = clock.elapsedTime - inicio.current
    // Sin giros ni desplazamientos: la pieza aparece en su sitio y se queda quieta.
    if (capa.tipo === 'entra') grupo.scale.setScalar(0.82 + 0.18 * easeOutCubic(Math.min(1, t / DURACION_ENTRA)))
    else grupo.scale.setScalar(Math.max(0, 1 - easeOutCubic(Math.min(1, t / DURACION_SALE))))
  })

  return (
    <group ref={g}>
      <Suspense fallback={null}>
        <ModeloEscalado modelo={capa.modelo} onListo={listo} />
      </Suspense>
    </group>
  )
}

/** Sombra difusa bajo la pieza: dice dónde está el suelo y a qué altura va la pieza. */
function texturaSombra() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(0,0,0,0.85)')
  g.addColorStop(0.5, 'rgba(0,0,0,0.35)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

type Sujecion = {
  z0: number
  z: number
  escala0: number
  qMano0: THREE.Quaternion
  qObj0: THREE.Quaternion
  desfase: THREE.Vector3
}

/**
 * La pieza y todo lo que le pasa: la coge la mano que se cierra a su lado, la
 * sigue con la posición, la profundidad y el giro de la muñeca, y al soltarla
 * hereda la velocidad de la mano y entra la física. Nadie la toca: quieta.
 */
function Escena({
  capas,
  manos,
  inter,
  cuerpo,
  audio,
  estadoTexto,
  modoDemo,
  fraccionSuelo,
}: {
  capas: Capa[]
  manos: MutableRefObject<ManoViva[]>
  inter: MutableRefObject<Interaccion>
  cuerpo: Cuerpo
  audio: MutableRefObject<AudioContext | null>
  estadoTexto: MutableRefObject<HTMLSpanElement | null>
  modoDemo: boolean
  /** Hasta dónde llegan los controles de abajo, como fracción de la altura: la pieza se apoya justo encima. */
  fraccionSuelo: MutableRefObject<number>
}) {
  const grupo = useRef<THREE.Group>(null)
  const anillo = useRef<THREE.Mesh>(null)
  const sombra = useRef<THREE.Mesh>(null)
  const limites = useRef<Limites>({ suelo: -1.2, techo: 2, ancho: 3, fondo: FONDO, frente: FRENTE, camaraZ: CAMARA_Z })
  const suj = useRef<Sujecion>({ z0: 0, z: 0, escala0: 1, qMano0: new THREE.Quaternion(), qObj0: new THREE.Quaternion(), desfase: new THREE.Vector3() })
  const estela = useRef(new Estela())
  const brillo = useRef(0)
  const textoPrevio = useRef('')
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), e: new THREE.Vector3(), q: new THREE.Quaternion(), r: new THREE.Quaternion() }), [])
  const mapaSombra = useMemo(() => texturaSombra(), [])

  const alListo = useCallback(
    (semi: THREE.Vector3) => {
      cuerpo.semi.copy(semi)
      if (inter.current.sujeta < 0) inter.current.reiniciar = true
    },
    [cuerpo, inter],
  )

  useFrame((state, dtBruto) => {
    const g = grupo.current
    if (!g) return
    const dt = Math.min(dtBruto, 1 / 20)
    const ahora = performance.now() / 1000
    const aspecto = state.size.width / state.size.height
    const tanMedio = Math.tan((FOV * Math.PI) / 360)
    const alto0 = 2 * tanMedio * CAMARA_Z
    const lim = limites.current
    lim.techo = alto0 / 2 - 0.04
    lim.ancho = (alto0 / 2) * aspecto - 0.04
    lim.suelo = -alto0 / 2 + alto0 * fraccionSuelo.current
    const it = inter.current
    const c = cuerpo
    const s = suj.current

    if (it.reiniciar) {
      it.reiniciar = false
      it.sujeta = -1
      colocarEnReposo(c, lim)
    }

    /** Dónde está una mano en el mundo, sobre el plano de profundidad `z`. */
    const aMundo = (m: ManoViva, z: number, out: THREE.Vector3) => {
      let sx = m.x
      let sy = m.y
      if (!m.puntero) {
        const e = Math.min(EXTRAPOLA, Math.max(0, ahora - m.t))
        ;({ x: sx, y: sy } = corregirRecorte(sx + m.vx * e, sy + m.vy * e, aspecto))
      }
      const h = 2 * tanMedio * (CAMARA_Z - z)
      return out.set((sx - 0.5) * h * aspecto, -(sy - 0.5) * h, z)
    }

    const soltar = (lanzar: boolean) => {
      it.sujeta = -1
      it.ultimaSuelta = ahora
      if (lanzar) estela.current.lanzamiento(c.v, c.w)
      else {
        c.v.set(0, 0, 0)
        c.w.set(0, 0, 0)
      }
      c.dormido = false
      if (audio.current) sonidoAgarre(audio.current, false)
    }

    const ext = extension(c, tmp.e)
    const alcance = Math.max(ext.x, ext.y) + ALCANCE_EXTRA
    let hayMano = false
    let hayCerca = false
    for (let h = 0; h < 3; h++) {
      const m = manos.current[h]
      if (!m.visible) {
        if (it.sujeta === h) soltar(false)
        it.cerca[h] = false
        it.previa[h] = false
        continue
      }
      if (!m.puntero) hayMano = true
      const z = it.sujeta === h ? s.z : c.p.z
      const pm = aMundo(m, z, tmp.v)
      const d = Math.hypot(pm.x - c.p.x, pm.y - c.p.y)
      const alAlcance = d < alcance
      it.cerca[h] = it.sujeta === h || alAlcance
      if (alAlcance && !m.puntero) hayCerca = true
      // Coger: la mano se cierra junto a la pieza. Vale también quitársela a la otra mano.
      if (m.cerrada && !it.previa[h] && alAlcance && it.sujeta !== h) {
        it.sujeta = h
        s.z0 = s.z = c.p.z
        s.escala0 = m.escala
        s.qMano0.copy(m.q)
        s.qObj0.copy(c.q)
        s.desfase.set(c.p.x - pm.x, c.p.y - pm.y, 0)
        c.dormido = false
        c.v.set(0, 0, 0)
        c.w.set(0, 0, 0)
        estela.current.vaciar()
        if (audio.current) sonidoAgarre(audio.current, true)
      } else if (it.sujeta === h && !m.cerrada) soltar(true)
      it.previa[h] = m.cerrada
    }

    // La rueda del ratón gira la pieza sobre sí misma.
    if (it.giroRueda) {
      if (it.sujeta >= 0) s.qObj0.premultiply(tmp.r.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.giroRueda))
      else {
        c.w.y += it.giroRueda * 12
        c.dormido = false
      }
      it.giroRueda = 0
    }

    if (it.sujeta >= 0) {
      // En la mano: posición, profundidad y giro de la muñeca, 1:1.
      const m = manos.current[it.sujeta]
      const prof = m.puntero ? 0 : PROFUNDIDAD * Math.log(Math.max(0.25, m.escala / Math.max(1e-6, s.escala0)))
      s.z = recorta(s.z0 + prof, FONDO + 0.9, FRENTE - 0.9)
      const objetivo = aMundo(m, s.z, tmp.v)
      // El punto por donde se cogió se va acercando a la palma: la pieza se asienta en la mano.
      s.desfase.multiplyScalar(Math.exp(-3 * dt))
      objetivo.add(s.desfase)
      c.p.lerp(objetivo, 1 - Math.exp(-LAMBDA_SUJETA * dt))
      tmp.q.copy(s.qMano0).invert().premultiply(m.q).multiply(s.qObj0)
      c.q.slerp(tmp.q, 1 - Math.exp(-LAMBDA_GIRO * dt))
      // No atraviesa la mesa: se puede arrastrar por encima.
      const e2 = extension(c, tmp.e)
      if (c.p.y < lim.suelo + e2.y) c.p.y = lim.suelo + e2.y
      estela.current.anotar(ahora, c.p, c.q)
    } else {
      // Suelta: física en pasos de 1/120 s para que un lanzamiento fuerte no atraviese el suelo.
      const n = Math.max(1, Math.ceil(dt * 120))
      let golpe = 0
      for (let i = 0; i < n; i++) golpe = Math.max(golpe, paso(c, lim, dt / n))
      if (golpe > 1.3 && audio.current && ahora - it.ultimoGolpe > 0.07) {
        it.ultimoGolpe = ahora
        sonidoGolpe(audio.current, golpe)
      }
    }

    g.position.copy(c.p)
    g.quaternion.copy(c.q)

    // Anillo: tenue con una mano en pantalla, claro al alcance, lleno al agarrar.
    const e3 = extension(c, tmp.e)
    const agarrada = it.sujeta >= 0
    const objetivoBrillo = agarrada ? 1 : hayCerca || it.cerca[2] ? 0.55 : hayMano ? 0.14 : 0
    brillo.current = THREE.MathUtils.damp(brillo.current, objetivoBrillo, 12, dt)
    const a = anillo.current
    if (a) {
      a.position.set(c.p.x, c.p.y, c.p.z)
      const r = Math.max(e3.x, e3.y) * 1.15 * (agarrada ? 0.94 : 1)
      a.scale.setScalar(THREE.MathUtils.damp(a.scale.x || r, r, 14, dt))
      ;(a.material as THREE.MeshBasicMaterial).opacity = brillo.current * 0.75
      a.visible = brillo.current > 0.01
    }
    const so = sombra.current
    if (so) {
      const altura = c.p.y - e3.y - lim.suelo
      so.position.set(c.p.x, lim.suelo + 0.002, c.p.z)
      const k = 1 + Math.max(0, altura) * 0.35
      so.scale.set(e3.x * 2.6 * k, e3.z * 2.6 * k, 1)
      ;(so.material as THREE.MeshBasicMaterial).opacity = 0.55 * recorta(1 - altura / 2.6, 0, 1)
    }

    // Lo que dice la píldora de estado, solo cuando cambia.
    const texto = agarrada
      ? manos.current[it.sujeta].puntero
        ? 'La tienes · suéltala en movimiento para lanzarla'
        : 'La tienes · gira la muñeca, acércala o lánzala'
      : hayCerca
        ? 'Cierra la mano para agarrarla'
        : hayMano
          ? 'Acerca la mano a la pieza'
          : modoDemo
            ? 'Arrástrala con el ratón o el dedo y suéltala en movimiento'
            : 'Levanta una mano frente a la cámara'
    if (texto !== textoPrevio.current && estadoTexto.current) {
      textoPrevio.current = texto
      estadoTexto.current.textContent = texto
    }
  })

  return (
    <>
      <group ref={grupo}>
        {capas
          .filter((c) => c.tipo === 'entra')
          .map((c) => (
            <CapaFigura key={c.clave} capa={c} onListo={alListo} />
          ))}
      </group>
      {capas
        .filter((c) => c.tipo === 'sale')
        .map((c) => (
          <CapaFigura key={c.clave} capa={c} />
        ))}
      <mesh ref={anillo} renderOrder={10} visible={false}>
        <ringGeometry args={[0.965, 1, 96]} />
        <meshBasicMaterial color={ACENTO} transparent depthTest={false} depthWrite={false} />
      </mesh>
      <mesh ref={sombra} rotation-x={-Math.PI / 2} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={mapaSombra} transparent depthWrite={false} opacity={0.5} />
      </mesh>
    </>
  )
}

/* ── El modo manos ───────────────────────────────────────────────────── */

/** Lo que el bucle de detección guarda de cada pista de mano entre fotogramas. */
type Pista = {
  fx: FiltroEuro
  fy: FiltroEuro
  fEscala: FiltroEuro
  fEjes: FiltroEuro[]
  agarre: Agarre
  desliz: Deslizamiento
  esqueleto: [FiltroEuro, FiltroEuro][]
  vista: number
}

const nuevaPista = (): Pista => ({
  // Corte bajo y beta alta: quieta como una piedra en reposo y pegada a la mano en movimiento.
  fx: new FiltroEuro(1.4, 1.2),
  fy: new FiltroEuro(1.4, 1.2),
  fEscala: new FiltroEuro(0.9, 0.4),
  fEjes: Array.from({ length: 6 }, () => new FiltroEuro(1.6, 0.6)),
  agarre: new Agarre(),
  desliz: new Deslizamiento(),
  esqueleto: Array.from({ length: 21 }, () => [new FiltroEuro(1.5, 0.6), new FiltroEuro(1.5, 0.6)] as [FiltroEuro, FiltroEuro]),
  vista: -Infinity,
})

function reiniciarPista(p: Pista) {
  p.fx.reiniciar()
  p.fy.reiniciar()
  p.fEscala.reiniciar()
  p.fEjes.forEach((f) => f.reiniciar())
  p.agarre.reiniciar()
  p.desliz.reiniciar()
  p.esqueleto.forEach(([a, b]) => {
    a.reiniciar()
    b.reiniciar()
  })
}

/**
 * Modo manos: la pieza del catálogo delante de ti, quieta, esperando a que la
 * cojas con la cámara del equipo.
 *
 * - Acerca cualquier mano y ciérrala (o haz pinza): la agarras. Moverla la
 *   lleva, girar la muñeca la gira y acercarla a la cámara la acerca.
 * - Ábrela: la sueltas. Si la mano iba en movimiento, la lanzas: vuela,
 *   rebota contra el suelo y los bordes, rueda y se queda de pie.
 * - Mano abierta deslizada rápido, sin la pieza: cambia de figura.
 * - Sin cámara, lo mismo con el ratón o el dedo.
 *
 * Bajo el capó: MediaPipe Hands con landmarks 3D, filtro One Euro en cada
 * señal, agarre con histéresis, pistas de mano estables y una física ligera
 * de sólido rígido. Ver `lib/manos.ts` y `lib/fisica.ts`.
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
  const [capas, setCapas] = useState<Capa[]>(() => [{ modelo: lista[indiceInicial], clave: 0, tipo: 'entra' }])
  const actual = lista[indice]

  const video = useRef<HTMLVideoElement>(null)
  const lienzo2d = useRef<HTMLCanvasElement>(null)
  const capaPuntero = useRef<HTMLDivElement>(null)
  const flujo = useRef<MediaStream | null>(null)
  const detector = useRef<HandLandmarker | null>(null)
  const audioCtx = useRef<AudioContext | null>(null)
  const manos = useRef<ManoViva[]>([nuevaMano(), nuevaMano(), nuevaMano(true)])
  const inter = useRef<Interaccion>(nuevaInteraccion())
  const [cuerpo] = useState<Cuerpo>(nuevoCuerpo)
  const estadoTexto = useRef<HTMLSpanElement>(null)
  const barraDesliz = useRef<HTMLDivElement>(null)
  const panelInferior = useRef<HTMLDivElement>(null)
  const fraccionSuelo = useRef(FRACCION_SUELO)
  const claveCapa = useRef(1)
  const indiceRef = useRef(indiceInicial)
  /** El análisis de un fotograma: lo usan la cámara y, en desarrollo, las pruebas con manos simuladas. */
  const procesar = useRef<(imagenes: Punto[][], mundos: Punto[][]) => void>(() => {})

  /** Cambia de figura. La que había se encoge donde esté; la nueva aparece quieta en el centro. */
  const mover = useCallback(
    (pasoIndice: number) => {
      const n = (indiceRef.current + pasoIndice + lista.length) % lista.length
      indiceRef.current = n
      const clave = claveCapa.current++
      setIndice(n)
      const p = cuerpo.p.clone()
      const q = cuerpo.q.clone()
      setCapas((cs) => [
        ...cs.filter((c) => c.tipo === 'entra').map((c) => ({ ...c, tipo: 'sale' as const, p, q })),
        { modelo: lista[n], clave, tipo: 'entra' },
      ])
      inter.current.reiniciar = true
      window.setTimeout(() => setCapas((cs) => cs.filter((c) => c.tipo === 'entra' || c.clave >= clave)), DURACION_SALE * 1000 + 80)
      if (audioCtx.current) sonidoCambio(audioCtx.current)
    },
    [lista, cuerpo],
  )
  const siguiente = useCallback(() => mover(1), [mover])
  const anterior = useCallback(() => mover(-1), [mover])
  const moverRef = useRef(mover)
  useEffect(() => {
    moverRef.current = mover
  }, [mover])
  const recolocar = useCallback(() => {
    inter.current.reiniciar = true
  }, [])

  useEffect(() => {
    precargar(lista[(indice + 1) % lista.length])
    precargar(lista[(indice - 1 + lista.length) % lista.length])
  }, [indice, lista])

  /* El análisis de cada fotograma: manos → pistas → filtros → `ManoViva`. */
  useEffect(() => {
    const pistas = new PistasManos()
    const datos = [nuevaPista(), nuevaPista()]
    const reloj0 = performance.now()

    const dibujarEsqueleto = (porPista: (Punto[] | undefined)[], t: number) => {
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
      porPista.forEach((p, h) => {
        if (!p) return
        const pts = p.map((q, i) => {
          const { x, y } = corregirRecorte(datos[h].esqueleto[i][0].filtrar(1 - q.x, t), datos[h].esqueleto[i][1].filtrar(q.y, t), aspecto)
          return [x * ancho, y * alto] as const
        })
        const it = inter.current
        const sujeta = it.sujeta === h
        const cerca = it.cerca[h]
        ctx.lineWidth = sujeta ? 2 : 1.25
        ctx.strokeStyle = sujeta ? 'rgba(94,234,212,0.85)' : cerca ? 'rgba(94,234,212,0.5)' : 'rgba(255,255,255,0.28)'
        ctx.beginPath()
        for (const [a, b] of CONEXIONES) {
          ctx.moveTo(pts[a][0], pts[a][1])
          ctx.lineTo(pts[b][0], pts[b][1])
        }
        ctx.stroke()
        ctx.fillStyle = sujeta || cerca ? ACENTO : '#ffffff'
        for (const i of [4, 8, 12, 16, 20]) {
          ctx.beginPath()
          ctx.arc(pts[i][0], pts[i][1], sujeta ? 3.2 : 2.6, 0, Math.PI * 2)
          ctx.fill()
        }
      })
    }

    procesar.current = (imagenes, mundos) => {
      const ahora = performance.now() / 1000
      const t = (performance.now() - reloj0) / 1000
      const asignadas = pistas.asignar(imagenes.map(centroPalma), t)
      const it = inter.current
      let progreso = 0
      const porPista: (Punto[] | undefined)[] = [undefined, undefined]

      for (let k = 0; k < 2; k++) {
        const m = manos.current[k]
        const d = datos[k]
        const i = asignadas[k]
        if (i === -1) {
          // Unos fotogramas sin detección no sueltan la pieza: se espera la gracia.
          if (m.visible && t - d.vista > GRACIA) {
            m.visible = false
            m.cerrada = false
            reiniciarPista(d)
          }
          continue
        }
        const img = imagenes[i]
        const mundo = mundos[i] ?? img
        porPista[k] = img
        d.vista = t
        const c = centroPalma(img)
        // En pantalla la imagen va espejada: x de pantalla = 1 - x del sensor.
        m.x = d.fx.filtrar(1 - c.x, t)
        m.y = d.fy.filtrar(c.y, t)
        m.vx = d.fx.velocidad
        m.vy = d.fy.velocidad
        m.escala = d.fEscala.filtrar(escalaAparente(img, mundo), t)
        const { arriba, lado } = ejesPalma(mundo)
        const f = d.fEjes
        const [qx, qy, qz, qw] = cuaternionPalma(
          [f[0].filtrar(arriba[0], t), f[1].filtrar(arriba[1], t), f[2].filtrar(arriba[2], t)],
          [f[3].filtrar(lado[0], t), f[4].filtrar(lado[1], t), f[5].filtrar(lado[2], t)],
        )
        m.q.set(qx, qy, qz, qw)
        m.cerrada = d.agarre.actualizar(mundo)
        m.cierre = cierre(mundo)
        m.t = ahora
        m.visible = true

        // Deslizar con la mano abierta y sin la pieza cambia de figura. Justo
        // después de soltar no: el lanzamiento no es un deslizamiento.
        const puede = !m.cerrada && m.cierre < 0.3 && it.sujeta === -1 && ahora - it.ultimaSuelta > BLOQUEO_DESLIZ && !it.cerca[k]
        if (puede) {
          const dir = d.desliz.leer(t, m.x, m.vx)
          // Como en un móvil: la mano hacia la izquierda trae la siguiente.
          if (dir) moverRef.current(-dir)
          const pr = d.desliz.progreso()
          if (Math.abs(pr) > Math.abs(progreso)) progreso = pr
        } else d.desliz.reiniciar()
      }

      if (barraDesliz.current) {
        barraDesliz.current.style.transform = `translateX(${progreso * 50}%) scaleX(${0.15 + Math.abs(progreso) * 0.35})`
        barraDesliz.current.style.opacity = String(Math.min(1, Math.abs(progreso) * 1.6))
      }
      dibujarEsqueleto(porPista, t)
    }

    if (import.meta.env.DEV) {
      // Para probar sin cámara: `__manosPrueba([[...21 puntos]], [[...21 puntos de mundo]])`.
      ;(window as unknown as { __manosPrueba?: typeof procesar.current }).__manosPrueba = (a, b) => procesar.current(a, b)
      ;(window as unknown as { __cuerpoManos?: Cuerpo }).__cuerpoManos = cuerpo
    }
  }, [cuerpo])

  /* La cámara y MediaPipe. */
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
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
    }

    async function arrancar() {
      try {
        try {
          audioCtx.current = new AudioContext()
        } catch {
          /* Sin audio: el resto sigue igual. */
        }
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

        // GPU primero; si el equipo no la ofrece a WebGL, CPU. Más lento, pero funciona.
        try {
          detector.current = await crearDetector('GPU')
        } catch {
          detector.current = await crearDetector('CPU')
        }
        if (cancelado) return
        setEstado('activo')

        let ultimaMarca = 0
        const analizar = (ahoraMs: number) => {
          const det = detector.current
          const v2 = video.current
          if (!det || !v2 || v2.readyState < 2 || document.hidden) return
          // MediaPipe exige marcas de tiempo estrictamente crecientes.
          const marca = Math.max(ahoraMs, ultimaMarca + 1)
          ultimaMarca = marca
          const r = det.detectForVideo(v2, marca)
          procesar.current(r.landmarks as Punto[][], (r.worldLandmarks ?? []) as Punto[][])
        }

        // Un análisis por cada fotograma real de la cámara: ni uno repetido ni
        // uno perdido. Donde no exista `requestVideoFrameCallback`, a ritmo de pantalla.
        const vfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (ahora: number) => void) => number }).requestVideoFrameCallback?.bind(v)
        if (vfc) {
          const cb = (ahora: number) => {
            if (cancelado) return
            analizar(ahora)
            vfcId = vfc(cb)
          }
          vfcId = vfc(cb)
        } else {
          const cb = (ahora: number) => {
            if (cancelado) return
            analizar(ahora)
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

  /* El ratón o el dedo: una mano más, sin giro ni profundidad. */
  const puntero = useCallback((e: EventoPuntero<HTMLDivElement>, tipo: 'baja' | 'mueve' | 'sube' | 'sale') => {
    const caja = capaPuntero.current?.getBoundingClientRect()
    const m = manos.current[2]
    if (!caja) return
    if (tipo === 'sale') {
      if (!m.cerrada) m.visible = false
      return
    }
    m.x = (e.clientX - caja.left) / caja.width
    m.y = (e.clientY - caja.top) / caja.height
    m.t = performance.now() / 1000
    m.visible = true
    if (tipo === 'baja') {
      m.cerrada = true
      capaPuntero.current?.setPointerCapture(e.pointerId)
      audioCtx.current?.resume().catch(() => {})
    } else if (tipo === 'sube') {
      m.cerrada = false
      if (e.pointerType !== 'mouse') m.visible = false
    }
  }, [])

  useEffect(() => {
    const el = capaPuntero.current
    if (!el) return
    const rueda = (e: WheelEvent) => {
      e.preventDefault()
      inter.current.giroRueda += recorta(e.deltaY, -120, 120) * 0.004
    }
    el.addEventListener('wheel', rueda, { passive: false })
    return () => el.removeEventListener('wheel', rueda)
  }, [])

  // El suelo de la escena queda justo encima de los controles de abajo, midan lo que midan.
  useEffect(() => {
    const el = panelInferior.current
    if (!el) return
    const medir = () => {
      const alto = window.innerHeight || 1
      fraccionSuelo.current = recorta((alto - el.getBoundingClientRect().top + 28) / alto, 0.12, 0.45)
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    window.addEventListener('resize', medir)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [])

  const cerrar = useCallback(() => onCerrar(actual.id), [onCerrar, actual.id])

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
      if (e.key === 'ArrowRight') siguiente()
      if (e.key === 'ArrowLeft') anterior()
      if (e.key === 'r' || e.key === 'R') recolocar()
    }
    window.addEventListener('keydown', teclas)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', teclas)
      document.documentElement.style.overflow = ''
    }
  }, [cerrar, siguiente, anterior, recolocar])

  const boton =
    'flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-[13px] font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-white hover:text-black'
  const vecinos = [-2, -1, 0, 1, 2].map((d) => ({ d, m: lista[(indice + d + lista.length * 3) % lista.length] }))
  const enEscena = estado === 'activo' || estado === 'demo'

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-hidden bg-black text-white" role="dialog" aria-modal="true" aria-label="Modo manos">
      {/* La cámara, espejada como un espejo de verdad. */}
      <div className="pointer-events-none absolute inset-0" style={{ transform: 'scaleX(-1)' }}>
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0" style={{ backgroundColor: '#0b1514', mixBlendMode: 'color', opacity: 0.65 }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.7)_100%)]" />
      </div>

      {/* La escena va sin espejar: la pieza se ve tal cual es, no su reflejo. Las manos ya llegan espejadas. */}
      {enEscena && (
        <div className="pointer-events-none absolute inset-0">
        <Canvas
          dpr={[1, 2]}
          camera={{ fov: FOV, position: [0, 0, CAMARA_Z] }}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 2]} intensity={1.3} />
          <spotLight position={[-3, 4, -3]} intensity={40} angle={0.9} penumbra={1} color={ACENTO} />
          <Suspense fallback={null}>
            <Environment preset="city" />
          </Suspense>
          <Escena capas={capas} manos={manos} inter={inter} cuerpo={cuerpo} audio={audioCtx} estadoTexto={estadoTexto} modoDemo={estado === 'demo'} fraccionSuelo={fraccionSuelo} />
        </Canvas>
        </div>
      )}

      {/* El esqueleto de las manos. */}
      <canvas ref={lienzo2d} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* Ratón y dedo: agarrar arrastrando, lanzar soltando en movimiento, rueda para girar. */}
      <div
        ref={capaPuntero}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => puntero(e, 'baja')}
        onPointerMove={(e) => puntero(e, 'mueve')}
        onPointerUp={(e) => puntero(e, 'sube')}
        onPointerCancel={(e) => puntero(e, 'sube')}
        onPointerLeave={(e) => puntero(e, 'sale')}
      />

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
            <button type="button" title="Devuelve la pieza al centro (tecla R)" className={boton} onClick={recolocar}>
              <RotateCcw size={15} /> <span className="hidden sm:inline">Recolocar</span>
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
              Usar el ratón o el dedo
            </button>
          </div>
        )}

        <div ref={panelInferior} className="flex flex-col items-center gap-4">
          {enEscena && (
            <div className="flex flex-col items-center gap-2">
              <p className="flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3.5 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACENTO }} />
                <span ref={estadoTexto}>Levanta una mano frente a la cámara</span>
              </p>
              {/* Avance del deslizamiento: se llena hacia donde va la mano. */}
              <div className="relative h-[3px] w-40 overflow-hidden rounded-full bg-white/10">
                <div ref={barraDesliz} className="absolute inset-y-0 left-1/4 w-1/2 rounded-full opacity-0" style={{ background: ACENTO }} />
              </div>
            </div>
          )}

          <div className="pointer-events-auto flex w-full items-center justify-center gap-3">
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
                    onClick={() => d && mover(d)}
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
            <li><b className="font-medium text-white/85">Cierra la mano junto a la pieza</b> · la agarras</li>
            <li><b className="font-medium text-white/85">Gira la muñeca</b> · gira contigo</li>
            <li><b className="font-medium text-white/85">Acércala a la cámara</b> · la ves de cerca</li>
            <li><b className="font-medium text-white/85">Ábrela en movimiento</b> · la lanzas y rebota</li>
            <li><b className="font-medium text-white/85">Mano abierta + deslizar</b> · cambia de figura</li>
          </ul>
          <p className="text-[11px] text-white/30">El vídeo se procesa en tu equipo y no se envía a ningún sitio.</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
