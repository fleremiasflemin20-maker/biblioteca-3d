import * as THREE from 'three'

/**
 * La rampa de tonos del sombreado cel.
 *
 * `MeshToonMaterial` no calcula bandas por su cuenta: mira la luz que recibe
 * cada punto y **la usa como coordenada** para leer esta textura de un píxel de
 * alto. Es decir, aquí no se define un degradado, se define en cuántos escalones
 * se corta la luz.
 *
 * Dos claves para que se lea como dibujo y no como un degradado a baja
 * resolución:
 *
 * - `NearestFilter`. Sin él, la GPU interpola entre escalones y el corte duro
 *   —lo único que estamos buscando— se convierte otra vez en degradado.
 * - Escalones **desiguales**. Una rampa repartida a partes iguales parece un
 *   error de banding. El anime da mucho sitio a la luz plena, un salto seco a la
 *   sombra media y una sombra profunda muy estrecha.
 */
const ESCALONES = [
  60, // sombra profunda: solo el fondo de los pliegues
  60,
  118, // sombra media: la mayor parte de la zona oscura
  118,
  118,
  255, // luz plena: manda en la figura
  255,
  255,
  255,
]

export function crearRampaToon(): THREE.DataTexture {
  const datos = new Uint8Array(ESCALONES)

  const textura = new THREE.DataTexture(datos, datos.length, 1, THREE.RedFormat)
  textura.minFilter = THREE.NearestFilter
  textura.magFilter = THREE.NearestFilter
  textura.generateMipmaps = false
  textura.needsUpdate = true

  return textura
}
