import * as THREE from 'three'

/**
 * Hace que three lea los `data:` URI en memoria, sin pedirlos por red.
 *
 * En el build de un solo archivo la malla va incrustada como `data:` URI, y
 * `GLTFLoader` la carga con `FileLoader`, que por debajo hace un XHR. Una XHR a
 * un `data:` URI parece inofensiva, pero para una Content-Security-Policy es una
 * conexión como cualquier otra: si la política no lista el esquema `data:` en
 * `connect-src`, la petición se bloquea. El `<img>` de las texturas suele estar
 * permitido por `img-src data:`; la XHR casi nunca.
 *
 * Cuando eso pasa, la promesa de `useGLTF` revienta dentro de un `<Suspense>`
 * sin frontera de error, React desmonta el árbol y lo que queda es una página
 * negra sin un solo mensaje.
 *
 * Descodificar el base64 aquí evita la petición entera, así que deja de depender
 * de la política del sitio donde se publique.
 */
export function installDataUriShortcut() {
  const original = THREE.FileLoader.prototype.load

  THREE.FileLoader.prototype.load = function patched(url, onLoad, onProgress, onError) {
    if (typeof url !== 'string' || !url.startsWith('data:')) {
      return original.call(this, url, onLoad, onProgress, onError)
    }

    // itemStart/itemEnd son lo que alimenta a `useProgress`. Sin ellos la
    // pantalla de carga se queda clavada aunque el modelo ya esté en memoria.
    this.manager.itemStart(url)

    try {
      const comma = url.indexOf(',')
      const header = url.slice(5, comma)
      const payload = url.slice(comma + 1)

      let data: ArrayBuffer | string

      if (header.endsWith(';base64')) {
        const binary = atob(payload)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        data = this.responseType === 'arraybuffer' ? bytes.buffer : new TextDecoder().decode(bytes)
      } else {
        data = decodeURIComponent(payload)
      }

      // En microtarea, no en el mismo tick: `onLoad` síncrono rompe a los
      // llamantes que aún no han terminado de montar su propio estado.
      queueMicrotask(() => {
        onLoad?.(data as ArrayBuffer & string)
        this.manager.itemEnd(url)
      })
    } catch (error) {
      this.manager.itemError(url)
      this.manager.itemEnd(url)
      onError?.(error as ErrorEvent)
    }
  }
}
