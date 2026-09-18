import { bigint, pgTable, uuid } from "drizzle-orm/pg-core";
import { priceLists } from "./priceLists";
import { productVariants } from "./productVariants";
import { products } from "./products";
import { venues } from "./venues";

/**
 * El plan original mostraba `primary key (price_list_id, product_id, variant_id)`,
 * pero variant_id es nullable (precio del producto base sin variante) y una PK
 * no admite NULL. Se usa un id UUIDv7 propio (regla no negociable #3); el
 * UNIQUE ... NULLS NOT DISTINCT que reproduce la intención original (como
 * mucho un precio por combinación) se agrega a mano en la migración
 * 0004_catalog_rls.sql — la versión de drizzle-orm instalada no expone
 * `.nullsNotDistinct()` en el builder de uniqueIndex.
 */
export const prices = pgTable("prices", {
  id: uuid("id").primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  priceListId: uuid("price_list_id")
    .notNull()
    .references(() => priceLists.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  priceCents: bigint("price_cents", { mode: "number" }).notNull(),
});
