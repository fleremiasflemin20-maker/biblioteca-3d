import type { CrossSection, Manifold, Vec2 } from 'manifold-3d'
import { emblema, rectRedondeado, seccionTexto, type Contexto } from './formas.ts'
import { deManifold, type Wasm } from './wasm.ts'
import type { Parametro, Params, PiezaGenerada, Vec3 } from './tipos.ts'

/**
 * Plantillas paramétricas: piezas de impresión probadas que el visitante
 * ajusta con deslizadores, como las "Feature Studios" de Onshape o los
 * generadores de Thingiverse Customizer, pero sin instalar nada.
 *
 * Las dos primeras salen de los scripts de Python del taller
 * (`~/Documents/3d trabajos`): la funda de encendedor (`crear_funda.py`,
 * tabla HUECOS) y el grinder Flemin de 63 mm (`grinder/flemin_grinder.py`),
 * portados a Manifold en el navegador con las mismas medidas.
 */
export type Plantilla = {
  id: string
  nombre: string
  descripcion: string
  /** Etiqueta corta para la tarjeta: tiempo, piezas, material. */
  etiqueta: string
  params: Parametro[]
  construir: (w: Wasm, p: Params, ctx: Contexto) => { nombre: string; color: string; solido: Manifold; pos?: Vec3 }[]
}

const n = (clave: string, nombre: string, valor: number, min: number, max: number, paso = 0.1, unidad = 'mm', ayuda?: string): Parametro => ({
  clave, nombre, tipo: 'numero', valor, min, max, paso, unidad, ayuda,
})
const num = (p: Params, k: string) => Number(p[k])
const si = (p: Params, k: string) => p[k] === true || p[k] === 'true'

/** Aleatorio con semilla: las llamas salen iguales cada vez que se regenera. */
function azar(semilla: number) {
  let s = semilla * 2654435761 + 1013904223
  return (a: number, b: number) => {
    s = (Math.imul(s ^ (s >>> 15), 2246822519) + 3266489917) | 0
    return a + ((s >>> 0) / 4294967296) * (b - a)
  }
}

const linspace = (a: number, b: number, k: number) => Array.from({ length: k }, (_, i) => a + ((b - a) * i) / (k - 1))

/** Una llama Flemin (perfil 2D en X/Z): ancha abajo, ondulada y en punta arriba. */
function seccionLlama(w: Wasm, alto: number, w0 = 2.6, vaiven = 1.4, fase = 0, k = 40): CrossSection {
  const der: Vec2[] = [], izq: Vec2[] = []
  for (const s of linspace(0, 1, k)) {
    const cx = vaiven * s * Math.sin(Math.PI * 1.5 * s + fase)
    const ancho = 0.35 + (w0 - 0.35) * (1 - s) ** 0.6
    der.push([cx + ancho, alto * s])
    izq.push([cx - ancho, alto * s])
  }
  return new w.CrossSection([[...der, ...izq.reverse()]])
}

/* ═══ Funda para encendedor ═══════════════════════════════════════════ */

/*
 * Hueco interior (ancho, grosor, radio de las puntas) y alto de la funda: la
 * tabla HUECOS de `crear_funda.py`. La BIC Mini queda en 21,7 × 11,3 hasta
 * que el anillo de prueba diga otra cosa.
 */
export const HUECOS = {
  mini: { ancho: 21.7, grosor: 11.3, radio: 5.5, alto: 60, pulgar: 8 },
  maxi: { ancho: 25.6, grosor: 15.3, radio: 7.2, alto: 78, pulgar: 10 },
}

