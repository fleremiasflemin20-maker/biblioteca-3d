/**
 * El degradado que hace legible el texto sobre la figura, en vertical.
 *
 * Va **fijo al viewport y no dentro de cada capítulo**, y esa es toda la
 * diferencia. Antes cada sección llevaba el suyo propio a `inset-0`: opaco
 * abajo, transparente arriba. Apiladas, el fondo negro del final de una sección
 * quedaba pegado al transparente del principio de la siguiente, así que en cada
 * frontera había un **corte duro de negro total a nada**.
 *
 * Con seis secciones son cinco cortes barriendo la pantalla al hacer scroll, y
 * cada uno parte la figura en dos con una línea recta. En el móvil eso no se lee
 * como un degradado: se lee como que la página se ha roto. Y cuando el scroll se
 * paraba con una de esas líneas a media altura, ahí se quedaba.
 *
 * Fijo al viewport el degradado no se mueve nunca, así que no hay frontera que
 * cruzar: el texto se apoya siempre en la misma base oscura y la figura nunca
 * aparece cortada.
 *
 * El degradado es idéntico al que había (opaco abajo, 0.85 a media altura,
 * transparente arriba) para no tocar el contraste, que ya estaba medido en
 * 4.5:1.
 *
 * En z-[7] queda por encima de las capas de escena —tramas, onomatopeyas,
 * impactos— y por debajo del relato (z-10), que es el orden que tenía cuando
 * vivía dentro de los capítulos.
 */
export function ScrimMovil() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[7] bg-gradient-to-t from-ink via-ink/85 to-transparent md:hidden"
      aria-hidden="true"
    />
  )
}
