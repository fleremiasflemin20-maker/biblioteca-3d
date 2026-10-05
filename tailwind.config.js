/** @type {import('tailwindcss').Config} */
// Tienda clara y sobria (al estilo MakerWorld): fondo hueso, texto grafito y
// un solo acento. `ink`/`paper` se quedan para el panel de subida y el modo
// manos, que siguen siendo oscuros.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0B',
        paper: '#F5F4F1',
        accent: '#0E9F93',
        hueso: '#FAFAF8',
        grafito: '#18181B',
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
