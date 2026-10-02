import { appendOrderEvent, materializeOrder, orderItems, orders, withContext } from "@resto-zest/db";
import type { OrderEvent } from "@resto-zest/domain";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireVenueAuth } from "../lib/venueAuth";

const orderModifierSchema = z.object({ id: z.string(), name: z.string(), deltaCents: z.number().int() });

const baseEventFields = {
  id: z.string().uuid(),
  deviceId: z.string().uuid(),
  lamport: z.number().int().nonnegative(),
  occurredAt: z.string().datetime(),
};

const eventSchema = z.discriminatedUnion("type", [
  z.object({
    ...baseEventFields,
    type: z.literal("order.created"),
    payload: z.object({
      sessionId: z.string().uuid().nullable(),
      channel: z.enum(["dine_in", "takeaway", "delivery", "qr_self"]),
      code: z.string().min(1),
      priceListId: z.string().uuid(),
    }),
  }),
  z.object({
    ...baseEventFields,
    type: z.literal("item.added"),
    payload: z.object({
      itemId: z.string().uuid(),
      productId: z.string().uuid(),
      variantId: z.string().uuid().nullable().optional(),
      nameSnapshot: z.string().min(1),
      unitPriceCents: z.number().int().nonnegative(),
      costSnapshotCents: z.number().int().nullable().optional(),
      qty: z.number().positive(),
      modifiers: z.array(orderModifierSchema),
      note: z.string().nullable().optional(),
      course: z.number().int().positive(),
      prepStation: z.enum(["kitchen", "bar", "grill"]),
    }),
  }),
  z.object({
    ...baseEventFields,
    type: z.literal("item.qty_changed"),
    payload: z.object({ itemId: z.string().uuid(), qty: z.number().positive() }),
  }),
  z.object({
    ...baseEventFields,
    type: z.literal("item.voided"),
    payload: z.object({ itemId: z.string().uuid(), reason: z.string().min(1) }),
  }),
  z.object({
    ...baseEventFields,
    type: z.literal("item.status_changed"),
    payload: z.object({
      itemId: z.string().uuid(),
      status: z.enum(["pending", "preparing", "ready", "served", "void"]),
    }),
  }),
  z.object({
    ...baseEventFields,
    type: z.literal("order.sent_to_station"),
    payload: z.object({ itemIds: z.array(z.string().uuid()).min(1) }),
  }),
  z.object({ ...baseEventFields, type: z.literal("order.closed"), payload: z.object({}) }),
  z.object({ ...baseEventFields, type: z.literal("order.reopened"), payload: z.object({}) }),
]);

export function registerOrderRoutes(app: FastifyInstance) {
  app.post("/venues/:venueId/orders/:orderId/events", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    const { orderId } = request.params as { orderId: string };
    const body = eventSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }

    const ctx = { tenantId: auth.tenantId, venueId: auth.venueId };
    const { duplicate } = await appendOrderEvent(ctx, {
      id: body.data.id,
      orderId,
      type: body.data.type,
      payload: body.data.payload,
      actorUserId: auth.userId,
      deviceId: body.data.deviceId,
      lamport: body.data.lamport,
      occurredAt: new Date(body.data.occurredAt),
    });

    const newEvent = duplicate
      ? undefined
      : ({
          id: body.data.id,
          orderId,
          type: body.data.type,
          payload: body.data.payload,
          actorUserId: auth.userId,
          deviceId: body.data.deviceId,
          lamport: body.data.lamport,
          occurredAt: body.data.occurredAt,
        } as OrderEvent);

    const state = await materializeOrder(ctx, orderId, body.data.deviceId, newEvent);
    return reply.code(duplicate ? 200 : 201).send({ duplicate, order: state });
  });

  app.get("/venues/:venueId/orders/:orderId", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    const { orderId } = request.params as { orderId: string };

    const result = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return null;
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      return { ...order, items };
    });

    if (!result) {
      return reply.code(404).send({ error: "no encontrado" });
    }
    return result;
  });
}
