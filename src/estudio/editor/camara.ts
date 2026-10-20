/**
 * Mando de la cámara del editor. El visor (dentro del Canvas) rellena estas
 * funciones; los botones y los atajos (fuera del Canvas) las llaman.
 */
export type Vista = 'iso' | 'frente' | 'arriba' | 'derecha' | 'izquierda' | 'atras'

export const camara = {
  ir: (_v: Vista) => {},
  encuadrar: () => {},
}
