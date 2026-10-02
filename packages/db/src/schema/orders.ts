import { sql } from "drizzle-orm";
import { bigint, check, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { devices } from "./devices";
import { priceLists } from "./priceLists";
import { tableSessions } from "./tableSessions";
import { venues } from "./venues";

export const ORDER_CHANNELS = ["dine_in", "takeaway", "delivery", "qr_self"] as const;
export const ORDER_STATUSES = ["open", "sent", "served", "paid", "void"] as const;

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey(), // UUIDv7 generado EN EL DISPOSITIVO
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id),
    sessionId: uuid("session_id").references(() => tableSessions.id), // null si es delivery
    channel: text("channel").notNull(),
    code: text("code").notNull(), // legible: "C1-0831-042"
    status: text("status").notNull().default("open"),
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceLists.id),
    customerId: uuid("customer_id"),
    subtotalCents: bigint("subtotal_cents", { mode: "number" }).notNull().default(0),
    discountCents: bigint("discount_cents", { mode: "number" }).notNull().default(0),
    serviceCents: bigint("service_cents", { mode: "number" }).notNull().default(0), // cubierto / servicio de mesa
    totalCents: bigint("total_cents", { mode: "number" }).notNull().default(0),
    originDeviceId: uuid("origin_device_id")
      .notNull()
      .references(() => devices.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
  },
  (table) => [
    unique("orders_venue_code_key").on(table.venueId, table.code),
    check("orders_channel_check", sql`${table.channel} in ('dine_in','takeaway','delivery','qr_self')`),
    check("orders_status_check", sql`${table.status} in ('open','sent','served','paid','void')`),
  ],
);
