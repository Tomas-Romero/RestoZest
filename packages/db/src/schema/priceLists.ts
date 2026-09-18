import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { venues } from "./venues";

export const PRICE_LIST_CHANNELS = ["salon", "delivery", "take_away"] as const;

export const priceLists = pgTable(
  "price_lists",
  {
    id: uuid("id").primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id),
    name: text("name").notNull(),
    channel: text("channel").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [check("price_lists_channel_check", sql`${table.channel} in ('salon','delivery','take_away')`)],
);