const funda: Plantilla = {
  id: 'funda-encendedor',
  nombre: 'Funda para encendedor',
  descripcion: 'Funda BIC Mini o Maxi con hueco calibrado, fondo reforzado, rebaje para el pulgar, llamas Flemin al frente y el emblema grabado atrás. Se imprime de pie, sin soportes.',
  etiqueta: '1 pieza · ~1 h',
  params: [
    { clave: 'encendedor', nombre: 'Encendedor', tipo: 'opcion', valor: 'mini', opciones: [{ valor: 'mini', nombre: 'BIC Mini (J25)' }, { valor: 'maxi', nombre: 'BIC Maxi (J26)' }] },
    n('ajuste', 'Ajuste extra', 0, -0.4, 0.6, 0.05, 'mm', 'Suma al hueco por lado. Negativo = más apretada.'),
    n('pared', 'Pared', 1.8, 1.2, 4, 0.1),
    n('fondo', 'Fondo', 3, 1.5, 6, 0.1),
    { clave: 'llamas', nombre: 'Llamas al frente', tipo: 'si-no', valor: true },
    { clave: 'emblema', nombre: 'Emblema grabado atrás', tipo: 'si-no', valor: true },
  ],
  construir(w, p) {
    const h = HUECOS[(p.encendedor as keyof typeof HUECOS) ?? 'mini'] ?? HUECOS.mini
    const aj = num(p, 'ajuste'), pared = num(p, 'pared'), fondo = num(p, 'fondo')
    const cw = h.ancho + 2 * aj, cd = h.grosor + 2 * aj, cr = Math.min(h.radio + aj, cd / 2 - 0.05)
    const W = cw + 2 * pared, D = cd + 2 * pared, H = h.alto
    let s = rectRedondeado(w, W, D, cr + pared).extrude(H)
    // Chaflán de 0,6 mm en la base: la primera capa no hace pata de elefante.
    const pie = rectRedondeado(w, W + 2, D + 2, cr + pared + 1).extrude(0.6).subtract(rectRedondeado(w, W - 1.2, D - 1.2, cr + pared - 0.6).extrude(0.6, 0, 0, [(W + 0.01) / (W - 1.2), (D + 0.01) / (D - 1.2)]))
    s = s.subtract(pie.translate([0, 0, -0.001]))
    s = s.subtract(rectRedondeado(w, cw, cd, cr).extrude(H).translate([0, 0, fondo]))
    // Rebaje para el pulgar sobre la rueda (lado +X), como SCOOP_SIDE = +1.
    s = s.subtract(w.Manifold.cylinder(D + 4, h.pulgar, h.pulgar, 64, true).rotate([90, 0, 0]).translate([cw / 4, 0, H]))
    if (si(p, 'llamas')) {
      const r = azar(3)
      const llamas: Manifold[] = []
      const k = Math.max(3, Math.round(W / 6))
      for (let i = 0; i < k; i++) {
        const x = -W / 2 + 3 + ((W - 6) * i) / (k - 1)
        const alto = (H - 18) * r(0.45, 0.85)
        llamas.push(seccionLlama(w, alto, r(2, 2.8), r(0.8, 1.6), r(0, 6.28)).extrude(1.6).rotate([90, 0, 0]).translate([x, -D / 2 + 0.8, 6]))
      }
      // Recortadas al contorno: no sobresalen de los costados.
      const recorte = rectRedondeado(w, W - 1, D + 1.6, cr + pared).extrude(H - 10)
      s = s.add(w.Manifold.union(llamas).intersect(recorte))
    }
    if (si(p, 'emblema')) {
      const e = emblema(w, Math.min(W - 6, 22) / 100).extrude(0.7).rotate([-90, 0, 0])
      s = s.subtract(e.translate([0, D / 2 - 0.6, H * 0.55]))
    }
    return [{ nombre: `Funda ${p.encendedor === 'maxi' ? 'BIC Maxi' : 'BIC Mini'}`, color: '#FF6A13', solido: s }]
  },
}

/* ═══ Anillos de prueba ══════════════════════════════════════════════ */

const anillos: Plantilla = {
  id: 'anillos-prueba',
  nombre: 'Anillos de prueba de ajuste',
  descripcion: 'Antes de la funda: un anillo escalonado de 3 medidas por encendedor (arriba la más holgada). El escalón donde empieza a apretar es tu hueco. Imprime en 10 minutos.',
  etiqueta: '2 piezas · ~10 min',
  params: [n('escalon', 'Alto de escalón', 2.5, 1.5, 5, 0.1), n('paso', 'Diferencia entre escalones', 0.3, 0.1, 0.6, 0.05), n('pared', 'Pared', 1.2, 0.8, 3, 0.1)],
  construir(w, p) {
    const paso = num(p, 'paso'), alto = num(p, 'escalon'), pared = num(p, 'pared')
    const anillo = (h: (typeof HUECOS)['mini'], marcas: number) => {
      const pasos = [1, 0, -1].map((k) => ({ a: h.ancho, g: h.grosor + k * paso, r: h.radio + (k * paso) / 2 }))
      const H = alto * pasos.length
      let s = rectRedondeado(w, pasos[0].a + 2 * pared, pasos[0].g + 2 * pared, pasos[0].r + pared).extrude(H)
      pasos.forEach((q, i) => {
        const z0 = H - alto * (i + 1) - (i === pasos.length - 1 ? 0.01 : 0)
        s = s.subtract(rectRedondeado(w, q.a, q.g, Math.min(q.r, q.g / 2 - 0.05)).extrude(H + 1 - z0).translate([0, 0, z0]))
      })
      // Bultos que identifican el anillo al tacto: 1 = Mini, 2 = Maxi.
      for (let k = 0; k < marcas; k++)
        s = s.add(w.Manifold.cylinder(H, 0.9, 0.9, 24).translate([-2 * (marcas - 1) + 4 * k, pasos[0].g / 2 + pared, 0]))
      return s
    }
    return [
      { nombre: 'Anillo BIC Mini', color: '#FFC23D', solido: anillo(HUECOS.mini, 1), pos: [-20, 0, 0] },
      { nombre: 'Anillo BIC Maxi', color: '#2FA8FF', solido: anillo(HUECOS.maxi, 2), pos: [20, 0, 0] },
    ]
  },
}

