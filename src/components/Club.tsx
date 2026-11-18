import { useEffect, useRef, useState } from 'react'
import { Check, Crown, Download, KeyRound, Lock, LogOut, MessageCircle, ShieldCheck, Sparkles, X } from 'lucide-react'
import {
  abrirClub,
  archivosDe,
  cerrarClub,
  confirmarPayPal,
  enlaceDescarga,
  fecha,
  megas,
  pedir,
  salir,
  useClub,
  type ArchivoClub,
  type ConfigClub,
  type UsuarioClub,
  type PestanaClub,
  verPestana,
} from '../lib/club'
import { Acceso } from './ClubAcceso'
import { IMPRESIONES, IMPRESORAS, UNIVERSOS, type Perfil } from '../../worker/perfil.ts'

/**
 * Club Flemin: suscripción mensual que deja descargar todos los STL, 3MF y
 * demás archivos de impresión de los modelos del Club, sin límite.
 */

const campo = 'w-full bg-white/[0.07] px-3.5 py-2.5 font-chakra text-[14px] text-white outline-none ring-1 ring-inset ring-white/15 transition placeholder:text-white/35 focus:ring-[#FFC23D]/70'

/** El botón de la cabecera: siempre a la vista, aunque el servidor del Club no esté. */
export function BotonClub() {
  const club = useClub()
  const socio = club.suscripcion?.activa
  return (
    <button
      type="button"
      onClick={() => abrirClub()}
      className={`btn-juego shrink-0 !px-3.5 ${socio ? '' : 'btn-fuego btn-club'}`}
      title={`Club Flemin: descarga los STL y 3MF por ${club.config.precio} USD al mes`}
    >
      <Crown size={16} /> <span>{socio ? 'Socio del Club' : 'Únete al Club'}</span>
    </button>
  )
}

const PASOS = [
  { n: '1', titulo: 'Crea tu cuenta', texto: 'Solo tu correo y una contraseña.' },
  { n: '2', titulo: 'Activa el Club', texto: 'Con PayPal o tarjeta, o por transferencia y Deuna por WhatsApp.' },
  { n: '3', titulo: 'Descarga e imprime', texto: 'Abre cualquier modelo y baja sus archivos cuantas veces quieras.' },
]

const INCLUYE = [
  'Los STL, 3MF y demás archivos de impresión de los modelos de la Biblioteca.',
  'Descargas ilimitadas mientras tu suscripción esté activa.',
  'Todo lo que ya está en la web y todo lo que vamos sumando, en una sola suscripción.',
  'Sin permanencia: cancelas cuando quieras y sigues descargando hasta el final del mes pagado.',
]

