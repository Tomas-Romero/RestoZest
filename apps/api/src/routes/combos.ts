import { comboItems, combos, withContext } from "@resto-zest/db";
import { generateId } from "@resto-zest/domain";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireCatalogWriteAuth, requireVenueAuth } from "../lib/venueAuth";

const createComboSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  priceCents: z.number().int().nonnegative(),
  available: z.boolean().optional(),
  position: z.number().int().optional(),
});
const updateComboSchema = createComboSchema.partial();

const createComboItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  qty: z.number().positive().optional(),
  position: z.number().int().optional(),
});

export function registerComboRoutes(app: FastifyInstance) {
  app.get("/venues/:venueId/combos", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.select().from(combos).where(isNull(combos.deletedAt)).orderBy(combos.position),
    );
  });

  app.post("/venues/:venueId/combos", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = createComboSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }

    const id = generateId();
    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .insert(combos)
        .values({ id, venueId: auth.venueId, ...body.data })
        .returning(),
    );
    return reply.code(201).send(row);
  });

  app.patch("/venues/:venueId/combos/:comboId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = updateComboSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }
    const { comboId } = request.params as { comboId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(combos)
        .set({ ...body.data, updatedAt: new Date() })
        .where(eq(combos.id, comboId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return row;
  });

  app.delete("/venues/:venueId/combos/:comboId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { comboId } = request.params as { comboId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(combos)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(combos.id, comboId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return reply.code(204).send();
  });

  // Items del combo (qué productos/variantes lo componen)

  app.get("/venues/:venueId/combos/:comboId/items", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    const { comboId } = request.params as { comboId: string };
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.select().from(comboItems).where(eq(comboItems.comboId, comboId)).orderBy(comboItems.position),
    );
  });

  app.post("/venues/:venueId/combos/:comboId/items", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { comboId } = request.params as { comboId: string };
    const body = createComboItemSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }

    const id = generateId();
    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .insert(comboItems)
        .values({
          id,
          venueId: auth.venueId,
          comboId,
          productId: body.data.productId,
          variantId: body.data.variantId,
          qty: body.data.qty !== undefined ? String(body.data.qty) : undefined,
          position: body.data.position,
        })
        .returning(),
    );
    return reply.code(201).send(row);
  });

  app.delete("/venues/:venueId/combos/:comboId/items/:itemId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { comboId, itemId } = request.params as { comboId: string; itemId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .delete(comboItems)
        .where(and(eq(comboItems.id, itemId), eq(comboItems.comboId, comboId)))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return reply.code(204).send();
  });
}