/* ═══ Grinder Flemin 63 mm ═══════════════════════════════════════════ */

function grinder(w: Wasm, p: Params) {
  const M = w.Manifold
  const fino = p.calidad === 'final'
  const SEG = fino ? 160 : 96
  const THREAD_N = fino ? 360 : 180
  const DIV_PER_TURN = fino ? 90 : 48

  const R_OUT = 31.5, R_BODY = 30.7
  const PITCH = 3.0, T_DEPTH = 1.2, T_LEN = 8.0
  const T_CLEAR = num(p, 'holgura')
  const M_MAJOR = 28.95, M_MINOR = M_MAJOR - T_DEPTH
  const FLOOR = 3.0, CAVITY = 11.5, R_IN = M_MINOR - 1.6
  const TOOTH = 2.6, TOOTH_H = 7.0, TIP = 0.3
  const LID_RINGS: [number, number][] = [[8.6, 8], [19.0, 15]]
  const CH_RINGS: [number, number][] = [[13.8, 11], [24.2, 19]]
  const SLOTS: [number, number, number, number][] = [[5.2, 11.4, 6, 34], [16.1, 21.9, 9, 22]]
  const BOSS_R = 4.0, BOSS_H = 5.0
  const MAG_D = num(p, 'imanD'), MAG_H = num(p, 'imanH'), MAG_FIT = 0.15, MAG_GAP = 0.4
  const LID_PLATE = 10.0, GRIP_N = 14, GRIP_R = 3.4, GRIP_DEPTH = 2.2, LIP = 0.8, ENGRAVE = 0.8
  const H_COLL = 30.0, H_BASE = 14.0, LEDGE_W = 2.6, SCREEN_D = 52.0
  const llamas = si(p, 'llamas')

  const cyl = (h: number, r: number, z0 = 0, r2?: number) => M.cylinder(h, r, r2 ?? r, SEG).translate([0, 0, z0])
  const tube = (h: number, ro: number, ri: number, z0 = 0) => cyl(h, ro, z0).subtract(cyl(h + 2, ri, z0 - 1))
  const union = (l: Manifold[]) => M.union(l)

  function threadSection(rMinor: number, depth: number, extra = 0) {
    const ramp = T_DEPTH / PITCH, root = (1 - 2 * ramp) / 2
    const pts: Vec2[] = []
    for (let i = 0; i < THREAD_N; i++) {
      const u = i / THREAD_N
      const prof = Math.min(1, Math.max(0, Math.min((u - root / 2) / ramp, (1 - root / 2 - u) / ramp)))
      const r = rMinor + extra + depth * prof, a = 2 * Math.PI * u
      pts.push([r * Math.cos(a), r * Math.sin(a)])
    }
    return new w.CrossSection([pts])
  }
  const thread = (h: number, rMinor: number, extra = 0) => {
    const turns = h / PITCH
    return threadSection(rMinor, T_DEPTH, extra).extrude(h, Math.round(turns * DIV_PER_TURN), 360 * turns)
  }
  const maleThread = (z0: number) => {
    const t = thread(T_LEN, M_MINOR).add(cyl(T_LEN, M_MINOR + 0.01))
    const lead = cyl(T_LEN, M_MINOR - 0.2, 0, M_MINOR - 0.2 + T_LEN)
    return t.intersect(lead).translate([0, 0, z0])
  }
  const femaleCut = (z0: number, extraH = 1.0) => {
    const h = T_LEN + extraH
    let t = thread(h + PITCH, M_MINOR, T_CLEAR).add(cyl(h + PITCH, M_MINOR + T_CLEAR)).translate([0, 0, -PITCH])
    t = t.intersect(cyl(h, 50))
    const mouth = cyl(1.0, M_MAJOR + T_CLEAR + 0.6, h - 1.0, M_MAJOR + T_CLEAR + 1.6)
    return t.add(mouth).translate([0, 0, z0])
  }
  const tooth = () => w.CrossSection.square([TOOTH, TOOTH], true).rotate(45).extrude(TOOTH_H, 0, 0, [TIP, TIP])
  const toothRing = (radius: number, count: number, phase = 0) => {
    const t = tooth()
    return union(
      Array.from({ length: count }, (_, k) => {
        const a = phase + (360 * k) / count, r = (a * Math.PI) / 180
        return t.rotate([0, 0, a]).translate([radius * Math.cos(r), radius * Math.sin(r), 0])
      }),
    )
  }
  const slotRing = (rIn: number, rOut: number, count: number, deg: number, h: number) => {
    const a0 = (-deg * Math.PI) / 360, a1 = (deg * Math.PI) / 360
    const pts: Vec2[] = [...linspace(a0, a1, 24).map((a) => [rOut * Math.cos(a), rOut * Math.sin(a)] as Vec2), ...linspace(a1, a0, 24).map((a) => [rIn * Math.cos(a), rIn * Math.sin(a)] as Vec2)]
    const one = new w.CrossSection([pts]).offset(-0.6, 'Round').offset(0.6, 'Round').extrude(h)
    return union(Array.from({ length: count }, (_, k) => one.rotate([0, 0, (360 * k) / count + 360 / count / 2])))
  }
  const flameBand = (z0: number, height: number, count: number, seed: number, tall: [number, number] = [0.6, 1.0]) => {
    const r = azar(seed)
    const parts = Array.from({ length: count }, (_, k) => {
      const h = height * r(...tall)
      const f = seccionLlama(w, h, r(2.2, 3.0), r(0.8, 1.8), r(0, 6.28)).extrude(3.0).rotate([90, 0, 0]).translate([0, -(R_OUT - 3.0), z0])
      return f.rotate([0, 0, (360 * k) / count + r(-4, 4)])
    })
    return union(parts).intersect(cyl(height + 1, R_OUT, z0 - 0.5))
  }
  const fingerGrooves = (h: number) => {
    const c = R_OUT + GRIP_R - GRIP_DEPTH
    const g = cyl(h + 2, GRIP_R, -1)
    return union(Array.from({ length: GRIP_N }, (_, k) => g.translate([c, 0, 0]).rotate([0, 0, (360 * k) / GRIP_N])))
  }

  function lid() {
    let plate = cyl(LID_PLATE, R_OUT).subtract(fingerGrooves(LID_PLATE))
    plate = plate.subtract(cyl(0.8, R_OUT + 1, -0.01).subtract(cyl(0.8, R_OUT - 0.8, -0.01, R_OUT + 0.01)))
    const lip = tube(LIP, R_IN - 0.3, R_IN - 1.5, -LIP)
    const teeth = union(LID_RINGS.map(([r, k]) => toothRing(r, k, 180 / k).mirror([0, 0, 1])))
    const bossLen = CAVITY - BOSS_H - MAG_GAP
    const boss = cyl(bossLen, BOSS_R, -bossLen)
    const pocket = cyl(MAG_H + 0.2, (MAG_D + MAG_FIT) / 2, -bossLen - 0.01)
    const art = emblema(w, 0.48).extrude(ENGRAVE + 0.01).translate([0, 0, LID_PLATE - ENGRAVE])
    const edge = cyl(0.8, R_OUT + 1, LID_PLATE - 0.6, R_OUT + 1).subtract(cyl(0.8, R_OUT - 0.2, LID_PLATE - 0.6, R_OUT - 1.0))
    const body = union([plate, lip, teeth, boss]).subtract(pocket).subtract(art).subtract(edge)
    // Se imprime boca abajo: la cara de arriba de la tapa va sobre la cama.
    return body.mirror([0, 0, 1]).translate([0, 0, LID_PLATE])
  }
  function chamber() {
    const h = FLOOR + CAVITY
    let wall = tube(h - T_LEN, R_BODY, R_IN, T_LEN)
    if (llamas) wall = wall.add(flameBand(T_LEN + 0.4, h - T_LEN - 1.4, 18, 3, [0.7, 1.0]))
    const threadZone = maleThread(0).subtract(cyl(T_LEN + 2, R_IN, FLOOR))
    let body = union([wall, threadZone, cyl(FLOOR, M_MINOR)])
    for (const [a, b, k, d] of SLOTS) body = body.subtract(slotRing(a, b, k, d, 20).translate([0, 0, -5]))
    body = body.add(union(CH_RINGS.map(([r, k]) => toothRing(r, k))).translate([0, 0, FLOOR]))
    const boss = cyl(BOSS_H, BOSS_R, FLOOR)
    const pocket = cyl(MAG_H + 0.2, (MAG_D + MAG_FIT) / 2, FLOOR + BOSS_H - MAG_H - 0.2)
    const rim = cyl(0.6, R_IN, h - 0.6, R_IN + 0.6)
    return body.add(boss).subtract(pocket).subtract(rim)
  }
  function collector() {
    const H = H_COLL
    let shell = tube(H - T_LEN, R_BODY, M_MINOR - 1.6 + 1.0, T_LEN)
    if (llamas) shell = shell.add(flameBand(T_LEN + 0.6, H - T_LEN - 4.0, 16, 7))
    shell = shell.subtract(femaleCut(H - T_LEN))
    const shoulder = 1.5
    shell = shell.subtract(cyl(H - 2 * T_LEN - shoulder + 0.01, M_MAJOR + T_CLEAR, T_LEN + shoulder))
    const bottom = maleThread(0).subtract(cyl(T_LEN + 2, R_IN, 1.2)).subtract(cyl(2, R_IN - LEDGE_W, -0.5))
    const seat = cyl(1.0, SCREEN_D / 2 + 0.2, 1.2)
    return shell.add(bottom).subtract(seat)
  }
  function base() {
    const H = H_BASE
    let cup = cyl(H, R_BODY)
    if (llamas) cup = cup.add(flameBand(1.0, H - T_LEN - 1.2 + 4, 14, 11, [0.5, 0.9]))
    cup = cup.subtract(femaleCut(H - T_LEN))
    const bowl = cyl(H - T_LEN - 2.5 + 0.01, M_MAJOR + T_CLEAR - 1.5, 2.5)
    const foot = cyl(0.6, R_BODY + 1, -0.01).subtract(cyl(0.6, R_BODY - 0.5, -0.01, R_BODY + 0.1))
    return cup.subtract(bowl).subtract(foot)
  }

  const todas = [
    { id: 'tapa', nombre: '1 · Tapa (boca abajo)', color: '#FF6A13', f: lid, pos: [-36, 36, 0] as Vec3 },
    { id: 'molienda', nombre: '2 · Cámara de molienda', color: '#FFC23D', f: chamber, pos: [36, 36, 0] as Vec3 },
    { id: 'recolector', nombre: '3 · Recolector con malla', color: '#2FA8FF', f: collector, pos: [-36, -36, 0] as Vec3 },
    { id: 'base', nombre: '4 · Base (polen)', color: '#8A3CFF', f: base, pos: [36, -36, 0] as Vec3 },
  ]
  return todas.filter((t) => p.pieza === 'todas' || p.pieza === t.id).map((t) => ({ nombre: t.nombre, color: t.color, solido: t.f(), pos: p.pieza === 'todas' ? t.pos : ([0, 0, 0] as Vec3) }))
}

