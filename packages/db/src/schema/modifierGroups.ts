import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { venues } from "./venues";

export const modifierGroups = pgTable("modifier_groups", {
  id: uuid("id").primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  name: text("name").notNull(), // "Punto de cocción", "Agregados"
  minSelect: integer("min_select").notNull().default(0),
  maxSelect: integer("max_select").notNull().default(1),
  position: integer("position").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
