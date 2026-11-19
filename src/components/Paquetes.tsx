import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Crown, Download, Globe, Images, Lock, MessageCircle, Package, ShieldCheck, X } from 'lucide-react'
import datos from '../data/paquetes.json'
import {
  abrirClub,
  archivosPaquete,
  capturarPaquete,
  enlacePaquete,
  megas,
  ordenPaquete,
  tienePaquete,
  useClub,
  type ArchivoClub,
} from '../lib/club'

/**
 * Paquetes de descarga: colecciones enteras a precio fijo. En la web solo se
 * ven sus fotos; los archivos (en R2) se bajan tras comprar el paquete o con
 * el Club activo. Ver worker/paquetes.ts.
 */
export type Paquete = {
  id: string
  nombre: string
  lema: string
  precio: string
  descripcion: string
  modelos: number
  peso: string
  color: string
  fotos: string[]
  /** Enlace de pago con tarjeta desde cualquier país (Payhip, Gumroad, Lemon Squeezy…). Vacío = no se muestra. */
  pagoInternacional?: string
}

export const PAQUETES = datos as Paquete[]
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
const foto = (ruta: string) => `${BASE}/${ruta}`

export function SeccionPaquetes() {
  const [abierto, setAbierto] = useState<Paquete | null>(null)
  const club = useClub()
  if (PAQUETES.length === 0) return null
  return (
    <section id="paquetes" className="relative scroll-mt-36 overflow-hidden border-t border-white/10">
      <div className="relative mx-auto max-w-[1600px] px-4 py-14 md:px-6">
        <p className="font-chakra text-[11px] font-semibold uppercase tracking-[0.4em] text-[#FFC23D]">Descarga digital</p>
        <h2 className="titulo-seccion mt-2 text-[clamp(2rem,4.5vw,3.6rem)]" style={{ '--d': '#8A3CFF' } as CSSProperties}>
          Paquetes
        </h2>
        <p className="mt-3 max-w-2xl text-white/65">
          Colecciones enteras listas para imprimir, en una sola descarga. Compra el paquete que quieras o hazte socio del Club y bájalos todos.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {PAQUETES.map((p) => {
            const mio = tienePaquete(club, p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setAbierto(p)}
                className="cristal corte group relative overflow-hidden text-left transition hover:-translate-y-1"
              >
                <div className="grid aspect-[16/9] grid-cols-3 grid-rows-2 gap-[2px] overflow-hidden bg-black/40">
                  {p.fotos.slice(0, 3).map((f, i) => (
                    <img
                      key={f}
                      src={foto(f)}
                      alt=""
                      loading="lazy"
                      className={`h-full min-h-0 w-full object-cover transition duration-500 group-hover:scale-[1.03] ${i === 0 ? 'col-span-2 row-span-2' : ''}`}
                    />
                  ))}
                </div>
                <div className="flex items-end justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="font-chakra text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: p.color }}>
                      {p.lema}
                    </p>
                    <h3 className="mt-1 font-flemin text-[26px] leading-tight">{p.nombre}</h3>
                    <p className="mt-1 font-chakra text-[13px] uppercase tracking-wider text-white/55">
                      {p.modelos} modelos · {p.peso}
                    </p>
                  </div>
                  <span className={`btn-juego shrink-0 ${mio ? '' : 'btn-fuego'}`}>
                    {mio ? (
                      <>
                        <Download size={15} /> Descargar
                      </>
                    ) : (
                      <>
                        <Package size={15} /> {p.precio} USD
                      </>
                    )}
                  </span>
                </div>
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${p.color}, #FFC23D)` }} />
              </button>
            )
          })}
        </div>
      </div>
      {abierto && <FichaPaquete paquete={abierto} onCerrar={() => setAbierto(null)} />}
    </section>
  )
}