const grinderFlemin: Plantilla = {
  id: 'grinder-63',
  nombre: 'Grinder Flemin 63 mm',
  descripcion: 'Cuatro piezas con rosca de 45° (sin soportes), dientes de diamante, ranuras de paso, imanes de 6 × 3 mm, malla de 52 mm y llamas Flemin. La holgura de rosca 0,35 mm es la que funciona en la K2 Plus con PLA/PETG.',
  etiqueta: '4 piezas · ~6 h',
  params: [
    { clave: 'pieza', nombre: 'Pieza', tipo: 'opcion', valor: 'todas', opciones: [{ valor: 'todas', nombre: 'Las 4 piezas' }, { valor: 'tapa', nombre: 'Solo tapa' }, { valor: 'molienda', nombre: 'Solo molienda' }, { valor: 'recolector', nombre: 'Solo recolector' }, { valor: 'base', nombre: 'Solo base' }] },
    n('holgura', 'Holgura de rosca', 0.35, 0.15, 0.7, 0.05, 'mm', '0,25 apretada (PETG) · 0,45 suelta (PLA rugoso)'),
    n('imanD', 'Imán: diámetro', 6, 3, 10, 0.5),
    n('imanH', 'Imán: alto', 3, 1, 5, 0.5),
    { clave: 'llamas', nombre: 'Llamas en el cuerpo', tipo: 'si-no', valor: true },
    { clave: 'calidad', nombre: 'Resolución', tipo: 'opcion', valor: 'borrador', opciones: [{ valor: 'borrador', nombre: 'Rápida (vista previa)' }, { valor: 'final', nombre: 'Final (para imprimir)' }] },
  ],
  construir: (w, p) => grinder(w, p),
}

