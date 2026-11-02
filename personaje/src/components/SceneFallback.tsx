import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Frontera de error alrededor de la escena.
 *
 * Sin esto, cualquier fallo al cargar la malla o las texturas revienta dentro
 * del `<Suspense>`, React desmonta el árbol entero y la página se queda **negra
 * y muda**: ni escena, ni texto, ni pista de qué ha pasado. Diagnosticar eso
 * desde fuera —en un móvil ajeno, o en un sitio publicado al que no tienes
 * consola— es imposible.
 *
 * Con la frontera, el relato sigue en pie y el fallo se cuenta en pantalla.
 */
export class SceneFallback extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[escena 3D] no se pudo montar:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="pointer-events-none fixed inset-0 z-0 flex items-end justify-center p-8">
        <p className="max-w-md text-center text-caption uppercase leading-relaxed text-paper/40">
          La escena 3D no ha podido cargarse en este navegador.
          <br />
          <span className="text-paper/25">{this.state.error.message}</span>
        </p>
      </div>
    )
  }
}