export function PanelClub() {
  const club = useClub()
  useEffect(() => {
    if (!club.panel) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrarClub()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [club.panel])
  if (!club.panel) return null
  const { precio } = club.config
  const pestanas: { id: PestanaClub; nombre: string }[] = [
    { id: 'info', nombre: '¿Qué es el Club?' },
    { id: 'cuenta', nombre: club.usuario ? 'Mi cuenta' : 'Unirme' },
  ]

  return (
    <div className="fixed inset-0 z-[65] grid place-items-center bg-black/75 p-3 backdrop-blur-sm" onClick={cerrarClub} role="dialog" aria-modal aria-label="Club Flemin">
      <div onClick={(e) => e.stopPropagation()} className="panel-sel entra flex max-h-[94svh] w-[min(96vw,600px)] flex-col overflow-hidden bg-[#120d20] text-white ring-1 ring-white/15">
        <div className="relative flex items-center gap-4 border-b border-white/10 bg-gradient-to-r from-[#FF6A13]/40 via-[#FF2D8A]/25 to-transparent px-5 py-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#FFE27A] to-[#FF6A13] text-[#140f22] shadow-[0_0_24px_rgba(255,194,61,0.55)]">
            <Crown size={26} strokeWidth={2.4} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-chakra text-[11px] uppercase tracking-[0.28em] text-[#FFC23D]">Suscripción mensual</p>
            <p className="font-flemin text-2xl leading-tight">Club Flemin</p>
            <p className="mt-0.5 text-[13px] text-white/65">Descarga los STL y 3MF de la Biblioteca, sin límite.</p>
          </div>
          <button type="button" onClick={cerrarClub} aria-label="Cerrar" className="grid h-9 w-9 shrink-0 place-items-center bg-white/10 hover:bg-white/20">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 border-b border-white/10 bg-black/20 p-1.5" role="tablist">
          {pestanas.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={club.pestana === t.id}
              onClick={() => verPestana(t.id)}
              className={`py-2.5 font-chakra text-[12.5px] font-bold uppercase tracking-[0.14em] transition ${club.pestana === t.id ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}
            >
              {t.nombre}
            </button>
          ))}
        </div>

        <div className="sin-barra flex flex-col gap-5 overflow-y-auto px-5 py-5">
          {club.pestana === 'info' ? (
            <Explicacion precio={precio} />
          ) : (
            <>
              <p className="bg-gradient-to-b from-[#FFE08A] to-[#FF8A2F] bg-clip-text font-flemin text-5xl leading-none text-transparent">
                {precio} USD<span className="font-chakra text-lg text-white/60"> /mes</span>
              </p>
              {!club.disponible ? (
                <SinServidor config={club.config} />
              ) : !club.usuario ? (
                <Acceso />
              ) : (
                <Cuenta usuario={club.usuario} config={club.config} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** La pestaña que cuenta qué es el Club, cuánto cuesta y qué incluye. */
function Explicacion({ precio }: { precio: string }) {
  const club = useClub()
  return (
    <div className="flex flex-col gap-5">
      <div className="corte-sm bg-gradient-to-br from-[#FF6A13]/20 via-[#FF2D8A]/10 to-transparent p-4 ring-1 ring-inset ring-[#FFC23D]/35">
        <p className="font-chakra text-[11px] font-bold uppercase tracking-[0.24em] text-[#FFC23D]">Por solo</p>
        <p className="bg-gradient-to-b from-[#FFE08A] to-[#FF8A2F] whitespace-nowrap bg-clip-text font-flemin text-[44px] leading-none text-transparent sm:text-6xl">
          {precio} USD<span className="font-chakra text-base text-white/60 sm:text-xl"> /mes</span>
        </p>
        <p className="mt-2 text-[14.5px] leading-relaxed text-white/85">
          Con tu suscripción mensual accedes a la Biblioteca y descargas los archivos <b>STL</b>, <b>3MF</b> y demás
          formatos de impresión de los modelos de la web, para imprimirlos en tu casa o en tu taller.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {INCLUYE.map((t) => (
          <li key={t} className="flex gap-2.5 text-[14px] leading-snug text-white/85">
            <Check size={18} className="mt-0.5 shrink-0 text-[#3BE0A0]" /> {t}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3 bg-gradient-to-r from-[#8A3CFF]/25 to-transparent p-3.5 ring-1 ring-inset ring-[#8A3CFF]/45">
        <Sparkles size={22} className="shrink-0 text-[#C77DFF]" />
        <p className="text-[13.5px] leading-snug text-white/85">
          <b>Estamos actualizando la Biblioteca:</b> cada semana subimos personajes y modelos nuevos, y todos entran a tu suscripción sin pagar nada extra.
        </p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-3">
        {PASOS.map((p) => (
          <li key={p.n} className="bg-white/[0.04] p-3 ring-1 ring-inset ring-white/10">
            <span className="font-flemin text-2xl text-[#FFC23D]">{p.n}</span>
            <p className="font-chakra text-[13px] font-bold uppercase tracking-[0.1em]">{p.titulo}</p>
            <p className="mt-1 text-[12.5px] leading-snug text-white/60">{p.texto}</p>
          </li>
        ))}
      </ol>

      <button type="button" onClick={() => verPestana('cuenta')} className="btn-juego btn-fuego !h-14 w-full !text-[15px]">
        <Crown size={18} /> {club.suscripcion?.activa ? 'Ver mi cuenta' : club.usuario ? 'Activar mi suscripción' : 'Únete al Club'}
      </button>
      <p className="text-center text-[11.5px] text-white/40">Archivos para uso personal. No se permite revenderlos ni compartirlos.</p>
    </div>
  )
}

/** Donde no hay servidor del Club (la copia de GitHub Pages): se apunta a la web principal. */
function SinServidor({ config }: { config: ConfigClub }) {
  const principal = 'https://biblioteca-3d.fleremiasflemin.workers.dev/#club'
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] leading-relaxed text-white/75">Las cuentas del Club se crean en la web principal de la Biblioteca.</p>
      {location.host !== new URL(principal).host && (
        <a href={principal} className="btn-juego btn-fuego !h-12 w-full !text-[14px]">
          <Crown size={17} /> Ir a la Biblioteca y unirme
        </a>
      )}
      <a
        href={`https://wa.me/${config.whatsapp}?text=${encodeURIComponent(`Hola, quiero unirme al Club Flemin (${config.precio} USD/mes).`)}`}
        target="_blank"
        rel="noreferrer"
        className="btn-juego !h-12 w-full !text-[13px]"
      >
        <MessageCircle size={17} /> Pregúntanos por WhatsApp
      </a>
    </div>
  )
}

function Cuenta({ usuario, config }: { usuario: UsuarioClub; config: ConfigClub }) {
  const { suscripcion } = useClub()
  const activa = suscripcion?.activa
  const transferencia = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(
    `Hola, quiero activar el Club Flemin (${config.precio} USD/mes) por transferencia o Deuna. Mi cuenta es ${usuario.correo}`,
  )}`

  return (
    <div className="flex flex-col gap-4">
      <div className={`flex items-center gap-3 p-3.5 ring-1 ${activa ? 'bg-gradient-to-r from-[#3BE0A0]/15 to-transparent ring-[#3BE0A0]/40' : 'bg-white/[0.04] ring-white/10'}`}>
        {activa ? <ShieldCheck size={22} className="shrink-0 text-[#3BE0A0]" /> : <Lock size={20} className="shrink-0 text-white/50" />}
        <div className="min-w-0 flex-1 leading-snug">
          {usuario.nombre && <p className="font-flemin text-[17px] leading-tight">Hola, {usuario.nombre.split(' ')[0]}</p>}
          <p className="truncate text-[13px] text-white/60">{usuario.correo}</p>
          <p className="text-[14.5px] font-semibold">
            {activa
              ? `Socio activo hasta el ${fecha(suscripcion!.vence!)}`
              : suscripcion?.vence
                ? `Tu suscripción venció el ${fecha(suscripcion.vence)}`
                : 'Aún no tienes la suscripción'}
          </p>
        </div>
      </div>

      {activa ? (
        <p className="text-[13px] leading-relaxed text-white/60">
          Abre cualquier modelo con la etiqueta del Club y descarga sus archivos de impresión cuantas veces quieras.
          {suscripcion?.proveedor === 'paypal' && ' Se renueva solo cada mes; puedes cancelarla cuando quieras desde tu cuenta de PayPal.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {config.paypal ? (
            <BotonPayPal usuario={usuario} paypal={config.paypal} />
          ) : (
            <p className="text-[13px] text-white/55">El pago con tarjeta llega pronto. Mientras tanto, actívala por transferencia:</p>
          )}
          <a href={transferencia} target="_blank" rel="noreferrer" className="btn-juego !h-12 w-full !text-[13px]">
            <MessageCircle size={17} /> Pagar por transferencia o Deuna
          </a>
        </div>
      )}

      {usuario.admin && <Admin />}

      <CambiarClave />

      <button type="button" onClick={() => salir()} className="flex items-center justify-center gap-2 self-center font-chakra text-[12px] uppercase tracking-[0.16em] text-white/45 hover:text-white">
        <LogOut size={14} /> Cerrar sesión
      </button>
    </div>
  )
}

declare global {
  interface Window {
    paypal?: {
      Buttons: (o: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void>; close?: () => void }
    }
  }
}

let sdkPayPal: Promise<void> | null = null
const cargarPayPal = (clientId: string) =>
  (sdkPayPal ??= new Promise<void>((ok, mal) => {
    const s = document.createElement('script')
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription&locale=es_EC&currency=USD`
    s.onload = () => ok()
    s.onerror = () => {
      sdkPayPal = null
      mal(new Error('No se pudo cargar PayPal.'))
    }
    document.head.appendChild(s)
  }))

function BotonPayPal({ usuario, paypal }: { usuario: UsuarioClub; paypal: { clientId: string; planId: string } }) {
  const caja = useRef<HTMLDivElement>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'confirmando' | 'error'>('cargando')
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    let botones: { close?: () => void } | undefined
    cargarPayPal(paypal.clientId)
      .then(() => {
        if (!vivo || !caja.current || !window.paypal) return
        const b = window.paypal.Buttons({
          style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'subscribe' },
          // custom_id liga la suscripción a esta cuenta: el Worker lo comprueba con PayPal.
          createSubscription: (_d: unknown, acciones: { subscription: { create: (o: object) => Promise<string> } }) =>
            acciones.subscription.create({ plan_id: paypal.planId, custom_id: usuario.id }),
          onApprove: async (datos: { subscriptionID: string }) => {
            setEstado('confirmando')
            try {
              await confirmarPayPal(datos.subscriptionID)
            } catch (e) {
              setError((e as Error).message)
              setEstado('error')
            }
          },
          onError: () => {
            setError('PayPal no pudo completar el pago. Intenta otra vez o paga por transferencia.')
            setEstado('error')
          },
        })
        botones = b
        return b.render(caja.current).then(() => vivo && setEstado('listo'))
      })
      .catch((e: Error) => {
        if (!vivo) return
        setError(e.message)
        setEstado('error')
      })
    return () => {
      vivo = false
      botones?.close?.()
    }
  }, [paypal.clientId, paypal.planId, usuario.id])

  return (
    <div>
      <div ref={caja} className="min-h-[50px] overflow-hidden rounded bg-white p-2" />
      {estado === 'cargando' && <p className="mt-2 text-[12.5px] text-white/50">Cargando PayPal…</p>}
      {estado === 'confirmando' && <p className="mt-2 text-[12.5px] text-[#FFC23D]">Confirmando tu pago con PayPal…</p>}
      {error && <p className="mt-2 text-[13px] text-[#FF7A6B]">{error}</p>}
      <p className="mt-2 text-[11.5px] text-white/40">Puedes pagar con tu cuenta PayPal o con tarjeta de débito o crédito.</p>
    </div>
  )
}

