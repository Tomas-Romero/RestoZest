import "dotenv/config";
import { generateId } from "@resto-zest/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withContext } from "./client";
import { appendOrderEvent, materializeOrder } from "./orderProjection";
import {
  devices,
  kitchenTicketItems,
  kitchenTickets,
  orderEvents,
  orderItems,
  orders,
  priceLists,
  products,
  stations,
  tenants,
  users,
  venues,
} from "./schema";

describe("proyección de órdenes (order_events -> orders/order_items)", () => {
  const tenantId = generateId();
  const venueId = generateId();
  const userId = generateId();
  const deviceId = generateId();
  const productId = generateId();
  const priceListId = generateId();
  const orderId = generateId();
  const ctx = { tenantId, venueId };

  beforeAll(async () => {
    await withContext({ tenantId }, async (tx) => {
      await tx.insert(tenants).values({ id: tenantId, name: "Tenant proyección", slug: tenantId });
      await tx.insert(venues).values({ id: venueId, tenantId, name: "Venue", slug: venueId });
      await tx.insert(users).values({ id: userId, tenantId, fullName: "Mozo de prueba" });
    });
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.insert(devices).values({ id: deviceId, venueId, label: "Tablet 1", kind: "waiter", tokenHash: "x" });
      await tx.insert(products).values({ id: productId, venueId, name: "Empanada", basePriceCents: 150000, prepStation: "kitchen" });
      await tx.insert(priceLists).values({ id: priceListId, venueId, name: "Salón", channel: "salon" });
    });
  });

  afterAll(async () => {
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.delete(kitchenTicketItems).where(eq(kitchenTicketItems.venueId, venueId));
      await tx.delete(kitchenTickets).where(eq(kitchenTickets.venueId, venueId));
      await tx.delete(orderItems).where(eq(orderItems.venueId, venueId));
      await tx.delete(orderEvents).where(eq(orderEvents.venueId, venueId));
      await tx.delete(orders).where(eq(orders.venueId, venueId));
      await tx.delete(stations).where(eq(stations.venueId, venueId));
      await tx.delete(priceLists).where(eq(priceLists.venueId, venueId));
      await tx.delete(products).where(eq(products.venueId, venueId));
      await tx.delete(devices).where(eq(devices.venueId, venueId));
    });
    await withContext({ tenantId }, async (tx) => {
      await tx.delete(users).where(eq(users.tenantId, tenantId));
      await tx.delete(venues).where(eq(venues.tenantId, tenantId));
      await tx.delete(tenants).where(eq(tenants.id, tenantId));
    });
  });

  it("arma la orden y sus items a partir de los eventos, y crea la comanda al enviar a estación", async () => {
    const itemId = generateId();

    await appendOrderEvent(ctx, {
      id: generateId(),
      orderId,
      type: "order.created",
      payload: { venueId, sessionId: null, channel: "takeaway", code: "TA-001", priceListId },
      actorUserId: userId,
      deviceId,
      lamport: 1,
      occurredAt: new Date(),
    });
    await appendOrderEvent(ctx, {
      id: generateId(),
      orderId,
      type: "item.added",
      payload: {
        itemId,
        productId,
        variantId: null,
        nameSnapshot: "Empanada",
        unitPriceCents: 150000,
        qty: 2,
        modifiers: [],
        course: 1,
        prepStation: "kitchen",
      },
      actorUserId: userId,
      deviceId,
      lamport: 2,
      occurredAt: new Date(),
    });
    await materializeOrder(ctx, orderId, deviceId);

    const [orderRow] = await withContext(ctx, (tx) => tx.select().from(orders).where(eq(orders.id, orderId)));
    expect(orderRow?.status).toBe("open");
    expect(orderRow?.subtotalCents).toBe(300000);

    const [itemRow] = await withContext(ctx, (tx) => tx.select().from(orderItems).where(eq(orderItems.id, itemId)));
    expect(itemRow?.nameSnapshot).toBe("Empanada");
    expect(itemRow?.status).toBe("pending");

    const sentEventId = generateId();
    await appendOrderEvent(ctx, {
      id: sentEventId,
      orderId,
      type: "order.sent_to_station",
      payload: { itemIds: [itemId] },
      actorUserId: userId,
      deviceId,
      lamport: 3,
      occurredAt: new Date(),
    });
    const state = await materializeOrder(ctx, orderId, deviceId, {
      id: sentEventId,
      orderId,
      type: "order.sent_to_station",
      payload: { itemIds: [itemId] },
      actorUserId: userId,
      deviceId,
      lamport: 3,
      occurredAt: new Date().toISOString(),
    });
    expect(state?.status).toBe("sent");

    const tickets = await withContext(ctx, (tx) => tx.select().from(kitchenTickets).where(eq(kitchenTickets.orderId, orderId)));
    expect(tickets).toHaveLength(1);
    expect(tickets[0]?.status).toBe("pending");

    const ticketItems = await withContext(ctx, (tx) =>
      tx.select().from(kitchenTicketItems).where(eq(kitchenTicketItems.ticketId, tickets[0]!.id)),
    );
    expect(ticketItems.map((t) => t.orderItemId)).toEqual([itemId]);
  });

  it("reenviar el mismo evento (mismo id) es un no-op idempotente", async () => {
    const dupOrderId = generateId();
    const eventId = generateId();
    const input = {
      id: eventId,
      orderId: dupOrderId,
      type: "order.created" as const,
      payload: { venueId, sessionId: null, channel: "takeaway" as const, code: "TA-DUP", priceListId },
      actorUserId: userId,
      deviceId,
      lamport: 1,
      occurredAt: new Date(),
    };

    const first = await appendOrderEvent(ctx, input);
    const second = await appendOrderEvent(ctx, input);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);

    const rows = await withContext(ctx, (tx) => tx.select().from(orderEvents).where(eq(orderEvents.orderId, dupOrderId)));
    expect(rows).toHaveLength(1);

    await withContext(ctx, (tx) => tx.delete(orderEvents).where(eq(orderEvents.orderId, dupOrderId)));
  });
});
