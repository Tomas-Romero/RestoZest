import { findTableByQrToken, findVenueBySlug, getPublicMenu } from "@resto-zest/db";
import type { FastifyInstance } from "fastify";

/**
 * Sin autenticación a propósito: es el menú digital público (Fase 2), lo
 * lee cualquiera que escanee el QR de la mesa o abra el link. Nunca exponer
 * acá nada del plano de gestión (costos, stock, datos de otros venues).
 */
export function registerPublicMenuRoutes(app: FastifyInstance) {
  app.get("/public/menu/:venueSlug", async (request, reply) => {
    const { venueSlug } = request.params as { venueSlug: string };
    const venue = await findVenueBySlug(venueSlug);
    if (!venue) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    const menu = await getPublicMenu(venue.tenantId, venue.id);
    return { venue: { slug: venue.slug, name: venue.name, timezone: venue.timezone }, menu };
  });

  app.get("/public/menu/:venueSlug/mesa/:qrToken", async (request, reply) => {
    const { venueSlug, qrToken } = request.params as { venueSlug: string; qrToken: string };
    const venue = await findVenueBySlug(venueSlug);
    if (!venue) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    const table = await findTableByQrToken(venue.tenantId, venue.id, qrToken);
    if (!table) {
      return reply.code(404).send({ error: "mesa no encontrada" });
    }
    const menu = await getPublicMenu(venue.tenantId, venue.id);
    return {
      venue: { slug: venue.slug, name: venue.name, timezone: venue.timezone },
      table: { code: table.code },
      menu,
    };
  });
}
