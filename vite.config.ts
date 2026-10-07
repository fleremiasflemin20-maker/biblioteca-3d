import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { admin } from './admin.ts'
import { tallerDev } from './servidor/vite.ts'

/*
 * `base` sale de una variable de entorno, igual que en el portafolio: en
 * GitHub Pages el sitio cuelga de /<repo>/ y no de la raíz del dominio.
 */
export default defineConfig(({ mode }) => ({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), admin(), tallerDev(loadEnv(mode, process.cwd(), '').MESHY_API_KEY ?? '')],
  // 5173 lo usa Gogeta y 5174 el portafolio.
  server: { port: 5175, strictPort: true },
}))
