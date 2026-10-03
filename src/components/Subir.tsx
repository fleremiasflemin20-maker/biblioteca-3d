import { useState } from 'react'
import { Upload, X } from 'lucide-react'
import { CATEGORIAS, type CategoriaId } from '../lib/catalogo'

/**
 * El panel para subir modelos. Solo existe con `npm run dev`: escribe en el
 * disco a través de `admin.ts`, y después basta un `git push` para publicar.
 *
 * Solo pide lo que la web no puede averiguar sola. Los triángulos, el peso y
 * la portada los saca ella al cargar la pieza.
 */
const FORMATOS = ['GLB', 'FBX', 'OBJ', 'STL', 'BLEND', 'USDZ']

export function Subir({ onCerrar }: { onCerrar: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [encima, setEncima] = useState(false)
  const [estado, setEstado] = useState<'listo' | 'subiendo' | 'error'>('listo')
  const [error, setError] = useState('')
  const [ficha, setFicha] = useState({
    nombre: '',
    categoria: 'personajes' as CategoriaId,
    precio: 10,
    formatos: ['GLB', 'FBX', 'OBJ'],
    descripcion: '',
    compra: '',
    destacado: false,
  })

  const cambiar = <K extends keyof typeof ficha>(k: K, v: (typeof ficha)[K]) => setFicha((f) => ({ ...f, [k]: v }))

  const elegir = (f?: File | null) => {
    if (!f) return
    setArchivo(f)
    if (!ficha.nombre) {
      const nombre = f.name.replace(/\.glb$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
      cambiar('nombre', nombre)
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!archivo) return
    setEstado('subiendo')
    const datos = { ...ficha, compra: ficha.compra || undefined, origen: 'Modelado propio' }
    const r = await fetch(`/__admin/modelo?ficha=${encodeURIComponent(JSON.stringify(datos))}`, { method: 'POST', body: archivo })
    if (!r.ok) {
      setEstado('error')
      setError((await r.json()).error ?? 'No se pudo subir')
      return
    }
    // El catálogo cambió en disco: Vite recarga la página y el fotógrafo de
    // portadas se encarga del resto.
    onCerrar()
  }

  const campo = 'w-full border border-paper/15 bg-ink px-3 py-2.5 font-mono text-sm text-paper outline-none transition-colors focus:border-[var(--tinta)]'
  const etiqueta = 'mb-1.5 block font-mono text-[0.62rem] uppercase tracking-[0.2em] text-paper/45'

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/70 backdrop-blur-sm" onClick={onCerrar}>
      <form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        className="entra flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto border-l border-paper/10 bg-ink p-6"
      >
        <div className="flex items-center justify-between">
          <p className="font-mono text-caption uppercase" style={{ color: 'var(--tinta)' }}>
            Subir modelo
          </p>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-paper/50 hover:text-paper">
            <X size={22} />
          </button>
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault()
            setEncima(true)
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={(e) => {
            e.preventDefault()
            setEncima(false)
            elegir(e.dataTransfer.files[0])
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-4 py-10 text-center transition-colors"
          style={{ borderColor: encima || archivo ? 'var(--tinta)' : '#F5F4F126' }}
        >
          <Upload size={28} className="text-paper/50" />
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-paper/70">
            {archivo ? archivo.name : 'Arrastra el .glb o haz clic'}
          </span>
          {archivo && <span className="font-mono text-[0.62rem] text-paper/40">{(archivo.size / 1048576).toFixed(1)} MB</span>}
          <input type="file" accept=".glb" className="sr-only" onChange={(e) => elegir(e.target.files?.[0])} />
        </label>

        <div>
          <label className={etiqueta} htmlFor="nombre">Nombre</label>
          <input id="nombre" required className={campo} value={ficha.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={etiqueta} htmlFor="categoria">Categoría</label>
            <select id="categoria" className={campo} value={ficha.categoria} onChange={(e) => cambiar('categoria', e.target.value as CategoriaId)}>
              {CATEGORIAS.filter((c) => c.id !== 'todo').map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={etiqueta} htmlFor="precio">Precio (USD)</label>
            <input id="precio" type="number" min={0} step="0.01" required className={campo} value={ficha.precio} onChange={(e) => cambiar('precio', Number(e.target.value))} />
          </div>
        </div>

        <fieldset>
          <legend className={etiqueta}>Formatos que entregas</legend>
          <div className="flex flex-wrap gap-2">
            {FORMATOS.map((f) => {
              const activo = ficha.formatos.includes(f)
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => cambiar('formatos', activo ? ficha.formatos.filter((x) => x !== f) : [...ficha.formatos, f])}
                  className="border px-2.5 py-1 font-mono text-[0.7rem] tracking-[0.12em] transition-colors"
                  style={activo ? { background: 'var(--tinta)', borderColor: 'var(--tinta)', color: '#0A0A0B' } : { borderColor: '#F5F4F126', color: '#F5F4F199' }}
                >
                  {f}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div>
          <label className={etiqueta} htmlFor="descripcion">Descripción</label>
          <textarea id="descripcion" rows={3} className={campo} value={ficha.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} />
        </div>

        <div>
          <label className={etiqueta} htmlFor="compra">Enlace de compra (opcional)</label>
          <input id="compra" type="url" placeholder="https://gumroad.com/…" className={campo} value={ficha.compra} onChange={(e) => cambiar('compra', e.target.value)} />
          <p className="mt-1.5 font-mono text-[0.6rem] text-paper/35">Sin enlace, el botón abre WhatsApp con el pedido escrito.</p>
        </div>

        <label className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.14em] text-paper/70">
          <input type="checkbox" checked={ficha.destacado} onChange={(e) => cambiar('destacado', e.target.checked)} className="accent-[var(--tinta)]" />
          Destacar en la portada
        </label>

        {estado === 'error' && <p className="font-mono text-xs text-[#FF5E5E]">{error}</p>}

        <button type="submit" disabled={!archivo || estado === 'subiendo'} className="boton mt-auto border-2 px-6 py-3.5 font-mono text-caption font-bold uppercase disabled:opacity-40">
          {estado === 'subiendo' ? 'Subiendo…' : 'Añadir a la biblioteca'}
        </button>
      </form>
    </div>
  )
}