type Socio = { correo: string; nombre: string | null; perfil: Perfil | null; creado: number; proveedor: string | null; estado: string | null; vence: number | null; descargas: number }

const nombreDe = (lista: readonly { id: string; nombre: string }[], id: string) => lista.find((x) => x.id === id)?.nombre ?? id

/** Cambiar la contraseña (por ejemplo, la provisional que se dio al crear la cuenta). */
function CambiarClave() {
  const [abierto, setAbierto] = useState(false)
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setAviso(null)
    try {
      await pedir('/clave', { actual, nueva })
      setAviso({ ok: true, texto: 'Listo, tu contraseña cambió.' })
      setActual('')
      setNueva('')
    } catch (err) {
      setAviso({ ok: false, texto: (err as Error).message })
    } finally {
      setOcupado(false)
    }
  }

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="flex items-center justify-center gap-2 self-center font-chakra text-[12px] uppercase tracking-[0.16em] text-white/45 hover:text-white">
        <KeyRound size={14} /> Cambiar contraseña
      </button>
    )
  return (
    <form onSubmit={guardar} className="flex flex-col gap-2 border-t border-white/10 pt-4">
      <p className="font-chakra text-[12px] font-bold uppercase tracking-[0.2em] text-white/60">Cambiar contraseña</p>
      <input type="password" required autoComplete="current-password" placeholder="Contraseña actual" value={actual} onChange={(e) => setActual(e.target.value)} className={campo} />
      <input type="password" required minLength={8} autoComplete="new-password" placeholder="Nueva contraseña (mínimo 8)" value={nueva} onChange={(e) => setNueva(e.target.value)} className={campo} />
      {aviso && <p className={`text-[13px] ${aviso.ok ? 'text-[#3BE0A0]' : 'text-[#FF7A6B]'}`}>{aviso.texto}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={ocupado} className="btn-juego btn-fuego flex-1 disabled:opacity-60">
          {ocupado ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="btn-juego">
          Cerrar
        </button>
      </div>
    </form>
  )
}

/** Lo que más piden los socios, para decidir qué personajes subir cada semana. */
function Gustos({ socios }: { socios: Socio[] }) {
  const contar = (lista: readonly { id: string; nombre: string }[], clave: 'universos' | 'impresiones') =>
    lista
      .map((x) => ({ nombre: x.nombre, n: socios.filter((s) => s.perfil?.[clave]?.includes(x.id)).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 5)
  const filas = [
    { titulo: 'Personajes', datos: contar(UNIVERSOS, 'universos') },
    { titulo: 'Impresiones', datos: contar(IMPRESIONES, 'impresiones') },
  ].filter((f) => f.datos.length > 0)
  if (filas.length === 0) return null
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {filas.map((f) => (
        <div key={f.titulo} className="bg-white/[0.04] p-2.5">
          <p className="mb-1 font-chakra text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/50">Lo que más piden · {f.titulo}</p>
          {f.datos.map((d) => (
            <p key={d.nombre} className="flex justify-between text-[12.5px]">
              <span>{d.nombre}</span>
              <span className="tabular-nums text-[#FFC23D]">{d.n}</span>
            </p>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Panel del administrador: activar a mano a quien pagó por transferencia. */
function Admin() {
  const [socios, setSocios] = useState<Socio[]>([])
  const [correo, setCorreo] = useState('')
  const [dias, setDias] = useState(30)
  const [aviso, setAviso] = useState('')
  const cargar = () => pedir<{ socios: Socio[] }>('/admin/socios').then((r) => setSocios(r.socios)).catch((e) => setAviso(e.message))
  useEffect(() => {
    cargar()
  }, [])

  async function activar(e: React.FormEvent, d = dias) {
    e.preventDefault()
    setAviso('')
    try {
      const r = await pedir<{ vence: number }>('/admin/activar', { correo, dias: d })
      setAviso(d > 0 ? `Activado hasta el ${fecha(r.vence)}.` : 'Suscripción cortada.')
      cargar()
    } catch (err) {
      setAviso((err as Error).message)
    }
  }

  const [ahora] = useState(Date.now)
  return (
    <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
      <p className="font-chakra text-[12px] font-bold uppercase tracking-[0.2em] text-[#FFC23D]">Administrador</p>
      <form onSubmit={activar} className="flex flex-col gap-2">
        <input type="email" required placeholder="Correo de la cuenta del cliente" value={correo} onChange={(e) => setCorreo(e.target.value)} className={campo} />
        <div className="flex gap-2">
          <input type="number" min={1} max={3650} value={dias} onChange={(e) => setDias(Number(e.target.value))} className={`${campo} !w-24`} aria-label="Días" />
          <button type="submit" className="btn-juego btn-fuego flex-1">Activar {dias} días</button>
          <button type="button" onClick={(e) => activar(e, -1)} className="btn-juego" title="Cortar la suscripción ya">Cortar</button>
        </div>
        {aviso && <p className="text-[13px] text-white/70">{aviso}</p>}
      </form>
      <Gustos socios={socios} />
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto text-[12.5px]">
        {socios.map((s) => (
          <li key={s.correo} className="bg-white/[0.04] px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${s.vence && s.vence > ahora ? 'bg-[#3BE0A0]' : 'bg-white/25'}`} />
              <button type="button" onClick={() => setCorreo(s.correo)} className="min-w-0 flex-1 truncate text-left hover:text-[#FFC23D]">
                {s.nombre ? `${s.nombre} · ` : ''}
                {s.correo}
              </button>
              <span className="shrink-0 text-white/45">
                {s.vence ? `${s.proveedor} · ${fecha(s.vence)}` : 'sin suscripción'} · {s.descargas} ↓
              </span>
            </div>
            {s.perfil && (
              <p className="mt-0.5 pl-4 text-[11.5px] leading-snug text-white/45">
                {[
                  ...s.perfil.universos.map((id) => nombreDe(UNIVERSOS, id)),
                  ...s.perfil.impresiones.map((id) => nombreDe(IMPRESIONES, id)),
                  s.perfil.impresora && nombreDe(IMPRESORAS, s.perfil.impresora),
                  s.perfil.ciudad,
                  s.perfil.whatsapp && `WhatsApp ${s.perfil.whatsapp}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                {s.perfil.pedido && <span className="block text-[#FFC23D]/80">Quiere: {s.perfil.pedido}</span>}
              </p>
            )}
          </li>
        ))}
        {socios.length === 0 && <li className="text-white/45">Aún no hay cuentas.</li>}
      </ul>
    </div>
  )
}

/** En la ficha: los archivos de impresión del Club de este modelo. */
export function ArchivosClub({ id }: { id: string }) {
  const club = useClub()
  // Se guardan con su id para no enseñar los archivos del modelo anterior al pasar de ficha.
  const [cargados, setCargados] = useState<{ id: string; archivos: ArchivoClub[] } | null>(null)
  const enClub = club.disponible && club.modelos.has(id)
  const archivos = cargados?.id === id ? cargados.archivos : null

  useEffect(() => {
    if (!enClub) return
    let vivo = true
    archivosDe(id)
      .then((a) => vivo && setCargados({ id, archivos: a }))
      .catch(() => vivo && setCargados({ id, archivos: [] }))
    return () => {
      vivo = false
    }
  }, [id, enClub])

  if (!enClub || !archivos || archivos.length === 0) return null
  const activa = club.suscripcion?.activa

  return (
    <div className="corte-sm bg-gradient-to-br from-[#FF6A13]/15 via-[#FF2D8A]/10 to-transparent p-3.5 ring-1 ring-inset ring-[#FFC23D]/35">
      <p className="mb-2 flex items-center gap-2 font-chakra text-[12px] font-bold uppercase tracking-[0.2em] text-[#FFC23D]">
        <Crown size={14} /> Archivos de impresión · Club Flemin
      </p>
      {!activa && <p className="mb-2 text-[12.5px] leading-snug text-white/60">Descárgalos con la suscripción mensual del Club.</p>}
      <ul className="flex flex-col gap-1.5">
        {archivos.map((a) => (
          <li key={a.nombre}>
            {activa ? (
              <a
                href={enlaceDescarga(id, a.nombre)}
                download={a.nombre}
                className="flex items-center gap-2 bg-white/[0.06] px-3 py-2 text-[13.5px] ring-1 ring-inset ring-white/10 transition hover:bg-white/10"
              >
                <Download size={15} className="shrink-0 text-[#3BE0A0]" />
                <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
                <span className="shrink-0 font-mono text-[11px] text-white/45">{megas(a.tamano)}</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => abrirClub('cuenta')}
                className="flex w-full items-center gap-2 bg-white/[0.04] px-3 py-2 text-left text-[13.5px] text-white/70 ring-1 ring-inset ring-white/10 transition hover:bg-white/10"
              >
                <Lock size={14} className="shrink-0 text-white/45" />
                <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
                <span className="shrink-0 font-mono text-[11px] text-white/40">{megas(a.tamano)}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {!activa && (
        <button type="button" onClick={() => abrirClub('cuenta')} className="btn-juego btn-fuego mt-3 w-full">
          <Crown size={15} /> {club.usuario ? 'Activar el Club' : 'Únete al Club'}
        </button>
      )}
    </div>
  )
}
