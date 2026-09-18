import { findSession, memberships, withContext } from "@resto-zest/db";
import { and, eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";

const SESSION_COOKIE = "rz_session";

export type VenueAuth = {
  userId: string;
  tenantId: string;
  venueId: string;
  role: string;
};

/**
 * Valida la cookie de sesión y la membership del usuario en el venue de la
 * URL (`/venues/:venueId/...`). Nunca confiar en un venueId de la URL sin
 * este chequeo: las políticas de RLS del catálogo aíslan por venue_id, no
 * por tenant_id, así que la app es la única que garantiza que el venueId
 * pedido pertenece al tenant del usuario autenticado.
 *
 * Devuelve null (y ya mandó la respuesta de error) si no está autorizado.
 */
export async function requireVenueAuth(request: FastifyRequest, reply: FastifyReply): Promise<VenueAuth | null> {
  const sessionId = (request.cookies as Record<string, string | undefined>)[SESSION_COOKIE];
  if (!sessionId) {
    await reply.code(401).send({ error: "no autenticado" });
    return null;
  }

  const session = await findSession(sessionId);
  if (!session) {
    await reply.code(401).send({ error: "sesión inválida o vencida" });
    return null;
  }

  const { venueId } = request.params as { venueId?: string };
  if (!venueId) {
    await reply.code(400).send({ error: "falta venueId" });
    return null;
  }

  // La política de RLS de memberships es por tenant_id (subquery a venues,
  // ver ADR 0002), así que el filtro exacto por venueId lo hace esta query,
  // no RLS.
  const own = await withContext({ tenantId: session.tenantId }, async (tx) => {
    const rows = await tx
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, session.userId), eq(memberships.venueId, venueId)))
      .limit(1);
    return rows[0];
  });

  if (!own) {
    await reply.code(403).send({ error: "no pertenecés a este venue" });
    return null;
  }

  return { userId: session.userId, tenantId: session.tenantId, venueId, role: own.role };
}

export function canManageCatalog(role: string): boolean {
  return role === "owner" || role === "admin";
}

export async function requireCatalogWriteAuth(request: FastifyRequest, reply: FastifyReply): Promise<VenueAuth | null> {
  const auth = await requireVenueAuth(request, reply);
  if (!auth) return null;
  if (!canManageCatalog(auth.role)) {
    await reply.code(403).send({ error: "no tenés permiso para modificar el catálogo" });
    return null;
  }
  return auth;
}