function FichaPaquete({ paquete: p, onCerrar }: { paquete: Paquete; onCerrar: () => void }) {
  const club = useClub()
  const mio = tienePaquete(club, p.id)
  const [grande, setGrande] = useState(0)

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#07050d]/90 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={p.nombre} onClick={onCerrar}>
      <div className="mx-auto my-6 grid max-w-6xl gap-6 px-4 lg:grid-cols-[1.4fr_1fr]" onClick={(e) => e.stopPropagation()}>
        <div>
          <img src={foto(p.fotos[grande])} alt={`${p.nombre}: foto ${grande + 1}`} className="aspect-square w-full bg-black/50 object-contain ring-1 ring-white/10" />
          <div className="mt-2 grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {p.fotos.map((f, i) => (
              <button key={f} type="button" onClick={() => setGrande(i)} className={`aspect-square overflow-hidden ring-1 ${i === grande ? 'ring-[#FFC23D]' : 'ring-white/10'}`}>
                <img src={foto(f)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div className="cristal corte flex flex-col gap-4 self-start p-6 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-chakra text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: p.color }}>
                {p.lema}
              </p>
              <h3 className="font-flemin text-[30px] leading-tight">{p.nombre}</h3>
            </div>
            <button type="button" onClick={onCerrar} className="btn-juego !px-2.5" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
          <p className="leading-relaxed text-white/70">{p.descripcion}</p>
          <p className="flex items-center gap-2 font-chakra text-[13px] uppercase tracking-wider text-white/55">
            <Images size={15} /> {p.modelos} modelos · {p.peso} · descarga digital
          </p>

          {mio ? <Archivos id={p.id} /> : <Comprar paquete={p} />}
        </div>
      </div>
    </div>
  )
}

function Archivos({ id }: { id: string }) {
  const club = useClub()
  const [archivos, setArchivos] = useState<ArchivoClub[] | null>(null)
  useEffect(() => {
    let vivo = true
    archivosPaquete(id)
      .then((a) => vivo && setArchivos(a))
      .catch(() => vivo && setArchivos([]))
    return () => {
      vivo = false
    }
  }, [id])

  return (
    <div className="corte-sm bg-gradient-to-br from-[#3BE0A0]/15 to-transparent p-3.5 ring-1 ring-inset ring-[#3BE0A0]/35">
      <p className="mb-2 flex items-center gap-2 font-chakra text-[12px] font-bold uppercase tracking-[0.2em] text-[#3BE0A0]">
        <ShieldCheck size={14} /> {club.paquetes.has(id) ? 'Paquete comprado' : 'Incluido en tu Club'}
      </p>
      {archivos === null && <p className="text-[13px] text-white/55">Cargando archivos…</p>}
      {archivos?.length === 0 && <p className="text-[13px] text-white/55">Estamos subiendo los archivos. Vuelve en un rato o escríbenos por WhatsApp.</p>}
      <ul className="flex flex-col gap-1.5">
        {archivos?.map((a) => (
          <li key={a.nombre}>
            <a href={enlacePaquete(id, a.nombre)} download={a.nombre} className="flex items-center gap-2 bg-white/[0.06] px-3 py-2 text-[13.5px] ring-1 ring-inset ring-white/10 transition hover:bg-white/10">
              <Download size={15} className="shrink-0 text-[#3BE0A0]" />
              <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
              <span className="shrink-0 font-mono text-[11px] text-white/45">{megas(a.tamano)}</span>
            </a>
          </li>
        ))}
      </ul>
      {archivos && archivos.length > 1 && (
        <p className="mt-2 text-[11.5px] leading-snug text-white/45">Baja todas las partes a la misma carpeta y abre la primera con 7-Zip o WinRAR: se juntan solas.</p>
      )}
    </div>
  )
}

