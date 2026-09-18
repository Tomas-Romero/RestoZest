import "dotenv/config";
import { generateId } from "@resto-zest/domain";
import {
  categories,
  hashPassword,
  memberships,
  productVariants,
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

describe("CRUD de catálogo (categorías, productos, variantes)", () => {
  const tenantId = generateId();
  const venueId = generateId();
  const otherVenueId = generateId();
  const ownerId = generateId();
  const waiterId = generateId();
  const ownerEmail = `owner-${ownerId}@catalog.test`;
  const waiterEmail = `waiter-${waiterId}@catalog.test`;
  const password = "correcto-horse-battery-staple";
  let app: FastifyInstance;
  let ownerCookie: string;
  let waiterCookie: string;

  function extractCookie(response: { headers: Record<string, unknown> }): string {
    const setCookie = response.headers["set-cookie"];
    const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    return String(raw).split(";")[0]!;
  }

  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    await withContext({ tenantId }, async (tx) => {
      await tx.insert(tenants).values({ id: tenantId, name: "Tenant catálogo test", slug: tenantId });
      await tx.insert(venues).values([
        { id: venueId, tenantId, name: "Venue principal" },
        { id: otherVenueId, tenantId, name: "Venue ajeno" },
      ]);
      await tx.insert(users).values([
        { id: ownerId, tenantId, fullName: "Owner", email: ownerEmail, passwordHash, active: true },
        { id: waiterId, tenantId, fullName: "Waiter", email: waiterEmail, passwordHash, active: true },
      ]);
    });
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.insert(memberships).values([
        { userId: ownerId, venueId, role: "owner" },
        { userId: waiterId, venueId, role: "waiter" },
      ]);
    });

    app = await buildApp({ logger: false });
    await app.ready();

    const ownerLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: ownerEmail, password },
    });
    ownerCookie = extractCookie(ownerLogin);

    const waiterLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: waiterEmail, password },
    });
    waiterCookie = extractCookie(waiterLogin);
  });

  afterAll(async () => {
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.delete(memberships).where(eq(memberships.venueId, venueId));
      await tx.delete(productVariants).where(eq(productVariants.venueId, venueId));
      await tx.delete(products).where(eq(products.venueId, venueId));
      await tx.delete(categories).where(eq(categories.venueId, venueId));
    });
    await withContext({ tenantId, venueId: otherVenueId }, async (tx) => {
      await tx.delete(categories).where(eq(categories.venueId, otherVenueId));
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
    const res = await app.inject({ method: "GET", url: `/venues/${venueId}/categories` });
    expect(res.statusCode).toBe(401);
  });

  it("con sesión pero sin membership en el venue, 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/venues/${otherVenueId}/categories`,
      headers: { cookie: ownerCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it("un waiter puede leer el catálogo pero no crear categorías (403)", async () => {
    const readRes = await app.inject({
      method: "GET",
      url: `/venues/${venueId}/categories`,
      headers: { cookie: waiterCookie },
    });
    expect(readRes.statusCode).toBe(200);

    const writeRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/categories`,
      headers: { cookie: waiterCookie },
      payload: { name: "Bebidas" },
    });
    expect(writeRes.statusCode).toBe(403);
  });

  it("el owner crea, edita, borra (soft) una categoría, y crea un producto con variantes", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/categories`,
      headers: { cookie: ownerCookie },
      payload: { name: "Entradas" },
    });
    expect(createRes.statusCode).toBe(201);
    const category = createRes.json();
    expect(category.venueId).toBe(venueId);

    const listRes = await app.inject({
      method: "GET",
      url: `/venues/${venueId}/categories`,
      headers: { cookie: ownerCookie },
    });
    expect(listRes.json().map((c: { id: string }) => c.id)).toContain(category.id);

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/venues/${venueId}/categories/${category.id}`,
      headers: { cookie: ownerCookie },
      payload: { name: "Entradas y picadas" },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().name).toBe("Entradas y picadas");

    const productRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/products`,
      headers: { cookie: ownerCookie },
      payload: { categoryId: category.id, name: "Empanada", basePriceCents: 150000 },
    });
    expect(productRes.statusCode).toBe(201);
    const product = productRes.json();

    const variantRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/products/${product.id}/variants`,
      headers: { cookie: ownerCookie },
      payload: { name: "Docena", priceDeltaCents: 1200000 },
    });
    expect(variantRes.statusCode).toBe(201);

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/venues/${venueId}/categories/${category.id}`,
      headers: { cookie: ownerCookie },
    });
    expect(deleteRes.statusCode).toBe(204);

    const listAfterDeleteRes = await app.inject({
      method: "GET",
      url: `/venues/${venueId}/categories`,
      headers: { cookie: ownerCookie },
    });
    expect(listAfterDeleteRes.json().map((c: { id: string }) => c.id)).not.toContain(category.id);
  });

  it("rechaza un producto con kind inválido (400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/products`,
      headers: { cookie: ownerCookie },
      payload: { name: "Cosa rara", basePriceCents: 100, kind: "no-existe" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("no se puede editar una categoría de otro venue (404, aunque exista)", async () => {
    // crear una categoría en otherVenueId directamente en la base
    const foreignCategoryId = generateId();
    await withContext({ tenantId, venueId: otherVenueId }, async (tx) => {
      await tx.insert(categories).values({ id: foreignCategoryId, venueId: otherVenueId, name: "Ajena" });
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/venues/${venueId}/categories/${foreignCategoryId}`,
      headers: { cookie: ownerCookie },
      payload: { name: "hackeada" },
    });
    expect(res.statusCode).toBe(404);
  });
});
