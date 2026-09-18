import { sql } from "drizzle-orm";
import { bigint, boolean, check, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { venues } from "./venues";

export const PRODUCT_KINDS = ["food", "drink", "combo"] as const;
export const PREP_STATIONS = ["kitchen", "bar", "grill"] as const;

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id),
    categoryId: uuid("category_id").references(() => categories.id),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    basePriceCents: bigint("base_price_cents", { mode: "number" }).notNull(),
    costCents: bigint("cost_cents", { mode: "number" }), // para el reporte de ganancias (Fase 8)
    kind: text("kind").notNull().default("food"),
    prepStation: text("prep_station").notNull().default("kitchen"), // rutea la comanda (Fase 6)
    tracksStock: boolean("tracks_stock").notNull().default(false),
    available: boolean("available").notNull().default(true),
    tags: text("tags").array().notNull().default([]), // sin_tacc, vegano, picante
    position: integer("position").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("products_kind_check", sql`${table.kind} in ('food','drink','combo')`),
    check("products_prep_station_check", sql`${table.prepStation} in ('kitchen','bar','grill')`),
  ],
);
