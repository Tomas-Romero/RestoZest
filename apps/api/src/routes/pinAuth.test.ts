import "dotenv/config";
import { generateId } from "@resto-zest/domain";
import { hashPassword, memberships, sessions, tenants, users, venues, withContext } from "@resto-zest/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";

describe("POST /venues/:venueId/auth/pin-login (plano operativo)", () => {
  const tenantId = generateId();
  const venueId = generateId();
  const waiterId = generateId();
  const kitchenId = generateId();
  const pin = "4321";
  let app: FastifyInstance;

  function extractCookie(response: { headers: Record<string, unknown> }): string {
    const setCookie = response.headers["set-cookie"];
    const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    return String(raw).split(";")[0]!;
  }

  beforeAll(async () => {
    const pinHash = await hashPassword(pin);
    await withContext({ tenantId }, async (tx) => {
      await tx.insert(tenants).values({ id: tenantId, name: "Tenant pin auth", slug: tenantId });
      await tx.insert(venues).values({ id: venueId, tenantId, name: "Venue", slug: venueId });
      await tx.insert(users).values([
        { id: waiterId, tenantId, fullName: "Mozo de prueba", pinHash, active: true },
        { id: kitchenId, tenantId, fullName: "Cocinero de prueba", pinHash: await hashPassword("9999"), active: true },
      ]);
    });
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.insert(memberships).values([
        { userId: waiterId, venueId, role: "waiter" },
        { userId: kitchenId, venueId, role: "kitchen" },
      ]);
    });
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await withContext({ tenantId, venueId }, async (tx) => {
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

  it("404 si el venue no existe", async () => {
    const res = await app.inject({ method: "POST", url: `/venues/${generateId()}/auth/pin-login`, payload: { pin } });
    expect(res.statusCode).toBe(404);
  });

  it("401 con un PIN que no matchea ningún usuario del venue", async () => {
    const res = await app.inject({ method: "POST", url: `/venues/${venueId}/auth/pin-login`, payload: { pin: "0000" } });
    expect(res.statusCode).toBe(401);
  });

  it("encuentra al usuario correcto entre varios candidatos con PIN, y /auth/me trae venueId+role directo", async () => {
    const loginRes = await app.inject({ method: "POST", url: `/venues/${venueId}/auth/pin-login`, payload: { pin } });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.json().user.id).toBe(waiterId);
    expect(loginRes.json().role).toBe("waiter");

    const cookie = extractCookie(loginRes);
    const meRes = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie } });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().venueId).toBe(venueId);
    expect(meRes.json().role).toBe("waiter");
  });

  it("cada PIN loguea a su propio usuario, no al primero de la lista", async () => {
    const res = await app.inject({ method: "POST", url: `/venues/${venueId}/auth/pin-login`, payload: { pin: "9999" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.id).toBe(kitchenId);
    expect(res.json().role).toBe("kitchen");
  });
});
