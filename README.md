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
