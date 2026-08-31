import { bigint, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { venues } from "./venues";

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  label: text("label").notNull(), // "Tablet Mozo 2", "Caja 1", "KDS Parrilla"
  kind: text("kind").notNull(), // waiter | pos | kds | admin | hub
  tokenHash: text("token_hash").notNull(),
  lamport: bigint("lamport", { mode: "number" }).notNull().default(0), // reloj lógico
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});
