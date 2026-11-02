/**
 * La música de fondo de la biblioteca. Las pistas viven en `public/musica/`.
 *
 * No son nuestras: cada una lleva su autor y se cita en el reproductor y en
 * los términos del pie de página. Para sumar otra, se copia el `.mp3` a
 * `public/musica/` y se añade aquí.
 */
export type Pista = { titulo: string; obra: string; autor: string; archivo: string }

export const PISTAS: Pista[] = [
  {
    titulo: 'Solid State Scouter',
    obra: 'Dragon Ball Z (banda sonora original)',
    autor: 'Bruce Faulconer',
    archivo: 'solid-state-scouter.mp3',
  },
]

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
export const rutaPista = (p: Pista) => `${BASE}/musica/${p.archivo}`
