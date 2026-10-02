import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tables } from "./tables";
import { venues } from "./venues";

export const TABLE_SESSION_STATUSES = ["open", "billing", "closed"] as const;

export const tableSessions = pgTable(
  "table_sessions",
  {
    id: uuid("id").primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id),
    openedBy: uuid("opened_by").notNull(), // mozo
    guests: integer("guests").notNull().default(1),
    status: text("status").notNull().default("open"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [check("table_sessions_status_check", sql`${table.status} in ('open','billing','closed')`)],
);
