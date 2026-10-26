import type { Modelo3D } from './catalogo'

/**
 * Flemin Studio 3D: el separador y el editor viven en su propia web (repo
 * aparte). Desde la biblioteca siempre se entra por su portada, para que el
 * cliente vea todo lo que hace antes de abrir una herramienta. Una obra del
 * catálogo viaja por la URL (?modelo=…&nombre=…): la portada la guarda y el
 * Studio la carga al pulsar "Separar mi modelo" o "Abrir el Editor 3D", en
 * modo protegido.
 */
export const STUDIO = 'https://flemin-studio-3d.analista-datos-pro.workers.dev/'

export function enlaceStudio(obra?: Modelo3D) {
  const q = obra?.archivo ? `?${new URLSearchParams({ modelo: obra.archivo, nombre: obra.nombre })}` : ''
  return `${STUDIO}${q}`
}
