import { useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Heart, Lock, Mail, MapPin, MessageCircle, Printer, Sparkles, User } from 'lucide-react'
import { crearCuenta, entrar, useClub } from '../lib/club'
import { IMPRESIONES, IMPRESORAS, NIVELES, UNIVERSOS, USOS, type Perfil } from '../../worker/perfil.ts'

/**
 * Registro e inicio de sesión del Club. El registro va en tres pasos cortos:
 * tus datos, qué te gusta imprimir y con qué imprimes. Así el Club sabe qué
 * personajes subir primero y el cliente siente que se le escucha.
 */

const campo =
  'w-full bg-white/[0.07] py-3 pl-11 pr-3.5 font-chakra text-[14.5px] text-white outline-none ring-1 ring-inset ring-white/15 transition placeholder:text-white/35 focus:bg-white/[0.1] focus:ring-[#FFC23D]/70'
const rotulo = 'mb-1.5 block font-chakra text-[11px] font-bold uppercase tracking-[0.2em] text-white/55'

function Campo({ icono, children }: { icono: ReactNode; children: ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">{icono}</span>
      {children}
    </div>
  )
}

function Clave({ valor, cambiar, nueva }: { valor: string; cambiar: (v: string) => void; nueva: boolean }) {
  const [ver, setVer] = useState(false)
  return (
    <Campo icono={<Lock size={17} />}>
      <input
        type={ver ? 'text' : 'password'}
        required
        minLength={8}
        autoComplete={nueva ? 'new-password' : 'current-password'}
        placeholder={nueva ? 'Crea una contraseña (mínimo 8)' : 'Tu contraseña'}
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        className={`${campo} !pr-11`}
      />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? 'Ocultar contraseña' : 'Ver contraseña'}
        className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-white/45 hover:text-white"
      >
        {ver ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </Campo>
  )
}

