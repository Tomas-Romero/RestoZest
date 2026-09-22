import { dailyMenuItems, dailyMenus, withContext } from "@resto-zest/db";
import { generateId } from "@resto-zest/domain";
import { eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireCatalogWriteAuth, requireVenueAuth } from "../lib/venueAuth";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha inválida (YYYY-MM-DD)");
const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "hora inválida (HH:MM)");

const createDailyMenuSchema = z.object({
  name: z.string().min(1),
  validFrom: dateSchema,
  validTo: dateSchema.nullable().optional(),
  startsAt: timeSchema.nullable().optional(),
  endsAt: timeSchema.nullable().optional(),
  active: z.boolean().optional(),
});
const updateDailyMenuSchema = createDailyMenuSchema.partial();

const createDailyMenuItemSchema = z.object({
  productId: z.string().uuid(),
  priceCents: z.number().int().nonnegative().nullable().optional(),
  position: z.number().int().optional(),
});

export function registerDailyMenuRoutes(app: FastifyInstance) {
  app.get("/venues/:venueId/daily-menus", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.select().from(dailyMenus).where(isNull(dailyMenus.deletedAt)),
    );
  });

  app.post("/venues/:venueId/daily-menus", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = createDailyMenuSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .insert(dailyMenus)
        .values({ id: generateId(), venueId: auth.venueId, ...body.data })
        .returning(),
    );
    return reply.code(201).send(row);
  });

  app.patch("/venues/:venueId/daily-menus/:dailyMenuId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = updateDailyMenuSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }
    const { dailyMenuId } = request.params as { dailyMenuId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(dailyMenus)
        .set({ ...body.data, updatedAt: new Date() })
        .where(eq(dailyMenus.id, dailyMenuId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return row;
  });

  app.delete("/venues/:venueId/daily-menus/:dailyMenuId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { dailyMenuId } = request.params as { dailyMenuId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(dailyMenus)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(dailyMenus.id, dailyMenuId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return reply.code(204).send();
  });

  // Items del menú del día

  app.get("/venues/:venueId/daily-menus/:dailyMenuId/items", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    const { dailyMenuId } = request.params as { dailyMenuId: string };
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.select().from(dailyMenuItems).where(eq(dailyMenuItems.dailyMenuId, dailyMenuId)).orderBy(dailyMenuItems.position),
    );
  });

  app.post("/venues/:venueId/daily-menus/:dailyMenuId/items", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { dailyMenuId } = request.params as { dailyMenuId: string };
    const body = createDailyMenuItemSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .insert(dailyMenuItems)
        .values({ id: generateId(), venueId: auth.venueId, dailyMenuId, ...body.data })
        .returning(),
    );
    return reply.code(201).send(row);
  });

  app.delete("/venues/:venueId/daily-menus/:dailyMenuId/items/:itemId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { itemId } = request.params as { itemId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.delete(dailyMenuItems).where(eq(dailyMenuItems.id, itemId)).returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return reply.code(204).send();
  });
}
