import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { areas } from "./areas";
import { venues } from "./venues";

/**
 * Empezó mínima en Fase 2 (solo lo que necesitaba el menú público por QR).
 * Fase 3 le suma area_id/seats/pos_x/pos_y para el plano del salón — migración
 * aditiva (0007), no se tocó la tabla original.
 */
export const tables = pgTable("tables", {
  id: uuid("id").primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  areaId: uuid("area_id").references(() => areas.id),
  code: text("code").notNull(), // "12"
  seats: integer("seats").notNull().default(4),
  posX: integer("pos_x"),
  posY: integer("pos_y"),
  qrToken: text("qr_token").notNull().unique(), // → menú "solo vista" de esa mesa
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
