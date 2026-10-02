import type { OrderItemStatus, OrderModifier } from "@resto-zest/domain";
import { sql } from "drizzle-orm";
import { bigint, check, integer, jsonb, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { orders } from "./orders";
import { productVariants } from "./productVariants";
import { products } from "./products";
import { venues } from "./venues";

export const ORDER_ITEM_STATUSES = ["pending", "preparing", "ready", "served", "void"] as const;

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    variantId: uuid("variant_id").references(() => productVariants.id),
    nameSnapshot: text("name_snapshot").notNull(), // congelado
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(), // congelado, NO se recalcula jamás
    costSnapshotCents: bigint("cost_snapshot_cents", { mode: "number" }), // congelado → margen histórico correcto
    qty: numeric("qty", { precision: 10, scale: 3 }).notNull().default("1"),
    modifiers: jsonb("modifiers").notNull().default([]).$type<OrderModifier[]>(),
    note: text("note"), // "sin sal", "para llevar"
    course: integer("course").notNull().default(1), // entrada / principal / postre
    prepStation: text("prep_station").notNull(),
    status: text("status").notNull().default("pending").$type<OrderItemStatus>(),
    voidReason: text("void_reason"),
  },
  (table) => [check("order_items_status_check", sql`${table.status} in ('pending','preparing','ready','served','void')`)],
);
