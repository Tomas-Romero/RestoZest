import { priceChangeBatches, products, withContext } from "@resto-zest/db";
import { applyPriceRule, generateId, type PriceRule } from "@resto-zest/domain";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireCatalogWriteAuth, requireVenueAuth } from "../lib/venueAuth";

const applyBatchSchema = z
  .object({
    scope: z.enum(["all", "category", "tag"]),
    categoryId: z.string().uuid().optional(),
    tag: z.string().min(1).optional(),
    op: z.enum(["percent", "fixed"]),
    percent: z.number().optional(),
    amountCents: z.number().int().optional(),
    rounding: z.union([z.literal(10), z.literal(50), z.literal(100)]).optional(),
  })
  .refine((v) => v.scope !== "category" || !!v.categoryId, {
    message: "categoryId es requerido cuando scope es 'category'",
  })
  .refine((v) => v.scope !== "tag" || !!v.tag, { message: "tag es requerido cuando scope es 'tag'" })
  .refine((v) => v.op !== "percent" || typeof v.percent === "number", {
    message: "percent es requerido cuando op es 'percent'",
  })
  .refine((v) => v.op !== "fixed" || typeof v.amountCents === "number", {
    message: "amountCents es requerido cuando op es 'fixed'",
  });

export function registerPriceChangeBatchRoutes(app: FastifyInstance) {
  app.get("/venues/:venueId/price-change-batches", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.select().from(priceChangeBatches).orderBy(desc(priceChangeBatches.appliedAt)),
    );
  });

  app.post("/venues/:venueId/price-change-batches", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = applyBatchSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }
    const data = body.data;

    const rule: PriceRule =
      data.op === "percent"
        ? { op: "percent", percent: data.percent!, rounding: data.rounding }
        : { op: "fixed", amountCents: data.amountCents!, rounding: data.rounding };

    const result = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, async (tx) => {
      const conditions = [isNull(products.deletedAt)];
      if (data.scope === "category") {
        conditions.push(eq(products.categoryId, data.categoryId!));
      }
      if (data.scope === "tag") {
        conditions.push(sql`${products.tags} @> ARRAY[${data.tag}]::text[]`);
      }

      const affected = await tx
        .select({ id: products.id, basePriceCents: products.basePriceCents })
        .from(products)
        .where(and(...conditions));

      if (affected.length === 0) {
        return null;
      }

      const snapshot: Record<string, number> = {};
      for (const product of affected) {
        snapshot[product.id] = product.basePriceCents;
        const newPrice = applyPriceRule(product.basePriceCents, rule);
        await tx.update(products).set({ basePriceCents: newPrice, updatedAt: new Date() }).where(eq(products.id, product.id));
      }

      const [batch] = await tx
        .insert(priceChangeBatches)
        .values({
          id: generateId(),
          venueId: auth.venueId,
          rule: { scope: data.scope, categoryId: data.categoryId, tag: data.tag, ...rule },
          snapshot,
          appliedBy: auth.userId,
          appliedAt: new Date(),
        })
        .returning();

      return { batch, affectedCount: affected.length };
    });

    if (!result) {
      return reply.code(400).send({ error: "ningún producto coincide con el criterio elegido" });
    }
    return reply.code(201).send(result);
  });

  app.post("/venues/:venueId/price-change-batches/:batchId/revert", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { batchId } = request.params as { batchId: string };

    const result = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, async (tx) => {
      const [batch] = await tx.select().from(priceChangeBatches).where(eq(priceChangeBatches.id, batchId)).limit(1);
      if (!batch) return "not_found" as const;
      if (batch.revertedAt) return "already_reverted" as const;

      for (const [productId, oldPriceCents] of Object.entries(batch.snapshot)) {
        await tx.update(products).set({ basePriceCents: oldPriceCents, updatedAt: new Date() }).where(eq(products.id, productId));
      }

      const [reverted] = await tx
        .update(priceChangeBatches)
        .set({ revertedAt: new Date() })
        .where(eq(priceChangeBatches.id, batchId))
        .returning();
      return reverted;
    });

    if (result === "not_found") {
      return reply.code(404).send({ error: "no encontrado" });
    }
    if (result === "already_reverted") {
      return reply.code(400).send({ error: "este lote ya fue revertido" });
    }
    return result;
  });
}
