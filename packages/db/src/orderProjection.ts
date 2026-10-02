import {
  type OrderEvent,
  type OrderItemState,
  computeOrderSubtotalCents,
  generateId,
  reduceOrderEvents,
} from "@resto-zest/domain";
import { and, eq, isNull } from "drizzle-orm";
import type { Tx } from "./client";
import { withContext } from "./client";
import { kitchenTicketItems, kitchenTickets, orderEvents, orderItems, orders, stations } from "./schema";

export type NewOrderEventInput = {
  id: string;
  orderId: string;
  type: OrderEvent["type"];
  payload: Record<string, unknown>;
  actorUserId: string;
  deviceId: string;
  lamport: number;
  occurredAt: Date;
};

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "23505";
}

/**
 * Única vía de escritura de una orden. Reenviar el mismo evento (mismo id =
 * UUIDv7 del cliente) es un no-op: el PK lo rechaza y acá se traduce a
 * `{ duplicate: true }` en vez de un error — necesario para reintentos de
 * red incluso estando 100% online (Fase 3 todavía no tiene hub/outbox).
 */
export async function appendOrderEvent(
  ctx: { tenantId: string; venueId: string },
  input: NewOrderEventInput,
): Promise<{ duplicate: boolean }> {
  // El catch va AFUERA de withContext a propósito: si se captura el error
  // adentro de la transacción, Postgres ya la abortó y el intento de COMMIT
  // que hace drizzle al "volver bien" del callback tira un error distinto
  // (transacción abortada), tapando el 23505 real.
  try {
    await withContext(ctx, async (tx) => {
      await tx.insert(orderEvents).values({
        id: input.id,
        venueId: ctx.venueId,
        orderId: input.orderId,
        type: input.type,
        payload: input.payload,
        actorUserId: input.actorUserId,
        deviceId: input.deviceId,
        lamport: input.lamport,
        occurredAt: input.occurredAt,
        receivedAt: new Date(),
      });
    });
    return { duplicate: false };
  } catch (err) {
    if (isUniqueViolation(err)) return { duplicate: true };
    throw err;
  }
}

async function loadOrderEvents(tx: Tx, orderId: string): Promise<OrderEvent[]> {
  const rows = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, orderId));
  return rows.map(
    (row) =>
      ({
        id: row.id,
        orderId: row.orderId,
        type: row.type,
        payload: row.payload,
        actorUserId: row.actorUserId,
        deviceId: row.deviceId,
        lamport: row.lamport,
        occurredAt: row.occurredAt.toISOString(),
      }) as OrderEvent,
  );
}

async function findOrCreateStation(tx: Tx, venueId: string, kind: string): Promise<string> {
  const existing = await tx
    .select({ id: stations.id })
    .from(stations)
    .where(and(eq(stations.kind, kind), isNull(stations.deletedAt)))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const names: Record<string, string> = { kitchen: "Cocina", bar: "Barra", grill: "Parrilla" };
  const id = generateId();
  await tx.insert(stations).values({ id, venueId, name: names[kind] ?? kind, kind });
  return id;
}

/**
 * Crea una comanda (kitchen_ticket) por estación involucrada en un envío,
 * agrupando los order_items que se mandaron juntos. Es lo que el KDS muestra
 * como una tarjeta con cronómetro — arranca en el created_at del ticket, no
 * en el del evento.
 */
async function createKitchenTickets(
  tx: Tx,
  venueId: string,
  orderId: string,
  items: OrderItemState[],
): Promise<void> {
  const itemsByStation = new Map<string, OrderItemState[]>();
  for (const item of items) {
    const list = itemsByStation.get(item.prepStation) ?? [];
    list.push(item);
    itemsByStation.set(item.prepStation, list);
  }

  for (const [kind, stationItems] of itemsByStation) {
    const stationId = await findOrCreateStation(tx, venueId, kind);
    const ticketId = generateId();
    await tx.insert(kitchenTickets).values({ id: ticketId, venueId, orderId, stationId });
    await tx.insert(kitchenTicketItems).values(
      stationItems.map((item) => ({ venueId, ticketId, orderItemId: item.id })),
    );
  }
}

/**
 * Vuelve a plegar TODO el log de la orden y sobreescribe las proyecciones
 * (orders/order_items) para que coincidan. Es literalmente el criterio de
 * "listo cuando" de la fase: se puede borrar orders/order_items y
 * reconstruirlos desde order_events sin perder nada.
 */
export async function materializeOrder(
  ctx: { tenantId: string; venueId: string },
  orderId: string,
  originDeviceId: string,
  newEvent?: OrderEvent,
) {
  return withContext(ctx, async (tx) => {
    const events = await loadOrderEvents(tx, orderId);
    const state = reduceOrderEvents(events);
    if (!state) return null;

    const subtotalCents = computeOrderSubtotalCents(state);

    await tx
      .insert(orders)
      .values({
        id: state.id,
        venueId: ctx.venueId,
        sessionId: state.sessionId,
        channel: state.channel,
        code: state.code,
        status: state.status,
        priceListId: state.priceListId,
        subtotalCents,
        totalCents: subtotalCents, // sin descuento/servicio todavía — Fase 4
        originDeviceId,
        createdAt: new Date(state.createdAt),
      })
      .onConflictDoUpdate({
        target: orders.id,
        set: { status: state.status, subtotalCents, totalCents: subtotalCents },
      });

    for (const item of Object.values(state.items)) {
      await tx
        .insert(orderItems)
        .values({
          id: item.id,
          venueId: ctx.venueId,
          orderId: state.id,
          productId: item.productId,
          variantId: item.variantId,
          nameSnapshot: item.nameSnapshot,
          unitPriceCents: item.unitPriceCents,
          costSnapshotCents: item.costSnapshotCents,
          qty: String(item.qty),
          modifiers: item.modifiers,
          note: item.note,
          course: item.course,
          prepStation: item.prepStation,
          status: item.status,
          voidReason: item.voidReason,
        })
        .onConflictDoUpdate({
          target: orderItems.id,
          set: { qty: String(item.qty), status: item.status, voidReason: item.voidReason },
        });
    }

    if (newEvent?.type === "order.sent_to_station") {
      const sentItems = newEvent.payload.itemIds
        .map((itemId) => state.items[itemId])
        .filter((item): item is OrderItemState => item !== undefined);
      if (sentItems.length > 0) {
        await createKitchenTickets(tx, ctx.venueId, state.id, sentItems);
      }
    }

    return state;
  });
}
