"""Filtro cómic / manga para las portadas de la Biblioteca (PNG/WebP con fondo transparente).

Convierte el render 3D de una figura en un dibujo: colores planos (cel shading),
contorno de tinta grueso, líneas interiores y trama de puntos en las sombras.
`manga=True` lo deja en blanco y negro con tramas, como una página impresa.
"""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image


def _bandas(l: np.ndarray, n: int) -> np.ndarray:
    """Cuantiza la luminosidad en n escalones, como el sombreado de un cómic."""
    paso = 255 / n
    return np.clip((np.floor(l / paso) + 0.5) * paso, 0, 255)


def trama(h: int, w: int, paso: int = 7, angulo: float = 45) -> np.ndarray:
    """Campo 0..1 con una retícula de puntos rotada (la trama de imprenta)."""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    a = np.deg2rad(angulo)
    u = (x * np.cos(a) + y * np.sin(a)) / paso
    v = (-x * np.sin(a) + y * np.cos(a)) / paso
    du = u - np.round(u)
    dv = v - np.round(v)
    return np.sqrt(du * du + dv * dv) / 0.7071  # 0 en el centro del punto, 1 en la esquina


def comic(img: Image.Image, manga: bool = False, grosor: int = 5, paso_trama: int = 6) -> Image.Image:
    rgba = np.array(img.convert('RGBA'))
    alfa = rgba[..., 3]
    rgb = rgba[..., :3].copy()
    h, w = alfa.shape
    solido = alfa > 40

    # Rellenar el fondo con el color vecino para que el suavizado no meta halos oscuros.
    rgb[~solido] = 0
    suave = cv2.bilateralFilter(rgb, 9, 60, 9)
    suave = cv2.bilateralFilter(suave, 9, 50, 9)

    lab = cv2.cvtColor(suave, cv2.COLOR_RGB2LAB).astype(np.float32)
    L = lab[..., 0]
    # Más contraste antes de cuantizar: los renders vienen suaves.
    L = np.clip((L - 128) * 1.25 + 140, 0, 255)

    if manga:
        # Repartir la luz de cada figura entre negro y blanco: un pelo rubio no puede quedarse en blanco puro.
        lo, hi = np.percentile(L[solido], [4, 92]) if solido.any() else (0, 255)
        base = np.clip((L - lo) / max(hi - lo, 1) * 255, 0, 255)
        t = trama(h, w, paso_trama, 45)
        out = np.full((h, w), 255, np.float32)
        # Blancos limpios, medios con trama clara, sombras con trama densa, negros sólidos.
        out[base < 185] = np.where(t[base < 185] < 0.45, 40, 255)
        out[base < 115] = np.where(t[base < 115] < 0.75, 25, 255)
        out[base < 50] = 20
        color = np.dstack([out] * 3)
    else:
        lab[..., 0] = _bandas(L, 5) * 0.92 + 18
        # Saturación de imprenta.
        lab[..., 1] = (lab[..., 1] - 128) * 1.35 + 128
        lab[..., 2] = (lab[..., 2] - 128) * 1.35 + 128
        color = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)
        # Trama en la sombra: puntos oscuros solo donde la luz es baja.
        t = trama(h, w, paso_trama, 22)
        sombra = (L < 105) & (t < 0.55)
        color[sombra] *= 0.55

    # Líneas interiores de tinta: bordes de la luminosidad suavizada.
    gris = cv2.GaussianBlur(cv2.cvtColor(suave, cv2.COLOR_RGB2GRAY), (3, 3), 0)
    bordes = cv2.Canny(gris, 40, 110)
    bordes = cv2.dilate(bordes, np.ones((2, 2), np.uint8))
    bordes[~cv2.erode(solido.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)] = 0

    # Contorno exterior grueso: la silueta engordada.
    sil = solido.astype(np.uint8) * 255
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (grosor * 2 + 1, grosor * 2 + 1))
    gorda = cv2.dilate(sil, k)

    out = np.zeros((h, w, 4), np.float32)
    out[..., :3] = 18
    out[..., 3] = gorda
    out[solido, :3] = color[solido]
    out[bordes > 0, :3] = 18
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


if __name__ == '__main__':
    import sys

    src, dst = sys.argv[1], sys.argv[2]
    comic(Image.open(src), manga='--manga' in sys.argv).save(dst)
