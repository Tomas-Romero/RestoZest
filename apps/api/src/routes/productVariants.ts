import { productVariants, withContext } from "@resto-zest/db";
import { generateId } from "@resto-zest/domain";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireCatalogWriteAuth, requireVenueAuth } from "../lib/venueAuth";

const createVariantSchema = z.object({
  name: z.string().min(1),
  priceDeltaCents: z.number().int().optional(),
  position: z.number().int().optional(),
});
const updateVariantSchema = createVariantSchema.partial();

export function registerProductVariantRoutes(app: FastifyInstance) {
  app.get("/venues/:venueId/products/:productId/variants", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    const { productId } = request.params as { productId: string };
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .select()
        .from(productVariants)
        .where(and(eq(productVariants.productId, productId), isNull(productVariants.deletedAt)))
        .orderBy(productVariants.position),
    );
  });

  app.post("/venues/:venueId/products/:productId/variants", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { productId } = request.params as { productId: string };
    const body = createVariantSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }

    const id = generateId();
    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .insert(productVariants)
        .values({ id, venueId: auth.venueId, productId, ...body.data })
        .returning(),
    );
    return reply.code(201).send(row);
  });

  app.patch("/venues/:venueId/products/:productId/variants/:variantId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = updateVariantSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }
    const { variantId } = request.params as { variantId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(productVariants)
        .set({ ...body.data, updatedAt: new Date() })
        .where(eq(productVariants.id, variantId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return row;
  });

  app.delete("/venues/:venueId/products/:productId/variants/:variantId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { variantId } = request.params as { variantId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(productVariants)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(productVariants.id, variantId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return reply.code(204).send();
  });
}
