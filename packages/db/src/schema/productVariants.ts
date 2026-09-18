import { bigint, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { products } from "./products";
import { venues } from "./venues";

export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  name: text("name").notNull(), // "Porción", "Media porción"
  priceDeltaCents: bigint("price_delta_cents", { mode: "number" }).notNull().default(0),
  position: integer("position").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