function Comprar({ paquete: p }: { paquete: Paquete }) {
  const club = useClub()
  const pedido = `Hola, quiero comprar el ${p.nombre} (${p.precio} USD) de la Biblioteca 3D`
  const whatsapp = (extra: string) => `https://wa.me/${club.config.whatsapp}?text=${encodeURIComponent(`${pedido}${extra}`)}`

  // En GitHub Pages no hay servidor: solo se puede pedir por WhatsApp.
  if (!club.disponible) {
    return (
      <a href={whatsapp('.')} target="_blank" rel="noreferrer" className="btn-juego btn-fuego !h-12 w-full">
        <MessageCircle size={17} /> Comprar por WhatsApp · {p.precio} USD
      </a>
    )
  }

  if (!club.usuario) {
    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-[13.5px] text-white/65">
          <Lock size={15} /> Crea tu cuenta gratis o entra: la descarga queda guardada en ella.
        </p>
        <button type="button" onClick={() => abrirClub('cuenta')} className="btn-juego btn-fuego !h-12 w-full">
          <Package size={16} /> Comprar por {p.precio} USD
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-flemin text-[26px] leading-none">
        {p.precio} <span className="font-chakra text-[14px] text-white/55">USD · pago único</span>
      </p>
      {club.config.paypalPaquetes && <BotonPayPalPaquete paquete={p} clientId={club.config.paypalPaquetes} />}
      {p.pagoInternacional && (
        <a href={p.pagoInternacional} target="_blank" rel="noreferrer" className="btn-juego !h-12 w-full">
          <Globe size={17} /> Tarjeta desde cualquier país
        </a>
      )}
      <a href={whatsapp(` con Deuna o transferencia. Mi cuenta es ${club.usuario.correo}`)} target="_blank" rel="noreferrer" className="btn-juego !h-12 w-full !text-[13px]">
        <MessageCircle size={17} /> Pagar con Deuna o transferencia
      </a>
      <p className="text-[11.5px] leading-snug text-white/45">
        Con Deuna o transferencia te activamos la descarga en tu cuenta apenas llegue el pago. Con PayPal o tarjeta se activa sola al instante.
      </p>
      <button type="button" onClick={() => abrirClub('info')} className="flex items-center justify-center gap-2 font-chakra text-[12px] uppercase tracking-[0.16em] text-[#FFC23D] hover:text-white">
        <Crown size={14} /> O hazte socio del Club y bájalos todos ({club.config.precio} USD/mes)
      </button>
    </div>
  )
}

type BotonesPayPal = { Buttons: (o: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void>; close?: () => void } }
declare global {
  interface Window {
    paypalPaquetes?: BotonesPayPal
  }
}

// Otro "namespace" para no chocar con el SDK de la suscripción del Club (que se carga con vault=true).
let sdk: Promise<void> | null = null
const cargarSdk = (clientId: string) =>
  (sdk ??= new Promise<void>((ok, mal) => {
    const s = document.createElement('script')
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&intent=capture&currency=USD&locale=es_EC`
    s.dataset.namespace = 'paypalPaquetes'
    s.onload = () => ok()
    s.onerror = () => {
      sdk = null
      mal(new Error('No se pudo cargar PayPal.'))
    }
    document.head.appendChild(s)
  }))

function BotonPayPalPaquete({ paquete, clientId }: { paquete: Paquete; clientId: string }) {
  const caja = useRef<HTMLDivElement>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'cobrando' | 'error'>('cargando')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    let vivo = true
    let botones: { close?: () => void } | undefined
    cargarSdk(clientId)
      .then(() => {
        if (!vivo || !caja.current || !window.paypalPaquetes) return
        const b = window.paypalPaquetes.Buttons({
          style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'pay' },
          createOrder: () => ordenPaquete(paquete.id),
          onApprove: async (d: { orderID: string }) => {
            setEstado('cobrando')
            try {
              await capturarPaquete(paquete.id, d.orderID)
            } catch (e) {
              setAviso((e as Error).message)
              setEstado('error')
            }
          },
          onError: () => {
            setAviso('PayPal no pudo completar el pago. Intenta otra vez o paga con Deuna.')
            setEstado('error')
          },
        })
        botones = b
        return b.render(caja.current).then(() => vivo && setEstado('listo'))
      })
      .catch((e: Error) => {
        if (!vivo) return
        setAviso(e.message)
        setEstado('error')
      })
    return () => {
      vivo = false
      botones?.close?.()
    }
  }, [clientId, paquete.id])

  return (
    <div>
      <div ref={caja} className="min-h-[50px] overflow-hidden rounded bg-white p-2" />
      {estado === 'cargando' && <p className="mt-2 text-[12.5px] text-white/50">Cargando PayPal…</p>}
      {estado === 'cobrando' && <p className="mt-2 text-[12.5px] text-[#FFC23D]">Confirmando tu pago…</p>}
      {aviso && <p className="mt-2 text-[13px] text-[#FF7A6B]">{aviso}</p>}
      <p className="mt-2 text-[11.5px] text-white/40">PayPal acepta tu cuenta o tarjeta de débito o crédito de cualquier país.</p>
    </div>
  )
}
