import { bigint, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { modifierGroups } from "./modifierGroups";
import { venues } from "./venues";

export const modifiers = pgTable("modifiers", {
  id: uuid("id").primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  modifierGroupId: uuid("modifier_group_id")
    .notNull()
    .references(() => modifierGroups.id),
  name: text("name").notNull(), // "Jugoso", "Queso extra"
  priceDeltaCents: bigint("price_delta_cents", { mode: "number" }).notNull().default(0),
  position: integer("position").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
