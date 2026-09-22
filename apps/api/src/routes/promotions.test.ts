import "dotenv/config";
import { generateId } from "@resto-zest/domain";
import {
  categories,
  hashPassword,
  memberships,
  promotions,
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

describe("promociones", () => {
  const tenantId = generateId();
  const venueId = generateId();
  const ownerId = generateId();
  const email = `owner-${ownerId}@promotions.test`;
  const password = "correcto-horse-battery-staple";
  const categoryId = generateId();
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
      await tx.insert(tenants).values({ id: tenantId, name: "Tenant promotions test", slug: tenantId });
      await tx.insert(venues).values({ id: venueId, tenantId, name: "Venue" });
      await tx.insert(users).values({ id: ownerId, tenantId, fullName: "Owner", email, passwordHash, active: true });
    });
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.insert(memberships).values({ userId: ownerId, venueId, role: "owner" });
      await tx.insert(categories).values({ id: categoryId, venueId, name: "Bebidas" });
    });

    app = await buildApp({ logger: false });
    await app.ready();
    const loginRes = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
    cookie = extractCookie(loginRes);
  });

  afterAll(async () => {
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.delete(memberships).where(eq(memberships.venueId, venueId));
      await tx.delete(promotions).where(eq(promotions.venueId, venueId));
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

  it("crea una promo por categoría, la edita y la borra (soft)", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/promotions`,
      headers: { cookie },
      payload: {
        name: "Happy hour",
        scope: "category",
        scopeId: categoryId,
        discountType: "percent",
        discountValue: 20,
        validFrom: "2026-01-01T00:00:00.000Z",
        startsAt: "18:00",
        endsAt: "20:00",
      },
    });
    expect(createRes.statusCode).toBe(201);
    const promo = createRes.json();
    expect(promo.discountValue).toBe("20.00");

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/venues/${venueId}/promotions/${promo.id}`,
      headers: { cookie },
      payload: { discountValue: 25 },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().discountValue).toBe("25.00");

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/venues/${venueId}/promotions/${promo.id}`,
      headers: { cookie },
    });
    expect(deleteRes.statusCode).toBe(204);

    const listRes = await app.inject({ method: "GET", url: `/venues/${venueId}/promotions`, headers: { cookie } });
    expect(listRes.json().map((p: { id: string }) => p.id)).not.toContain(promo.id);
  });

  it("scope=category sin scopeId, 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/promotions`,
      headers: { cookie },
      payload: {
        name: "Mala",
        scope: "category",
        discountType: "percent",
        discountValue: 10,
        validFrom: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("scope=all no necesita scopeId", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/promotions`,
      headers: { cookie },
      payload: {
        name: "Todo 10%",
        scope: "all",
        discountType: "percent",
        discountValue: 10,
        validFrom: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(res.statusCode).toBe(201);
    await app.inject({ method: "DELETE", url: `/venues/${venueId}/promotions/${res.json().id}`, headers: { cookie } });
  });
});