/** 0 a 3 según largo y variedad: solo para orientar, el servidor exige 8 caracteres. */
function fuerza(c: string) {
  if (c.length < 8) return 0
  let n = 1
  if (c.length >= 12) n++
  if (/\d/.test(c) && /[a-zA-Z]/.test(c) && (/[^\w]/.test(c) || /[A-Z]/.test(c))) n++
  return n
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium ring-1 ring-inset transition ${
        activo ? 'bg-gradient-to-r from-[#FF6A13]/35 to-[#FF2D8A]/25 text-white ring-[#FFC23D]/70' : 'bg-white/[0.04] text-white/70 ring-white/12 hover:bg-white/[0.08] hover:text-white'
      }`}
    >
      {activo && <Check size={14} className="text-[#FFC23D]" />}
      {children}
    </button>
  )
}

const PASOS = [
  { titulo: 'Tus datos', icono: User },
  { titulo: 'Tus gustos', icono: Heart },
  { titulo: 'Tu taller', icono: Printer },
]

const PERFIL_VACIO: Perfil = { universos: [], impresiones: [], novedades: true }

export function Acceso() {
  const [modo, setModo] = useState<'crear' | 'entrar'>('crear')
  return modo === 'crear' ? <Registro alEntrar={() => setModo('entrar')} /> : <Entrar alCrear={() => setModo('crear')} />
}

function Registro({ alEntrar }: { alEntrar: () => void }) {
  const [paso, setPaso] = useState(0)
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [perfil, setPerfil] = useState<Perfil>(PERFIL_VACIO)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  const cambiar = <K extends keyof Perfil>(k: K, v: Perfil[K]) => setPerfil((p) => ({ ...p, [k]: v }))
  const alternar = (k: 'universos' | 'impresiones', id: string) =>
    setPerfil((p) => ({ ...p, [k]: p[k].includes(id) ? p[k].filter((x) => x !== id) : [...p[k], id] }))
  const f = fuerza(clave)
  const primerNombre = nombre.trim().split(/\s+/)[0]

  async function siguiente(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (paso < 2) return setPaso(paso + 1)
    setOcupado(true)
    try {
      await crearCuenta({ correo, clave, nombre, perfil })
    } catch (err) {
      setError((err as Error).message)
      // Si el problema está en los datos del primer paso, se vuelve allí.
      if (/correo|contraseña|llamas|cuenta/i.test((err as Error).message)) setPaso(0)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form onSubmit={siguiente} className="flex flex-col gap-4">
      {/* Progreso: tres pasos cortos para que no se sienta como un trámite. */}
      <ol className="grid grid-cols-3 gap-2">
        {PASOS.map((p, i) => {
          const Icono = p.icono
          const hecho = i < paso
          const actual = i === paso
          return (
            <li key={p.titulo}>
              <button
                type="button"
                disabled={i > paso}
                onClick={() => setPaso(i)}
                className="flex w-full flex-col items-start gap-1.5 text-left disabled:cursor-default"
              >
                <span className={`h-1.5 w-full transition ${hecho || actual ? 'bg-gradient-to-r from-[#FF6A13] to-[#FFC23D]' : 'bg-white/10'}`} />
                <span className={`flex items-center gap-1.5 font-chakra text-[11px] font-bold uppercase tracking-[0.14em] ${actual ? 'text-white' : hecho ? 'text-[#FFC23D]' : 'text-white/35'}`}>
                  {hecho ? <Check size={13} /> : <Icono size={13} />} {p.titulo}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {paso === 0 && (
        <div className="entra flex flex-col gap-3">
          <div>
            <p className="font-flemin text-xl leading-tight">Bienvenido al Club</p>
            <p className="mt-1 text-[13.5px] leading-snug text-white/60">Crea tu cuenta en un minuto. Después eliges cómo pagar.</p>
          </div>
          <Campo icono={<User size={17} />}>
            <input required maxLength={60} autoComplete="name" placeholder="¿Cómo te llamas?" value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} />
          </Campo>
          <Campo icono={<Mail size={17} />}>
            <input type="email" required autoComplete="email" placeholder="Tu correo" value={correo} onChange={(e) => setCorreo(e.target.value)} className={campo} />
          </Campo>
          <div>
            <Clave valor={clave} cambiar={setClave} nueva />
            <div className="mt-2 flex items-center gap-2">
              <div className="grid flex-1 grid-cols-3 gap-1">
                {[1, 2, 3].map((n) => (
                  <span key={n} className={`h-1 ${f >= n ? (f === 1 ? 'bg-[#FFC23D]' : 'bg-[#3BE0A0]') : 'bg-white/10'}`} />
                ))}
              </div>
              <span className="w-24 text-right font-chakra text-[11px] uppercase tracking-[0.12em] text-white/45">
                {clave.length === 0 ? '' : f === 0 ? `Faltan ${8 - clave.length}` : f === 1 ? 'Aceptable' : f === 2 ? 'Buena' : 'Muy segura'}
              </span>
            </div>
          </div>
        </div>
      )}

      {paso === 1 && (
        <div className="entra flex flex-col gap-4">
          <div>
            <p className="font-flemin text-xl leading-tight">{primerNombre ? `${primerNombre}, ¿qué te gusta?` : '¿Qué te gusta?'}</p>
            <p className="mt-1 text-[13.5px] leading-snug text-white/60">Con tus respuestas elegimos los personajes que subimos cada semana.</p>
          </div>
          <div>
            <span className={rotulo}>Personajes y universos</span>
            <div className="flex flex-wrap gap-1.5">
              {UNIVERSOS.map((u) => (
                <Chip key={u.id} activo={perfil.universos.includes(u.id)} onClick={() => alternar('universos', u.id)}>
                  {u.nombre}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <span className={rotulo}>¿Qué quieres imprimir?</span>
            <div className="flex flex-wrap gap-1.5">
              {IMPRESIONES.map((u) => (
                <Chip key={u.id} activo={perfil.impresiones.includes(u.id)} onClick={() => alternar('impresiones', u.id)}>
                  {u.nombre}
                </Chip>
              ))}
            </div>
          </div>
          <label>
            <span className={rotulo}>¿Qué personaje te gustaría ver en la Biblioteca?</span>
            <Campo icono={<Sparkles size={17} />}>
              <input maxLength={200} placeholder="Ej.: Vegeta Super Saiyan Blue, Hollow Knight…" value={perfil.pedido ?? ''} onChange={(e) => cambiar('pedido', e.target.value)} className={campo} />
            </Campo>
          </label>
        </div>
      )}

      {paso === 2 && (
        <div className="entra flex flex-col gap-4">
          <div>
            <p className="font-flemin text-xl leading-tight">Tu taller</p>
            <p className="mt-1 text-[13.5px] leading-snug text-white/60">Así preparamos los archivos para tu máquina: piezas separadas, colores y soportes.</p>
          </div>
          <div>
            <span className={rotulo}>¿Con qué imprimes?</span>
            <div className="grid grid-cols-2 gap-1.5">
              {IMPRESORAS.map((m) => {
                const activo = perfil.impresora === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => cambiar('impresora', activo ? undefined : m.id)}
                    className={`p-3 text-left ring-1 ring-inset transition ${activo ? 'bg-gradient-to-br from-[#FF6A13]/30 to-[#FF2D8A]/15 ring-[#FFC23D]/70' : 'bg-white/[0.04] ring-white/12 hover:bg-white/[0.08]'}`}
                  >
                    <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                      {activo && <Check size={14} className="text-[#FFC23D]" />}
                      {m.nombre}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-white/50">{m.detalle}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Segmento titulo="Tu experiencia" opciones={NIVELES} valor={perfil.nivel} cambiar={(v) => cambiar('nivel', v)} />
            <Segmento titulo="Imprimes para" opciones={USOS} valor={perfil.uso} cambiar={(v) => cambiar('uso', v)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo icono={<MessageCircle size={17} />}>
              <input type="tel" maxLength={20} autoComplete="tel" placeholder="WhatsApp (opcional)" value={perfil.whatsapp ?? ''} onChange={(e) => cambiar('whatsapp', e.target.value)} className={campo} />
            </Campo>
            <Campo icono={<MapPin size={17} />}>
              <input maxLength={60} autoComplete="address-level2" placeholder="Ciudad (opcional)" value={perfil.ciudad ?? ''} onChange={(e) => cambiar('ciudad', e.target.value)} className={campo} />
            </Campo>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-white/70">
            <input type="checkbox" checked={perfil.novedades} onChange={(e) => cambiar('novedades', e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#FF6A13]" />
            Avísame cuando suban personajes nuevos de lo que me gusta.
          </label>
        </div>
      )}

      {error && <p className="text-[13px] text-[#FF7A6B]">{error}</p>}

      <div className="flex gap-2">
        {paso > 0 && (
          <button type="button" onClick={() => setPaso(paso - 1)} className="btn-juego !h-12 !px-4" aria-label="Atrás">
            <ArrowLeft size={17} />
          </button>
        )}
        <button type="submit" disabled={ocupado} className="btn-juego btn-fuego !h-12 flex-1 !text-[14px] disabled:opacity-60">
          {ocupado ? 'Creando tu cuenta…' : paso < 2 ? (
            <>
              Continuar <ArrowRight size={17} />
            </>
          ) : (
            'Crear mi cuenta'
          )}
        </button>
      </div>
      {paso > 0 && paso < 2 && (
        <button type="button" onClick={() => setPaso(2)} className="-mt-1 self-center font-chakra text-[11.5px] uppercase tracking-[0.16em] text-white/40 hover:text-white">
          Saltar este paso
        </button>
      )}

      <p className="border-t border-white/10 pt-3 text-center text-[13px] text-white/55">
        ¿Ya eres parte del Club?{' '}
        <button type="button" onClick={alEntrar} className="font-semibold text-[#FFC23D] underline-offset-4 hover:underline">
          Inicia sesión
        </button>
      </p>
    </form>
  )
}

function Segmento({ titulo, opciones, valor, cambiar }: { titulo: string; opciones: readonly { id: string; nombre: string }[]; valor?: string; cambiar: (v?: string) => void }) {
  return (
    <div>
      <span className={rotulo}>{titulo}</span>
      <div className="flex flex-col gap-1">
        {opciones.map((o) => (
          <Chip key={o.id} activo={valor === o.id} onClick={() => cambiar(valor === o.id ? undefined : o.id)}>
            {o.nombre}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Entrar({ alCrear }: { alCrear: () => void }) {
  const { config } = useClub()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const ayuda = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(`Hola, olvidé mi contraseña del Club Flemin. Mi correo es ${correo || '…'}`)}`

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setError('')
    try {
      await entrar(correo, clave)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form onSubmit={enviar} className="entra flex flex-col gap-3">
      <div>
        <p className="font-flemin text-xl leading-tight">Qué bueno verte de nuevo</p>
        <p className="mt-1 text-[13.5px] leading-snug text-white/60">Entra y sigue descargando lo nuevo de la semana.</p>
      </div>
      <Campo icono={<Mail size={17} />}>
        <input type="email" required autoComplete="email" placeholder="Tu correo" value={correo} onChange={(e) => setCorreo(e.target.value)} className={campo} />
      </Campo>
      <Clave valor={clave} cambiar={setClave} nueva={false} />
      <a href={ayuda} target="_blank" rel="noreferrer" className="-mt-1 self-end text-[12.5px] text-white/50 underline-offset-4 hover:text-[#FFC23D] hover:underline">
        ¿Olvidaste tu contraseña?
      </a>
      {error && <p className="text-[13px] text-[#FF7A6B]">{error}</p>}
      <button type="submit" disabled={ocupado} className="btn-juego btn-fuego !h-12 w-full !text-[14px] disabled:opacity-60">
        {ocupado ? 'Entrando…' : 'Entrar al Club'}
      </button>
      <p className="border-t border-white/10 pt-3 text-center text-[13px] text-white/55">
        ¿Nuevo aquí?{' '}
        <button type="button" onClick={alCrear} className="font-semibold text-[#FFC23D] underline-offset-4 hover:underline">
          Crea tu cuenta
        </button>
      </p>
    </form>
  )
}
