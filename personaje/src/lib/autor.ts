/**
 * Quién firma la pieza.
 *
 * ⚠️ RELLENA ESTO. Es lo único de toda la página que no puedo saber por ti, y
 * sin ello la pieza no cumple su función: alguien la ve, le gusta, y no tiene
 * forma de saber de quién es ni cómo encontrarte.
 *
 * El nombre aparece en el plano general y en el cierre; el enlace, en el botón.
 */
export const AUTOR = {
  /**
   * El nombre que firma. El real, no el alias: es el que se lee de un vistazo,
   * el que se recuerda y el que casa con el perfil de LinkedIn al que lleva el
   * botón. Un alias de diecisiete letras no lo retiene nadie.
   */
  nombre: 'Lenin Bonilla',

  /**
   * El alias, tratado como lo que es: un identificador de internet. Va en
   * minúsculas y con arroba porque así se lee como un handle y no como un
   * apellido raro.
   */
  alias: 'fleremahiasflemin',

  /** Cómo te presentas. Dos o tres palabras. */
  rol: 'Ingeniero de software',

  /** Tu perfil completo, con https:// */
  linkedin: 'https://www.linkedin.com/in/fleremahiaslenin',

  /*
   * Enlaces secundarios del cierre. Deja la cadena vacía en cualquiera para que
   * desaparezca de la página: la lista se filtra sola, no hay que tocar el JSX.
   */
  instagram: 'https://www.instagram.com/fleremiasflemin2.0/',
  facebook: 'https://www.facebook.com/fleremiasflemin2.0',
} as const

/**
 * Los secundarios ya listos para pintar, sin los que estén vacíos.
 *
 * LinkedIn no entra aquí: es la llamada principal y va en su propio botón. Estos
 * son el «y además», y por eso van en texto y no en botón — dos botones del
 * mismo peso obligan a elegir y la mitad de la gente no elige ninguno.
 */
export const REDES = [
  { nombre: 'Instagram', url: AUTOR.instagram },
  { nombre: 'Facebook', url: AUTOR.facebook },
].filter((r) => r.url.length > 0)

/** El año que aparece junto a la firma. Se calcula solo. */
export const ANIO = new Date().getFullYear()
