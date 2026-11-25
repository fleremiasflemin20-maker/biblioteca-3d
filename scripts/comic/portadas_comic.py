"""Genera las portadas de cómic y manga de la intro y las páginas del fondo del escenario.

Todo sale de las portadas (renders con fondo transparente) de NUESTRAS figuras:
cada una pasa por el filtro cómic y se monta en una tapa con cabecera propia
("FLEMIN COMICS" o el tomo manga "フレミン"), número, nombre y estampado.

Uso (desde la raíz del repo):
    python3 scripts/comic/portadas_comic.py --fuentes /ruta/a/fuentes

Fuentes (Google Fonts, OFL): Bangers-Regular.ttf, DelaGothicOne-Regular.ttf,
ChakraPetch-Bold.ttf. Salida: public/comic/tapas/*.webp, public/comic/paginas.webp
y src/data/tapas-comic.json (qué figura lleva cada tapa).
"""
from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from filtro import comic, trama

RAIZ = Path(__file__).resolve().parents[2]
PORTADAS = RAIZ / 'public' / 'portadas'
SALIDA = RAIZ / 'public' / 'comic'

W, H = 480, 720  # tapa 2:3, como un tomo

# Figuras que salen en la pila. Solo personajes propios con color, sin kits repetidos.
TAPAS = [
    ('saiyan-dorado-chibi-a', 'comic'),
    ('seiya-pegaso-chibi', 'manga'),
    ('gogeta-ssj4', 'comic'),
    ('principe-saiyan-chibi-b', 'manga'),
    ('hechicera-violeta-chibi-a', 'manga'),
    ('saiyan-dios-azul-hd-a', 'comic'),
    ('ikki-fenix-chibi', 'comic'),
    ('chica-lazo-rojo-chibi-a', 'manga'),
    ('fusion-fase4-chibi-a', 'manga'),
    ('ninja-capa-nubes-rojas-hd', 'comic'),
    ('artista-marcial-trenza-chibi-a', 'manga'),
    ('guerrero-rose-furia-divina', 'comic'),
    ('espadachin-rubio-chibi', 'manga'),
    ('saiyan-legendario-furia-esmeralda', 'comic'),
    ('shiryu-dragon-chibi', 'manga'),
    ('piccolo-chibi', 'comic'),
    ('guerrera-gigante-chibi-a', 'manga'),
    ('cyber-draconian-sentinel', 'comic'),
    ('saga-geminis-chibi', 'manga'),
    ('guerrero-futuro-chibi-a', 'comic'),
    ('rey-hada-chibi-b', 'manga'),
    ('cosmic-fusion-warrior-ultra-pop', 'comic'),
    ('samurai-errante-chibi-a', 'manga'),
    ('saiyan-nino-chibi', 'comic'),
    ('estudiante-tokio-chibi', 'manga'),
    ('guerrero-bestia', 'comic'),
    ('monje-guerrero-chibi', 'manga'),
    ('starlight-sentinel', 'comic'),
]

# Colores por tapa: parejas vivas de imprenta.
PALETAS = [
    ('#FFD400', '#FF3B1F'), ('#16B4FF', '#0B3DFF'), ('#FF2D8A', '#8A3CFF'), ('#2BD96B', '#0E8A55'),
    ('#FF8A00', '#E0102E'), ('#00E1D9', '#1767FF'), ('#FFE45C', '#FF7A1A'), ('#B44CFF', '#3311AA'),
]

TINTA = (18, 16, 26)


def fuente(dir_: Path, nombre: str, tam: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(dir_ / nombre), tam)


def hexa(c: str) -> tuple[int, int, int]:
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def recortar(im: Image.Image) -> Image.Image:
    bb = im.getchannel('A').point(lambda a: 255 if a > 30 else 0).getbbox()
    return im.crop(bb) if bb else im


def rayos(w: int, h: int, c1, c2, centro=(0.5, 0.55), n=26) -> Image.Image:
    """Explosión de rayos alternos, el fondo clásico de portada."""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    a = np.arctan2(y - h * centro[1], x - w * centro[0])
    banda = (np.floor((a + math.pi) / (2 * math.pi) * n) % 2).astype(bool)
    out = np.where(banda[..., None], np.array(hexa(c1)), np.array(hexa(c2))).astype(np.float32)
    # Viñeta de trama: los puntos crecen hacia los bordes.
    r = np.sqrt(((x - w * centro[0]) / w) ** 2 + ((y - h * centro[1]) / h) ** 2)
    t = trama(h, w, 9, 30)
    puntos = t < np.clip(r * 1.15 - 0.15, 0, 0.8)
    out[puntos] *= 0.72
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def texto_tinta(d: ImageDraw.ImageDraw, xy, txt, f, relleno, borde=6, sombra=(6, 6), anchor='la'):
    """Rótulo de cómic: sombra sólida desplazada, trazo negro grueso y relleno."""
    x, y = xy
    if sombra:
        d.text((x + sombra[0], y + sombra[1]), txt, font=f, fill=TINTA, stroke_width=borde, stroke_fill=TINTA, anchor=anchor)
    d.text((x, y), txt, font=f, fill=relleno, stroke_width=borde, stroke_fill=TINTA, anchor=anchor)


