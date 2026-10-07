import { crearManejador } from '../../servidor/taller.ts'

/*
 * El proxy de "Foto a 3D" publicado como función de Netlify. Variables del
 * sitio en Netlify:
 *   MESHY_API_KEY  la clave de Meshy
 *   ORIGENES       quién puede llamar, separado por comas, p. ej.
 *                  https://fleremiasflemin20-maker.github.io
 * Y en GitHub (Settings → Variables → Actions) TALLER_API con la URL de
 * esta función, p. ej. https://<sitio>.netlify.app/api/taller
 */
const manejar = crearManejador({
  clave: process.env.MESHY_API_KEY ?? '',
  origenes: (process.env.ORIGENES ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  porHora: Number(process.env.POR_HORA ?? 3),
  porDia: Number(process.env.POR_DIA ?? 60),
})

export default (req: Request) => manejar(req)

export const config = { path: '/api/taller/*' }
