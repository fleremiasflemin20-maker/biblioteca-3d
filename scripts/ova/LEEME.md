# La Incursión · cómo se hacen las viñetas

Las viñetas de la OVA (`/ova/`) son renders de **nuestros propios GLB** de `public/models`,
en cel shading de 3 tonos con contorno de tinta (#121019) y **sin peana**: `escena.html`
detecta la base y la recorta con un plano de corte (o usa `corte` de `reparto.json`).
Fondos, grietas, semitono, rayos y onomatopeyas se pintan en canvas 2D encima.
Los textos (narración y globos) NO van en la imagen: van en `src/data/ova.json`.

```bash
cd scripts/ova
ln -s ../../node_modules node_modules; ln -s ../../public/models models; ln -s ../../public/draco draco
python3 -m http.server 8765 &          # escena.html necesita servirse por http
python3 guion.py                       # escribe vinetas.json y ../../src/data/ova.json
python3 lote.py 3840 2160 salida       # renderiza todas (o: python3 lote.py 960 540 prev 1-4 2-3)
```

Luego se pasan a WebP: `public/ova/4k/<id>.webp` (3840×2160, calidad 82) y
`public/ova/movil/<id>.webp` (1280×720, calidad 80).

- `reparto.json`: clave del personaje → GLB (+ `corte` en fracción de altura, o `false` para no recortar).
- `guion.py`: cada `vin(...)` es una viñeta: figuras (posición, giro, altura), fondo (mundos y grietas),
  efectos (`rayo`, `meteoros`, `rafaga`, `relampago`, `esfera`, `hilo`), onomatopeyas y textos.
- Las figuras mantienen la pose con la que se imprimieron.