def ajustar(d: ImageDraw.ImageDraw, txt: str, dir_: Path, nombre: str, maximo: int, ancho: int) -> ImageFont.FreeTypeFont:
    tam = maximo
    while tam > 14:
        f = fuente(dir_, nombre, tam)
        if d.textlength(txt, font=f) <= ancho:
            return f
        tam -= 2
    return fuente(dir_, nombre, tam)


def figura(id_: str, alto: int, manga=False) -> Image.Image:
    im = recortar(Image.open(PORTADAS / f'{id_}.webp').convert('RGBA'))
    # El filtro trabaja a tamaño de tapa para que el trazo tenga el mismo grosor en todas.
    k = alto / im.height
    im = im.resize((max(1, int(im.width * k)), alto), Image.LANCZOS)
    pad = 12
    lienzo = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2))
    lienzo.paste(im, (pad, pad))
    return comic(lienzo, manga=manga, grosor=5, paso_trama=5)


def nombre_corto(n: str) -> str:
    # "Saiyan Dorado Chibi · A" → "SAIYAN DORADO"; el cómic no necesita la variante.
    n = n.split('·')[0].replace('Chibi', '').strip()
    return n.upper()


def tapa_comic(m: dict, numero: int, pal, dir_: Path) -> Image.Image:
    c1, c2 = pal
    base = rayos(W, H, c1, c2, centro=(0.5, 0.62)).convert('RGBA')
    d = ImageDraw.Draw(base)

    # Cabecera: FLEMIN gigante, como el logo de una editorial de superhéroes.
    d.rectangle([0, 0, W, 150], fill=TINTA)
    d.rectangle([0, 150, W, 158], fill=hexa(c1))
    f_logo = fuente(dir_, 'Bangers-Regular.ttf', 132)
    texto_tinta(d, (W // 2 + 30, 6), 'FLEMIN', f_logo, hexa(c1), borde=5, sombra=(5, 5), anchor='ma')
    f_chico = fuente(dir_, 'ChakraPetch-Bold.ttf', 15)
    d.text((W // 2 + 30, 128), 'BIBLIOTECA 3D · COMICS', font=f_chico, fill=(255, 255, 255), anchor='ma')
    # Recuadro del número, arriba a la izquierda.
    d.rectangle([10, 12, 74, 112], fill=(255, 255, 255), outline=hexa(c1), width=3)
    d.text((42, 22), 'No.', font=fuente(dir_, 'ChakraPetch-Bold.ttf', 16), fill=TINTA, anchor='ma')
    d.text((42, 40), str(numero), font=fuente(dir_, 'Bangers-Regular.ttf', 54), fill=TINTA, anchor='ma')

    # La figura, grande, montada sobre la cabecera como en las tapas de verdad.
    fig = figura(m['id'], 520)
    if fig.width > W - 20:
        fig = fig.resize((W - 20, int(fig.height * (W - 20) / fig.width)), Image.LANCZOS)
    x = (W - fig.width) // 2
    y = H - fig.height - 70
    base.alpha_composite(fig, (x, max(100, y)))

    # Cartela inclinada con el nombre.
    cart = Image.new('RGBA', (W + 80, 86))
    dc = ImageDraw.Draw(cart)
    dc.rectangle([0, 0, W + 80, 86], fill=(255, 255, 255), outline=TINTA, width=5)
    nom = nombre_corto(m['nombre'])
    f_nom = ajustar(dc, nom, dir_, 'Bangers-Regular.ttf', 64, W - 40)
    texto_tinta(dc, ((W + 80) // 2, 44), nom, f_nom, hexa(c2), borde=3, sombra=(3, 3), anchor='mm')
    cart = cart.rotate(4, expand=True, resample=Image.BICUBIC)
    base.alpha_composite(cart, (-40, H - cart.height - 8))

    # Estrella de "Edición coleccionista".
    est = estrella(118, hexa('#FFFFFF'), hexa(c2))
    de = ImageDraw.Draw(est)
    f_e = fuente(dir_, 'Bangers-Regular.ttf', 22)
    de.multiline_text((59, 59), '¡EDICIÓN\nCOLECCIO-\nNISTA!', font=f_e, fill=TINTA, anchor='mm', align='center', spacing=-2)
    base.alpha_composite(est.rotate(-12, resample=Image.BICUBIC), (W - 132, 168))
    return marco(base)


def estrella(t: int, relleno, borde, puntas=14) -> Image.Image:
    im = Image.new('RGBA', (t, t))
    d = ImageDraw.Draw(im)
    pts = []
    for i in range(puntas * 2):
        r = t / 2 - 3 if i % 2 == 0 else t / 2 * 0.74
        a = math.pi * i / puntas
        pts.append((t / 2 + r * math.cos(a), t / 2 + r * math.sin(a)))
    d.polygon(pts, fill=relleno, outline=borde)
    d.line(pts + [pts[0]], fill=TINTA, width=4)
    return im


def tapa_manga(m: dict, numero: int, pal, dir_: Path) -> Image.Image:
    """Tomo manga: tapa blanca, logo arriba, figura sobre una mancha de color, número en círculo."""
    c1, c2 = pal
    base = Image.new('RGBA', (W, H), (250, 248, 242, 255))
    d = ImageDraw.Draw(base)
    # Franja de color del lomo y el pie, como los tomos de una misma colección.
    d.rectangle([0, 0, 22, H], fill=hexa(c2))
    d.rectangle([0, H - 54, W, H], fill=hexa(c2))

    # Mancha de fondo con trama y líneas de velocidad hacia el centro.
    fondo = rayos(W, H, c1, '#FFFFFF', centro=(0.55, 0.55), n=60).convert('RGBA')
    masc = Image.new('L', (W, H), 0)
    ImageDraw.Draw(masc).polygon([(40, 210), (W, 160), (W, H - 120), (40, H - 70)], fill=255)
    base.paste(fondo, (0, 0), masc)

    fig = figura(m['id'], 470)
    if fig.width > W - 40:
        fig = fig.resize((W - 40, int(fig.height * (W - 40) / fig.width)), Image.LANCZOS)
    base.alpha_composite(fig, (30 + (W - 30 - fig.width) // 2, H - 54 - fig.height + 18))

    # Logo: katakana arriba, FLEMIN en letra gótica japonesa con trazo.
    d = ImageDraw.Draw(base)
    f_kata = fuente(dir_, 'DelaGothicOne-Regular.ttf', 26)
    d.text((44, 18), 'フレミン', font=f_kata, fill=hexa(c2))
    f_logo = ajustar(d, 'FLEMIN', dir_, 'DelaGothicOne-Regular.ttf', 86, W - 110)
    texto_tinta(d, (40, 44), 'FLEMIN', f_logo, hexa(c1), borde=5, sombra=(0, 6))
    nom = nombre_corto(m['nombre'])
    f_nom = ajustar(d, nom, dir_, 'DelaGothicOne-Regular.ttf', 30, W - 80)
    d.text((44, 152), nom, font=f_nom, fill=TINTA)

    # Texto vertical japonés en el borde derecho: "edición coleccionista".
    f_v = fuente(dir_, 'DelaGothicOne-Regular.ttf', 24)
    for i, ch in enumerate('コレクター版'):
        d.text((W - 36, 200 + i * 28), ch, font=f_v, fill=TINTA, stroke_width=3, stroke_fill=(255, 255, 255), anchor='ma')

    # Número de tomo en círculo y pie de editorial.
    cx, cy, r = W - 56, H - 100, 34
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255), outline=TINTA, width=4)
    d.text((cx, cy + 2), str(numero), font=fuente(dir_, 'DelaGothicOne-Regular.ttf', 36), fill=TINTA, anchor='mm')
    d.text((40, H - 28), 'FLEMIN COMICS  ·  BIBLIOTECA 3D', font=fuente(dir_, 'ChakraPetch-Bold.ttf', 17), fill=(255, 255, 255), anchor='lm')
    return marco(base)


def marco(im: Image.Image) -> Image.Image:
    """Filo oscuro y brillo de papel satinado."""
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W - 1, H - 1], outline=TINTA, width=3)
    brillo = Image.new('L', (W, H), 0)
    ImageDraw.Draw(brillo).polygon([(0, 0), (W * 0.45, 0), (0, H * 0.4)], fill=28)
    im.alpha_composite(Image.merge('RGBA', [Image.new('L', (W, H), 255)] * 3 + [brillo.filter(ImageFilter.GaussianBlur(40))]))
    return im


# ── Páginas para el fondo del escenario ────────────────────────────────────

ONOMATOPEYAS = ['¡BOOM!', '¡ZAS!', 'ドン', '¡KRAK!', 'ゴゴゴ', '¡POW!', 'ズドン', '¡FWOOSH!', 'バキ', '¡WHAM!']


def pagina(ids: list[str], semilla: int, dir_: Path, w=1024, h=1400) -> Image.Image:
    """Una página de cómic a color: viñetas inclinadas, cada una con una figura en acción."""
    rnd = random.Random(semilla)
    pag = Image.new('RGBA', (w, h), (250, 247, 238, 255))
    m = 26
    # Tres filas con cortes diagonales; la del medio partida en dos.
    y1, y2 = int(h * 0.36) + rnd.randint(-30, 30), int(h * 0.66) + rnd.randint(-30, 30)
    xc = int(w * 0.5) + rnd.randint(-90, 90)
    inc = rnd.choice([-40, 40])
    vinetas = [
        [(m, m), (w - m, m), (w - m, y1 - inc), (m, y1 + inc)],
        [(m, y1 + inc + m), (xc + 30, y1 + m), (xc - 30, y2 - m // 2), (m, y2 - m // 2)],
        [(xc + 30 + m, y1 + m), (w - m, y1 - inc + m), (w - m, y2 - m // 2), (xc - 30 + m, y2 - m // 2)],
        [(m, y2 + m // 2), (w - m, y2 + m // 2), (w - m, h - m), (m, h - m)],
    ]
    for k, poly in enumerate(vinetas):
        id_ = ids[k % len(ids)]
        xs, ys = [p[0] for p in poly], [p[1] for p in poly]
        bx, by, bw, bh = min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)
        c1, c2 = PALETAS[(semilla * 3 + k) % len(PALETAS)]
        fondo = rayos(bw, bh, c1, c2 if k % 2 else '#FFFFFF', centro=(rnd.uniform(0.3, 0.7), rnd.uniform(0.4, 0.7)), n=rnd.choice([28, 48, 70])).convert('RGBA')
        manga = k == 3 and semilla % 2 == 0
        fig = figura(id_, int(bh * rnd.uniform(1.0, 1.25)), manga=manga)
        if manga:
            fondo = fondo.convert('L').convert('RGBA')
        fx = rnd.randint(-fig.width // 6, max(0, bw - fig.width + fig.width // 6))
        fondo.alpha_composite(fig, (fx, int(bh * 0.08)) if fig.width < bw else (0, int(bh * 0.08)))
        # Onomatopeya grande.
        d = ImageDraw.Draw(fondo)
        txt = rnd.choice(ONOMATOPEYAS)
        jap = any(ord(ch) > 0x3000 for ch in txt)
        f = fuente(dir_, 'DelaGothicOne-Regular.ttf' if jap else 'Bangers-Regular.ttf', rnd.randint(70, 110))
        ox = rnd.choice([30, bw - 30])
        texto_tinta(d, (ox, rnd.randint(20, max(21, bh // 3))), txt, f, hexa(rnd.choice(['#FFD400', '#FF3B1F', '#FFFFFF', '#16B4FF'])), borde=5, sombra=(5, 5), anchor='ra' if ox > bw / 2 else 'la')
        masc = Image.new('L', pag.size, 0)
        ImageDraw.Draw(masc).polygon(poly, fill=255)
        capa = Image.new('RGBA', pag.size)
        capa.paste(fondo, (bx, by))
        pag.paste(capa, (0, 0), Image.composite(capa.getchannel('A'), Image.new('L', pag.size, 0), masc))
        ImageDraw.Draw(pag).line(poly + [poly[0]], fill=TINTA, width=7, joint='curve')
    return pag


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--fuentes', required=True, type=Path)
    a = ap.parse_args()

    catalogo = {m['id']: m for m in json.loads((RAIZ / 'src/data/catalogo.json').read_text())}
    (SALIDA / 'tapas').mkdir(parents=True, exist_ok=True)
    lista = []
    for i, (id_, estilo) in enumerate(TAPAS):
        m = catalogo[id_]
        pal = PALETAS[i % len(PALETAS)]
        im = (tapa_comic if estilo == 'comic' else tapa_manga)(m, i + 1, pal, a.fuentes)
        im.convert('RGB').save(SALIDA / 'tapas' / f'{id_}.webp', quality=82, method=6)
        lista.append({'id': id_, 'estilo': estilo, 'tapa': f'{id_}.webp'})
        print('tapa', i + 1, id_)
    (RAIZ / 'src/data/tapas-comic.json').write_text(json.dumps(lista, ensure_ascii=False, indent=1) + '\n')

    # Tira de páginas para el escenario: cuatro páginas lado a lado que se repiten en bucle.
    ids = [t[0] for t in TAPAS]
    paginas = [pagina(ids[k * 4:(k + 1) * 4], k, a.fuentes) for k in range(4)]
    tira = Image.new('RGB', (sum(p.width for p in paginas) + 24 * len(paginas), paginas[0].height + 48), (24, 20, 34))
    x = 12
    for p in paginas:
        tira.paste(p, (x, 24))
        x += p.width + 24
    tira.save(SALIDA / 'paginas.webp', quality=72, method=6)
    tira.resize((tira.width // 2, tira.height // 2), Image.LANCZOS).save(SALIDA / 'paginas_1k.webp', quality=70, method=6)
    print('paginas', tira.size)


if __name__ == '__main__':
    main()
