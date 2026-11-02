import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

/*
 * Las fichas con `"oculto": true` no salen en la web (ver `CATALOGO` en
 * src/lib/catalogo.ts). Vite copia `public/` entero a `dist/`, así que sin
 * esto sus `.glb` y portadas seguirían publicados y se podrían abrir por URL
 * directa. Tras compilar, se borran de `dist/` (nunca de `public/`), salvo
 * los que también use una ficha visible.
 */
type Ficha = {
  archivo: string
  portada?: string
  oculto?: boolean
  documentos?: { archivo: string }[]
  texturas?: { carpeta: string }
}

const rutas = (m: Ficha) => [
  `models/${m.archivo}`,
  ...(m.portada ? [`portadas/${m.portada}`] : []),
  ...(m.documentos ?? []).map((d) => `descargas/${d.archivo}`),
  ...(m.texturas ? [`textures/${m.texturas.carpeta}`] : []),
]

export function ocultos(): Plugin {
  let salida = 'dist'
  return {
    name: 'ocultos',
    apply: 'build',
    configResolved(c) {
      salida = c.build.outDir
    },
    closeBundle() {
      const fichas: Ficha[] = JSON.parse(readFileSync(join(import.meta.dirname, 'src/data/catalogo.json'), 'utf8'))
      const visibles = new Set(fichas.filter((m) => !m.oculto).flatMap(rutas))
      for (const ruta of fichas.filter((m) => m.oculto).flatMap(rutas)) {
        const destino = join(salida, ruta)
        if (!visibles.has(ruta) && existsSync(destino)) rmSync(destino, { recursive: true })
      }
    },
  }
}
