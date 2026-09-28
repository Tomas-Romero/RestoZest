import { hash, verify } from "@node-rs/argon2";
import { generateId } from "@resto-zest/domain";
import { eq } from "drizzle-orm";
import { bypassDb } from "./bypassClient";
import { db } from "./client";
import { sessions, users } from "./schema";

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

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas — plano de gestión (dueño/admin)

export async function createSession(userId: string, tenantId: string): Promise<{ id: string; expiresAt: Date }> {
  const id = generateId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id, userId, tenantId, expiresAt });
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
