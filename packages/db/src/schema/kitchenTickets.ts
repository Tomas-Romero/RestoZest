import { sql } from "drizzle-orm";
import { check, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { orderItems } from "./orderItems";
import { orders } from "./orders";
import { stations } from "./stations";
import { venues } from "./venues";

/**
 * Agrupa los order_items que se mandaron juntos a una estación en una misma
 * "comanda" (Fase 3): es la unidad que el KDS muestra como una tarjeta, y de
 * donde sale el cronómetro (arranca en created_at). No está en el esquema
 * original del plan con detalle — se diseñó acá porque el roadmap la nombra
 * como migración de Fase 3 sin especificar columnas.
 */
export const kitchenTickets = pgTable(
  "kitchen_tickets",
  {
    id: uuid("id").primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    stationId: uuid("station_id")
      .notNull()
      .references(() => stations.id),
    status: text("status").notNull().default("pending"), // pending -> preparing -> ready
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
  },
  (table) => [check("kitchen_tickets_status_check", sql`${table.status} in ('pending','preparing','ready')`)],
);

export const kitchenTicketItems = pgTable(
  "kitchen_ticket_items",
  {
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => kitchenTickets.id),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id),
  },
  (table) => [primaryKey({ columns: [table.ticketId, table.orderItemId] })],
);
