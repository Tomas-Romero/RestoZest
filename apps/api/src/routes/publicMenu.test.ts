import "dotenv/config";
import { generateId } from "@resto-zest/domain";
import { categories, products, tables, tenants, venues, withContext } from "@resto-zest/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";

describe("GET /public/menu (sin autenticación)", () => {
  const tenantId = generateId();
  const venueId = generateId();
  const slug = `venue-public-route-${venueId}`;
  const categoryId = generateId();
  const productId = generateId();
  const tableId = generateId();
  const qrToken = `qr-${generateId()}`;
  let app: FastifyInstance;

  beforeAll(async () => {
    await withContext({ tenantId }, async (tx) => {
      await tx.insert(tenants).values({ id: tenantId, name: "Tenant public route", slug: tenantId });
      await tx.insert(venues).values({ id: venueId, tenantId, name: "Venue público", slug });
    });
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.insert(categories).values({ id: categoryId, venueId, name: "Entradas" });
      await tx.insert(products).values({ id: productId, venueId, categoryId, name: "Empanada", basePriceCents: 150000 });
      await tx.insert(tables).values({ id: tableId, venueId, code: "12", qrToken });
    });
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.delete(tables).where(eq(tables.venueId, venueId));
      await tx.delete(products).where(eq(products.venueId, venueId));
      await tx.delete(categories).where(eq(categories.venueId, venueId));
    });
    await withContext({ tenantId }, async (tx) => {
      await tx.delete(venues).where(eq(venues.tenantId, tenantId));
      await tx.delete(tenants).where(eq(tenants.id, tenantId));
    });
    await app.close();
  });

  it("devuelve el menú sin ninguna cookie de sesión", async () => {
    const res = await app.inject({ method: "GET", url: `/public/menu/${slug}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.venue.slug).toBe(slug);
    expect(body.menu.products.map((p: { id: string }) => p.id)).toContain(productId);
  });

  it("404 para un slug que no existe", async () => {
    const res = await app.inject({ method: "GET", url: "/public/menu/no-existe" });
    expect(res.statusCode).toBe(404);
  });

  it("resuelve la ruta de mesa con su código", async () => {
    const res = await app.inject({ method: "GET", url: `/public/menu/${slug}/mesa/${qrToken}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().table.code).toBe("12");
  });

  it("404 para un qrToken que no existe", async () => {
    const res = await app.inject({ method: "GET", url: `/public/menu/${slug}/mesa/no-existe` });
    expect(res.statusCode).toBe(404);
  });
});
