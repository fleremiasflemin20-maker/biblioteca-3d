import { useEffect, useState } from 'react'
import { CATALOGO, CATEGORIAS } from './catalogo'

/**
 * Lo que hace que la biblioteca se juegue como una consola: efectos de
 * sonido, vibración del mando, la colección de figuras vistas y los logros.
 *
 * Todo se guarda en `localStorage` del visitante: no hay cuentas ni servidor
 * (GitHub Pages es estático). Si el navegador no deja guardar, vale para la
 * visita y ya.
 */

const leer = <T,>(llave: string, defecto: T): T => {
  try {
    const v = localStorage.getItem(llave)
    return v ? (JSON.parse(v) as T) : defecto
  } catch {
    return defecto
  }
}
const guardar = (llave: string, v: unknown) => {
  try {
    localStorage.setItem(llave, JSON.stringify(v))
  } catch {
    /* modo privado */
  }
}

/* ── Sonido (WebAudio, sin archivos) ──────────────────────────────────── */

let sonidoActivo = leer('sonido', false)
let audio: AudioContext | null = null

export const haySonido = () => sonidoActivo
export function ponerSonido(si: boolean) {
  sonidoActivo = si
  guardar('sonido', si)
  avisar()
}

type Nota = { f: number; t: number; d: number; tipo?: OscillatorType; v?: number }

function tocar(notas: Nota[], forzar = false) {
  if (!sonidoActivo && !forzar) return
  try {
    audio ??= new AudioContext()
    const ahora = audio.currentTime
    for (const n of notas) {
      const o = audio.createOscillator()
      const g = audio.createGain()
      o.type = n.tipo ?? 'triangle'
      o.frequency.value = n.f
      g.gain.setValueAtTime(n.v ?? 0.06, ahora + n.t)
      g.gain.exponentialRampToValueAtTime(0.0001, ahora + n.t + n.d)
      o.connect(g).connect(audio.destination)
      o.start(ahora + n.t)
      o.stop(ahora + n.t + n.d + 0.02)
    }
  } catch {
    /* sin audio: no pasa nada */
  }
}

/** Los efectos de la interfaz, como los de un menú de consola. */
export const sfx = {
  mover: () => tocar([{ f: 660, t: 0, d: 0.07 }]),
  confirmar: () => tocar([{ f: 880, t: 0, d: 0.08 }, { f: 1320, t: 0.06, d: 0.16 }]),
  seccion: () => tocar([{ f: 520, t: 0, d: 0.06, tipo: 'square', v: 0.035 }, { f: 780, t: 0.05, d: 0.08, tipo: 'square', v: 0.035 }]),
  ruleta: () => tocar([{ f: 990, t: 0, d: 0.04, tipo: 'square', v: 0.03 }]),
  obturador: () => tocar([{ f: 2400, t: 0, d: 0.03, tipo: 'square', v: 0.05 }, { f: 1200, t: 0.04, d: 0.08, tipo: 'sawtooth', v: 0.03 }]),
  logro: () =>
    tocar([
      { f: 784, t: 0, d: 0.12 },
      { f: 988, t: 0.1, d: 0.12 },
      { f: 1175, t: 0.2, d: 0.12 },
      { f: 1568, t: 0.3, d: 0.4, v: 0.07 },
    ]),
  /** El acorde de arranque: suena siempre, porque lo dispara la propia pulsación de START. */
  inicio: () =>
    tocar(
      [
        { f: 392, t: 0, d: 0.5, tipo: 'sine', v: 0.08 },
        { f: 523, t: 0.08, d: 0.5, tipo: 'sine', v: 0.07 },
        { f: 659, t: 0.16, d: 0.6, tipo: 'sine', v: 0.06 },
        { f: 1047, t: 0.3, d: 0.9, tipo: 'triangle', v: 0.05 },
      ],
      true,
    ),
}

/* ── Mando ────────────────────────────────────────────────────────────── */

type ConVibracion = Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } }

/** Un golpe de vibración en el primer mando conectado (si el navegador sabe). */
export function vibrar(fuerte = false) {
  try {
    const p = [...navigator.getGamepads()].find(Boolean) as ConVibracion | undefined
    p?.vibrationActuator?.playEffect?.('dual-rumble', { duration: fuerte ? 140 : 45, strongMagnitude: fuerte ? 0.7 : 0.15, weakMagnitude: fuerte ? 0.5 : 0.35 })
  } catch {
    /* sin vibración */
  }
}

/** ¿Hay un mando conectado? La barra de controles cambia las teclas por botones. */
export function useMando() {
  const [hay, setHay] = useState(() => 'getGamepads' in navigator && [...navigator.getGamepads()].some(Boolean))
  useEffect(() => {
    const si = () => {
      setHay(true)
      desbloquear('mando')
      avisarConsola({ tipo: 'aviso', titulo: 'Mando conectado', texto: 'Cruceta para moverte · A ficha · X pedido · Y manos' })
    }
    const no = () => setHay([...navigator.getGamepads()].some(Boolean))
    window.addEventListener('gamepadconnected', si)
    window.addEventListener('gamepaddisconnected', no)
    return () => {
      window.removeEventListener('gamepadconnected', si)
      window.removeEventListener('gamepaddisconnected', no)
    }
  }, [])
  return hay
}

