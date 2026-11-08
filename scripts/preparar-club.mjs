/*
 * Prepara Cloudflare para el Club Flemin. Se corre UNA vez, desde la carpeta
 * del proyecto, con la sesión de wrangler ya iniciada:
 *
 *   npm run club:preparar
 *
 * 1. Crea la base de datos D1 "biblioteca-3d-club" y escribe su id en wrangler.jsonc.
 * 2. Crea el almacén R2 "biblioteca-3d-archivos" (privado: nadie lo ve sin el Worker).
 * 3. Crea las tablas (migrations/).
 *
 * Si algo ya existe, lo deja como está y sigue.
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const CONFIG = 'wrangler.jsonc'
const correr = (cmd) => execSync(`npx wrangler ${cmd}`, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] })

let config = readFileSync(CONFIG, 'utf8')
if (config.includes('PENDIENTE-npm-run-club-preparar')) {
  let id
  try {
    const salida = correr('d1 create biblioteca-3d-club')
    id = salida.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0]
  } catch (e) {
    // Ya existía: se busca su id en la lista.
    const lista = JSON.parse(correr('d1 list --json'))
    id = lista.find((d) => d.name === 'biblioteca-3d-club')?.uuid
    if (!id) throw e
  }
  if (!id) throw new Error('No se pudo leer el id de la base de datos D1.')
  config = config.replace('PENDIENTE-npm-run-club-preparar', id)
  writeFileSync(CONFIG, config)
  console.log(`✔ Base de datos D1 lista (${id}). Guarda el cambio de wrangler.jsonc con git.`)
} else {
  console.log('✔ La base de datos D1 ya estaba configurada.')
}

try {
  correr('r2 bucket create biblioteca-3d-archivos')
  console.log('✔ Almacén R2 "biblioteca-3d-archivos" creado.')
} catch (e) {
  const texto = `${e.stdout ?? ''}${e.stderr ?? ''}`
  if (/already exists|ya existe|10004/i.test(texto)) console.log('✔ El almacén R2 ya existía.')
  else {
    console.error(texto)
    console.error('✘ No se pudo crear R2. Si dice que R2 no está activado, actívalo en dash.cloudflare.com → R2 y vuelve a correr esto.')
    process.exit(1)
  }
}

execSync('npx wrangler d1 migrations apply biblioteca-3d-club --remote', { stdio: 'inherit' })
console.log('\n✔ Listo. Ahora: npm run desplegar')
