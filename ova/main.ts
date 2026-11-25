import './ova.css'
import { CAPITULOS, VINETAS, imagenVineta, type Globo, type Vineta } from '../src/lib/ova'

/**
 * El lector de "La Incursión": un tomo de manga que se lee hoja a hoja.
 *
 * Sin React a propósito: es una página de imágenes y texto, y lo único que se
 * mueve es la hoja que gira. Portada → páginas (una viñeta 4K por página, con
 * su narración y sus globos en HTML) → fin. La URL lleva la viñeta (#1-4) para
 * poder enlazar una escena desde la historia de cada personaje.
 */

const raiz = document.getElementById('ova')!
const BASE = import.meta.env.BASE_URL

const EXTRAS = { num: 8, titulo: 'Extras · Vida en el multiverso', kanji: '生' }
const caps = [...CAPITULOS, EXTRAS]
const capDe = (n: number) => caps.find((c) => c.num === n)!

/** Orden de lectura: la OVA y, al final, las escenas sueltas como extras. */
const PAGINAS: Vineta[] = [...VINETAS.filter((v) => v.cap <= 7), ...VINETAS.filter((v) => v.cap === 8)]

/** Marca corta del capítulo: P, 1–6, E o ✦ (los kanji pequeños se empastaban). */
const marca = (n: number) => (n === 0 ? 'P' : n === 7 ? 'E' : n === 8 ? '✦' : String(n))

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function globoHTML(g: Globo, i: number) {
  return `<div class="globo globo-${g.tipo} cola-${g.cola}" style="--x:${g.x};--y:${g.y};--d:${0.25 + i * 0.35}s">
    <span class="globo-quien">${esc(g.quien)}</span>${esc(g.texto)}</div>`
}

function paginaHTML(v: Vineta, n: number) {
  const cap = capDe(v.cap)
  const primera = PAGINAS.findIndex((p) => p.cap === v.cap) === n
  return `
  <article class="pagina" data-id="${v.id}">
    <header class="pagina-cabecera">
      <span class="pagina-kanji">${marca(v.cap)}</span>
      <span class="pagina-cap">${v.cap === 0 ? 'Prólogo' : v.cap === 7 ? 'Epílogo' : v.cap === 8 ? 'Extras' : `Capítulo ${v.cap}`}</span>
      <span class="pagina-titulo">${esc(cap.titulo.replace(/^(Prólogo|Epílogo|Extras) · /, ''))}</span>
      <span class="pagina-num">${n + 1} / ${PAGINAS.length}</span>
    </header>
    ${primera ? `<h2 class="rotulo-cap"><span class="rotulo-kanji">${cap.kanji}</span>${esc(cap.titulo)}</h2>` : ''}
    <figure class="vineta">
      <picture>
        <source media="(min-width: 1400px)" srcset="${imagenVineta(v.id, '4k')}" />
        <img src="${imagenVineta(v.id, 'movil')}" alt="${esc(v.narra || v.globos.map((g) => g.quien).join(', '))}" width="3840" height="2160" decoding="async" />
      </picture>
      ${v.narra ? `<figcaption class="cartela">${esc(v.narra)}</figcaption>` : ''}
      <div class="globos">${v.globos.map(globoHTML).join('')}</div>
    </figure>
    ${v.narra ? `<p class="narracion-movil">${esc(v.narra)}</p>` : ''}
    ${v.globos.length ? `<div class="dialogo">${v.globos.map((g) => `<p class="linea linea-${g.tipo}"><b>${esc(g.quien)}</b>${esc(g.texto)}</p>`).join('')}</div>` : ''}
  </article>`
}

function portadaHTML() {
  return `
  <section class="portada">
    <div class="portada-tomo">
      <div class="portada-arte"><img src="${imagenVineta('5-4', 'movil')}" alt="Todos los personajes de la Biblioteca peleando entre cuatro mundos" /></div>
      <p class="portada-sello">Biblioteca Flemin 3D · OVA 01</p>
      <h1 class="portada-titulo"><span>La</span> Incursión</h1>
      <p class="portada-kanji">侵 攻</p>
      <p class="portada-gancho">Cada figura guarda un universo. Cuando los universos se tocan, todos terminan peleando.</p>
      <button class="boton-comic" data-ir="0">Leer el episodio ▶</button>
    </div>
    <nav class="indice" aria-label="Capítulos">
      <p class="indice-rotulo">Índice</p>
      <ol>${caps
        .map((c) => {
          const i = PAGINAS.findIndex((p) => p.cap === c.num)
          return `<li><button data-ir="${i}"><span class="indice-kanji">${marca(c.num)}</span><span>${esc(c.titulo)}</span><span class="indice-pag">p. ${i + 1}</span></button></li>`
        })
        .join('')}</ol>
      <a class="volver" href="${BASE}">← Volver a la Biblioteca</a>
      <p class="aviso">Fan art sin fines comerciales hecho con nuestras figuras 3D. Los personajes pertenecen a sus autores: Akira Toriyama, Masami Kurumada, Nakaba Suzuki, Rumiko Takahashi, Makoto Shinkai y Masashi Kishimoto. El Archivista, el Centinela Dracónico y la historia son de la Biblioteca Flemin 3D.</p>
    </nav>
  </section>`
}

