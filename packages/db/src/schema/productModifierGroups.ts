import { integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { modifierGroups } from "./modifierGroups";
import { products } from "./products";
import { venues } from "./venues";

export const productModifierGroups = pgTable(
  "product_modifier_groups",
  {
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    modifierGroupId: uuid("modifier_group_id")
      .notNull()
      .references(() => modifierGroups.id),
    position: integer("position").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.productId, table.modifierGroupId] })],
);
