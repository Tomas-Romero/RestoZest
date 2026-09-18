import { boolean, date, pgTable, text, time, timestamp, uuid } from "drizzle-orm/pg-core";
import { venues } from "./venues";

export const dailyMenus = pgTable("daily_menus", {
  id: uuid("id").primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  name: text("name").notNull(), // "Menú ejecutivo"
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"), // null = sin fecha de fin
  startsAt: time("starts_at"), // franja horaria; null = todo el día
  endsAt: time("ends_at"),
  active: boolean("active").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
