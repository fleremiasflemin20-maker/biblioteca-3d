/*
 * Sube los archivos de impresión del Club a R2. Pon cada modelo en una
 * carpeta con el MISMO id que tiene en src/data/catalogo.json:
 *
 *   archivos-club/
 *     organizador-consola/
 *       organizador-consola-base-TPU.stl
 *       organizador-consola.3mf
 *     espadachin-rubio-chibi/
 *       espadachin-rubio-chibi.3mf
 *
 *   npm run club:subir                 → sube todo
 *   npm run club:subir -- espadachin   → solo las carpetas cuyo id contiene "espadachin"
 *
 * La carpeta archivos-club/ no se sube a GitHub (está en .gitignore): los
 * archivos solo viven en R2 y solo los descargan los socios.
 * Un modelo entra al Club en cuanto tiene al menos un archivo subido.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = 'archivos-club'
const BUCKET = 'biblioteca-3d-archivos'
const TIPOS = { stl: 'model/stl', '3mf': 'model/3mf', obj: 'model/obj', glb: 'model/gltf-binary', step: 'model/step', stp: 'model/step', zip: 'application/zip', pdf: 'application/pdf', scad: 'text/plain', png: 'image/png', jpg: 'image/jpeg' }
const filtro = process.argv[2]

if (!existsSync(RAIZ)) {
  console.error(`No existe la carpeta ${RAIZ}/. Créala y pon dentro una carpeta por modelo (con su id del catálogo).`)
  process.exit(1)
}
const ids = new Set(JSON.parse(readFileSync('src/data/catalogo.json', 'utf8')).map((m) => m.id))
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
let subidos = 0

for (const id of readdirSync(RAIZ)) {
  const carpeta = join(RAIZ, id)
  if (!statSync(carpeta).isDirectory() || (filtro && !id.includes(filtro))) continue
  if (!ids.has(id)) {
    console.warn(`⚠ "${id}" no es un id del catálogo; se salta. Revisa el nombre de la carpeta.`)
    continue
  }
  for (const archivo of readdirSync(carpeta)) {
    const ruta = join(carpeta, archivo)
    if (!statSync(ruta).isFile() || archivo.startsWith('.')) continue
    if (!/^[\w][\w .()+-]*\.[A-Za-z0-9]{1,8}$/.test(archivo)) {
      console.warn(`⚠ Renombra "${archivo}": usa solo letras sin tilde, números, espacios, - _ . ( )`)
      continue
    }
    const ext = archivo.split('.').pop().toLowerCase()
    console.log(`↑ ${id}/${archivo} (${(statSync(ruta).size / 1048576).toFixed(1)} MB)`)
    execFileSync(npx, ['wrangler', 'r2', 'object', 'put', `${BUCKET}/modelos/${id}/${archivo}`, '--file', ruta, '--remote', '--content-type', TIPOS[ext] ?? 'application/octet-stream'], { stdio: 'inherit', shell: process.platform === 'win32' })
    subidos++
  }
}
console.log(`\n✔ ${subidos} archivo(s) subidos al Club.`)
