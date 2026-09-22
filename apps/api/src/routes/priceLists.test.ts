import "dotenv/config";
import { generateId } from "@resto-zest/domain";
import {
  hashPassword,
  memberships,
  prices,
  priceLists,
  products,
  sessions,
  tenants,
  users,
  venues,
  withContext,
} from "@resto-zest/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";

describe("listas de precio por canal", () => {
  const tenantId = generateId();
  const venueId = generateId();
  const ownerId = generateId();
  const email = `owner-${ownerId}@pricelists.test`;
  const password = "correcto-horse-battery-staple";
  const productId = generateId();
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
      await tx.insert(tenants).values({ id: tenantId, name: "Tenant price lists test", slug: tenantId });
      await tx.insert(venues).values({ id: venueId, tenantId, name: "Venue" });
      await tx.insert(users).values({ id: ownerId, tenantId, fullName: "Owner", email, passwordHash, active: true });
    });
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.insert(memberships).values({ userId: ownerId, venueId, role: "owner" });
      await tx.insert(products).values({ id: productId, venueId, name: "Producto", basePriceCents: 100000 });
    });

    app = await buildApp({ logger: false });
    await app.ready();
    const loginRes = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
    cookie = extractCookie(loginRes);
  });

  afterAll(async () => {
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.delete(memberships).where(eq(memberships.venueId, venueId));
      await tx.delete(prices).where(eq(prices.venueId, venueId));
      await tx.delete(priceLists).where(eq(priceLists.venueId, venueId));
      await tx.delete(products).where(eq(products.venueId, venueId));
    });
    await withContext({ tenantId }, async (tx) => {
      await tx.delete(sessions).where(eq(sessions.tenantId, tenantId));
      await tx.delete(users).where(eq(users.tenantId, tenantId));
      await tx.delete(venues).where(eq(venues.tenantId, tenantId));
      await tx.delete(tenants).where(eq(tenants.id, tenantId));
    });
    await app.close();
  });

  it("crea una lista, le pone un precio y lo actualiza (upsert), y lo borra", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/price-lists`,
      headers: { cookie },
      payload: { name: "Delivery", channel: "delivery" },
    });
    expect(createRes.statusCode).toBe(201);
    const priceList = createRes.json();

    const upsert1 = await app.inject({
      method: "PUT",
      url: `/venues/${venueId}/price-lists/${priceList.id}/prices`,
      headers: { cookie },
      payload: { productId, priceCents: 120000 },
    });
    expect(upsert1.statusCode).toBe(200);
    expect(upsert1.json().priceCents).toBe(120000);

    // upsert de nuevo con otro valor: mismo producto, misma lista → actualiza, no duplica
    const upsert2 = await app.inject({
      method: "PUT",
      url: `/venues/${venueId}/price-lists/${priceList.id}/prices`,
      headers: { cookie },
      payload: { productId, priceCents: 130000 },
    });
    expect(upsert2.statusCode).toBe(200);
    expect(upsert2.json().priceCents).toBe(130000);
    expect(upsert2.json().id).toBe(upsert1.json().id);

    const listRes = await app.inject({
      method: "GET",
      url: `/venues/${venueId}/price-lists/${priceList.id}/prices`,
      headers: { cookie },
    });
    expect(listRes.json()).toHaveLength(1);

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/venues/${venueId}/price-lists/${priceList.id}/prices/${upsert2.json().id}`,
      headers: { cookie },
    });
    expect(deleteRes.statusCode).toBe(204);
  });

  it("PATCH desactiva una lista", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/price-lists`,
      headers: { cookie },
      payload: { name: "Take away", channel: "take_away" },
    });
    const priceList = createRes.json();

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/venues/${venueId}/price-lists/${priceList.id}`,
      headers: { cookie },
      payload: { active: false },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().active).toBe(false);
  });

  it("rechaza un canal inválido", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/price-lists`,
      headers: { cookie },
      payload: { name: "Rara", channel: "no-existe" },
    });
    expect(res.statusCode).toBe(400);
  });
});
