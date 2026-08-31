import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Sesiones del plano de gestión (dueño/admin, email+password). Sin RLS a
 * propósito: para validar una sesión todavía no conocemos el tenant_id, así
 * que no hay forma de setear el contexto antes de leer esta tabla. El id es
 * el token opaco de sesión — su confidencialidad es lo que la protege, no RLS.
 */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
