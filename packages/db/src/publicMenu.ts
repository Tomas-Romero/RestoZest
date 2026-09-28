import { and, eq, isNull } from "drizzle-orm";
import { bypassDb } from "./bypassClient";
import { withContext } from "./client";
import {
  categories,
  modifierGroups,
  modifiers,
  productModifierGroups,
  productVariants,
  products,
  tables,
  venues,
} from "./schema";

export type PublicVenue = { id: string; tenantId: string; slug: string; name: string; timezone: string };

/**
 * El menú público resuelve un venue por slug ANTES de tener tenant_id en el
 * contexto de RLS — mismo problema de bootstrap que el login (ADR 0002).
 * Por eso usa bypassDb (rol resto_zest_auth) en vez del `db` general.
 */
export async function findVenueBySlug(slug: string): Promise<PublicVenue | null> {
  const rows = await bypassDb
    .select({ id: venues.id, tenantId: venues.tenantId, slug: venues.slug, name: venues.name, timezone: venues.timezone })
    .from(venues)
    .where(eq(venues.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export type PublicMenuModifier = { id: string; name: string; priceDeltaCents: number };
export type PublicMenuModifierGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  modifiers: PublicMenuModifier[];
};
export type PublicMenuVariant = { id: string; name: string; priceDeltaCents: number };
export type PublicMenuProduct = {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePriceCents: number;
  kind: string;
  tags: string[];
  position: number;
  variants: PublicMenuVariant[];
  modifierGroups: PublicMenuModifierGroup[];
};
export type PublicMenu = {
  categories: Array<{ id: string; name: string; position: number }>;
  products: PublicMenuProduct[];
};

/**
 * Una vez resuelto el venue, todo esto sí pasa por el `db` general con RLS
 * normal (withContext ya deja el resto de las queries acotadas al venue).
 */
export async function getPublicMenu(tenantId: string, venueId: string): Promise<PublicMenu> {
  return withContext({ tenantId, venueId }, async (tx) => {
    const [categoryRows, productRows, variantRows, pmgRows, groupRows, modifierRows] = await Promise.all([
      tx.select().from(categories).where(isNull(categories.deletedAt)).orderBy(categories.position),
      tx
        .select()
        .from(products)
        .where(isNull(products.deletedAt))
        .orderBy(products.position),
      tx.select().from(productVariants).where(isNull(productVariants.deletedAt)).orderBy(productVariants.position),
      tx.select().from(productModifierGroups).orderBy(productModifierGroups.position),
      tx.select().from(modifierGroups).where(isNull(modifierGroups.deletedAt)),
      tx.select().from(modifiers).where(isNull(modifiers.deletedAt)).orderBy(modifiers.position),
    ]);

    const variantsByProduct = new Map<string, PublicMenuVariant[]>();
    for (const v of variantRows) {
      const list = variantsByProduct.get(v.productId) ?? [];
      list.push({ id: v.id, name: v.name, priceDeltaCents: v.priceDeltaCents });
      variantsByProduct.set(v.productId, list);
    }

    const modifiersByGroup = new Map<string, PublicMenuModifier[]>();
    for (const m of modifierRows) {
      const list = modifiersByGroup.get(m.modifierGroupId) ?? [];
      list.push({ id: m.id, name: m.name, priceDeltaCents: m.priceDeltaCents });
      modifiersByGroup.set(m.modifierGroupId, list);
    }

    const groupsById = new Map(groupRows.map((g) => [g.id, g]));
    const groupIdsByProduct = new Map<string, string[]>();
    for (const pmg of pmgRows) {
      const list = groupIdsByProduct.get(pmg.productId) ?? [];
      list.push(pmg.modifierGroupId);
      groupIdsByProduct.set(pmg.productId, list);
    }

    const publicProducts: PublicMenuProduct[] = productRows
      .filter((p) => p.available)
      .map((p) => ({
        id: p.id,
        categoryId: p.categoryId,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        basePriceCents: p.basePriceCents,
        kind: p.kind,
        tags: p.tags,
        position: p.position,
        variants: variantsByProduct.get(p.id) ?? [],
        modifierGroups: (groupIdsByProduct.get(p.id) ?? [])
          .map((groupId) => groupsById.get(groupId))
          .filter((g): g is NonNullable<typeof g> => g !== undefined)
          .map((g) => ({
            id: g.id,
            name: g.name,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
            modifiers: modifiersByGroup.get(g.id) ?? [],
          })),
      }));

    return {
      categories: categoryRows.map((c) => ({ id: c.id, name: c.name, position: c.position })),
      products: publicProducts,
    };
  });
}

export async function findTableByQrToken(tenantId: string, venueId: string, qrToken: string) {
  return withContext({ tenantId, venueId }, async (tx) => {
    const rows = await tx.select().from(tables).where(and(eq(tables.qrToken, qrToken), isNull(tables.deletedAt))).limit(1);
    return rows[0] ?? null;
  });
}
