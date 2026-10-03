import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'

/**
 * El "backend" de la biblioteca, solo en desarrollo.
 *
 * El sitio se publica en GitHub Pages, que es estático: no hay servidor donde
 * subir nada. Así que subir un modelo es un paso local — con `npm run dev`
 * corriendo, el panel de la web escribe el `.glb` en `public/models/subidos/`
 * y la ficha en `src/data/catalogo.json`. Luego un `git push` y el workflow
 * de Pages lo publica. En producción este plugin no existe (`apply: 'serve'`).
 */
const RAIZ = process.cwd()
const CATALOGO = join(RAIZ, 'src/data/catalogo.json')

type Ficha = Record<string, unknown> & { id: string }

async function leerCatalogo(): Promise<Ficha[]> {
  return JSON.parse(await readFile(CATALOGO, 'utf8'))
}

async function guardarCatalogo(c: Ficha[]) {
  await writeFile(CATALOGO, JSON.stringify(c, null, 2) + '\n')
}

function cuerpo(req: IncomingMessage): Promise<Buffer> {
  return new Promise((ok, mal) => {
    const trozos: Buffer[] = []
    req.on('data', (t: Buffer) => trozos.push(t))
    req.on('end', () => ok(Buffer.concat(trozos)))
    req.on('error', mal)
  })
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/*
 * Cada portada reescribe el catálogo, y Vite recargaría la página a mitad de
 * la cola de fotos. Durante un momento tras guardar una portada se ignora el
 * cambio; la web recarga ella sola cuando termina la cola.
 */
let silencioHasta = 0

export function admin(): Plugin {
  return {
    name: 'biblioteca-admin',
    apply: 'serve',
    handleHotUpdate({ file }) {
      if (file === CATALOGO && Date.now() < silencioHasta) return []
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__admin/')) return next()
        const url = new URL(req.url, 'http://x')
        const responder = (estado: number, datos: unknown) => {
          res.statusCode = estado
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(datos))
        }

        try {
          // Sube un .glb nuevo. Los metadatos van en la query para que el
          // cuerpo sea el binario tal cual, sin multipart que parsear.
          if (url.pathname === '/__admin/modelo' && req.method === 'POST') {
            const datos = JSON.parse(url.searchParams.get('ficha') ?? '{}') as Ficha
            const catalogo = await leerCatalogo()
            let id = slug(String(datos.nombre ?? 'modelo')) || 'modelo'
            while (catalogo.some((f) => f.id === id)) id += '-2'
            const glb = await cuerpo(req)
            if (glb.subarray(0, 4).toString() !== 'glTF') return responder(400, { error: 'El archivo no es un .glb válido' })
            await mkdir(join(RAIZ, 'public/models/subidos'), { recursive: true })
            await writeFile(join(RAIZ, 'public/models/subidos', `${id}.glb`), glb)
            const ficha: Ficha = { ...datos, id, archivo: `subidos/${id}.glb`, peso: glb.length, alta: new Date().toISOString().slice(0, 10) }
            catalogo.unshift(ficha)
            await guardarCatalogo(catalogo)
            return responder(200, ficha)
          }

          // Guarda la portada que la propia web renderiza del modelo, y de
          // paso el número de triángulos que contó al cargarlo.
          if (url.pathname === '/__admin/portada' && req.method === 'POST') {
            const id = slug(url.searchParams.get('id') ?? '')
            const catalogo = await leerCatalogo()
            const ficha = catalogo.find((f) => f.id === id)
            if (!ficha) return responder(404, { error: 'No existe' })
            await mkdir(join(RAIZ, 'public/portadas'), { recursive: true })
            await writeFile(join(RAIZ, 'public/portadas', `${id}.webp`), await cuerpo(req))
            ficha.portada = `${id}.webp`
            silencioHasta = Date.now() + 2000
            const tris = Number(url.searchParams.get('triangulos'))
            if (tris > 0) ficha.triangulos = tris
            await guardarCatalogo(catalogo)
            return responder(200, ficha)
          }

          // Edita campos sueltos (precio, nombre, enlace de compra…) o borra
          // la ficha. Borrar quita el modelo del catálogo, no el archivo.
          if (url.pathname === '/__admin/ficha' && (req.method === 'PATCH' || req.method === 'DELETE')) {
            const id = url.searchParams.get('id')
            let catalogo = await leerCatalogo()
            const ficha = catalogo.find((f) => f.id === id)
            if (!ficha) return responder(404, { error: 'No existe' })
            if (req.method === 'DELETE') catalogo = catalogo.filter((f) => f.id !== id)
            else Object.assign(ficha, JSON.parse((await cuerpo(req)).toString()), { id: ficha.id })
            await guardarCatalogo(catalogo)
            return responder(200, { ok: true })
          }

          responder(404, { error: 'Ruta desconocida' })
        } catch (e) {
          responder(500, { error: String(e) })
        }
      })
    },
  }
}
