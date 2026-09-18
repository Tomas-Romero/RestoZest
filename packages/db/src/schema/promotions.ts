import { sql } from "drizzle-orm";
import { boolean, check, numeric, pgTable, text, time, timestamp, uuid } from "drizzle-orm/pg-core";
import { venues } from "./venues";

export const PROMOTION_SCOPES = ["product", "category", "all"] as const;
export const DISCOUNT_TYPES = ["percent", "fixed"] as const;

export const promotions = pgTable(
  "promotions",
  {
    id: uuid("id").primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id),
    name: text("name").notNull(),
    scope: text("scope").notNull(), // product | category | all
    scopeId: uuid("scope_id"), // product_id o category_id según scope; null si scope='all'
    discountType: text("discount_type").notNull(), // percent | fixed
    discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    startsAt: time("starts_at"), // franja horaria diaria opcional
    endsAt: time("ends_at"),
    active: boolean("active").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("promotions_scope_check", sql`${table.scope} in ('product','category','all')`),
    check("promotions_discount_type_check", sql`${table.discountType} in ('percent','fixed')`),
  ],
);
