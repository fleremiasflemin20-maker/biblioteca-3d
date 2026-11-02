import { useEffect, useRef, useState } from 'react'
import { Music2, Pause, Play, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { PISTAS, rutaPista } from '../lib/musica'

/*
 * Reproductor de la música de fondo, en la barra superior.
 *
 * Los navegadores no dejan sonar audio antes de que el visitante toque la
 * página, así que arranca con su primer clic o tecla, salvo que la haya
 * pausado en otra visita. Volumen, silencio y pausa se recuerdan en
 * `localStorage`.
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

export function Musica() {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [indice, setIndice] = useState(0)
  const [sonando, setSonando] = useState(false)
  const [volumen, setVolumen] = useState(() => leer('musica-volumen', 0.35))
  const [silencio, setSilencio] = useState(() => leer('musica-silencio', false))
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const pista = PISTAS[indice]

  useEffect(() => {
    if (!audio.current) return
    audio.current.volume = volumen
    audio.current.muted = silencio
    guardar('musica-volumen', volumen)
    guardar('musica-silencio', silencio)
  }, [volumen, silencio])

  // Primer gesto del visitante: empieza a sonar (si no la pausó antes).
  useEffect(() => {
    if (leer('musica-pausada', false)) return
    const arrancar = () => {
      audio.current?.play().catch(() => {})
      quitar()
    }
    const quitar = () => {
      window.removeEventListener('pointerdown', arrancar)
      window.removeEventListener('keydown', arrancar)
    }
    window.addEventListener('pointerdown', arrancar)
    window.addEventListener('keydown', arrancar)
    return quitar
  }, [])

  // Cerrar el panel al tocar fuera.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    window.addEventListener('pointerdown', fuera)
    return () => window.removeEventListener('pointerdown', fuera)
  }, [abierto])

  const alternar = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) {
      a.play().catch(() => {})
      guardar('musica-pausada', false)
    } else {
      a.pause()
      guardar('musica-pausada', true)
    }
  }

  // Al cambiar de pista, sigue sonando si sonaba (o si la anterior acabó).
  const seguir = useRef(false)
  const siguiente = (continuar: boolean) => {
    seguir.current = continuar
    setIndice((i) => (i + 1) % PISTAS.length)
  }
  useEffect(() => {
    if (seguir.current) audio.current?.play().catch(() => {})
    seguir.current = false
  }, [indice])

  if (!pista) return null
  const mudo = silencio || volumen === 0

  return (
    <div ref={caja} className="relative">
      <audio
        ref={audio}
        src={rutaPista(pista)}
        preload="none"
        loop={PISTAS.length === 1}
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onEnded={() => siguiente(true)}
      />
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="btn-juego !px-3"
        title="Música"
        aria-expanded={abierto}
        aria-label="Música de fondo"
      >
        {sonando && !mudo ? <Music2 size={16} className="animate-pulse text-[#FFC23D]" /> : mudo ? <VolumeX size={16} /> : <Music2 size={16} />}
      </button>

      {abierto && (
        <div className="corte-sm absolute right-0 top-full z-50 mt-2 w-[min(86vw,280px)] bg-[#0b0718]/95 p-3.5 font-chakra text-white shadow-[0_12px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/15 backdrop-blur-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#FFC23D]">Sonando</p>
          <p className="mt-1 truncate text-[14px] font-semibold">{pista.titulo}</p>
          <p className="truncate text-[11px] text-white/55">
            {pista.obra} · {pista.autor}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={alternar} className="btn-juego !h-9 !px-3" aria-label={sonando ? 'Pausar' : 'Reproducir'}>
              {sonando ? <Pause size={15} /> : <Play size={15} />}
            </button>
            {PISTAS.length > 1 && (
              <button type="button" onClick={() => siguiente(sonando)} className="btn-juego !h-9 !px-3" aria-label="Siguiente canción">
                <SkipForward size={15} />
              </button>
            )}
            <button type="button" onClick={() => setSilencio((s) => !s)} className="btn-juego !h-9 !px-3" aria-pressed={silencio} aria-label={silencio ? 'Quitar silencio' : 'Silenciar'}>
              {mudo ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={silencio ? 0 : volumen}
              onChange={(e) => {
                setVolumen(Number(e.target.value))
                setSilencio(false)
              }}
              aria-label="Volumen"
              className="h-1 min-w-0 flex-1 cursor-pointer accent-[#FFC23D]"
            />
          </div>

          <p className="mt-3 text-[10px] leading-snug text-white/40">La música pertenece a sus autores. Solo la usamos como ambientación; no es de nuestra propiedad.</p>
        </div>
      )}
    </div>
  )
}
