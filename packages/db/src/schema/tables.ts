import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { venues } from "./venues";

/**
 * Versión mínima para Fase 2 (menú público por QR): solo lo que necesita
 * mostrar "estás en la mesa 12". Fase 3 le agrega area_id, seats, pos_x/pos_y
 * y el resto del salón con una migración aditiva — no se toca esta.
 */
export const tables = pgTable("tables", {
  id: uuid("id").primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  code: text("code").notNull(), // "12"
  qrToken: text("qr_token").notNull().unique(), // → menú "solo vista" de esa mesa
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
