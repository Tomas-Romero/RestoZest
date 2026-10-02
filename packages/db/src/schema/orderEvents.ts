import { bigint, bigserial, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { devices } from "./devices";
import { venues } from "./venues";

/**
 * La única vía de escritura del núcleo operativo (Fase 3): los endpoints NO
 * hacen UPDATE directo sobre orders/order_items, solo insertan acá. El
 * reductor puro de @resto-zest/domain (orderReducer.ts) es quien sabe
 * proyectar esto a un estado.
 *
 * order_id NO tiene FK a orders(id) a propósito: en event-sourcing el evento
 * se escribe ANTES de que exista la fila proyectada (orders.id se crea recién
 * cuando se materializa el primer "order.created"). Ponerle FK obligaría a
 * un orden de escritura al revés de cómo funciona el patrón.
 */
export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey(), // UUIDv7 del cliente = CLAVE DE IDEMPOTENCIA
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id),
    orderId: uuid("order_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    actorUserId: uuid("actor_user_id").notNull(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id),
    lamport: bigint("lamport", { mode: "number" }).notNull(), // reloj lógico del dispositivo
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(), // hora del dispositivo (puede mentir)
    receivedAt: timestamp("received_at", { withTimezone: true }), // hora del hub/nube (autoridad)
    serverSeq: bigserial("server_seq", { mode: "number" }), // orden canónico al recibirse
  },
  (table) => [
    index("order_events_venue_seq_idx").on(table.venueId, table.serverSeq),
    index("order_events_order_lamport_device_idx").on(table.orderId, table.lamport, table.deviceId),
  ],
);
