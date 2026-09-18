import { modifierGroups, modifiers, withContext } from "@resto-zest/db";
import { generateId } from "@resto-zest/domain";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireCatalogWriteAuth, requireVenueAuth } from "../lib/venueAuth";

const createGroupSchema = z.object({
  name: z.string().min(1),
  minSelect: z.number().int().nonnegative().optional(),
  maxSelect: z.number().int().nonnegative().optional(),
  position: z.number().int().optional(),
});
const updateGroupSchema = createGroupSchema.partial();

const createModifierSchema = z.object({
  name: z.string().min(1),
  priceDeltaCents: z.number().int().optional(),
  position: z.number().int().optional(),
});
const updateModifierSchema = createModifierSchema.partial();

export function registerModifierGroupRoutes(app: FastifyInstance) {
  app.get("/venues/:venueId/modifier-groups", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.select().from(modifierGroups).where(isNull(modifierGroups.deletedAt)).orderBy(modifierGroups.position),
    );
  });

  app.post("/venues/:venueId/modifier-groups", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = createGroupSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }

    const id = generateId();
    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .insert(modifierGroups)
        .values({ id, venueId: auth.venueId, ...body.data })
        .returning(),
    );
    return reply.code(201).send(row);
  });

  app.patch("/venues/:venueId/modifier-groups/:groupId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = updateGroupSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }
    const { groupId } = request.params as { groupId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(modifierGroups)
        .set({ ...body.data, updatedAt: new Date() })
        .where(eq(modifierGroups.id, groupId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return row;
  });

  app.delete("/venues/:venueId/modifier-groups/:groupId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { groupId } = request.params as { groupId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(modifierGroups)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(modifierGroups.id, groupId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return reply.code(204).send();
  });

  // Modificadores (anidados bajo su grupo)

  app.get("/venues/:venueId/modifier-groups/:groupId/modifiers", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    const { groupId } = request.params as { groupId: string };
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .select()
        .from(modifiers)
        .where(and(eq(modifiers.modifierGroupId, groupId), isNull(modifiers.deletedAt)))
        .orderBy(modifiers.position),
    );
  });

  app.post("/venues/:venueId/modifier-groups/:groupId/modifiers", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { groupId } = request.params as { groupId: string };
    const body = createModifierSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }

    const id = generateId();
    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .insert(modifiers)
        .values({ id, venueId: auth.venueId, modifierGroupId: groupId, ...body.data })
        .returning(),
    );
    return reply.code(201).send(row);
  });

  app.patch("/venues/:venueId/modifier-groups/:groupId/modifiers/:modifierId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = updateModifierSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }
    const { modifierId } = request.params as { modifierId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(modifiers)
        .set({ ...body.data, updatedAt: new Date() })
        .where(eq(modifiers.id, modifierId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return row;
  });

  app.delete("/venues/:venueId/modifier-groups/:groupId/modifiers/:modifierId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { modifierId } = request.params as { modifierId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(modifiers)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(modifiers.id, modifierId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return reply.code(204).send();
  });
}
