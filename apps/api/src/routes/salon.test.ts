import "dotenv/config";
import {
  areas,
  devices,
  hashPassword,
  memberships,
  orderItems,
  orders,
  prices,
  priceLists,
  products,
  sessions,
  tableSessions,
  tables,
  tenants,
  users,
  venues,
  withContext,
} from "@resto-zest/db";
import { generateId } from "@resto-zest/domain";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";

describe("salón: plano, dispositivos y sesiones de mesa", () => {
  const tenantId = generateId();
  const venueId = generateId();
  const ownerId = generateId();
  const waiterId = generateId();
  const email = `owner-${ownerId}@salon.test`;
  const password = "correcto-horse-battery-staple";
  let app: FastifyInstance;
  let ownerCookie: string;
  let waiterCookie: string;

  function cookieOf(res: { headers: Record<string, unknown> }): string {
    const raw = res.headers["set-cookie"];
    return String(Array.isArray(raw) ? raw[0] : raw).split(";")[0]!;
  }

  beforeAll(async () => {
    await withContext({ tenantId }, async (tx) => {
      await tx.insert(tenants).values({ id: tenantId, name: "Tenant salón", slug: tenantId });
      await tx.insert(venues).values({ id: venueId, tenantId, name: "Venue", slug: venueId });
      await tx.insert(users).values([
        { id: ownerId, tenantId, fullName: "Owner", email, passwordHash: await hashPassword(password) },
        { id: waiterId, tenantId, fullName: "Mozo", pinHash: await hashPassword("2468") },
      ]);
    });
    await withContext({ tenantId, venueId }, (tx) =>
      tx.insert(memberships).values([
        { userId: ownerId, venueId, role: "owner" },
        { userId: waiterId, venueId, role: "waiter" },
      ]),
    );
    app = await buildApp({ logger: false });
    await app.ready();
    ownerCookie = cookieOf(await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } }));
    waiterCookie = cookieOf(
      await app.inject({ method: "POST", url: `/venues/${venueId}/auth/pin-login`, payload: { pin: "2468" } }),
    );
  });

  afterAll(async () => {
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.delete(orderItems).where(eq(orderItems.venueId, venueId));
      await tx.delete(orders).where(eq(orders.venueId, venueId));
      await tx.delete(tableSessions).where(eq(tableSessions.venueId, venueId));
      await tx.delete(tables).where(eq(tables.venueId, venueId));
      await tx.delete(areas).where(eq(areas.venueId, venueId));
      await tx.delete(devices).where(eq(devices.venueId, venueId));
      await tx.delete(prices).where(eq(prices.venueId, venueId));
      await tx.delete(priceLists).where(eq(priceLists.venueId, venueId));
      await tx.delete(products).where(eq(products.venueId, venueId));
      await tx.delete(memberships).where(eq(memberships.venueId, venueId));
    });
    await withContext({ tenantId }, async (tx) => {
      await tx.delete(sessions).where(eq(sessions.tenantId, tenantId));
      await tx.delete(users).where(eq(users.tenantId, tenantId));
      await tx.delete(venues).where(eq(venues.tenantId, tenantId));
      await tx.delete(tenants).where(eq(tenants.id, tenantId));
    });
    await app.close();
  });

  it("el owner arma el plano; el mozo lo lee pero no puede crear mesas (403)", async () => {
    const areaRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/areas`,
      headers: { cookie: ownerCookie },
      payload: { name: "Salón" },
    });
    expect(areaRes.statusCode).toBe(201);

    const tableRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/tables`,
      headers: { cookie: ownerCookie },
      payload: { code: "7", areaId: areaRes.json().id, posX: 10, posY: 20 },
    });
    expect(tableRes.statusCode).toBe(201);
    expect(tableRes.json().qrToken).toMatch(/^qr_/);

    const forbidden = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/tables`,
      headers: { cookie: waiterCookie },
      payload: { code: "8" },
    });
    expect(forbidden.statusCode).toBe(403);

    const floor = await app.inject({ method: "GET", url: `/venues/${venueId}/floor`, headers: { cookie: waiterCookie } });
    expect(floor.statusCode).toBe(200);
    expect(floor.json().tables).toHaveLength(1);
    expect(floor.json().tables[0].session).toBeNull();
  });

  it("el mozo registra su dispositivo, abre una mesa, y una segunda apertura da 409", async () => {
    const deviceRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/devices/register`,
      headers: { cookie: waiterCookie },
      payload: { label: "Tablet mozo 1", kind: "waiter" },
    });
    expect(deviceRes.statusCode).toBe(201);
    expect(deviceRes.json().id).toBeTruthy();

    const floor = await app.inject({ method: "GET", url: `/venues/${venueId}/floor`, headers: { cookie: waiterCookie } });
    const tableId = floor.json().tables[0].id;

    const openRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/tables/${tableId}/sessions`,
      headers: { cookie: waiterCookie },
      payload: { guests: 3 },
    });
    expect(openRes.statusCode).toBe(201);
    expect(openRes.json().guests).toBe(3);

    const again = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/tables/${tableId}/sessions`,
      headers: { cookie: waiterCookie },
      payload: { guests: 2 },
    });
    expect(again.statusCode).toBe(409);

    const floorAfter = await app.inject({ method: "GET", url: `/venues/${venueId}/floor`, headers: { cookie: waiterCookie } });
    expect(floorAfter.json().tables[0].session.guests).toBe(3);

    const sessionOrders = await app.inject({
      method: "GET",
      url: `/venues/${venueId}/table-sessions/${openRes.json().id}/orders`,
      headers: { cookie: waiterCookie },
    });
    expect(sessionOrders.json()).toEqual([]);
  });

  it("pos-menu trae estación y costo, y aplica el precio de la lista del canal", async () => {
    const productId = generateId();
    const priceListId = generateId();
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.insert(products).values({
        id: productId,
        venueId,
        name: "Cerveza",
        basePriceCents: 300000,
        costCents: 90000,
        prepStation: "bar",
        kind: "drink",
      });
      await tx.insert(priceLists).values({ id: priceListId, venueId, name: "Salón", channel: "salon" });
      await tx.insert(prices).values({ id: generateId(), venueId, priceListId, productId, priceCents: 350000 });
    });

    const res = await app.inject({
      method: "GET",
      url: `/venues/${venueId}/pos-menu?priceListId=${priceListId}`,
      headers: { cookie: waiterCookie },
    });
    expect(res.statusCode).toBe(200);
    const cerveza = res.json().products.find((p: { id: string }) => p.id === productId);
    expect(cerveza).toMatchObject({ prepStation: "bar", costCents: 90000, basePriceCents: 350000 });

    // el menú público, en cambio, nunca expone estación ni costo
    const sinLista = await app.inject({ method: "GET", url: `/venues/${venueId}/pos-menu`, headers: { cookie: waiterCookie } });
    expect(sinLista.json().products.find((p: { id: string }) => p.id === productId).basePriceCents).toBe(300000);
  });
});
