import {
  createSession,
  deleteSession,
  findSession,
  findUserForLogin,
  findUsersForPinLogin,
  findVenueById,
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

const pinLoginSchema = z.object({
  pin: z.string().min(4).max(6),
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

  // Plano operativo (07-seguridad.md): PIN en vez de email+contraseña.
  // Todavía sin dispositivo enrolado ni offline (eso es Fase 5) — Fase 3 es
  // 100% online, así que esto alcanza con validar contra la nube.
  app.post("/venues/:venueId/auth/pin-login", async (request, reply) => {
    const body = pinLoginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }
    const { venueId } = request.params as { venueId: string };

    const venue = await findVenueById(venueId);
    if (!venue) {
      return reply.code(404).send({ error: "no encontrado" });
    }

    const candidates = await findUsersForPinLogin(venue.tenantId, venueId);
    let matched: (typeof candidates)[number] | null = null;
    for (const candidate of candidates) {
      if (await verifyPassword(candidate.pinHash, body.data.pin)) {
        matched = candidate;
        break;
      }
    }
    if (!matched) {
      return reply.code(401).send({ error: "PIN inválido" });
    }

    const session = await createSession(matched.id, venue.tenantId, { venueId, operational: true });
    setSessionCookie(reply, session.id, session.expiresAt);
    return { ok: true, user: { id: matched.id, fullName: matched.fullName }, role: matched.role };
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

      // Si la sesión ya trae venueId (login PIN), el rol de esa membership
      // puntual también viaja directo — evita que apps/waiter tenga que
      // buscarlo en la lista de memberships como hace el admin.
      const currentMembership = venueMemberships.find((m) => m.venueId === session.venueId);

      return {
        user,
        tenantId: session.tenantId,
        memberships: venueMemberships,
        venueId: session.venueId ?? null,
        role: currentMembership?.role ?? null,
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
