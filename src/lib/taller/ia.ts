/**
 * "Foto a 3D": el visitante sube una foto y la ve convertida en modelo.
 *
 * Habla con el proxy de `servidor/taller.ts`, nunca con Meshy directamente:
 * la clave no puede viajar en una página pública. En desarrollo el proxy
 * está en el propio Vite; en producción, donde diga VITE_TALLER_API. Sin esa
 * variable el generador se enseña como "próximamente".
 */
const API = (import.meta.env.VITE_TALLER_API as string | undefined) ?? (import.meta.env.DEV ? '/api/taller' : '')

export const iaDisponible = !!API

export type Estado = { estado: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED'; progreso: number; error?: string }

async function api<T>(ruta: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${ruta}`, init)
  if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? `Error ${r.status}`)
  return r.json() as Promise<T>
}

/** Reduce la foto a 1024 px como mucho y la pasa a JPEG: sube rápido y Meshy no necesita más. */
export async function prepararFoto(f: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(f.type)) throw new Error('Usa una foto PNG, JPG o WebP')
  const img = await createImageBitmap(f)
  const k = Math.min(1, 1024 / Math.max(img.width, img.height))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(img.width * k)
  lienzo.height = Math.round(img.height * k)
  const ctx = lienzo.getContext('2d')!
  ctx.fillStyle = '#fff' // las transparencias de un PNG, en blanco y no en negro
  ctx.fillRect(0, 0, lienzo.width, lienzo.height)
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height)
  img.close()
  return lienzo.toDataURL('image/jpeg', 0.9)
}

const pausa = (ms: number, señal?: AbortSignal) =>
  new Promise<void>((ok, mal) => {
    const t = setTimeout(ok, ms)
    señal?.addEventListener('abort', () => (clearTimeout(t), mal(new DOMException('Cancelado', 'AbortError'))), { once: true })
  })

/**
 * Pide el modelo y espera a que esté. Devuelve el .glb en memoria: se pinta
 * en el visor y no existe ningún enlace para descargarlo.
 */
export async function fotoA3D(imagen: string, alProgreso: (e: Estado) => void, señal?: AbortSignal): Promise<ArrayBuffer> {
  const { id } = await api<{ id: string }>('/generar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imagen }),
    signal: señal,
  })
  for (let fallos = 0; ; ) {
    await pausa(3000, señal)
    let e: Estado
    try {
      e = await api<Estado>(`/estado/${id}`, { signal: señal })
      fallos = 0
    } catch (err) {
      // Un corte de red puntual no tira una generación de un minuto.
      if (señal?.aborted || ++fallos > 4) throw err
      continue
    }
    alProgreso(e)
    if (e.estado === 'SUCCEEDED') break
    if (e.estado === 'FAILED' || e.estado === 'CANCELED') throw new Error(e.error || 'Meshy no pudo generar el modelo con esta foto')
  }
  const r = await fetch(`${API}/modelo/${id}`, { signal: señal })
  if (!r.ok) throw new Error('No se pudo traer el modelo generado')
  return r.arrayBuffer()
}