/* ═══ Caja con tapa ══════════════════════════════════════════════════ */

const cajaTapa: Plantilla = {
  id: 'caja-tapa',
  nombre: 'Caja con tapa a presión',
  descripcion: 'Caja de esquinas redondeadas y tapa con labio que entra a presión. Las medidas son interiores: lo que cabe dentro.',
  etiqueta: '2 piezas · ~2 h',
  params: [
    n('ancho', 'Ancho interior', 60, 10, 300, 1), n('fondo', 'Fondo interior', 40, 10, 300, 1), n('alto', 'Alto interior', 30, 5, 300, 1),
    n('pared', 'Pared', 2, 1, 6, 0.2), n('radio', 'Redondeo', 4, 0, 30, 0.5), n('holgura', 'Holgura de tapa', 0.2, 0, 0.6, 0.05),
    { clave: 'emblema', nombre: 'Emblema en la tapa', tipo: 'si-no', valor: true },
  ],
  construir(w, p) {
    const a = num(p, 'ancho'), f = num(p, 'fondo'), h = num(p, 'alto'), e = num(p, 'pared'), r = num(p, 'radio'), g = num(p, 'holgura')
    const fuera = (dx: number) => rectRedondeado(w, a + 2 * dx, f + 2 * dx, r + dx)
    const caja = fuera(e).extrude(h + e).subtract(fuera(0).extrude(h + 1).translate([0, 0, e]))
    const labio = fuera(-g).extrude(4).subtract(fuera(-g - 1.2).extrude(5).translate([0, 0, -0.5]))
    let tapa = fuera(e).extrude(e).add(labio.translate([0, 0, e]))
    if (si(p, 'emblema')) tapa = tapa.subtract(emblema(w, Math.min(a, f) * 0.6 / 100).extrude(0.61).translate([0, 0, -0.01]))
    return [
      { nombre: 'Caja', color: '#1FBF8F', solido: caja, pos: [0, -(f / 2 + e + 5), 0] },
      { nombre: 'Tapa (labio arriba)', color: '#FF6A13', solido: tapa, pos: [0, f / 2 + e + 5, 0] },
    ]
  },
}

