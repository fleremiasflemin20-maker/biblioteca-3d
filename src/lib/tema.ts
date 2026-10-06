import { useCallback, useState } from 'react'

/**
 * Tema claro / oscuro (negro mate).
 *
 * La elección se guarda en `localStorage`; sin elección, manda la del
 * sistema. Un script en `index.html` pone la clase `dark` antes de que
 * pinte nada, para que quien tiene el tema oscuro no vea un destello blanco
 * al cargar: este hook solo lee lo que ese script ya decidió.
 */
export type Tema = 'claro' | 'oscuro'

const LLAVE = 'tema'
const COLOR_BARRA: Record<Tema, string> = { claro: '#FAFAF8', oscuro: '#0B0B0C' }

const temaActual = (): Tema => (document.documentElement.classList.contains('dark') ? 'oscuro' : 'claro')

function aplicar(t: Tema) {
  document.documentElement.classList.toggle('dark', t === 'oscuro')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOR_BARRA[t])
  try {
    localStorage.setItem(LLAVE, t)
  } catch {
    /* Modo privado: el tema vale para esta visita. */
  }
}

type ConTransicion = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }

export function useTema() {
  const [tema, setTema] = useState<Tema>(temaActual)

  /**
   * Cambia de tema. Si el navegador tiene View Transitions, el tema nuevo se
   * abre en un círculo que nace del botón; si no, un fundido corto de
   * colores. Con movimiento reducido, cambio directo.
   */
  const alternar = useCallback((origen?: { x: number; y: number }) => {
    const nuevo: Tema = temaActual() === 'oscuro' ? 'claro' : 'oscuro'
    const doc = document as ConTransicion
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (doc.startViewTransition && !quieto) {
      const x = origen?.x ?? window.innerWidth - 40
      const y = origen?.y ?? 32
      const radio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
      const t = doc.startViewTransition(() => {
        aplicar(nuevo)
        setTema(nuevo)
      })
      t.ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`] },
          { duration: 520, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
        )
      })
      return
    }

    const raiz = document.documentElement
    if (!quieto) raiz.classList.add('cambiando-tema')
    aplicar(nuevo)
    setTema(nuevo)
    window.setTimeout(() => raiz.classList.remove('cambiando-tema'), 400)
  }, [])

  return { tema, alternar }
}
