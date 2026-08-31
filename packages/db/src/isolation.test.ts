import "dotenv/config";
import { eq } from "drizzle-orm";
import { generateId } from "@resto-zest/domain";
import { describe, expect, it } from "vitest";
import { withContext } from "./client";
import { devices, memberships, tenants, users, venues } from "./schema";

type Seeded = { tenantId: string; venueId: string; userId: string; deviceId: string };

async function createTenant(name: string): Promise<Seeded> {
  const tenantId = generateId();
  const venueId = generateId();
  const userId = generateId();
  const deviceId = generateId();

  await withContext({ tenantId }, async (tx) => {
    await tx.insert(tenants).values({ id: tenantId, name, slug: tenantId });
    await tx.insert(venues).values({ id: venueId, tenantId, name: `${name} - venue` });
    await tx.insert(users).values({ id: userId, tenantId, fullName: name });
  });

  await withContext({ tenantId, venueId }, async (tx) => {
    await tx.insert(memberships).values({ userId, venueId, role: "owner" });
    await tx.insert(devices).values({ id: deviceId, venueId, label: "test-device", kind: "admin", tokenHash: "x" });
  });

  return { tenantId, venueId, userId, deviceId };
}

async function cleanup(ctx: Seeded) {
  await withContext({ tenantId: ctx.tenantId, venueId: ctx.venueId }, async (tx) => {
    await tx.delete(devices).where(eq(devices.id, ctx.deviceId));
    await tx.delete(memberships).where(eq(memberships.userId, ctx.userId));
  });
  await withContext({ tenantId: ctx.tenantId }, async (tx) => {
    await tx.delete(users).where(eq(users.id, ctx.userId));
    await tx.delete(venues).where(eq(venues.id, ctx.venueId));
    await tx.delete(tenants).where(eq(tenants.id, ctx.tenantId));
  });
}

describe("aislamiento multi-tenant (RLS)", () => {
  it("un tenant no puede leer tenants, venues, usuarios ni devices de otro tenant", async () => {
    const a = await createTenant("Tenant A");
    const b = await createTenant("Tenant B");

    try {
      const usersFromA = await withContext({ tenantId: a.tenantId }, (tx) => tx.select().from(users));
      expect(usersFromA.map((u) => u.id)).toContain(a.userId);
      expect(usersFromA.map((u) => u.id)).not.toContain(b.userId);

      const venuesFromA = await withContext({ tenantId: a.tenantId }, (tx) => tx.select().from(venues));
      expect(venuesFromA.map((v) => v.id)).toContain(a.venueId);
      expect(venuesFromA.map((v) => v.id)).not.toContain(b.venueId);

      const tenantsFromA = await withContext({ tenantId: a.tenantId }, (tx) => tx.select().from(tenants));
      expect(tenantsFromA.map((t) => t.id)).toEqual([a.tenantId]);

      const devicesFromA = await withContext(
        { tenantId: a.tenantId, venueId: a.venueId },
        (tx) => tx.select().from(devices),
      );
      expect(devicesFromA.map((d) => d.id)).toContain(a.deviceId);
      expect(devicesFromA.map((d) => d.id)).not.toContain(b.deviceId);

      // memberships/devices se aíslan por tenant_id (subquery a venues), no
      // por venue_id: tienen que verse con SOLO tenantId en el contexto
      // (sin venueId) — es lo que necesita el login para armar el selector
      // de local. Ver docs/adr/0002-contexto-rls-tenant-id.md.
      const membershipsFromA = await withContext({ tenantId: a.tenantId }, (tx) => tx.select().from(memberships));
      expect(membershipsFromA.map((m) => m.userId)).toContain(a.userId);
      expect(membershipsFromA.map((m) => m.userId)).not.toContain(b.userId);

      const devicesFromATenantOnly = await withContext({ tenantId: a.tenantId }, (tx) => tx.select().from(devices));
      expect(devicesFromATenantOnly.map((d) => d.id)).toContain(a.deviceId);
      expect(devicesFromATenantOnly.map((d) => d.id)).not.toContain(b.deviceId);
    } finally {
      await cleanup(a);
      await cleanup(b);
    }
  });

  it("sin contexto de tenant seteado, no se ve ninguna fila", async () => {
    const a = await createTenant("Tenant sin contexto");
    try {
      // tenantId vacío: current_setting(...) no matchea ningún id real.
      const rows = await withContext({ tenantId: generateId() }, (tx) => tx.select().from(tenants));
      expect(rows).toHaveLength(0);
    } finally {
      await cleanup(a);
    }
  });
});
