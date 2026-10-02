import type { OrderEvent, OrderState } from "./orderEvents";

/**
 * Reductor puro: pliega el log de order_events a un OrderState. Es la única
 * lógica que sabe qué significa cada tipo de evento — los endpoints no hacen
 * UPDATE directo sobre orders/order_items, solo insertan eventos y llaman a
 * esto para proyectar.
 *
 * Determinismo de replay: se ordena SIEMPRE por (lamport, device_id) antes
 * de plegar, sin importar en qué orden llegaron los eventos. Eso es lo que
 * permite borrar las proyecciones y reconstruirlas exactamente iguales.
 */
export function reduceOrderEvents(events: OrderEvent[]): OrderState | null {
  if (events.length === 0) return null;

  const sorted = [...events].sort(compareByLamportThenDevice);

  let state: OrderState | null = null;
  for (const event of sorted) {
    state = applyEvent(state, event);
  }
  return state;
}

function compareByLamportThenDevice(a: OrderEvent, b: OrderEvent): number {
  if (a.lamport !== b.lamport) return a.lamport - b.lamport;
  if (a.deviceId < b.deviceId) return -1;
  if (a.deviceId > b.deviceId) return 1;
  return 0;
}

function applyEvent(state: OrderState | null, event: OrderEvent): OrderState {
  if (!state && event.type !== "order.created") {
    throw new Error(`Log de eventos corrupto: "${event.type}" llegó antes que "order.created" (order ${event.orderId})`);
  }

  switch (event.type) {
    case "order.created": {
      const { payload } = event;
      return {
        id: event.orderId,
        venueId: payload.venueId,
        sessionId: payload.sessionId,
        channel: payload.channel,
        code: payload.code,
        priceListId: payload.priceListId,
        status: "open",
        items: {},
        createdAt: event.occurredAt,
      };
    }

    case "item.added": {
      const current = state!;
      const { payload } = event;
      return {
        ...current,
        items: {
          ...current.items,
          [payload.itemId]: {
            id: payload.itemId,
            productId: payload.productId,
            variantId: payload.variantId ?? null,
            nameSnapshot: payload.nameSnapshot,
            unitPriceCents: payload.unitPriceCents,
            costSnapshotCents: payload.costSnapshotCents ?? null,
            qty: payload.qty,
            modifiers: payload.modifiers,
            note: payload.note ?? null,
            course: payload.course,
            prepStation: payload.prepStation,
            status: "pending",
            voidReason: null,
          },
        },
      };
    }

    case "item.qty_changed": {
      return updateItem(state!, event.payload.itemId, (item) => ({ ...item, qty: event.payload.qty }));
    }

    case "item.voided": {
      return updateItem(state!, event.payload.itemId, (item) => ({
        ...item,
        status: "void",
        voidReason: event.payload.reason,
      }));
    }

    case "item.status_changed": {
      return updateItem(state!, event.payload.itemId, (item) => ({ ...item, status: event.payload.status }));
    }

    case "order.sent_to_station": {
      const current = state!;
      return current.status === "open" ? { ...current, status: "sent" } : current;
    }

    case "order.closed": {
      return { ...state!, status: "served" };
    }

    case "order.reopened": {
      return { ...state!, status: "sent" };
    }
  }
}

/**
 * Actualiza un item si existe; si el evento referencia un item que no está
 * en el estado (log corrupto o evento fuera de orden causal), no explota el
 * replay — lo ignora. Distinto de "order.created" faltante, que sí es un
 * error real de secuencia.
 */
function updateItem(
  state: OrderState,
  itemId: string,
  updater: (item: OrderState["items"][string]) => OrderState["items"][string],
): OrderState {
  const item = state.items[itemId];
  if (!item) return state;
  return { ...state, items: { ...state.items, [itemId]: updater(item) } };
}
