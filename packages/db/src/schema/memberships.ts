import { sql } from "drizzle-orm";
import { check, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { venues } from "./venues";

export const MEMBERSHIP_ROLES = ["owner", "admin", "cashier", "waiter", "kitchen", "runner"] as const;

export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id),
    role: text("role").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.venueId] }),
    check(
      "memberships_role_check",
      sql`${table.role} in ('owner','admin','cashier','waiter','kitchen','runner')`,
    ),
  ],
);
