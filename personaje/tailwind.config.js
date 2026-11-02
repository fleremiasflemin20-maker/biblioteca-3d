/** @type {import('tailwindcss').Config} */
export default {
  // Rutas relativas a este archivo: la biblioteca tiene su propio Tailwind en
  // la raíz, y esta página usa el del Gogeta (ver `@config` en src/index.css).
  content: { relative: true, files: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'] },
  theme: {
    extend: {
      colors: {
        // Ni negro ni blanco puros: ver references/direccion-arte.md
        ink: '#0A0A0B',
        paper: '#F5F4F1',
        // Los dos colores del logo original: el amarillo de "DRAGON BALL" y el
        // rojo de la "Z". No se añade ninguno más.
        accent: '#E4002B',
        saiyan: '#FFDE00',
      },
      fontFamily: {
        display: ['Anton', 'Impact', '"Arial Narrow Bold"', 'sans-serif'],
      },
      fontSize: {
        display:  ['clamp(3.5rem, 13vw, 13rem)',  { lineHeight: '0.86', letterSpacing: '-0.02em' }],
        headline: ['clamp(2.25rem, 6vw, 5.5rem)', { lineHeight: '0.95', letterSpacing: '-0.015em' }],
        title:    ['clamp(1.5rem, 2.2vw, 2rem)',  { lineHeight: '1.2' }],
        body:     ['1.0625rem',                   { lineHeight: '1.65' }],
        caption:  ['0.75rem',                     { lineHeight: '1.4', letterSpacing: '0.16em' }],
      },
    },
  },
  plugins: [],
}
