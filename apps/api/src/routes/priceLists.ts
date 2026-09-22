import { PRICE_LIST_CHANNELS, prices, priceLists, withContext } from "@resto-zest/db";
import { generateId } from "@resto-zest/domain";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireCatalogWriteAuth, requireVenueAuth } from "../lib/venueAuth";

const createPriceListSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(PRICE_LIST_CHANNELS),
});
const updatePriceListSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

const upsertPriceSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  priceCents: z.number().int().nonnegative(),
});

export function registerPriceListRoutes(app: FastifyInstance) {
  app.get("/venues/:venueId/price-lists", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) => tx.select().from(priceLists));
  });

  app.post("/venues/:venueId/price-lists", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = createPriceListSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .insert(priceLists)
        .values({ id: generateId(), venueId: auth.venueId, name: body.data.name, channel: body.data.channel })
        .returning(),
    );
    return reply.code(201).send(row);
  });

  app.patch("/venues/:venueId/price-lists/:priceListId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = updatePriceListSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }
    const { priceListId } = request.params as { priceListId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.update(priceLists).set(body.data).where(eq(priceLists.id, priceListId)).returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return row;
  });

  // Precios (overrides por producto/variante dentro de la lista)

  app.get("/venues/:venueId/price-lists/:priceListId/prices", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    const { priceListId } = request.params as { priceListId: string };
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.select().from(prices).where(eq(prices.priceListId, priceListId)),
    );
  });

  app.put("/venues/:venueId/price-lists/:priceListId/prices", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { priceListId } = request.params as { priceListId: string };
    const body = upsertPriceSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }
    const variantId = body.data.variantId ?? null;

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .insert(prices)
        .values({
          id: generateId(),
          venueId: auth.venueId,
          priceListId,
          productId: body.data.productId,
          variantId,
          priceCents: body.data.priceCents,
        })
        .onConflictDoUpdate({
          target: [prices.priceListId, prices.productId, prices.variantId],
          set: { priceCents: body.data.priceCents },
        })
        .returning(),
    );
    return reply.code(200).send(row);
  });

  app.delete("/venues/:venueId/price-lists/:priceListId/prices/:priceId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { priceListId, priceId } = request.params as { priceListId: string; priceId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .delete(prices)
        .where(and(eq(prices.id, priceId), eq(prices.priceListId, priceListId)))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return reply.code(204).send();
  });
}
