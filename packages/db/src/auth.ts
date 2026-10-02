import { hash, verify } from "@node-rs/argon2";
import { generateId } from "@resto-zest/domain";
import { and, eq, isNotNull } from "drizzle-orm";
import { bypassDb } from "./bypassClient";
import { db, withContext } from "./client";
import { memberships, sessions, users, venues } from "./schema";

export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

export type LoginLookup = {
  id: string;
  tenantId: string;
  passwordHash: string | null;
  active: boolean;
};

export async function findUserForLogin(email: string): Promise<LoginLookup | null> {
  const rows = await bypassDb
    .select({
      id: users.id,
      tenantId: users.tenantId,
      passwordHash: users.passwordHash,
      active: users.active,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Igual problema de bootstrap que findUserForLogin: el login PIN (plano
 * operativo) arranca solo con un venueId en la URL, sin tenant_id en el
 * contexto todavía. Reutiliza el mismo rol resto_zest_auth — ya tiene el
 * grant sobre estas columnas de venues desde la migración 0006 (menú público).
 */
export async function findVenueById(venueId: string): Promise<{ id: string; tenantId: string } | null> {
  const rows = await bypassDb
    .select({ id: venues.id, tenantId: venues.tenantId })
    .from(venues)
    .where(eq(venues.id, venueId))
    .limit(1);
  return rows[0] ?? null;
}

export type PinLoginCandidate = { id: string; fullName: string; pinHash: string; role: string };

/**
 * Con tenantId ya resuelto (por findVenueById), esto SÍ pasa por RLS normal.
 * Un PIN no identifica un único usuario por sí solo (el hash es salteado),
 * así que trae todos los candidatos del venue y el caller prueba el PIN
 * contra cada hash hasta encontrar el que matchea.
 */
export async function findUsersForPinLogin(tenantId: string, venueId: string): Promise<PinLoginCandidate[]> {
  return withContext({ tenantId, venueId }, async (tx) => {
    const rows = await tx
      .select({ id: users.id, fullName: users.fullName, pinHash: users.pinHash, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.venueId, venueId), eq(users.active, true), isNotNull(users.pinHash)));
    return rows as PinLoginCandidate[];
  });
}

const MANAGEMENT_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas — plano de gestión (dueño/admin)
const OPERATIONAL_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // un turno — plano operativo (PIN)
// El auto-logout a los 90s de 07-seguridad.md es un auto-bloqueo de UI en el
// dispositivo (re-pedir PIN sin cerrar sesión), no una expiración de sesión
// del lado del servidor — eso lo resuelve apps/waiter, no esta duración.

export async function createSession(
  userId: string,
  tenantId: string,
  opts: { venueId?: string; operational?: boolean } = {},
): Promise<{ id: string; expiresAt: Date }> {
  const id = generateId();
  const ttl = opts.operational ? OPERATIONAL_SESSION_TTL_MS : MANAGEMENT_SESSION_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);
  await db.insert(sessions).values({ id, userId, tenantId, venueId: opts.venueId, expiresAt });
  return { id, expiresAt };
}

export async function findSession(sessionId: string) {
  const rows = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  const session = rows[0];
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
