import { useEffect, useState } from 'react'
import { Gamepad2, Lock, RotateCcw, Trophy, X } from 'lucide-react'
import { CATALOGO, rutaPortada } from '../lib/catalogo'
import { LOGROS, PUNTOS_TOTALES, borrarProgreso, nivel, useProgreso, type Aviso } from '../lib/consola'

/**
 * Avisos emergentes, como los trofeos de una consola: bajan arriba al centro,
 * se quedan unos segundos y se van. Se apilan si llegan varios.
 */
export function Avisos() {
  const [lista, setLista] = useState<(Aviso & { n: number })[]>([])
  useEffect(() => {
    let n = 0
    const llega = (e: Event) => {
      const a = { ...(e as CustomEvent<Aviso>).detail, n: ++n }
      setLista((l) => [...l.slice(-2), a])
      setTimeout(() => setLista((l) => l.filter((x) => x.n !== a.n)), 4200)
    }
    window.addEventListener('aviso-consola', llega)
    return () => window.removeEventListener('aviso-consola', llega)
  }, [])

  return (
    <div className="pointer-events-none fixed left-1/2 top-20 z-[70] flex w-[min(92vw,340px)] -translate-x-1/2 flex-col gap-2" aria-live="polite">
      {lista.map((a) => (
        <div key={a.n} className="aviso flex items-center gap-3 bg-[#140f22]/95 py-2.5 pl-2.5 pr-4 text-white shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] ring-1 ring-white/15 backdrop-blur">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${a.tipo === 'logro' ? 'aviso-trofeo bg-gradient-to-br from-[#FFE27A] via-[#FFC23D] to-[#FF6A13] text-[#140f22]' : 'bg-white/10 text-white'}`}>
            {a.tipo === 'logro' ? <Trophy size={20} strokeWidth={2.4} /> : <Gamepad2 size={20} />}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block font-chakra text-[10px] font-semibold uppercase tracking-[0.2em] text-[#FFC23D]">
              {a.tipo === 'logro' ? 'Logro desbloqueado' : 'Sistema'}
            </span>
            <span className="block truncate text-[14px] font-semibold">{a.titulo}</span>
            <span className="block truncate text-[12px] text-white/60">{a.texto}</span>
          </span>
          {a.puntos ? <span className="shrink-0 font-chakra text-[13px] font-bold tabular-nums text-[#FFC23D]">+{a.puntos}</span> : null}
        </div>
      ))}
    </div>
  )
}

/** La pantalla de logros: nivel de jugador, colección y la lista de trofeos. */
export function PanelLogros({ onCerrar }: { onCerrar: () => void }) {
  const { ganados, puntos, nVistas, vistas } = useProgreso()
  const { nivel: n, resto } = nivel(puntos)

  useEffect(() => {
    // La misma pulsación de L que abre el panel no debe cerrarlo.
    const desde = performance.now()
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key.toLowerCase() === 'l' && performance.now() - desde > 250)) onCerrar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])

  const ultimas = CATALOGO.filter((m) => vistas.has(m.id)).slice(-12)

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-3 backdrop-blur-sm" onClick={onCerrar} role="dialog" aria-modal aria-label="Logros">
      <div onClick={(e) => e.stopPropagation()} className="panel-sel entra flex max-h-[92svh] w-[min(96vw,760px)] flex-col overflow-hidden bg-[#120d20] text-white ring-1 ring-white/15">
        <div className="relative flex items-center gap-4 border-b border-white/10 bg-gradient-to-r from-[#8A3CFF]/40 via-[#FF2D8A]/25 to-transparent px-5 py-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#FFE27A] to-[#FF6A13] font-flemin text-xl text-[#140f22] shadow-[0_0_24px_rgba(255,194,61,0.55)]">{n}</span>
          <div className="min-w-0 flex-1">
            <p className="font-chakra text-[11px] uppercase tracking-[0.28em] text-[#FFC23D]">Perfil · Jugador 1</p>
            <p className="font-flemin text-2xl leading-tight">Nivel {n}</p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-[#FFC23D] to-[#FF6A13] transition-[width] duration-700" style={{ width: `${resto}%` }} />
            </div>
            <p className="mt-1 font-chakra text-[11px] uppercase tracking-[0.16em] text-white/50">
              {puntos} / {PUNTOS_TOTALES} pts · {ganados.size} / {LOGROS.length} logros
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid h-9 w-9 shrink-0 place-items-center bg-white/10 hover:bg-white/20">
            <X size={18} />
          </button>
        </div>

        <div className="sin-barra overflow-y-auto px-5 py-4">
          <div className="mb-4">
            <p className="mb-1.5 flex justify-between font-chakra text-[11px] uppercase tracking-[0.2em] text-white/70">
              <span>Colección</span>
              <span className="tabular-nums">
                {nVistas} / {CATALOGO.length} figuras vistas
              </span>
            </p>
            <div className="h-2.5 overflow-hidden bg-white/10 [clip-path:polygon(6px_0,100%_0,calc(100%-6px)_100%,0_100%)]">
              <div className="h-full bg-gradient-to-r from-[#00E5D1] to-[#2A7BFF]" style={{ width: `${(nVistas / CATALOGO.length) * 100}%` }} />
            </div>
            {ultimas.length > 0 && (
              <div className="mt-2 flex gap-1 overflow-hidden">
                {ultimas.map((m) => (
                  <img key={m.id} src={rutaPortada(m)} alt={m.nombre} title={m.nombre} className="h-10 w-10 shrink-0 bg-white/5 object-contain" />
                ))}
              </div>
            )}
          </div>

          <ul className="grid gap-1.5 sm:grid-cols-2">
            {LOGROS.map((l) => {
              const si = ganados.has(l.id)
              return (
                <li key={l.id} className={`flex items-center gap-3 p-2.5 ring-1 ${si ? 'bg-gradient-to-r from-[#FFC23D]/15 to-transparent ring-[#FFC23D]/40' : 'bg-white/[0.03] ring-white/10'}`}>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${si ? 'bg-gradient-to-br from-[#FFE27A] to-[#FF6A13] text-[#140f22]' : 'bg-white/10 text-white/35'}`}>
                    {si ? <Trophy size={17} strokeWidth={2.4} /> : <Lock size={15} />}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className={`block truncate text-[13.5px] font-semibold ${si ? '' : 'text-white/60'}`}>{l.nombre}</span>
                    <span className="block text-[11.5px] text-white/45">{l.detalle}</span>
                  </span>
                  <span className={`shrink-0 font-chakra text-[12px] font-bold tabular-nums ${si ? 'text-[#FFC23D]' : 'text-white/30'}`}>{l.puntos}</span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3 font-chakra text-[11px] uppercase tracking-[0.16em] text-white/45">
          <span>El progreso se guarda en este navegador</span>
          <button
            type="button"
            onClick={() => confirm('¿Borrar la colección y los logros de este navegador?') && borrarProgreso()}
            className="flex items-center gap-1.5 transition hover:text-white"
          >
            <RotateCcw size={13} /> Reiniciar
          </button>
        </div>
      </div>
    </div>
  )
}
