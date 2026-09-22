import "dotenv/config";
import { generateId } from "@resto-zest/domain";
import {
  dailyMenuItems,
  dailyMenus,
  hashPassword,
  memberships,
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

describe("menú del día", () => {
  const tenantId = generateId();
  const venueId = generateId();
  const ownerId = generateId();
  const email = `owner-${ownerId}@dailymenus.test`;
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
      await tx.insert(tenants).values({ id: tenantId, name: "Tenant daily menus test", slug: tenantId });
      await tx.insert(venues).values({ id: venueId, tenantId, name: "Venue" });
      await tx.insert(users).values({ id: ownerId, tenantId, fullName: "Owner", email, passwordHash, active: true });
    });
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.insert(memberships).values({ userId: ownerId, venueId, role: "owner" });
      await tx.insert(products).values({ id: productId, venueId, name: "Milanesa", basePriceCents: 200000 });
    });

    app = await buildApp({ logger: false });
    await app.ready();
    const loginRes = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
    cookie = extractCookie(loginRes);
  });

  afterAll(async () => {
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.delete(memberships).where(eq(memberships.venueId, venueId));
      await tx.delete(dailyMenuItems).where(eq(dailyMenuItems.venueId, venueId));
      await tx.delete(dailyMenus).where(eq(dailyMenus.venueId, venueId));
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

  it("crea un menú del día, le agrega un ítem, lo edita y lo borra (soft)", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/daily-menus`,
      headers: { cookie },
      payload: { name: "Menú ejecutivo", validFrom: "2026-01-01", startsAt: "11:30", endsAt: "15:00" },
    });
    expect(createRes.statusCode).toBe(201);
    const menu = createRes.json();

    const itemRes = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/daily-menus/${menu.id}/items`,
      headers: { cookie },
      payload: { productId, priceCents: 180000 },
    });
    expect(itemRes.statusCode).toBe(201);
    const item = itemRes.json();

    const listItemsRes = await app.inject({
      method: "GET",
      url: `/venues/${venueId}/daily-menus/${menu.id}/items`,
      headers: { cookie },
    });
    expect(listItemsRes.json()).toHaveLength(1);

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/venues/${venueId}/daily-menus/${menu.id}`,
      headers: { cookie },
      payload: { active: false },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().active).toBe(false);

    const deleteItemRes = await app.inject({
      method: "DELETE",
      url: `/venues/${venueId}/daily-menus/${menu.id}/items/${item.id}`,
      headers: { cookie },
    });
    expect(deleteItemRes.statusCode).toBe(204);

    const deleteMenuRes = await app.inject({
      method: "DELETE",
      url: `/venues/${venueId}/daily-menus/${menu.id}`,
      headers: { cookie },
    });
    expect(deleteMenuRes.statusCode).toBe(204);

    const listRes = await app.inject({ method: "GET", url: `/venues/${venueId}/daily-menus`, headers: { cookie } });
    expect(listRes.json().map((m: { id: string }) => m.id)).not.toContain(menu.id);
  });

  it("rechaza una fecha con formato inválido", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/venues/${venueId}/daily-menus`,
      headers: { cookie },
      payload: { name: "Malo", validFrom: "01/01/2026" },
    });
    expect(res.statusCode).toBe(400);
  });
});
