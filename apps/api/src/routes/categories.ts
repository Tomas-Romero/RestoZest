import { categories, withContext } from "@resto-zest/db";
import { generateId } from "@resto-zest/domain";
import { eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireCatalogWriteAuth, requireVenueAuth } from "../lib/venueAuth";

const createCategorySchema = z.object({
  name: z.string().min(1),
  position: z.number().int().optional(),
});
const updateCategorySchema = createCategorySchema.partial();

export function registerCategoryRoutes(app: FastifyInstance) {
  app.get("/venues/:venueId/categories", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.select().from(categories).where(isNull(categories.deletedAt)).orderBy(categories.position),
    );
  });

  app.post("/venues/:venueId/categories", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = createCategorySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }

    const id = generateId();
    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .insert(categories)
        .values({ id, venueId: auth.venueId, name: body.data.name, position: body.data.position ?? 0 })
        .returning(),
    );
    return reply.code(201).send(row);
  });

  app.patch("/venues/:venueId/categories/:categoryId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = updateCategorySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }
    const { categoryId } = request.params as { categoryId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(categories)
        .set({ ...body.data, updatedAt: new Date() })
        .where(eq(categories.id, categoryId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return row;
  });

  app.delete("/venues/:venueId/categories/:categoryId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { categoryId } = request.params as { categoryId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(categories)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(categories.id, categoryId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return reply.code(204).send();
  });
}
