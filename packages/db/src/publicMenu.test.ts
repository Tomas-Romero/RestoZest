import "dotenv/config";
import { generateId } from "@resto-zest/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withContext } from "./client";
import { findTableByQrToken, findVenueBySlug, getPublicMenu } from "./publicMenu";
import {
  categories,
  modifierGroups,
  modifiers,
  productModifierGroups,
  productVariants,
  products,
  tables,
  tenants,
  venues,
} from "./schema";

describe("menú público (lookup por slug, sin sesión)", () => {
  const tenantId = generateId();
  const venueId = generateId();
  const slug = `venue-publico-${venueId}`;
  const categoryId = generateId();
  const availableProductId = generateId();
  const hiddenProductId = generateId(); // available: false, no debe aparecer
  const variantId = generateId();
  const groupId = generateId();
  const modifierId = generateId();
  const tableId = generateId();
  const qrToken = `qr-${generateId()}`;

  beforeAll(async () => {
    await withContext({ tenantId }, async (tx) => {
      await tx.insert(tenants).values({ id: tenantId, name: "Tenant menú público", slug: tenantId });
      await tx.insert(venues).values({ id: venueId, tenantId, name: "Venue público", slug });
    });
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.insert(categories).values({ id: categoryId, venueId, name: "Entradas" });
      await tx.insert(products).values([
        { id: availableProductId, venueId, categoryId, name: "Empanada", basePriceCents: 150000, available: true },
        { id: hiddenProductId, venueId, categoryId, name: "Fuera de carta", basePriceCents: 999999, available: false },
      ]);
      await tx.insert(productVariants).values({ id: variantId, venueId, productId: availableProductId, name: "Docena", priceDeltaCents: 1200000 });
      await tx.insert(modifierGroups).values({ id: groupId, venueId, name: "Salsas", minSelect: 0, maxSelect: 2 });
      await tx.insert(modifiers).values({ id: modifierId, venueId, modifierGroupId: groupId, name: "Extra picante" });
      await tx.insert(productModifierGroups).values({ venueId, productId: availableProductId, modifierGroupId: groupId });
      await tx.insert(tables).values({ id: tableId, venueId, code: "12", qrToken });
    });
  });

  afterAll(async () => {
    await withContext({ tenantId, venueId }, async (tx) => {
      await tx.delete(tables).where(eq(tables.venueId, venueId));
      await tx.delete(productModifierGroups).where(eq(productModifierGroups.venueId, venueId));
      await tx.delete(modifiers).where(eq(modifiers.venueId, venueId));
      await tx.delete(modifierGroups).where(eq(modifierGroups.venueId, venueId));
      await tx.delete(productVariants).where(eq(productVariants.venueId, venueId));
      await tx.delete(products).where(eq(products.venueId, venueId));
      await tx.delete(categories).where(eq(categories.venueId, venueId));
    });
    await withContext({ tenantId }, async (tx) => {
      await tx.delete(venues).where(eq(venues.tenantId, tenantId));
      await tx.delete(tenants).where(eq(tenants.id, tenantId));
    });
  });

  it("resuelve el venue por slug sin ningún contexto de sesión previo", async () => {
    const found = await findVenueBySlug(slug);
    expect(found?.id).toBe(venueId);
    expect(found?.tenantId).toBe(tenantId);

    expect(await findVenueBySlug("no-existe")).toBeNull();
  });

  it("arma el menú público con categorías, productos disponibles, variantes y modificadores anidados", async () => {
    const menu = await getPublicMenu(tenantId, venueId);

    expect(menu.categories).toEqual([{ id: categoryId, name: "Entradas", position: 0 }]);

    const productIds = menu.products.map((p) => p.id);
    expect(productIds).toContain(availableProductId);
    expect(productIds).not.toContain(hiddenProductId); // available: false, no se expone

    const empanada = menu.products.find((p) => p.id === availableProductId)!;
    expect(empanada.variants).toEqual([{ id: variantId, name: "Docena", priceDeltaCents: 1200000 }]);
    expect(empanada.modifierGroups).toHaveLength(1);
    expect(empanada.modifierGroups[0]!.modifiers).toEqual([{ id: modifierId, name: "Extra picante", priceDeltaCents: 0 }]);
  });

  it("encuentra una mesa por qrToken dentro del venue ya resuelto", async () => {
    const table = await findTableByQrToken(tenantId, venueId, qrToken);
    expect(table?.id).toBe(tableId);
    expect(table?.code).toBe("12");

    expect(await findTableByQrToken(tenantId, venueId, "no-existe")).toBeNull();
  });
});
