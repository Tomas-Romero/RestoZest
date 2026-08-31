import { boolean, customType, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

// citext no tiene tipo nativo en drizzle-orm/pg-core; se declara como custom type.
// Requiere la extensión "citext" (la crea packages/db/docker/init.sql).
const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  fullName: text("full_name").notNull(),
  email: citext("email").unique(), // null para mozos y cocina: entran solo con PIN. Único: el login lo busca sin tenant_id todavía
  pinHash: text("pin_hash"), // argon2id · se replica al hub para login OFFLINE
  passwordHash: text("password_hash"), // solo dueño/admin, login en la nube
  active: boolean("active").notNull().default(true),
});
