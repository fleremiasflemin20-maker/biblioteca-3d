import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { installDataUriShortcut } from './lib/data-uri-loader'
import App from './App.tsx'
import { ELEGIDA } from './lib/figura'

// El título de la pestaña: el personaje y la figura que se eligieron.
if (ELEGIDA) document.title = `${ELEGIDA.personaje.titulo.join(' ')} · ${ELEGIDA.modelo.nombre} · Biblioteca 3D`

// Antes de que se monte nada: three tiene que poder leer los `data:` URI en
// memoria, o el build de un solo archivo depende de la CSP del alojamiento.
installDataUriShortcut()

// Al recargar, el navegador restaura el scroll anterior y la película arranca
// por la mitad, con la cámara dentro del modelo. La experiencia empieza en 0.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
