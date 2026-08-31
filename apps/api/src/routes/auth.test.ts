import "dotenv/config";
import { generateId } from "@resto-zest/domain";
import { hashPassword, tenants, users, withContext } from "@resto-zest/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";

describe("POST /auth/login, GET /auth/me, POST /auth/logout", () => {
  const tenantId = generateId();
  const userId = generateId();
  const email = `test-${userId}@auth.test`;
  const password = "correcto-horse-battery-staple";
  let app: FastifyInstance;

  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    await withContext({ tenantId }, async (tx) => {
      await tx.insert(tenants).values({ id: tenantId, name: "Tenant auth route test", slug: tenantId });
      await tx.insert(users).values({ id: userId, tenantId, fullName: "Test", email, passwordHash, active: true });
    });
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await withContext({ tenantId }, async (tx) => {
      await tx.delete(users).where(eq(users.id, userId));
      await tx.delete(tenants).where(eq(tenants.id, tenantId));
    });
    await app.close();
  });

  function extractCookie(response: { headers: Record<string, unknown> }): string {
    const setCookie = response.headers["set-cookie"];
    const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    return String(raw).split(";")[0]!;
  }

  it("rechaza body inválido con 400", async () => {
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "no-es-un-email" } });
    expect(res.statusCode).toBe(400);
  });

  it("rechaza credenciales incorrectas con 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "mala" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("login válido setea cookie de sesión, y /auth/me devuelve usuario + memberships", async () => {
    const loginRes = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
    expect(loginRes.statusCode).toBe(200);
    const cookie = extractCookie(loginRes);

    const meRes = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie } });
    expect(meRes.statusCode).toBe(200);
    const body = meRes.json();
    expect(body.user.id).toBe(userId);
    expect(body.tenantId).toBe(tenantId);
    expect(body.memberships).toEqual([]);

    const logoutRes = await app.inject({ method: "POST", url: "/auth/logout", headers: { cookie } });
    expect(logoutRes.statusCode).toBe(200);

    const meAfterLogoutRes = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie } });
    expect(meAfterLogoutRes.statusCode).toBe(401);
  });

  it("/auth/me sin cookie devuelve 401", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
  });
});
