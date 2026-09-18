import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { venues } from "./venues";

export const priceChangeBatches = pgTable("price_change_batches", {
  id: uuid("id").primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  rule: jsonb("rule").notNull(), // {scope:'category', id:'…', op:'percent', value:12.5}
  snapshot: jsonb("snapshot").notNull(), // precios previos → un click para revertir
  appliedBy: uuid("applied_by").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull(),
  revertedAt: timestamp("reverted_at", { withTimezone: true }),
});