/* ═══ Llavero / placa con nombre ═════════════════════════════════════ */

const placa: Plantilla = {
  id: 'placa-nombre',
  nombre: 'Llavero con nombre',
  descripcion: 'Placa con anilla y el nombre en relieve, en dos piezas de color: imprímelas juntas con cambio de filamento o pégalas.',
  etiqueta: '2 colores · ~25 min',
  params: [
    { clave: 'texto', nombre: 'Nombre', tipo: 'texto', valor: 'Flemin', max: 16 },
    n('tamano', 'Tamaño de letra', 9, 5, 30, 0.5), n('placa', 'Grosor de placa', 2.4, 1.2, 5, 0.2), n('relieve', 'Relieve', 1.2, 0.4, 4, 0.2),
    n('margen', 'Margen', 3, 1, 8, 0.5),
  ],
  construir(w, p, ctx) {
    if (!ctx.fuente) throw new Error('Falta la tipografía')
    const tam = num(p, 'tamano'), zp = num(p, 'placa'), zr = num(p, 'relieve'), m = num(p, 'margen')
    let letras = seccionTexto(w, ctx.fuente, String(p.texto || 'Flemin').slice(0, 16), tam)
    const b = letras.bounds()
    letras = letras.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2])
    const ancho = b.max[0] - b.min[0] + 2 * m, alto = Math.max(b.max[1] - b.min[1] + 2 * m, 16)
    const R = 4.5
    let base = rectRedondeado(w, ancho, alto, Math.min(4, alto / 2)).add(w.CrossSection.circle(R, 48).translate([-ancho / 2 - R + 2.5, 0]))
    base = base.subtract(w.CrossSection.circle(2, 32).translate([-ancho / 2 - R + 2.5, 0]))
    return [
      { nombre: 'Placa', color: '#2B0F54', solido: base.extrude(zp) },
      { nombre: 'Nombre', color: '#FF6A13', solido: letras.extrude(zr).translate([0, 0, zp]) },
    ]
  },
}

/* ═══ Test de tolerancias ════════════════════════════════════════════ */

