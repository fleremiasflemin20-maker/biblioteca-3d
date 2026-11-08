# Club Flemin · suscripción mensual de descargas

Quien crea una cuenta en la Biblioteca y tiene la suscripción activa puede
descargar **todos** los archivos de impresión (STL, 3MF, STEP…) de los modelos
del Club, sin límite. Solo funciona en Cloudflare
(https://biblioteca-3d.fleremiasflemin.workers.dev); en GitHub Pages el botón
del Club no aparece porque allí no hay servidor.

```
Navegador ──► Worker (worker/index.ts) ──► D1  (cuentas, sesiones, suscripciones)
                     │                └──► R2  (archivos de impresión, privados)
                     └──► PayPal (confirma el pago y avisa de renovaciones/cancelaciones)
```

- **Cuentas:** correo + contraseña (cifrada con PBKDF2). Sesión de 30 días en una cookie segura.
- **Cobro:** suscripción mensual de PayPal (cuenta PayPal o tarjeta), o **activación manual**
  desde el panel de administrador para quien pague por transferencia o Deuna.
- **Archivos:** en R2 bajo `modelos/<id-del-catálogo>/`. Un modelo entra al Club en cuanto
  tiene un archivo ahí. Se descargan solo con la suscripción activa, y queda registro.

## Puesta en marcha (una sola vez, en PowerShell, en `C:\Users\flere\biblioteca-3d`)

1. **Bajar el código**
   ```powershell
   git pull
   npm ci
   ```
2. **Crear la base de datos y el almacén** (R2 debe estar activado en
   dash.cloudflare.com → R2; el plan gratis da 10 GB):
   ```powershell
   npm run club:preparar
   git add wrangler.jsonc; git commit -m "Club: id de la base de datos"; git push
   ```
3. **PayPal** (primero en modo de prueba, *sandbox*):
   - Cuenta PayPal **Business** de Ecuador → https://developer.paypal.com → *Apps & Credentials*
     → *Create App*. Copia el **Client ID** y el **Secret**.
   - Crea el plan mensual (el número es el precio en USD):
     ```powershell
     $env:PAYPAL_CLIENT_ID="AQUÍ_EL_CLIENT_ID"; $env:PAYPAL_SECRETO="AQUÍ_EL_SECRET"; $env:PAYPAL_ENTORNO="sandbox"
     npm run club:plan -- 9.99
     ```
   - Pon en `wrangler.jsonc` → `vars`: `PAYPAL_CLIENT_ID`, `PAYPAL_PLAN_ID` y `PRECIO_CLUB`.
   - Guarda el secreto en Cloudflare (no va en GitHub):
     ```powershell
     npx wrangler secret put PAYPAL_SECRETO
     ```
   - En la app de PayPal → *Webhooks* → *Add webhook*:
     URL `https://biblioteca-3d.fleremiasflemin.workers.dev/api/paypal/webhook`,
     eventos `BILLING.SUBSCRIPTION.*` y `PAYMENT.SALE.COMPLETED`.
4. **Administrador:** en `wrangler.jsonc`, `ADMIN_CORREOS` lleva el correo con el que te
   registrarás en la web (por defecto `fleremias@outlook.com`). Con esa cuenta, el panel
   del Club muestra la lista de socios y el formulario para activar días a mano.
5. **Publicar:** `npm run desplegar`.
6. **Probar** con una cuenta comprador de prueba de PayPal (developer.paypal.com →
   *Sandbox accounts*). Cuando todo funcione, repite el paso 3 con `PAYPAL_ENTORNO="live"`
   y las credenciales *Live*, cambia `"PAYPAL_ENTORNO": "live"` en `wrangler.jsonc` y vuelve a desplegar.

## Subir archivos al Club

1. Crea `archivos-club\<id-del-modelo>\` (el `id` de `src/data/catalogo.json`) y copia ahí
   sus STL/3MF. Usa nombres sin tildes, p. ej. `goku-ss4-120mm.3mf`. Esa carpeta no se sube a GitHub.
2. `npm run club:subir` (o `npm run club:subir -- goku` para solo los que contienen "goku").

No hace falta volver a desplegar: los archivos aparecen en la ficha al momento.

## Cobros por transferencia o Deuna

El cliente crea su cuenta, pulsa **Pagar por transferencia o Deuna** (abre WhatsApp con su
correo escrito) y te paga. Tú entras al Club con tu cuenta de administrador, escribes su
correo y pulsas **Activar 30 días**. **Cortar** quita la suscripción al momento.

## Probar en tu PC sin tocar producción

```powershell
npm run club:local     # http://localhost:8787, con base de datos y R2 locales
```

## Bueno saberlo

- Las vistas 3D (`public/models/*.glb`) siguen siendo públicas porque el visor las necesita.
  Lo que protege el Club son los archivos listos para imprimir (piezas separadas, 3MF con colores,
  versiones a escala). Si se quiere más protección, se pueden publicar vistas 3D más ligeras.
- Cobrar por descargar personajes con marca (Dragon Ball, Marvel, DC…) tiene riesgo legal.
  Lo más seguro es que el Club tenga diseños propios y piezas útiles.
- El cliente cancela la renovación desde su cuenta de PayPal; sigue descargando hasta el final
  del mes pagado.
