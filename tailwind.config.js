/** @type {import('tailwindcss').Config} */
// Tienda sobria al estilo MakerWorld, en claro u oscuro (negro mate).
//
// Los colores del sitio son variables CSS (ver `index.css`): `hueso` es el
// fondo, `grafito` el texto, `superficie` las tarjetas y `stone` la escala de
// grises. El tema oscuro solo redefine las variables, así que ningún
// componente necesita clases `dark:` para lo básico. `ink`/`paper` son fijos:
// los usan el panel de subida y el modo manos, que son oscuros siempre.
const v = (nombre) => `rgb(var(--${nombre}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0B',
        paper: '#F5F4F1',
        accent: '#0E9F93',
        hueso: v('hueso'),
        grafito: v('grafito'),
        superficie: v('superficie'),
        stone: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700].map((n) => [n, v(`s${n}`)])),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        display: ['Archivo Black', 'Impact', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        display:  ['clamp(3rem, 9vw, 11rem)',    { lineHeight: '0.9',  letterSpacing: '-0.03em' }],
        headline: ['clamp(2rem, 4.5vw, 4rem)',   { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        title:    ['clamp(1.5rem, 2.2vw, 2rem)', { lineHeight: '1.2' }],
        body:     ['1.0625rem',                  { lineHeight: '1.65' }],
        caption:  ['0.75rem',                    { lineHeight: '1.4', letterSpacing: '0.14em' }],
      },
    },
  },
  plugins: [],
}
