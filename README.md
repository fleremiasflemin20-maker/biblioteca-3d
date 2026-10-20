# Biblioteca 3D

Tienda de modelos 3D de Fleremiasflemin, con el mismo lenguaje visual que el
[portafolio](https://fleremiasflemin20-maker.github.io/Portafolio-fleremiasflemin/):
atardecer, grano de película, HUD y rotulación Archivo Black.

Cada categoría tiñe la página entera, como la rueda de facetas del portafolio.
Cada pieza se abre en 3D (textura, arcilla o malla) antes de comprarla.

## Arrancar

```bash
npm install
npm run dev     # http://localhost:5175
```

## Subir un modelo

1. Con `npm run dev` corriendo, pulsa **Subir modelo** (arriba a la derecha).
2. Arrastra el `.glb`, pon nombre, categoría, precio y formatos.
3. La web guarda el archivo en `public/models/subidos/`, lo añade a
   `src/data/catalogo.json` y genera sola la portada y el conteo de triángulos.
4. `git push` → GitHub Pages lo publica.

El botón solo existe en desarrollo: GitHub Pages es estático y no tiene donde
guardar archivos. Para editar precios o textos, cambia `src/data/catalogo.json`.

**Compra:** si una ficha tiene `compra` (enlace de Gumroad, Cults3D…), el botón
lleva ahí. Si no, abre WhatsApp con el pedido ya escrito.

**Peso:** GitHub rechaza archivos de más de 100 MB. Comprime antes de subir:

```bash
npx @gltf-transform/cli optimize entrada.glb salida.glb --compress meshopt --texture-compress webp --texture-size 1024
```

## Llavero con nombre

El cliente escribe su nombre, elige icono y colores, lo ve en 3D y el pedido
llega por WhatsApp con todo escrito. Para generar el archivo de impresión:

```bash
~/Downloads/Disenos_Propios/Generador_Llaveros/llavero "María José" --icono colibri --paleta ecuador
```

Salen un STL por color y el 3MF en `Generador_Llaveros/pedidos/`. El script
(`llavero_nombre.py`) y `src/lib/llavero.ts` comparten tipografía, siluetas y
medidas: si se cambia una, hay que cambiar la otra.

## Estudio 3D (Flemin Studio)

Botón **Estudio 3D** (o `#estudio` / `#editor` en la URL). Todo corre en el
navegador; no hay servidor.

- **La sala** (`src/estudio/sala/`): las obras en pedestales alrededor de un
  estudio circular. La cámara camina de una a otra, cada pieza se carga en 3D
  al llegar, con luz de estudio, atardecer, neón o noche y modos color,
  arcilla y malla. Dragon Ball y Caballeros del Zodiaco no entran en la sala pública
  (`AJENAS` en `Sala.tsx`): siguen en la tienda.
- **El editor** (`src/estudio/editor/`): formas básicas, texto, emblema Flemin
  y SVG; mover, rotar y escalar con gizmo y atajos de Blender (G, R, S, 1/3/7,
  F); rejilla en mm; regla; sólido/hueco y Combinar como en Tinkercad;
  deshacer/rehacer; importar STL, 3MF, GLB, OBJ y SVG; exportar STL, 3MF
  multicolor y GLB. La escena se guarda sola en el navegador.
- **Imprimir**: perfiles K2 Plus (350³) y SPARKX i7 (260 × 260 × 255), revisar
  malla (estanca, cuerpos, voladizo, gramos), auto-orientar, centrar, ajustar a
  la cama y voladizos en rojo.
- **Plantillas** (`src/estudio/geo/plantillas.ts`): funda BIC Mini/Maxi (tabla
  `HUECOS`, la misma de `crear_funda.py`), anillos de prueba, grinder Flemin de
  63 mm en 4 piezas (portado de `flemin_grinder.py`), caja con tapa, llavero con
  nombre, test de tolerancias, maceta en espiral y engranaje.

La geometría es [Manifold](https://github.com/elalish/manifold) en WASM, en un
worker (`src/estudio/geo/geo.worker.ts`): toda unión o resta sale cerrada.
Cuando el anillo de prueba diga la medida buena de la BIC Mini, cámbiala en
`HUECOS` y también en `crear_funda.py`. Las piezas del catálogo se pueden abrir
en el editor para mirarlas y combinarlas, pero no se exportan.

## Taller 3D

El botón **Taller 3D** (barra superior, portada y cada ficha) abre una vitrina
interactiva. El visitante elige una pieza de la biblioteca, sube su modelo
(`.3mf`, `.stl`, `.glb`, `.obj`) o una foto que la IA convierte en 3D, y:

- **Pinta** con filamentos: pincel, relleno, gotero, deshacer, limpieza de
  bordes y manchas. Una textura se agrupa sola en N filamentos (OKLab, k-medias).
- **Separa en piezas**: cada color se corta por su frontera de pintura y se
  tapa como sólido cerrado, con despiece animado, caras de corte resaltadas y
  volumen, medidas y gramos por pieza.

Lee la pintura multicolor de Bambu Studio, OrcaSlicer y PrusaSlicer con la
misma subdivisión que el laminador (`src/lib/taller/pintura.ts`). Nada se
descarga: el botón final es pedir la pieza impresa por WhatsApp. Los archivos
del visitante se procesan en su navegador y no se suben.

`npm test` comprueba la geometría (piezas cerradas, volúmenes, pintura) y el proxy.

### Foto a 3D (Meshy)

La clave de Meshy no puede ir en una página pública, así que vive en un proxy
(`servidor/taller.ts`) que limita usos por IP y por día y sirve el modelo sin
exponer su enlace.

- **En local:** crea `.env.local` con `MESHY_API_KEY=msy_…` y `npm run dev`.
- **Publicado:** despliega el repo en Netlify (función `netlify/functions/taller.mts`)
  con las variables `MESHY_API_KEY` y `ORIGENES=https://fleremiasflemin20-maker.github.io`,
  y en GitHub → Settings → Variables → Actions crea `TALLER_API` con
  `https://<sitio>.netlify.app/api/taller`. Sin esa variable, la opción sale
  como "Próximamente".
