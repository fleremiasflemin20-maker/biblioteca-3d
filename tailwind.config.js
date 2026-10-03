/** @type {import('tailwindcss').Config} */
// Mismo sistema que el portafolio: tinta casi negra, papel casi blanco y el
// acento real por variable CSS (cambia con la categoría activa).
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0B',
        paper: '#F5F4F1',
        accent: '#3BE0D0',
      },
      fontFamily: {
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
