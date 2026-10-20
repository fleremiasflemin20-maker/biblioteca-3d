import type { NodoEditor } from './estado.ts'

/**
 * La escena se guarda sola en el navegador (IndexedDB, que acepta las mallas
 * tal cual): al volver al editor, sigue donde la dejaste. Si el navegador no
 * deja guardar (modo privado), el editor funciona igual.
 */
const BD = 'flemin-studio'
const ALMACEN = 'escenas'

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BD, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN)
    r.onsuccess = () => ok(r.result)
    r.onerror = () => mal(r.error)
  })
}

/** Las piezas del catálogo no se guardan: son solo de consulta y se vuelven a abrir desde la sala. */
export async function guardarEscena(nodos: NodoEditor[]) {
  try {
    const bd = await abrir()
    bd.transaction(ALMACEN, 'readwrite').objectStore(ALMACEN).put(nodos.filter((n) => !n.protegido), 'actual')
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

export async function leerEscena(): Promise<NodoEditor[] | null> {
  try {
    const bd = await abrir()
    return await new Promise((ok) => {
      const r = bd.transaction(ALMACEN).objectStore(ALMACEN).get('actual')
      r.onsuccess = () => ok(Array.isArray(r.result) ? r.result : null)
      r.onerror = () => ok(null)
    })
  } catch {
    return null
  }
}
