/**
 * Tipos del log de eventos de órdenes (Fase 3). El subconjunto de tipos de
 * evento cubre solo lo que necesita el núcleo operativo (mozo + KDS); los
 * eventos de pago/descuento/división llegan con Fase 4 — se agregan ahí sin
 * tocar esto, porque `type` es texto libre, no un enum de base de datos.
 */

export type OrderItemStatus = "pending" | "preparing" | "ready" | "served" | "void";
export type OrderChannel = "dine_in" | "takeaway" | "delivery" | "qr_self";
export type OrderStatus = "open" | "sent" | "served" | "paid" | "void";

export type OrderModifier = { id: string; name: string; deltaCents: number };

export type OrderCreatedPayload = {
  venueId: string;
  sessionId: string | null;
  channel: OrderChannel;
  code: string;
  priceListId: string;
};

export type ItemAddedPayload = {
  itemId: string;
  productId: string;
  variantId?: string | null;
  nameSnapshot: string;
  unitPriceCents: number;
  costSnapshotCents?: number | null;
  qty: number;
  modifiers: OrderModifier[];
  note?: string | null;
  course: number;
  prepStation: string;
};

export type ItemQtyChangedPayload = { itemId: string; qty: number };
export type ItemVoidedPayload = { itemId: string; reason: string };
export type ItemStatusChangedPayload = { itemId: string; status: OrderItemStatus };
export type OrderSentToStationPayload = { itemIds: string[] };

export type OrderEvent =
  | { id: string; orderId: string; type: "order.created"; payload: OrderCreatedPayload; actorUserId: string; deviceId: string; lamport: number; occurredAt: string }
  | { id: string; orderId: string; type: "item.added"; payload: ItemAddedPayload; actorUserId: string; deviceId: string; lamport: number; occurredAt: string }
  | { id: string; orderId: string; type: "item.qty_changed"; payload: ItemQtyChangedPayload; actorUserId: string; deviceId: string; lamport: number; occurredAt: string }
  | { id: string; orderId: string; type: "item.voided"; payload: ItemVoidedPayload; actorUserId: string; deviceId: string; lamport: number; occurredAt: string }
  | { id: string; orderId: string; type: "item.status_changed"; payload: ItemStatusChangedPayload; actorUserId: string; deviceId: string; lamport: number; occurredAt: string }
  | { id: string; orderId: string; type: "order.sent_to_station"; payload: OrderSentToStationPayload; actorUserId: string; deviceId: string; lamport: number; occurredAt: string }
  | { id: string; orderId: string; type: "order.closed"; payload: Record<string, never>; actorUserId: string; deviceId: string; lamport: number; occurredAt: string }
  | { id: string; orderId: string; type: "order.reopened"; payload: Record<string, never>; actorUserId: string; deviceId: string; lamport: number; occurredAt: string };

export type OrderEventType = OrderEvent["type"];

export type OrderItemState = {
  id: string;
  productId: string;
  variantId: string | null;
  nameSnapshot: string;
  unitPriceCents: number;
  costSnapshotCents: number | null;
  qty: number;
  modifiers: OrderModifier[];
  note: string | null;
  course: number;
  prepStation: string;
  status: OrderItemStatus;
  voidReason: string | null;
};

export type OrderState = {
  id: string;
  venueId: string;
  sessionId: string | null;
  channel: OrderChannel;
  code: string;
  priceListId: string;
  status: OrderStatus;
  items: Record<string, OrderItemState>;
  createdAt: string;
};
