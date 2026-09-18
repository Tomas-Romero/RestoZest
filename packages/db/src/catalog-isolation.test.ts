import "dotenv/config";
import { generateId } from "@resto-zest/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withContext } from "./client";
import { categories, priceLists, products, tenants, venues } from "./schema";

type Seeded = { tenantId: string; venueId: string; categoryId: string; productId: string; priceListId: string };

async function createVenue(name: string): Promise<Seeded> {
  const tenantId = generateId();
  const venueId = generateId();
  const categoryId = generateId();
  const productId = generateId();
  const priceListId = generateId();

  await withContext({ tenantId }, async (tx) => {
    await tx.insert(tenants).values({ id: tenantId, name, slug: tenantId });
    await tx.insert(venues).values({ id: venueId, tenantId, name: `${name} - venue` });
  });

  await withContext({ tenantId, venueId }, async (tx) => {
    await tx.insert(categories).values({ id: categoryId, venueId, name: "Entradas" });
    await tx.insert(products).values({
      id: productId,
      venueId,
      categoryId,
      name: "Empanada",
      basePriceCents: 150000,
    });
    await tx.insert(priceLists).values({ id: priceListId, venueId, name: "Salón", channel: "salon" });
  });

  return { tenantId, venueId, categoryId, productId, priceListId };
}

async function cleanup(seed: Seeded) {
  await withContext({ tenantId: seed.tenantId, venueId: seed.venueId }, async (tx) => {
    await tx.delete(priceLists).where(eq(priceLists.id, seed.priceListId));
    await tx.delete(products).where(eq(products.id, seed.productId));
    await tx.delete(categories).where(eq(categories.id, seed.categoryId));
  });
  await withContext({ tenantId: seed.tenantId }, async (tx) => {
    await tx.delete(venues).where(eq(venues.id, seed.venueId));
    await tx.delete(tenants).where(eq(tenants.id, seed.tenantId));
  });
}

describe("aislamiento del catálogo (RLS por venue_id)", () => {
  let a: Seeded;
  let b: Seeded;

  beforeAll(async () => {
    a = await createVenue("Venue A");
    b = await createVenue("Venue B");
  });

  afterAll(async () => {
    await cleanup(a);
    await cleanup(b);
  });

  it("un venue no ve categorías, productos ni listas de precio de otro venue", async () => {
    const categoriesFromA = await withContext(
      { tenantId: a.tenantId, venueId: a.venueId },
      (tx) => tx.select().from(categories),
    );
    expect(categoriesFromA.map((c) => c.id)).toContain(a.categoryId);
    expect(categoriesFromA.map((c) => c.id)).not.toContain(b.categoryId);

    const productsFromA = await withContext(
      { tenantId: a.tenantId, venueId: a.venueId },
      (tx) => tx.select().from(products),
    );
    expect(productsFromA.map((p) => p.id)).toContain(a.productId);
    expect(productsFromA.map((p) => p.id)).not.toContain(b.productId);

    const priceListsFromA = await withContext(
      { tenantId: a.tenantId, venueId: a.venueId },
      (tx) => tx.select().from(priceLists),
    );
    expect(priceListsFromA.map((p) => p.id)).toContain(a.priceListId);
    expect(priceListsFromA.map((p) => p.id)).not.toContain(b.priceListId);
  });

  it("sin venue_id en el contexto (solo tenant_id), no se ve ningún producto", async () => {
    const rows = await withContext({ tenantId: a.tenantId }, (tx) => tx.select().from(products));
    expect(rows).toHaveLength(0);
  });
});
