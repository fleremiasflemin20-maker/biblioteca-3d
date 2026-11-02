import gsap from 'gsap'
import { intro } from './intro'

/**
 * La secuencia de entrada: las letras aterrizan, la cámara entra al plano y el
 * contraluz da un golpe.
 *
 * Las tres cosas arrancan a la vez pero duran distinto — las letras 1.2 s, la
 * cámara 2.4 s — y eso es lo que hace que se lea como un movimiento y no como
 * tres animaciones sincronizadas. El golpe de luz cae en el momento en que la
 * primera letra toca su sitio.
 */
export function playHeroIntro() {
  const tl = gsap.timeline({ defaults: { overwrite: 'auto' } })

  tl
    // `back.out` pasa de largo y vuelve: es el rebote de algo que cae y encaja.
    .fromTo(
      '.hero-char',
      { opacity: 0, scale: 1.95, yPercent: -26, rotate: -11 },
      {
        opacity: 1,
        scale: 1,
        yPercent: 0,
        rotate: 0,
        duration: 0.8,
        ease: 'back.out(2.4)',
        // El origen en la base hace que la letra "aterrice" sobre su línea en
        // vez de inflarse desde el centro, y de paso las primeras letras no se
        // salen por el borde izquierdo mientras están a escala grande.
        transformOrigin: '50% 92%',
        stagger: 0.055,
      },
      0,
    )

    // La cámara entra durante todo el rótulo, no después: si esperas a que
    // terminen las letras, la entrada dura el doble y se hace larga.
    .fromTo(intro, { dolly: 2.1 }, { dolly: 0, duration: 2.4, ease: 'power3.out' }, 0)

    // Fogonazo del contraluz al aterrizar la primera letra.
    .to(intro, { flash: 0.9, duration: 0.14, ease: 'none' }, 0.5)
    .to(intro, { flash: 0, duration: 1.3, ease: 'power2.out' }, 0.64)

    .fromTo(
      '.hero-in',
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.12 },
      0.75,
    )

  return tl
}

/** Estado de partida. Sin esto las letras se ven un frame antes de empezar. */
export function armHeroIntro() {
  gsap.set(['.hero-char', '.hero-in'], { opacity: 0 })
}

/** Con `prefers-reduced-motion` no hay entrada: el héroe ya está puesto. */
export function skipHeroIntro() {
  gsap.set(['.hero-char', '.hero-in'], { opacity: 1, scale: 1, y: 0, yPercent: 0, rotate: 0 })
}
