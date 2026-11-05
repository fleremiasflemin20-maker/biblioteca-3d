/*
 * Lo mínimo de los tipos de Cloudflare que usa el Worker, escrito a mano para
 * no sumar @cloudflare/workers-types al proyecto.
 */

export interface D1Resultado<T> {
  results: T[]
}

export interface D1Sentencia {
  bind(...valores: unknown[]): D1Sentencia
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<D1Resultado<T>>
  run(): Promise<unknown>
}

export interface D1Database {
  prepare(sql: string): D1Sentencia
  batch(sentencias: D1Sentencia[]): Promise<unknown[]>
}

export interface R2Objeto {
  key: string
  size: number
  uploaded: Date
}

export interface R2Cuerpo extends R2Objeto {
  body: ReadableStream
  httpEtag: string
  writeHttpMetadata(h: Headers): void
}

export interface R2Lista {
  objects: R2Objeto[]
  delimitedPrefixes: string[]
  truncated: boolean
  cursor?: string
}

export interface R2Bucket {
  get(clave: string): Promise<R2Cuerpo | null>
  list(opciones: { prefix?: string; delimiter?: string; cursor?: string; limit?: number }): Promise<R2Lista>
}

export interface Fetcher {
  fetch(peticion: Request): Promise<Response>
}

export interface Entorno {
  ASSETS: Fetcher
  DB: D1Database
  ARCHIVOS: R2Bucket
  /** 'sandbox' para pruebas, 'live' para cobrar de verdad. */
  PAYPAL_ENTORNO?: string
  PAYPAL_CLIENT_ID?: string
  PAYPAL_PLAN_ID?: string
  /** Secreto: `npx wrangler secret put PAYPAL_SECRETO`. */
  PAYPAL_SECRETO?: string
  /** Precio que se muestra en la web (el que cobra de verdad es el del plan de PayPal). */
  PRECIO_CLUB?: string
  /** Correos de administrador separados por comas. */
  ADMIN_CORREOS?: string
  WHATSAPP?: string
}
