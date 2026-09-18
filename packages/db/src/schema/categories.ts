import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { venues } from "./venues";

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
