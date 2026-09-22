import "dotenv/config";
import { generateId } from "@resto-zest/domain";
import {
  categories,
  hashPassword,
  memberships,
  priceChangeBatches,
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

describe("remarcación masiva (price-change-batches)", () => {
  const tenantId = generateId();
  const venueId = generateId();
  const ownerId = generateId();
  const email = `owner-${ownerId}@batches.test`;
  const password = "correcto-horse-battery-staple";
  const categoryAId = generateId();
  const categoryBId = generateId();
  const productAId = generateId(); // categoría A, tag "oferta"
  const productBId = generateId(); // categoría A, sin tag
  const productCId = generateId(); // categoría B
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
      await tx.insert(tenants).values({ id: tenantId, name: "Tenant batches test", slug: tenantId });
      await tx.insert(venues).values({ id: venueId, tenantId, name: "Venue" });
      await tx.insert(users).values({ id: ownerId, tenantId, fullName: "Owner", email, passwordHash, active: true });
    });
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.insert(memberships).values({ userId: ownerId, venueId, role: "owner" });
      await tx.insert(categories).values([
        { id: categoryAId, venueId, name: "Categoría A" },
        { id: categoryBId, venueId, name: "Categoría B" },
      ]);
      await tx.insert(products).values([
        { id: productAId, venueId, categoryId: categoryAId, name: "Producto A", basePriceCents: 100000, tags: ["oferta"] },
        { id: productBId, venueId, categoryId: categoryAId, name: "Producto B", basePriceCents: 200000 },
        { id: productCId, venueId, categoryId: categoryBId, name: "Producto C", basePriceCents: 300000 },
      ]);
    });

    app = await buildApp({ logger: false });
    await app.ready();
    const loginRes = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
    cookie = extractCookie(loginRes);
  });

  afterAll(async () => {
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.delete(memberships).where(eq(memberships.venueId, venueId));
      await tx.delete(priceChangeBatches).where(eq(priceChangeBatches.venueId, venueId));
      await tx.delete(products).where(eq(products.venueId, venueId));
      await tx.delete(categories).where(eq(categories.venueId, venueId));
    });
    await withContext({ tenantId }, async (tx) => {
      await tx.delete(sessions).where(eq(sessions.tenantId, tenantId));
      await tx.delete(users).where(eq(users.tenantId, tenantId));
      await tx.delete(venues).where(eq(venues.tenantId, tenantId));
      await tx.delete(tenants).where(eq(tenants.id, tenantId));
    });
    await app.close();
  });

  it("aplica un % a una categoría y deja el resto sin tocar", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/price-change-batches`,
      headers: { cookie },
      payload: { scope: "category", categoryId: categoryAId, op: "percent", percent: 15 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.affectedCount).toBe(2);

    const productsRes = await app.inject({
      method: "GET",
      url: `/venues/${venueId}/products`,
      headers: { cookie },
    });
    const list = productsRes.json() as { id: string; basePriceCents: number }[];
    expect(list.find((p) => p.id === productAId)?.basePriceCents).toBe(115000);
    expect(list.find((p) => p.id === productBId)?.basePriceCents).toBe(230000);
    expect(list.find((p) => p.id === productCId)?.basePriceCents).toBe(300000); // categoría B, sin tocar

    // revertir deja todo como estaba
    const revertRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/price-change-batches/${body.batch.id}/revert`,
      headers: { cookie },
    });
    expect(revertRes.statusCode).toBe(200);

    const afterRevertRes = await app.inject({
      method: "GET",
      url: `/venues/${venueId}/products`,
      headers: { cookie },
    });
    const afterList = afterRevertRes.json() as { id: string; basePriceCents: number }[];
    expect(afterList.find((p) => p.id === productAId)?.basePriceCents).toBe(100000);
    expect(afterList.find((p) => p.id === productBId)?.basePriceCents).toBe(200000);

    // no se puede revertir dos veces
    const secondRevertRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/price-change-batches/${body.batch.id}/revert`,
      headers: { cookie },
    });
    expect(secondRevertRes.statusCode).toBe(400);
  });

  it("aplica un monto fijo por tag", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/price-change-batches`,
      headers: { cookie },
      payload: { scope: "tag", tag: "oferta", op: "fixed", amountCents: 5000 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().affectedCount).toBe(1);

    const productsRes = await app.inject({ method: "GET", url: `/venues/${venueId}/products`, headers: { cookie } });
    const list = productsRes.json() as { id: string; basePriceCents: number }[];
    expect(list.find((p) => p.id === productAId)?.basePriceCents).toBe(105000);
    expect(list.find((p) => p.id === productBId)?.basePriceCents).toBe(200000);

    // revertir para dejar limpio para el próximo test
    await app.inject({
      method: "POST",
      url: `/venues/${venueId}/price-change-batches/${res.json().batch.id}/revert`,
      headers: { cookie },
    });
  });

  it("400 si el criterio no matchea ningún producto", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/price-change-batches`,
      headers: { cookie },
      payload: { scope: "tag", tag: "no-existe", op: "percent", percent: 10 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("400 si falta categoryId con scope=category", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/price-change-batches`,
      headers: { cookie },
      payload: { scope: "category", op: "percent", percent: 10 },
    });
    expect(res.statusCode).toBe(400);
  });
});
