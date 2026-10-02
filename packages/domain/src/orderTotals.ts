import type { OrderState } from "./orderEvents";

/**
 * Subtotal a partir del estado proyectado: excluye ítems anulados, suma el
 * delta de los modificadores antes de multiplicar por cantidad. Sin
 * descuentos ni servicio de mesa todavía — eso es Fase 4 (POS y caja).
 */
export function computeOrderSubtotalCents(state: OrderState): number {
  return Object.values(state.items)
    .filter((item) => item.status !== "void")
    .reduce((sum, item) => {
      const modifiersCents = item.modifiers.reduce((total, modifier) => total + modifier.deltaCents, 0);
      return sum + Math.round(item.qty * (item.unitPriceCents + modifiersCents));
    }, 0);
}
