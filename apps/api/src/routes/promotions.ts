import { DISCOUNT_TYPES, PROMOTION_SCOPES, promotions, withContext } from "@resto-zest/db";
import { generateId } from "@resto-zest/domain";
import { eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireCatalogWriteAuth, requireVenueAuth } from "../lib/venueAuth";

const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "hora inválida (HH:MM)");

const basePromotionSchema = z.object({
  name: z.string().min(1),
  scope: z.enum(PROMOTION_SCOPES),
  scopeId: z.string().uuid().nullable().optional(),
  discountType: z.enum(DISCOUNT_TYPES),
  discountValue: z.number().positive(),
  validFrom: z.string().min(1),
  validTo: z.string().nullable().optional(),
  startsAt: timeSchema.nullable().optional(),
  endsAt: timeSchema.nullable().optional(),
  active: z.boolean().optional(),
});

const createPromotionSchema = basePromotionSchema.refine((v) => v.scope === "all" || !!v.scopeId, {
  message: "scopeId es requerido salvo que scope sea 'all'",
});
const updatePromotionSchema = basePromotionSchema.partial();

function toInsertRow(data: z.infer<typeof basePromotionSchema>) {
  return {
    ...data,
    discountValue: String(data.discountValue),
    validFrom: new Date(data.validFrom),
    validTo: data.validTo ? new Date(data.validTo) : null,
  };
}

// A diferencia de toInsertRow, acá los tres campos son opcionales (PATCH
// parcial) — convertirlos solo si vinieron en el body evita mandar
// "undefined" convertido a string/Date por accidente.
function toUpdateRow(data: z.infer<typeof updatePromotionSchema>) {
  const { discountValue, validFrom, validTo, ...rest } = data;
  return {
    ...rest,
    ...(discountValue !== undefined ? { discountValue: String(discountValue) } : {}),
    ...(validFrom !== undefined ? { validFrom: new Date(validFrom) } : {}),
    ...(validTo !== undefined ? { validTo: validTo ? new Date(validTo) : null } : {}),
  };
}

export function registerPromotionRoutes(app: FastifyInstance) {
  app.get("/venues/:venueId/promotions", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.select().from(promotions).where(isNull(promotions.deletedAt)),
    );
  });

  app.post("/venues/:venueId/promotions", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = createPromotionSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .insert(promotions)
        .values({ id: generateId(), venueId: auth.venueId, ...toInsertRow(body.data) })
        .returning(),
    );
    return reply.code(201).send(row);
  });

  app.patch("/venues/:venueId/promotions/:promotionId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = updatePromotionSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }
    const { promotionId } = request.params as { promotionId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(promotions)
        .set({ ...toUpdateRow(body.data), updatedAt: new Date() })
        .where(eq(promotions.id, promotionId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return row;
  });

  app.delete("/venues/:venueId/promotions/:promotionId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { promotionId } = request.params as { promotionId: string };

    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .update(promotions)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(promotions.id, promotionId))
        .returning(),
    );
    if (!row) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return reply.code(204).send();
  });
}