function finHTML() {
  return `
  <section class="fin">
    <p class="fin-rotulo">Fin del episodio 1</p>
    <p class="fin-texto">La OVA 2 ya se está tramando en un estante olvidado...</p>
    <div class="fin-botones">
      <button class="boton-comic" data-ir="portada">↺ Volver a la portada</button>
      <a class="boton-comic boton-oscuro" href="${BASE}">Ver las figuras en la Biblioteca</a>
    </div>
  </section>`
}

raiz.innerHTML = `
  <div class="lector">
    <div class="libro"><div class="hoja debajo"></div><div class="hoja encima"></div></div>
    <nav class="controles" aria-label="Pasar hojas">
      <button class="ctrl" data-paso="-1" aria-label="Hoja anterior">◀</button>
      <button class="ctrl ctrl-portada" data-ir="portada">Portada</button>
      <div class="progreso"><div class="progreso-barra"></div></div>
      <button class="ctrl" data-paso="1" aria-label="Hoja siguiente">▶</button>
    </nav>
  </div>`

const encima = raiz.querySelector<HTMLElement>('.encima')!
const debajo = raiz.querySelector<HTMLElement>('.debajo')!
const barra = raiz.querySelector<HTMLElement>('.progreso-barra')!
const controles = raiz.querySelector<HTMLElement>('.controles')!

/** -1 = portada, PAGINAS.length = fin. */
let actual = -2
let girando = false
const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches

const contenido = (n: number) => (n < 0 ? portadaHTML() : n >= PAGINAS.length ? finHTML() : paginaHTML(PAGINAS[n], n))

function precargar(n: number) {
  const v = PAGINAS[n]
  if (!v) return
  const img = new Image()
  img.src = imagenVineta(v.id, innerWidth >= 1400 ? '4k' : 'movil')
}

function ir(n: number, historial = true) {
  n = Math.max(-1, Math.min(PAGINAS.length, n))
  if (n === actual || girando) return
  const adelante = n > actual
  const primeraVez = actual === -2
  const nuevo = contenido(n)
  debajo.innerHTML = nuevo
  debajo.scrollTop = 0
  const terminar = () => {
    encima.innerHTML = nuevo
    encima.className = 'hoja encima'
    encima.scrollTop = 0
    debajo.innerHTML = ''
    girando = false
  }
  if (primeraVez || reducido) terminar()
  else {
    girando = true
    // Hacia delante gira la hoja de encima; hacia atrás la nueva entra girando.
    if (!adelante) {
      encima.innerHTML = nuevo
      debajo.innerHTML = contenido(actual)
    }
    encima.classList.add(adelante ? 'gira-adelante' : 'gira-atras')
    encima.addEventListener('animationend', terminar, { once: true })
  }
  actual = n
  controles.hidden = n < 0
  barra.style.width = `${(Math.max(0, n + 1) / (PAGINAS.length + 1)) * 100}%`
  const hash = n < 0 ? '' : n >= PAGINAS.length ? '#fin' : `#${PAGINAS[n].id}`
  if (historial && location.hash !== hash) history.replaceState(null, '', hash || location.pathname)
  precargar(n + 1)
  precargar(n + 2)
}

raiz.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ir],[data-paso]')
  if (!b) return
  if (b.dataset.paso) ir(actual + Number(b.dataset.paso))
  else ir(b.dataset.ir === 'portada' ? -1 : Number(b.dataset.ir))
})

addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
    e.preventDefault()
    ir(actual + 1)
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') ir(actual - 1)
  else if (e.key === 'Home') ir(-1)
})

// Deslizar en el móvil: horizontal y decidido, para no robarle el scroll vertical.
let x0 = 0, y0 = 0
addEventListener('touchstart', (e) => ((x0 = e.touches[0].clientX), (y0 = e.touches[0].clientY)), { passive: true })
addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && actual >= 0) ir(actual + (dx < 0 ? 1 : -1))
})

function desdeHash() {
  const id = location.hash.slice(1)
  if (id === 'fin') return ir(PAGINAS.length, false)
  const i = PAGINAS.findIndex((v) => v.id === id)
  ir(i, false)
}
addEventListener('hashchange', desdeHash)
desdeHash()
