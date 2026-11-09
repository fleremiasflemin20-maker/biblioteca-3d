import { Brush, Gift, Package, Palette, X } from 'lucide-react'
import { useEffect } from 'react'
import { CONTENIDO_KIT, PINCELES, type KitPintura } from '../lib/kitPintura'

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
export const PROMO_KIT = `${BASE}/promo/kit-pintura-hero.webp`

/** La paleta como gotas de pintura, cada una con su nombre. */
export function Gotas({ colores, chicas = false }: { colores: KitPintura['colores']; chicas?: boolean }) {
  return (
    <ul className={`flex flex-wrap ${chicas ? 'gap-1' : 'gap-x-3 gap-y-2.5'}`}>
      {colores.map((c, i) => (
        <li key={`${c.hex}-${i}`} className="flex items-center gap-1.5" title={c.nombre}>
          <span
            className={`${chicas ? 'h-3 w-3' : 'h-6 w-6'} shrink-0 rounded-full ring-2 ring-white/20 shadow-[inset_-2px_-3px_4px_rgba(0,0,0,.25),inset_2px_2px_3px_rgba(255,255,255,.35)]`}
            style={{ background: c.hex }}
          />
          {!chicas && <span className="text-[12.5px] text-white/75">{c.nombre}</span>}
        </li>
      ))}
    </ul>
  )
}

/** El bloque de la ficha: qué trae la cajita de esta figura. */
export function BloqueKit({ kit, etiqueta, onExplicar }: { kit: KitPintura; etiqueta: string; onExplicar: () => void }) {
  return (
    <div className="corte relative shrink-0 overflow-hidden bg-gradient-to-br from-[#FF5FA2]/15 via-[#FFC23D]/10 to-[#2AC3FF]/15 p-4 ring-1 ring-inset ring-white/15">
      <p className={`${etiqueta} flex items-center gap-2`}>
        <Gift size={14} /> Kit para pintar incluido
      </p>
      <p className="text-[14px] leading-relaxed text-white/75">
        Te llega en blanco, en una cajita con la paleta exacta del personaje, la pintura adecuada para el PLA y sus pinceles. Lo pintas tú.
      </p>
      <p className="mt-4 mb-2 flex items-center gap-1.5 font-chakra text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
        <Palette size={13} /> Paleta · {kit.colores.length} colores
      </p>
      <Gotas colores={kit.colores} />
      <p className="mt-4 mb-2 flex items-center gap-1.5 font-chakra text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
        <Brush size={13} /> Pinceles · {PINCELES.length}
      </p>
      <ul className="grid grid-cols-1 gap-1 text-[13px] text-white/70 sm:grid-cols-2">
        {PINCELES.map((p) => (
          <li key={p.nombre}>
            <span className="font-semibold text-white">{p.nombre}</span> · {p.uso}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onExplicar} className="mt-4 inline-flex items-center gap-1.5 font-chakra text-[12px] font-semibold uppercase tracking-[0.14em] text-[#FFC23D] underline-offset-4 hover:underline">
        <Package size={14} /> Qué más trae la cajita
      </button>
    </div>
  )
}

/** Explicación del kit: la imagen de promoción y todo lo que va en la caja. */
export function ExplicacionKit({ onCerrar, onVer }: { onCerrar: () => void; onVer?: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopImmediatePropagation(), onCerrar())
    window.addEventListener('keydown', tecla, true)
    return () => window.removeEventListener('keydown', tecla, true)
  }, [onCerrar])
  return (
    <div role="dialog" aria-modal="true" aria-label="Kit para pintar" className="fixed inset-0 z-[60] flex items-center justify-center bg-[#07050d]/80 p-4 text-white backdrop-blur-md" onClick={(e) => (e.stopPropagation(), onCerrar())}>
      <div className="corte relative max-h-[92vh] w-full max-w-3xl overflow-y-auto bg-[#140f22] ring-1 ring-white/15" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center bg-black/50 text-white/80 hover:text-white">
          <X size={18} />
        </button>
        <img src={PROMO_KIT} alt="Figura en blanco con su paleta de colores, pinturas y pinceles en una cajita" className="block w-full" />
        <div className="p-5 sm:p-7">
          <p className="font-chakra text-[11px] font-semibold uppercase tracking-[0.22em] text-[#FFC23D]">Figuras para pintar</p>
          <h2 className="mt-1 font-flemin text-[clamp(1.6rem,4vw,2.4rem)] leading-tight">Tu figura, tus manos, sus colores</h2>
          <p className="mt-3 leading-relaxed text-white/70">
            Cada figura en blanco de la biblioteca se puede pedir con su kit: la armamos en una cajita con todo lo necesario para pintarla igual que el personaje y te la enviamos.
          </p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {CONTENIDO_KIT.map((c) => (
              <li key={c.nombre} className="corte-sm bg-white/[0.05] px-3.5 py-2.5 text-[14px] leading-snug text-white/65 ring-1 ring-inset ring-white/10">
                <span className="font-semibold text-white">{c.nombre}.</span> {c.detalle}
              </li>
            ))}
            <li className="corte-sm bg-white/[0.05] px-3.5 py-2.5 text-[14px] leading-snug text-white/65 ring-1 ring-inset ring-white/10">
              <span className="font-semibold text-white">{PINCELES.length} pinceles.</span> {PINCELES.map((p) => p.nombre).join(', ')}.
            </li>
          </ul>
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {['Eliges tu figura en blanco', 'Te enviamos la cajita con su paleta exacta', 'La pintas tú, paso a paso'].map((t, i) => (
              <li key={t} className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#FF5FA2] to-[#FFC23D] font-flemin text-[15px] text-[#140f22]">{i + 1}</span>
                <span className="text-[14px] leading-snug text-white/80">{t}</span>
              </li>
            ))}
          </ol>
          {onVer && (
            <button type="button" onClick={onVer} className="btn-fuego mt-7 px-5 py-2.5 font-chakra text-[13px] font-bold uppercase tracking-[0.14em]">
              Ver las figuras para pintar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
