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

## Modo consola

La portada se juega como un videojuego (`src/lib/consola.ts`):

- **Pantalla de título** "Pulsa START" la primera vez de cada visita (`Inicio.tsx`).
- **Logros y colección** (L / Start): cada figura que se ve en 3D cuenta para
  la colección; hay trofeos por secciones completas, acabados, equipo,
  ruleta, foto y mando, con nivel de jugador. Se guarda en el navegador.
- **Selección aleatoria** (R / Select): ruleta que frena en una figura.
- **Modo foto** (P / clic del stick derecho): descarga un PNG de la figura
  con su nombre y la marca de la biblioteca.
- **Mando**: al conectarlo la barra enseña sus botones (A, X, Y, LB/RB,
  LT/RT) y vibra al moverse y al confirmar.
- Efectos de sonido (WebAudio, sin archivos), apagados por defecto.

## Sala del estudio

Botón **Estudio 3D** (o `#estudio`): las obras en pedestales alrededor de un
estudio circular, con luces de estudio, atardecer, neón o noche y modos
color, arcilla y malla (`src/estudio/sala/`). Dragon Ball y Caballeros del
Zodiaco no entran en la sala pública (`AJENAS` en `Sala.tsx`): siguen en la
tienda.

## Pintar y separar

El botón **Pintar y separar** de cada ficha y **Studio 3D** de la barra abren
[Flemin Studio 3D](https://flemin-studio-3d.analista-datos-pro.workers.dev/),
la web aparte con el separador por colores, cortes y cama, el editor y "Foto
a 3D". Recibe la obra por la URL (`src/lib/studio.ts`) y la abre en modo
protegido: se separa y se mide, pero no se descarga.