const tolerancias: Plantilla = {
  id: 'test-tolerancias',
  nombre: 'Test de tolerancias',
  descripcion: 'Placa con agujeros y pines de 0,1 a 0,5 mm de holgura. El primero que entra sin forzar es la holgura de tu impresora para encajes.',
  etiqueta: '2 piezas · ~20 min',
  params: [n('diametro', 'Diámetro del pin', 8, 3, 20, 0.5), n('desde', 'Holgura mínima', 0.1, 0, 0.5, 0.05), n('paso', 'Paso', 0.1, 0.05, 0.3, 0.05), n('cantidad', 'Cantidad', 5, 2, 8, 1, '')],
  construir(w, p) {
    const d = num(p, 'diametro'), k = Math.round(num(p, 'cantidad')), g0 = num(p, 'desde'), dg = num(p, 'paso')
    const sep = d + 6, ancho = k * sep + 4, fondo = d + 10
    let placaS = rectRedondeado(w, ancho, fondo, 3).extrude(4)
    const pines: Manifold[] = []
    for (let i = 0; i < k; i++) {
      const x = -ancho / 2 + 2 + sep * (i + 0.5), g = g0 + i * dg
      placaS = placaS.subtract(w.Manifold.cylinder(6, d / 2 + g, d / 2 + g, 64).translate([x, 0, -1]))
      // Muescas en el borde: tantas como el número del agujero.
      for (let j = 0; j <= i; j++) placaS = placaS.subtract(w.Manifold.cube([0.8, 2, 6], true).translate([x - i * 0.75 + j * 1.5, fondo / 2, 2]))
      pines.push(w.Manifold.cylinder(8, d / 2, d / 2, 64).add(w.Manifold.cylinder(1.5, d / 2 + 2, d / 2 + 2, 64)).translate([x, 0, 0]))
    }
    return [
      { nombre: 'Placa con agujeros', color: '#F2F0EB', solido: placaS, pos: [0, -fondo / 2 - 4, 0] },
      { nombre: 'Pines', color: '#FF6A13', solido: w.Manifold.union(pines), pos: [0, d / 2 + 6, 0] },
    ]
  },
}

/* ═══ Maceta / vaso en espiral ═══════════════════════════════════════ */

const maceta: Plantilla = {
  id: 'maceta-espiral',
  nombre: 'Maceta en espiral',
  descripcion: 'Estrella girada al subir, que se abre hacia arriba. Con pared fija o en modo jarrón (vase mode) del laminador.',
  etiqueta: '1 pieza · ~3 h',
  params: [
    n('puntas', 'Puntas', 7, 3, 16, 1, ''), n('diametro', 'Diámetro base', 70, 20, 250, 1), n('alto', 'Alto', 80, 10, 300, 1),
    n('giro', 'Giro', 90, 0, 360, 5, '°'), n('apertura', 'Apertura arriba', 1.3, 0.5, 2, 0.05, '×'), n('pared', 'Pared', 2, 0.8, 6, 0.2),
    n('fondo', 'Fondo', 2.4, 0.8, 8, 0.2), { clave: 'agujero', nombre: 'Agujero de drenaje', tipo: 'si-no', valor: true },
  ],
  construir(w, p) {
    const k = Math.round(num(p, 'puntas')), R = num(p, 'diametro') / 2, H = num(p, 'alto'), giro = num(p, 'giro'), esc = num(p, 'apertura'), e = num(p, 'pared'), f = num(p, 'fondo')
    const pts: Vec2[] = []
    for (let i = 0; i < k * 12; i++) {
      const a = (2 * Math.PI * i) / (k * 12)
      const r = R * (0.86 + 0.14 * Math.cos(k * a))
      pts.push([r * Math.cos(a), r * Math.sin(a)])
    }
    const cs = new w.CrossSection([pts])
    const div = Math.max(8, Math.round(giro / 3))
    const fuera = cs.extrude(H, div, giro, [esc, esc])
    // El hueco es la misma forma con la pared descontada, empezando sobre el fondo.
    const t0 = f / H
    const escIn = 1 + (esc - 1) * t0
    const giroIn = giro * (1 - t0)
    const dentro = cs.offset(-e, 'Round').scale([escIn, escIn]).extrude(H - f + 0.01, div, giroIn, [esc / escIn, esc / escIn]).rotate([0, 0, -giro * t0]).translate([0, 0, f])
    let s = fuera.subtract(dentro)
    if (si(p, 'agujero')) s = s.subtract(w.Manifold.cylinder(f + 2, 4, 4, 48).translate([0, 0, -1]))
    return [{ nombre: 'Maceta', color: '#1FBF8F', solido: s }]
  },
}

/* ═══ Engranaje recto ════════════════════════════════════════════════ */

