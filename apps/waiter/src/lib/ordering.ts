import { generateId } from "@resto-zest/domain";

export type CartModifier = { id: string; name: string; deltaCents: number };

export type CartItem = {
  itemId: string;
  productId: string;
  variantId: string | null;
  name: string;
  unitPriceCents: number; // precio base (de la lista del canal) + delta de la variante, congelado al agregar
  costSnapshotCents: number | null;
  qty: number;
  modifiers: CartModifier[];
  note: string | null;
  course: number;
  prepStation: string;
};

export type OutgoingEvent = {
  id: string;
  type: "order.created" | "item.added" | "order.sent_to_station";
  payload: Record<string, unknown>;
  deviceId: string;
  lamport: number;
  occurredAt: string;
};

export type SendBatch = { events: OutgoingEvent[]; nextLamport: number };

export function cartItemTotalCents(item: CartItem): number {
  const modifiersCents = item.modifiers.reduce((sum, m) => sum + m.deltaCents, 0);
  return Math.round(item.qty * (item.unitPriceCents + modifiersCents));
}

/**
 * Convierte el carrito en los eventos que se mandan a la API. Los ids de
 * evento se generan UNA vez acá y el caller conserva el lote: si un envío
 * falla a mitad de camino, reintentar manda los mismos ids y el backend los
 * trata como duplicados (idempotencia), sin crear ítems dobles.
 */
export function buildSendBatch(args: {
  orderId: string;
  existingOrder: boolean;
  sessionId: string;
  tableCode: string;
  priceListId: string;
  deviceId: string;
  startLamport: number;
  items: CartItem[];
}): SendBatch {
  let lamport = args.startLamport;
  const occurredAt = new Date().toISOString();
  const events: OutgoingEvent[] = [];

  const push = (type: OutgoingEvent["type"], payload: Record<string, unknown>) => {
    events.push({ id: generateId(), type, payload, deviceId: args.deviceId, lamport: lamport++, occurredAt });
  };

  if (!args.existingOrder) {
    push("order.created", {
      sessionId: args.sessionId,
      channel: "dine_in",
      // Legible para el personal: mesa + cola aleatoria del UUID (único por venue).
      code: `M${args.tableCode}-${args.orderId.slice(-5).toUpperCase()}`,
      priceListId: args.priceListId,
    });
  }

  for (const item of args.items) {
    push("item.added", {
      itemId: item.itemId,
      productId: item.productId,
      variantId: item.variantId,
      nameSnapshot: item.name,
      unitPriceCents: item.unitPriceCents,
      costSnapshotCents: item.costSnapshotCents,
      qty: item.qty,
      modifiers: item.modifiers,
      note: item.note,
      course: item.course,
      prepStation: item.prepStation,
    });
  }

  push("order.sent_to_station", { itemIds: args.items.map((i) => i.itemId) });
  return { events, nextLamport: lamport };
}
