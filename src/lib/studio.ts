import type { Modelo3D } from './catalogo'

/**
 * Flemin Studio 3D: el separador y el editor viven en su propia web (repo
 * aparte). Desde la biblioteca se abren con un enlace; una obra del catálogo
 * viaja por la URL y el Studio la carga desde aquí, en modo protegido.
 */
export const STUDIO = 'https://flemin-studio-3d.analista-datos-pro.workers.dev/'

export function enlaceStudio(vista: 'separador' | 'editor' | 'inicio' = 'inicio', obra?: Modelo3D) {
  const q = obra?.archivo ? `?${new URLSearchParams({ modelo: obra.archivo, nombre: obra.nombre })}` : ''
  return `${STUDIO}${q}${vista === 'inicio' ? '' : `#${vista}`}`
}
