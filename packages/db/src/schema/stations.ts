import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { venues } from "./venues";

export const STATION_KINDS = ["kitchen", "bar", "grill"] as const;

export const stations = pgTable(
  "stations",
  {
    id: uuid("id").primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id),
    name: text("name").notNull(), // "Cocina", "Parrilla 1"
    kind: text("kind").notNull(), // kitchen | bar | grill — mismo dominio que products.prep_station
    position: integer("position").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [check("stations_kind_check", sql`${table.kind} in ('kitchen','bar','grill')`)],
);
