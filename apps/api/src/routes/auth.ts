import {
  createSession,
  deleteSession,
  findSession,
  findUserForLogin,
  memberships,
  users,
  venues,
  verifyPassword,
  withContext,
} from "@resto-zest/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const SESSION_COOKIE = "rz_session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setSessionCookie(reply: import("fastify").FastifyReply, sessionId: string, expiresAt: Date) {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }

    const found = await findUserForLogin(body.data.email);
    if (!found || !found.active || !found.passwordHash) {
      return reply.code(401).send({ error: "credenciales inválidas" });
    }

    const valid = await verifyPassword(found.passwordHash, body.data.password);
    if (!valid) {
      return reply.code(401).send({ error: "credenciales inválidas" });
    }

    const session = await createSession(found.id, found.tenantId);
    setSessionCookie(reply, session.id, session.expiresAt);
    return { ok: true };
  });

  app.get("/auth/me", async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (!sessionId) {
      return reply.code(401).send({ error: "no autenticado" });
    }

    const session = await findSession(sessionId);
    if (!session) {
      reply.clearCookie(SESSION_COOKIE, { path: "/" });
      return reply.code(401).send({ error: "sesión inválida o vencida" });
    }

    return withContext({ tenantId: session.tenantId }, async (tx) => {
      const [user] = await tx
        .select({ id: users.id, fullName: users.fullName, email: users.email })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      const venueMemberships = await tx
        .select({ venueId: memberships.venueId, venueName: venues.name, role: memberships.role })
        .from(memberships)
        .innerJoin(venues, eq(venues.id, memberships.venueId))
        .where(eq(memberships.userId, session.userId));

      return {
        user,
        tenantId: session.tenantId,
        memberships: venueMemberships,
      };
    });
  });

  app.post("/auth/logout", async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (sessionId) {
      await deleteSession(sessionId);
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });
}
