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

## Flemin Studio 3D (separador y editor)

El separador de piezas y el editor 3D son **Flemin Studio 3D**, una web
aparte: https://flemin-studio-3d.analista-datos-pro.workers.dev/
(su código está en el repo privado `flemin-studio-3d`).

Los botones **Studio 3D**, **Separar en piezas** y **Modelar en 3D** abren
esa web, y en la sala cada obra tiene **Separar en el Studio**, que la abre
allí por la URL (`?modelo=…&nombre=…#separador`) en modo protegido: se
separa para verla, pero no se descarga. Los enlaces viejos `#separador` y
`#editor` redirigen al Studio. La enlaza `src/lib/studio.ts`.

## Sala del estudio

Botón **Estudio 3D** (o `#estudio`): las obras en pedestales alrededor de un
estudio circular, con luces de estudio, atardecer, neón o noche y modos
color, arcilla y malla (`src/estudio/sala/`). Dragon Ball y Caballeros del
Zodiaco no entran en la sala pública (`AJENAS` en `Sala.tsx`): siguen en la
tienda.

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
