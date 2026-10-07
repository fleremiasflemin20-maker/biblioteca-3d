import { Readable } from 'node:stream'
import type { Plugin } from 'vite'
import { crearManejador } from './taller.ts'

/**
 * El proxy del Taller dentro de `npm run dev`, en /api/taller. La clave se
 * lee de `.env.local` (MESHY_API_KEY=…), que git ignora.
 */
export function tallerDev(clave: string): Plugin {
  const manejar = crearManejador({ clave, porHora: 20 })
  return {
    name: 'taller-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/taller/')) return next()
        const cuerpo = req.method === 'POST' ? (Readable.toWeb(req) as ReadableStream) : undefined
        const r = await manejar(
          new Request(`http://${req.headers.host}${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: cuerpo,
            duplex: 'half',
          } as RequestInit),
        )
        res.statusCode = r.status
        r.headers.forEach((v, k) => res.setHeader(k, v))
        if (r.body) Readable.fromWeb(r.body as import('node:stream/web').ReadableStream).pipe(res)
        else res.end()
      })
    },
  }
}
