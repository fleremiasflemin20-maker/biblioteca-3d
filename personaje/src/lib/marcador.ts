/**
 * Dónde cae en pantalla el punto de anclaje del botón "cómo se hizo".
 *
 * Lo escribe la escena 3D proyectando un punto del mundo con la cámara de cada
 * frame, y lo lee el DOM. Es la única forma de que un botón HTML se quede
 * pegado a un objeto 3D: en la pantalla no hay "al lado de la figura", hay
 * píxeles, y esos píxeles cambian con la cámara, con el encuadre y con la forma
 * de la ventana.
 *
 * Objeto mutable, como `scroll` y `arrastre`: esto se actualiza 60 veces por
 * segundo y pasarlo por estado de React repintaría el árbol entero cada frame.
 */
export const marcador = {
  /** Píxeles CSS desde el borde izquierdo del viewport. */
  x: 0,
  /** Píxeles CSS desde el borde superior. */
  y: 0,
  /**
   * 0 → escondido, 1 → visible del todo.
   *
   * Se apaga cuando la figura deja de mirar de frente: a partir de ahí la
   * cámara gira y el punto que en el plano general quedaba junto al hombro pasa
   * por detrás del cuerpo, así que el botón se vería flotando sobre la espalda
   * sin señalar nada.
   */
  visible: 0,
}

/**
 * Punto del mundo al que se ancla, en metros. La figura mide 1.90 y pisa y=0.
 *
 * Medido, no estimado: en 1280 px el titular llega hasta x=582 y la figura
 * empieza en x=560. En el hombro izquierdo no cabe nada — la mitad izquierda de
 * la pantalla es del texto. Así que el ancla sube a la altura de la cabeza y se
 * arrima al cuello, que es la única banda libre que queda de ese lado.
 */
export const ANCLA: [number, number, number] = [-0.26, 1.99, 0.12]

/**
 * Los primeros planos de la plantilla están medidos para un Gogeta de
 * proporciones reales. Una figura chibi tiene la cabeza media figura de ancha y
 * a esa distancia la cámara se mete en el pelo, así que para figuras anchas la
 * cámara no se acerca más de esto. Lo fija `useFigura` al medir el modelo.
 */
export const ENCUADRE = { radioMin: 0 }
