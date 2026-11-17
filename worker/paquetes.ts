/*
 * Paquetes de descarga: colecciones que se venden enteras. En la web solo se
 * ven sus fotos (src/data/paquetes.json); los archivos viven en R2 bajo
 * `paquetes/<id>/` y solo los bajan quienes compraron el paquete o tienen el
 * Club activo. Ids y precios tienen que coincidir con los de paquetes.json
 * (lo comprueba pruebas/paquetes.test.ts).
 */
export const PRECIOS: Record<string, string> = {
  'dragon-ball-z-01': '2.50',
}

export const PREFIJO_PAQUETES = 'paquetes/'

export const paqueteValido = (id: string) => Object.hasOwn(PRECIOS, id)
export const precioPaquete = (id: string) => PRECIOS[id]

/** Puede bajar un paquete quien lo compró o quien tiene el Club activo. */
export const puedeBajarPaquete = (paquete: string, comprados: readonly string[], clubActivo: boolean) =>
  paqueteValido(paquete) && (clubActivo || comprados.includes(paquete))

export type PedidoPayPal = {
  status?: string
  purchase_units?: {
    custom_id?: string
    payments?: { captures?: { status?: string; custom_id?: string; amount?: { currency_code?: string; value?: string } }[] }
  }[]
}

/**
 * ¿El pedido capturado en PayPal es el pago completo de este paquete por esta cuenta?
 * Se mira lo que dice PayPal, nunca lo que mande el navegador.
 */
export function pagoCompleto(p: PedidoPayPal, usuarioId: string, paquete: string) {
  if (p.status !== 'COMPLETED') return false
  const u = p.purchase_units?.[0]
  const c = u?.payments?.captures?.[0]
  const custom = c?.custom_id ?? u?.custom_id
  return (
    custom === `${usuarioId}|${paquete}` &&
    c?.status === 'COMPLETED' &&
    c.amount?.currency_code === 'USD' &&
    Number(c.amount.value) >= Number(precioPaquete(paquete))
  )
}
