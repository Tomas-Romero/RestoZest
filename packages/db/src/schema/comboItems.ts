import { integer, numeric, pgTable, uuid } from "drizzle-orm/pg-core";
import { combos } from "./combos";
import { productVariants } from "./productVariants";
import { products } from "./products";
import { venues } from "./venues";

export const comboItems = pgTable("combo_items", {
  id: uuid("id").primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  comboId: uuid("combo_id")
    .notNull()
    .references(() => combos.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  qty: numeric("qty", { precision: 10, scale: 3 }).notNull().default("1"),
  position: integer("position").notNull().default(0),
});
