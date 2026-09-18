import { bigint, boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { venues } from "./venues";

export const combos = pgTable("combos", {
  id: uuid("id").primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  priceCents: bigint("price_cents", { mode: "number" }).notNull(), // precio fijo, no la suma de las partes
  available: boolean("available").notNull().default(true),
  position: integer("position").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
