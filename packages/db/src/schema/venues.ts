import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const venues = pgTable("venues", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/Argentina/Buenos_Aires"),
  fiscalConfig: jsonb("fiscal_config"), // { cuit, pto_venta, condicion_iva, razon_social }
  settings: jsonb("settings").notNull().default({}), // propina sugerida, cubierto, etc.
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
