/**
 * Lector ZIP mínimo, lo justo para abrir un 3MF: directorio central (con
 * ZIP64, que Bambu Studio usa en proyectos grandes) y entradas guardadas o
 * comprimidas con deflate. Descomprime el propio navegador
 * (`DecompressionStream`), y solo cuando se pide cada archivo.
 */
export type Zip = Map<string, () => Promise<Uint8Array>>

export function leerZip(datos: Uint8Array): Zip {
  const dv = new DataView(datos.buffer, datos.byteOffset, datos.byteLength)
  let fin = -1
  for (let i = datos.length - 22; i >= Math.max(0, datos.length - 65557); i--)
    if (dv.getUint32(i, true) === 0x06054b50) {
      fin = i
      break
    }
  if (fin < 0) throw new Error('No es un archivo ZIP/3MF válido')

  let total = dv.getUint16(fin + 10, true)
  let inicio = dv.getUint32(fin + 16, true)
  if (inicio === 0xffffffff || total === 0xffff) {
    const loc = fin - 20
    if (loc < 0 || dv.getUint32(loc, true) !== 0x07064b50) throw new Error('ZIP64 sin localizador')
    const z64 = Number(dv.getBigUint64(loc + 8, true))
    total = Number(dv.getBigUint64(z64 + 32, true))
    inicio = Number(dv.getBigUint64(z64 + 48, true))
  }

  const salida: Zip = new Map()
  const texto = new TextDecoder()
  let p = inicio
  for (let k = 0; k < total; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Directorio ZIP dañado')
    const metodo = dv.getUint16(p + 10, true)
    let comprimido = dv.getUint32(p + 20, true)
    const nNombre = dv.getUint16(p + 28, true), nExtra = dv.getUint16(p + 30, true), nComentario = dv.getUint16(p + 32, true)
    let local = dv.getUint32(p + 42, true)
    const nombre = texto.decode(datos.subarray(p + 46, p + 46 + nNombre))

    // Campo extra ZIP64: los tamaños que valen 0xFFFFFFFF vienen aquí, en orden.
    const tamOriginal = dv.getUint32(p + 24, true)
    for (let e = p + 46 + nNombre; e < p + 46 + nNombre + nExtra; ) {
      const id = dv.getUint16(e, true), largo = dv.getUint16(e + 2, true)
      if (id === 0x0001) {
        let q = e + 4
        if (tamOriginal === 0xffffffff) q += 8
        if (comprimido === 0xffffffff) {
          comprimido = Number(dv.getBigUint64(q, true))
          q += 8
        }
        if (local === 0xffffffff) local = Number(dv.getBigUint64(q, true))
      }
      e += 4 + largo
    }
    p += 46 + nNombre + nExtra + nComentario

    const datosEn = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true)
    const bruto = datos.subarray(datosEn, datosEn + comprimido)
    if (nombre.endsWith('/')) continue
    salida.set(nombre, async () => {
      if (metodo === 0) return bruto
      if (metodo !== 8) throw new Error(`Compresión ZIP no soportada (${metodo}) en ${nombre}`)
      const flujo = new Blob([bruto as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      return new Uint8Array(await new Response(flujo).arrayBuffer())
    })
  }
  return salida
}
