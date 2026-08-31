import "dotenv/config";
import { generateId } from "@resto-zest/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createSession,
  deleteSession,
  findSession,
  findUserForLogin,
  hashPassword,
  verifyPassword,
} from "./auth";
import { withContext } from "./client";
import { sessions, tenants, users } from "./schema";

describe("auth: login lookup y sesiones", () => {
  const tenantId = generateId();
  const userId = generateId();
  const email = `test-${userId}@auth.test`;
  const password = "correcto-horse-battery-staple";
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await hashPassword(password);
    await withContext({ tenantId }, async (tx) => {
      await tx.insert(tenants).values({ id: tenantId, name: "Tenant auth test", slug: tenantId });
      await tx.insert(users).values({ id: userId, tenantId, fullName: "Test", email, passwordHash });
    });
  });

  afterAll(async () => {
    await withContext({ tenantId }, async (tx) => {
      // orden: sessions antes que users (FK), users antes que tenants (FK).
      // Puede no quedar ninguna sesión (el test de sesión ya borró la suya).
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));
      await tx.delete(tenants).where(eq(tenants.id, tenantId));
    });
  });

  it("hashea y verifica contraseñas", async () => {
    expect(await verifyPassword(passwordHash, password)).toBe(true);
    expect(await verifyPassword(passwordHash, "otra-cosa")).toBe(false);
  });

  it("findUserForLogin encuentra al usuario por email cruzando tenants (rol resto_zest_auth)", async () => {
    const found = await findUserForLogin(email);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(userId);
    expect(found?.tenantId).toBe(tenantId);
    expect(await verifyPassword(found!.passwordHash!, password)).toBe(true);

    expect(await findUserForLogin("no-existe@auth.test")).toBeNull();
  });

  it("crea, encuentra y borra una sesión", async () => {
    const session = await createSession(userId, tenantId);
    const found = await findSession(session.id);
    expect(found?.userId).toBe(userId);
    expect(found?.tenantId).toBe(tenantId);

    await deleteSession(session.id);
    expect(await findSession(session.id)).toBeNull();
  });
});