const engranaje: Plantilla = {
  id: 'engranaje',
  nombre: 'Engranaje recto',
  descripcion: 'Perfil de evolvente real (ángulo de presión 20°). Dos engranajes del mismo módulo engranan: la distancia entre ejes es módulo × (dientes₁ + dientes₂) / 2.',
  etiqueta: '1 pieza · ~40 min',
  params: [n('dientes', 'Dientes', 20, 6, 120, 1, ''), n('modulo', 'Módulo', 2, 0.5, 6, 0.25), n('grosor', 'Grosor', 8, 1, 60, 0.5), n('eje', 'Agujero del eje', 5, 0, 40, 0.1), { clave: 'plano', nombre: 'Eje en D', tipo: 'si-no', valor: true }],
  construir(w, p) {
    const z = Math.round(num(p, 'dientes')), m = num(p, 'modulo'), alpha = (20 * Math.PI) / 180
    const r = (m * z) / 2, rb = r * Math.cos(alpha), ra = r + m, rf = Math.max(0.5, r - 1.25 * m)
    const inv = (a: number) => Math.tan(a) - a
    const psi = (rho: number) => Math.PI / (2 * z) + inv(alpha) - inv(Math.acos(Math.min(1, rb / Math.max(rb, rho))))
    const r0 = Math.max(rf, rb)
    const pts: Vec2[] = []
    const polar = (rho: number, a: number): Vec2 => [rho * Math.cos(a), rho * Math.sin(a)]
    for (let t = 0; t < z; t++) {
      const c = (2 * Math.PI * t) / z
      const flanco = linspace(r0, ra, 10)
      pts.push(polar(rf, c - psi(r0)))
      for (const rho of flanco) pts.push(polar(rho, c - Math.max(0.002, psi(rho))))
      for (const rho of [...flanco].reverse()) pts.push(polar(rho, c + Math.max(0.002, psi(rho))))
      pts.push(polar(rf, c + psi(r0)))
    }
    let s = new w.CrossSection([pts]).extrude(num(p, 'grosor'))
    const eje = num(p, 'eje')
    if (eje > 0) {
      let agujero = w.CrossSection.circle(eje / 2 + 0.1, 48)
      if (si(p, 'plano')) agujero = agujero.subtract(w.CrossSection.square([eje, eje], true).translate([eje * 0.9, 0]))
      s = s.subtract(agujero.extrude(num(p, 'grosor') + 2).translate([0, 0, -1]))
    }
    return [{ nombre: `Engranaje ${z} dientes`, color: '#FFC23D', solido: s }]
  },
}

export const PLANTILLAS: Plantilla[] = [funda, anillos, grinderFlemin, cajaTapa, placa, tolerancias, maceta, engranaje]

export const paramsPlantilla = (pl: Plantilla): Params => Object.fromEntries(pl.params.map((q) => [q.clave, q.valor]))

/**
 * Construye las piezas y las deja listas para la escena: cada malla centrada
 * en su propio origen y `pos` apoyada en la cama. Las piezas con `pos` se
 * reparten por la cama; las que no la traen quedan montadas como salieron
 * (el nombre sobre la placa, por ejemplo), que es como se imprimen en
 * multicolor.
 */
export function generarPlantilla(w: Wasm, id: string, p: Params, ctx: Contexto): PiezaGenerada[] {
  const pl = PLANTILLAS.find((x) => x.id === id)
  if (!pl) throw new Error(`No existe la plantilla ${id}`)
  const piezas = pl.construir(w, { ...paramsPlantilla(pl), ...p }, ctx)
  const cajas = piezas.map((pz) => {
    if (pz.solido.status() !== 'NoError') throw new Error(`${pz.nombre}: ${pz.solido.status()}`)
    return pz.solido.boundingBox()
  })
  const juntas = piezas.map((pz, i) => (pz.pos ? null : cajas[i])).filter((b) => b !== null)
  const g = juntas.length
    ? { x: (Math.min(...juntas.map((b) => b.min[0])) + Math.max(...juntas.map((b) => b.max[0]))) / 2, y: (Math.min(...juntas.map((b) => b.min[1])) + Math.max(...juntas.map((b) => b.max[1]))) / 2, z: Math.min(...juntas.map((b) => b.min[2])) }
    : { x: 0, y: 0, z: 0 }
  return piezas.map((pz, i) => {
    const b = cajas[i]
    const c: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]
    const malla = deManifold(pz.solido.translate([-c[0], -c[1], -c[2]]))
    const pos: Vec3 = pz.pos ? [pz.pos[0], pz.pos[1], (b.max[2] - b.min[2]) / 2] : [c[0] - g.x, c[1] - g.y, c[2] - g.z]
    return { nombre: pz.nombre, color: pz.color, malla, pos }
  })
}
