import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { TAPAS } from '../lib/comic'

/**
 * El fondo de la pantalla de título: un montón de cómics y mangas revueltos
 * sobre la mesa, con NUESTRAS figuras en las tapas. Caen uno a uno al entrar,
 * flotan un poco, se mueven en capas con el ratón (paralaje) y cada par de
 * segundos uno salta encima de la pila, como si alguien rebuscara.
 */
type Colocada = { k: number; url: string; x: number; y: number; r: number; z: number; capa: number; d: number }

function colocar(ancho: number, alto: number): { tapas: Colocada[]; cw: number } {
  // Tamaño de tapa: más grandes en pantallas grandes, sin pasar de 280px.
  const cw = Math.max(120, Math.min(280, Math.min(ancho, alto * 1.3) * 0.2))
  const ch = cw * 1.5
  const pasoX = cw * 0.72
  const pasoY = ch * 0.6
  const cols = Math.ceil(ancho / pasoX) + 1
  const filas = Math.ceil(alto / pasoY) + 1
  const orden = [...TAPAS].sort(() => Math.random() - 0.5)
  const tapas: Colocada[] = []
  let n = 0
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      const t = orden[n % orden.length]
      const x = (c + (f % 2) * 0.5 - 0.25) * pasoX + (Math.random() - 0.5) * cw * 0.45
      const y = (f - 0.2) * pasoY + (Math.random() - 0.5) * ch * 0.3
      tapas.push({ k: n, url: t.url, x, y, r: (Math.random() - 0.5) * 56, z: Math.floor(Math.random() * 30), capa: n % 3, d: 0 })
      n++
    }
  }
  // Caen en orden de abajo hacia arriba de la pila: primero las del fondo.
  tapas.sort((a, b) => a.z - b.z).forEach((t, i) => (t.d = 120 + i * Math.min(45, 2200 / tapas.length)))
  return { tapas, cw }
}

export function PilaComics() {
  const raiz = useRef<HTMLDivElement>(null)
  const [tam, setTam] = useState(() => ({ w: innerWidth, h: innerHeight }))
  const { tapas, cw } = useMemo(() => colocar(tam.w, tam.h), [tam])
  const [arriba, setArriba] = useState<number[]>([])

  useEffect(() => {
    let t = 0
    const cambio = () => {
      clearTimeout(t)
      // Solo si cambia de verdad (las barras del móvil cambian el alto al hacer scroll).
      t = window.setTimeout(() => setTam((v) => (Math.abs(v.w - innerWidth) > 80 || Math.abs(v.h - innerHeight) > 160 ? { w: innerWidth, h: innerHeight } : v)), 200)
    }
    addEventListener('resize', cambio)
    return () => removeEventListener('resize', cambio)
  }, [])

  // Paralaje: las tres capas se mueven distinto con el puntero (o con el giroscopio del cuerpo, quieto en móvil).
  useEffect(() => {
    const el = raiz.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const mover = (e: PointerEvent) => {
      el.style.setProperty('--mx', String(e.clientX / innerWidth - 0.5))
      el.style.setProperty('--my', String(e.clientY / innerHeight - 0.5))
    }
    addEventListener('pointermove', mover)
    return () => removeEventListener('pointermove', mover)
  }, [])

  // Cada poco, una tapa salta encima de la pila.
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      const k = tapas[Math.floor(Math.random() * tapas.length)]?.k
      if (k !== undefined) setArriba((a) => [...a.filter((x) => x !== k), k].slice(-6))
    }, 1700)
    return () => clearInterval(id)
  }, [tapas])

  return (
    <div ref={raiz} aria-hidden className="pila-comics absolute inset-0 isolate overflow-hidden" style={{ '--cw': `${cw}px` } as CSSProperties}>
      {tapas.map((t) => {
        const enCima = arriba.indexOf(t.k)
        return (
          <div
            key={`${tam.w}-${t.k}`}
            className="pila-sitio"
            style={{ left: t.x, top: t.y, zIndex: enCima >= 0 ? 100 + enCima : t.z, '--p': [10, 22, 38][t.capa] } as CSSProperties}
          >
            <div className="pila-tapa" style={{ '--r': `${t.r}deg`, '--d': `${t.d}ms` } as CSSProperties}>
              <div key={enCima === arriba.length - 1 ? `s${arriba.length}-${t.k}` : 'q'} className={enCima === arriba.length - 1 ? 'pila-salta' : ''}>
                <img src={t.url} alt="" draggable={false} decoding="async" style={{ animationDelay: `${-(t.k % 7)}s` }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
