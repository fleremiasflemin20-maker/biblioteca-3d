/**
 * El proxy de "Foto a 3D" del Taller.
 *
 * La página es pública y estática: si llevara la clave de Meshy, cualquiera
 * podría copiarla y gastar los créditos. Así que la clave vive aquí, en el
 * servidor, y el visitante solo puede hacer tres cosas:
 *
 *   POST /generar        { imagen: "data:image/…;base64,…" } → { id }
 *   GET  /estado/:id     → { estado, progreso, error? }
 *   GET  /modelo/:id     → el .glb, servido por aquí
 *
 * El enlace firmado de Meshy nunca sale del servidor: el visor recibe los
 * bytes para pintarlos, no una URL que se pueda compartir o descargar.
 *
 * Es un manejador de la API Fetch estándar (Request → Response), así que
 * corre igual en el servidor de desarrollo de Vite (ver `vite.ts`), en una
 * función de Netlify (`netlify/functions/taller.mts`) o en un Worker.
 */
export type OpcionesProxy = {
  clave: string
  /** Orígenes que pueden llamar (CORS). Vacío = solo el mismo origen. */
  origenes?: string[]
  /** Generaciones por IP y hora. Meshy cobra cada una. */
  porHora?: number
  /** Tope global por día, para que un abuso no vacíe la cuenta. */
  porDia?: number
  fetch?: typeof fetch
}

const MESHY = 'https://api.meshy.ai/openapi/v1/image-to-3d'
const MAX_IMAGEN = 6 * 1024 * 1024 // bytes del data URI, ya en base64
const ID = /^[A-Za-z0-9-]{8,64}$/
const IMAGEN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/

export function crearManejador(op: OpcionesProxy) {
  const pedir = op.fetch ?? fetch
  const porHora = op.porHora ?? 3
  const porDia = op.porDia ?? 60
  // En memoria: se reinicia con la instancia. Basta para frenar a un curioso
  // insistente; un abuso serio lo para el tope diario y el panel de Meshy.
  const usos = new Map<string, number[]>()
  let dia = { fecha: '', n: 0 }

  const meshy = (ruta: string, init?: RequestInit) =>
    pedir(`${MESHY}${ruta}`, {
      ...init,
      headers: { authorization: `Bearer ${op.clave}`, 'content-type': 'application/json', ...init?.headers },
    })

  return async function manejar(req: Request): Promise<Response> {
    const origen = req.headers.get('origin')
    const permitido = !origen || op.origenes?.includes(origen) || op.origenes?.includes('*')
    const cors: Record<string, string> =
      origen && permitido ? { 'access-control-allow-origin': origen, vary: 'Origin', 'access-control-allow-headers': 'content-type' } : {}
    const json = (estado: number, datos: unknown) =>
      new Response(JSON.stringify(datos), { status: estado, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors } })

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET, POST' } })
    if (!permitido) return json(403, { error: 'Origen no permitido' })
    if (!op.clave) return json(503, { error: 'El generador no está configurado (falta MESHY_API_KEY en el servidor).' })

    const ruta = new URL(req.url).pathname.replace(/\/+$/, '')
    try {
      if (req.method === 'POST' && ruta.endsWith('/generar')) {
        const ip = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local'
        const ahora = Date.now()
        const recientes = (usos.get(ip) ?? []).filter((t) => ahora - t < 3_600_000)
        if (recientes.length >= porHora) {
          const espera = Math.ceil((recientes[0] + 3_600_000 - ahora) / 60_000)
          return json(429, { error: `Has usado tus ${porHora} generaciones de esta hora. Vuelve en ${espera} min.` })
        }
        const hoy = new Date().toISOString().slice(0, 10)
        if (dia.fecha !== hoy) dia = { fecha: hoy, n: 0 }
        if (dia.n >= porDia) return json(429, { error: 'El generador llegó a su límite de hoy. Vuelve mañana.' })

        const texto = await req.text()
        if (texto.length > MAX_IMAGEN + 64) return json(413, { error: 'La imagen es demasiado grande' })
        const { imagen } = JSON.parse(texto) as { imagen?: string }
        if (!imagen || !IMAGEN.test(imagen)) return json(400, { error: 'Envía una imagen PNG, JPG o WebP' })

        const r = await meshy('', {
          method: 'POST',
          body: JSON.stringify({
            image_url: imagen,
            ai_model: 'latest',
            should_texture: true,
            enable_pbr: false,
            should_remesh: true,
            topology: 'triangle',
            target_polycount: 60000,
          }),
        })
        const datos = (await r.json().catch(() => ({}))) as { result?: string; message?: string }
        if (!r.ok || !datos.result) return json(r.status === 402 ? 503 : 502, { error: datos.message ?? `Meshy respondió ${r.status}` })
        recientes.push(ahora)
        usos.set(ip, recientes)
        dia.n++
        return json(200, { id: datos.result })
      }

      const [, accion, id] = ruta.match(/\/(estado|modelo)\/([^/]+)$/) ?? []
      if (req.method === 'GET' && accion && ID.test(id)) {
        const r = await meshy(`/${id}`)
        if (!r.ok) return json(r.status === 404 ? 404 : 502, { error: `Meshy respondió ${r.status}` })
        const tarea = (await r.json()) as { status: string; progress: number; model_urls?: { glb?: string }; task_error?: { message?: string } }

        if (accion === 'estado')
          return json(200, { estado: tarea.status, progreso: tarea.progress ?? 0, error: tarea.task_error?.message || undefined })

        if (tarea.status !== 'SUCCEEDED' || !tarea.model_urls?.glb) return json(409, { error: 'El modelo aún no está listo' })
        const glb = await pedir(tarea.model_urls.glb)
        if (!glb.ok || !glb.body) return json(502, { error: 'No se pudo traer el modelo' })
        return new Response(glb.body, {
          headers: { 'content-type': 'model/gltf-binary', 'cache-control': 'private, max-age=3600', 'content-disposition': 'inline', ...cors },
        })
      }

      return json(404, { error: 'Ruta desconocida' })
    } catch (e) {
      return json(500, { error: e instanceof Error ? e.message : String(e) })
    }
  }
}
