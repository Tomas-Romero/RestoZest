import { bigint, integer, pgTable, uuid } from "drizzle-orm/pg-core";
import { dailyMenus } from "./dailyMenus";
import { products } from "./products";
import { venues } from "./venues";

export const dailyMenuItems = pgTable("daily_menu_items", {
  id: uuid("id").primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  dailyMenuId: uuid("daily_menu_id")
    .notNull()
    .references(() => dailyMenus.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  priceCents: bigint("price_cents", { mode: "number" }), // null = usa el precio de lista normal
  position: integer("position").notNull().default(0),
});