/* ── Colección y logros ───────────────────────────────────────────────── */

export type Logro = { id: string; nombre: string; detalle: string; puntos: number }

const SECCIONES = CATEGORIAS.filter((c) => c.id !== 'todo' && CATALOGO.some((m) => m.categoria === c.id))

export const LOGROS: Logro[] = [
  { id: 'primera', nombre: 'Jugador 1 listo', detalle: 'Mira tu primera figura en 3D', puntos: 10 },
  { id: 'vistas-10', nombre: 'Coleccionista', detalle: 'Mira 10 figuras distintas', puntos: 20 },
  { id: 'vistas-25', nombre: 'Gran coleccionista', detalle: 'Mira 25 figuras distintas', puntos: 30 },
  { id: 'vistas-50', nombre: 'Curador del museo', detalle: 'Mira 50 figuras distintas', puntos: 50 },
  { id: 'vistas-todas', nombre: 'Completista', detalle: 'Mira todas las figuras de la biblioteca', puntos: 100 },
  ...SECCIONES.map((c) => ({ id: `seccion-${c.id}`, nombre: `Maestro: ${c.nombre}`, detalle: `Mira todas las figuras de ${c.nombre}`, puntos: 40 })),
  { id: 'acabados', nombre: 'Transformación', detalle: 'Prueba los tres acabados: color, arcilla y malla', puntos: 15 },
  { id: 'equipo', nombre: 'Equipo armado', detalle: 'Llena los cinco huecos del pedido', puntos: 25 },
  { id: 'ruleta', nombre: 'Que decida el destino', detalle: 'Usa la selección aleatoria', puntos: 10 },
  { id: 'foto', nombre: 'Fotógrafo', detalle: 'Guarda una captura con el modo foto', puntos: 15 },
  { id: 'mando', nombre: 'Jugador de consola', detalle: 'Conecta un mando', puntos: 15 },
]

export const PUNTOS_TOTALES = LOGROS.reduce((s, l) => s + l.puntos, 0)

let vistas = new Set<string>(leer<string[]>('coleccion', []))
let ganados = new Set<string>(leer<string[]>('logros', []))
const oyentes = new Set<() => void>()
function avisar() {
  for (const f of oyentes) f()
}

/** Los avisos emergentes (logros, mando…) que pinta `<Avisos />`. */
export type Aviso = { tipo: 'logro' | 'aviso'; titulo: string; texto: string; puntos?: number }
export const avisarConsola = (a: Aviso) => window.dispatchEvent(new CustomEvent<Aviso>('aviso-consola', { detail: a }))

export function desbloquear(id: string) {
  if (ganados.has(id)) return
  const l = LOGROS.find((x) => x.id === id)
  if (!l) return
  ganados = new Set(ganados).add(id)
  guardar('logros', [...ganados])
  avisar()
  sfx.logro()
  vibrar(true)
  avisarConsola({ tipo: 'logro', titulo: l.nombre, texto: l.detalle, puntos: l.puntos })
}

/** Apunta una figura como vista y entrega los logros que toque. */
export function marcarVista(id: string) {
  if (!vistas.has(id)) {
    vistas = new Set(vistas).add(id)
    guardar('coleccion', [...vistas])
    avisar()
  }
  const n = CATALOGO.filter((m) => vistas.has(m.id)).length
  if (n >= 1) desbloquear('primera')
  if (n >= 10) desbloquear('vistas-10')
  if (n >= 25) desbloquear('vistas-25')
  if (n >= 50) desbloquear('vistas-50')
  if (n >= CATALOGO.length) desbloquear('vistas-todas')
  const m = CATALOGO.find((x) => x.id === id)
  if (m && CATALOGO.every((x) => x.categoria !== m.categoria || vistas.has(x.id))) desbloquear(`seccion-${m.categoria}`)
}

export function borrarProgreso() {
  vistas = new Set()
  ganados = new Set()
  guardar('coleccion', [])
  guardar('logros', [])
  avisar()
}

/** Nivel de jugador: cada 100 puntos sube uno, como la experiencia de una consola. */
export const nivel = (puntos: number) => ({ nivel: 1 + Math.floor(puntos / 100), resto: puntos % 100 })

/** El progreso del visitante, reactivo. */
export function useProgreso() {
  const [, setN] = useState(0)
  useEffect(() => {
    const f = () => setN((n) => n + 1)
    oyentes.add(f)
    return () => void oyentes.delete(f)
  }, [])
  const puntos = LOGROS.filter((l) => ganados.has(l.id)).reduce((s, l) => s + l.puntos, 0)
  return {
    vistas,
    ganados,
    puntos,
    sonido: sonidoActivo,
    nVistas: CATALOGO.filter((m) => vistas.has(m.id)).length,
  }
}
