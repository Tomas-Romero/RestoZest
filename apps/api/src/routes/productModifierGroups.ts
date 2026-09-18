import { modifierGroups, productModifierGroups, withContext } from "@resto-zest/db";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireCatalogWriteAuth, requireVenueAuth } from "../lib/venueAuth";

const attachSchema = z.object({
  modifierGroupId: z.string().uuid(),
  position: z.number().int().optional(),
});

export function registerProductModifierGroupRoutes(app: FastifyInstance) {
  app.get("/venues/:venueId/products/:productId/modifier-groups", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    const { productId } = request.params as { productId: string };
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .select({
          modifierGroupId: productModifierGroups.modifierGroupId,
          position: productModifierGroups.position,
          name: modifierGroups.name,
          minSelect: modifierGroups.minSelect,
          maxSelect: modifierGroups.maxSelect,
        })
        .from(productModifierGroups)
        .innerJoin(modifierGroups, eq(modifierGroups.id, productModifierGroups.modifierGroupId))
        .where(eq(productModifierGroups.productId, productId))
        .orderBy(productModifierGroups.position),
    );
  });

  app.post("/venues/:venueId/products/:productId/modifier-groups", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { productId } = request.params as { productId: string };
    const body = attachSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .insert(productModifierGroups)
        .values({
          venueId: auth.venueId,
          productId,
          modifierGroupId: body.data.modifierGroupId,
          position: body.data.position ?? 0,
        })
        .returning(),
    );
    return reply.code(201).send(row);
  });

  app.delete("/venues/:venueId/products/:productId/modifier-groups/:modifierGroupId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { productId, modifierGroupId } = request.params as { productId: string; modifierGroupId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .delete(productModifierGroups)
        .where(
          and(
            eq(productModifierGroups.productId, productId),
            eq(productModifierGroups.modifierGroupId, modifierGroupId),
          ),
        )
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return reply.code(204).send();
  });
}
