import { PREP_STATIONS, PRODUCT_KINDS, products, withContext } from "@resto-zest/db";
import { generateId } from "@resto-zest/domain";
import { eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireCatalogWriteAuth, requireVenueAuth } from "../lib/venueAuth";

const createProductSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  basePriceCents: z.number().int().nonnegative(),
  costCents: z.number().int().nonnegative().nullable().optional(),
  kind: z.enum(PRODUCT_KINDS).optional(),
  prepStation: z.enum(PREP_STATIONS).optional(),
  tracksStock: z.boolean().optional(),
  available: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  position: z.number().int().optional(),
});
const updateProductSchema = createProductSchema.partial();

export function registerProductRoutes(app: FastifyInstance) {
  app.get("/venues/:venueId/products", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.select().from(products).where(isNull(products.deletedAt)).orderBy(products.position),
    );
  });

  app.post("/venues/:venueId/products", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = createProductSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }

    const id = generateId();
    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .insert(products)
        .values({ id, venueId: auth.venueId, ...body.data })
        .returning(),
    );
    return reply.code(201).send(row);
  });

  app.patch("/venues/:venueId/products/:productId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = updateProductSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }
    const { productId } = request.params as { productId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(products)
        .set({ ...body.data, updatedAt: new Date() })
        .where(eq(products.id, productId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return row;
  });

  app.delete("/venues/:venueId/products/:productId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { productId } = request.params as { productId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(products)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(products.id, productId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return reply.code(204).send();
  });
}
