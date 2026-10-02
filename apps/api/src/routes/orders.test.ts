import "dotenv/config";
import { generateId } from "@resto-zest/domain";
import {
  devices,
  hashPassword,
  kitchenTicketItems,
  kitchenTickets,
  memberships,
  orderEvents,
  orderItems,
  orders,
  priceLists,
  products,
  sessions,
  stations,
  tenants,
  users,
  venues,
  withContext,
} from "@resto-zest/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";

describe("POST /venues/:venueId/orders/:orderId/events", () => {
  const tenantId = generateId();
  const venueId = generateId();
  const ownerId = generateId();
  const email = `owner-${ownerId}@orders.test`;
  const password = "correcto-horse-battery-staple";
  const deviceId = generateId();
  const productId = generateId();
  const priceListId = generateId();
  const orderId = generateId();
  let app: FastifyInstance;
  let cookie: string;

  function extractCookie(response: { headers: Record<string, unknown> }): string {
    const setCookie = response.headers["set-cookie"];
    const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    return String(raw).split(";")[0]!;
  }

  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    await withContext({ tenantId }, async (tx) => {
      await tx.insert(tenants).values({ id: tenantId, name: "Tenant orders test", slug: tenantId });
      await tx.insert(venues).values({ id: venueId, tenantId, name: "Venue", slug: venueId });
      await tx.insert(users).values({ id: ownerId, tenantId, fullName: "Owner", email, passwordHash, active: true });
    });
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.insert(memberships).values({ userId: ownerId, venueId, role: "owner" });
      await tx.insert(devices).values({ id: deviceId, venueId, label: "Tablet 1", kind: "waiter", tokenHash: "x" });
      await tx.insert(products).values({ id: productId, venueId, name: "Empanada", basePriceCents: 150000, prepStation: "kitchen" });
      await tx.insert(priceLists).values({ id: priceListId, venueId, name: "Salón", channel: "salon" });
    });

    app = await buildApp({ logger: false });
    await app.ready();
    const loginRes = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
    cookie = extractCookie(loginRes);
  });

  afterAll(async () => {
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.delete(memberships).where(eq(memberships.venueId, venueId));
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
      await tx.delete(sessions).where(eq(sessions.tenantId, tenantId));
      await tx.delete(users).where(eq(users.tenantId, tenantId));
      await tx.delete(venues).where(eq(venues.tenantId, tenantId));
      await tx.delete(tenants).where(eq(tenants.id, tenantId));
    });
    await app.close();
  });

  it("sin sesión, 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/orders/${orderId}/events`,
      payload: { id: generateId(), type: "order.created", payload: {}, deviceId, lamport: 1, occurredAt: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rechaza un evento con payload inválido (400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/orders/${orderId}/events`,
      headers: { cookie },
      payload: { id: generateId(), type: "order.created", payload: { channel: "no-existe" }, deviceId, lamport: 1, occurredAt: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(400);
  });

  it("crea la orden, agrega un item, lo envía a estación, y el GET refleja la proyección", async () => {
    const itemId = generateId();

    const createRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/orders/${orderId}/events`,
      headers: { cookie },
      payload: {
        id: generateId(),
        type: "order.created",
        payload: { sessionId: null, channel: "takeaway", code: "TA-100", priceListId },
        deviceId,
        lamport: 1,
        occurredAt: new Date().toISOString(),
      },
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.json().order.status).toBe("open");

    const addRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/orders/${orderId}/events`,
      headers: { cookie },
      payload: {
        id: generateId(),
        type: "item.added",
        payload: {
          itemId,
          productId,
          nameSnapshot: "Empanada",
          unitPriceCents: 150000,
          qty: 3,
          modifiers: [],
          course: 1,
          prepStation: "kitchen",
        },
        deviceId,
        lamport: 2,
        occurredAt: new Date().toISOString(),
      },
    });
    expect(addRes.statusCode).toBe(201);
    expect(addRes.json().order.items[itemId].qty).toBe(3);

    const sendEventId = generateId();
    const sendRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/orders/${orderId}/events`,
      headers: { cookie },
      payload: {
        id: sendEventId,
        type: "order.sent_to_station",
        payload: { itemIds: [itemId] },
        deviceId,
        lamport: 3,
        occurredAt: new Date().toISOString(),
      },
    });
    expect(sendRes.statusCode).toBe(201);
    expect(sendRes.json().order.status).toBe("sent");

    // reenviar el mismo evento (mismo id) es idempotente: 200, no 201, y no duplica la comanda
    const resendRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/orders/${orderId}/events`,
      headers: { cookie },
      payload: {
        id: sendEventId,
        type: "order.sent_to_station",
        payload: { itemIds: [itemId] },
        deviceId,
        lamport: 3,
        occurredAt: new Date().toISOString(),
      },
    });
    expect(resendRes.statusCode).toBe(200);
    expect(resendRes.json().duplicate).toBe(true);

    const getRes = await app.inject({ method: "GET", url: `/venues/${venueId}/orders/${orderId}`, headers: { cookie } });
    expect(getRes.statusCode).toBe(200);
    const body = getRes.json();
    expect(body.status).toBe("sent");
    expect(body.subtotalCents).toBe(450000);
    expect(body.items).toHaveLength(1);

    const tickets = await withContext({ tenantId, venueId }, (tx) => tx.select().from(kitchenTickets).where(eq(kitchenTickets.orderId, orderId)));
    expect(tickets).toHaveLength(1); // el reenvío no creó una segunda comanda
  });

  it("404 para una orden que no existe", async () => {
    const res = await app.inject({ method: "GET", url: `/venues/${venueId}/orders/${generateId()}`, headers: { cookie } });
    expect(res.statusCode).toBe(404);
  });
});
