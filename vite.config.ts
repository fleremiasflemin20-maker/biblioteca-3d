import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { admin } from './admin.ts'
import { ocultos } from './ocultos.ts'

/*
 * `base` sale de una variable de entorno, igual que en el portafolio: en
 * GitHub Pages el sitio cuelga de /<repo>/ y no de la raíz del dominio.
 */
export default defineConfig(() => ({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), admin(), ocultos()],
  // 5173 lo usa Gogeta y 5174 el portafolio.
  server: { port: 5175, strictPort: true },
  // Dos páginas: la tienda y las historias de Dragon Ball (personaje/?id=…),
  // que es la plantilla scrollytelling del Gogeta SSJ4 con otro personaje.
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        personaje: resolve(import.meta.dirname, 'personaje/index.html'),
      },
    },
  },
}))
