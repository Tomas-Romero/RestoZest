import { createHash, randomBytes } from "node:crypto";
import { areas, devices, getOperationalMenu, orderItems, orders, tableSessions, tables, withContext } from "@resto-zest/db";
import { generateId } from "@resto-zest/domain";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireCatalogWriteAuth, requireVenueAuth } from "../lib/venueAuth";

const registerDeviceSchema = z.object({
  label: z.string().min(1),
  kind: z.enum(["waiter", "pos", "kds", "admin"]),
});

const areaSchema = z.object({ name: z.string().min(1), position: z.number().int().optional() });
const createTableSchema = z.object({
  code: z.string().min(1),
  areaId: z.string().uuid().nullable().optional(),
  seats: z.number().int().positive().optional(),
  posX: z.number().int().nullable().optional(),
  posY: z.number().int().nullable().optional(),
});
const updateTableSchema = createTableSchema.partial();
const openSessionSchema = z.object({
  id: z.string().uuid().optional(),
  guests: z.number().int().positive().default(1),
});

export function registerSalonRoutes(app: FastifyInstance) {
  // Alta de dispositivo (tablet de mozo, pantalla de KDS...). El token todavía
  // no se usa para autenticar — eso llega con el enrolamiento de Fase 5 — pero
  // order_events.device_id necesita una fila real en `devices`.
  app.post("/venues/:venueId/devices/register", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    const body = registerDeviceSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    }
    const token = randomBytes(24).toString("base64url");
    const id = generateId();
    await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.insert(devices).values({
        id,
        venueId: auth.venueId,
        label: body.data.label,
        kind: body.data.kind,
        tokenHash: createHash("sha256").update(token).digest("hex"),
      }),
    );
    return reply.code(201).send({ id });
  });

  // Menú para tomar pedidos: igual al público pero con estación y costo (los
  // necesita el evento item.added), y con los precios de la lista del canal.
  app.get("/venues/:venueId/pos-menu", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    const { priceListId } = request.query as { priceListId?: string };
    return getOperationalMenu(auth.tenantId, auth.venueId, priceListId);
  });

  // Plano completo: áreas + mesas, cada mesa con su sesión abierta (si hay).
  app.get("/venues/:venueId/floor", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, async (tx) => {
      const [areaRows, tableRows, sessionRows] = await Promise.all([
        tx.select().from(areas).where(isNull(areas.deletedAt)).orderBy(areas.position),
        tx.select().from(tables).where(isNull(tables.deletedAt)),
        tx.select().from(tableSessions).where(inArray(tableSessions.status, ["open", "billing"])),
      ]);
      const sessionByTable = new Map(sessionRows.map((s) => [s.tableId, s]));
      return {
        areas: areaRows,
        tables: tableRows.map((t) => {
          const session = sessionByTable.get(t.id);
          return {
            id: t.id,
            areaId: t.areaId,
            code: t.code,
            seats: t.seats,
            posX: t.posX,
            posY: t.posY,
            qrToken: t.qrToken,
            session: session
              ? { id: session.id, guests: session.guests, status: session.status, openedAt: session.openedAt }
              : null,
          };
        }),
      };
    });
  });

  app.post("/venues/:venueId/areas", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = areaSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.insert(areas).values({ id: generateId(), venueId: auth.venueId, ...body.data }).returning(),
    );
    return reply.code(201).send(row);
  });

  app.patch("/venues/:venueId/areas/:areaId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = areaSchema.partial().safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    const { areaId } = request.params as { areaId: string };
    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.update(areas).set(body.data).where(eq(areas.id, areaId)).returning(),
    );
    if (!row) return reply.code(404).send({ error: "no encontrado" });
    return row;
  });

  app.delete("/venues/:venueId/areas/:areaId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { areaId } = request.params as { areaId: string };
    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.update(areas).set({ deletedAt: new Date() }).where(eq(areas.id, areaId)).returning(),
    );
    if (!row) return reply.code(404).send({ error: "no encontrado" });
    return reply.code(204).send();
  });

  app.post("/venues/:venueId/tables", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = createTableSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx
        .insert(tables)
        .values({
          id: generateId(),
          venueId: auth.venueId,
          qrToken: `qr_${randomBytes(9).toString("base64url")}`,
          ...body.data,
        })
        .returning(),
    );
    return reply.code(201).send(row);
  });

  app.patch("/venues/:venueId/tables/:tableId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const body = updateTableSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    const { tableId } = request.params as { tableId: string };
    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.update(tables).set(body.data).where(eq(tables.id, tableId)).returning(),
    );
    if (!row) return reply.code(404).send({ error: "no encontrado" });
    return row;
  });

  app.delete("/venues/:venueId/tables/:tableId", async (request, reply) => {
    const auth = await requireCatalogWriteAuth(request, reply);
    if (!auth) return;
    const { tableId } = request.params as { tableId: string };
    const [row] = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, (tx) =>
      tx.update(tables).set({ deletedAt: new Date() }).where(eq(tables.id, tableId)).returning(),
    );
    if (!row) return reply.code(404).send({ error: "no encontrado" });
    return reply.code(204).send();
  });

  // Abrir una mesa con la cantidad de comensales. Cualquier miembro puede
  // (el mozo abre sus mesas). El id lo puede generar el cliente (UUIDv7).
  app.post("/venues/:venueId/tables/:tableId/sessions", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    const body = openSessionSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "datos inválidos", issues: body.error.issues });
    const { tableId } = request.params as { tableId: string };

    const result = await withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, async (tx) => {
      const [table] = await tx.select().from(tables).where(and(eq(tables.id, tableId), isNull(tables.deletedAt))).limit(1);
      if (!table) return "table_not_found" as const;
      const open = await tx
        .select({ id: tableSessions.id })
        .from(tableSessions)
        .where(and(eq(tableSessions.tableId, tableId), inArray(tableSessions.status, ["open", "billing"])))
        .limit(1);
      if (open[0]) return "already_open" as const;
      const [row] = await tx
        .insert(tableSessions)
        .values({
          id: body.data.id ?? generateId(),
          venueId: auth.venueId,
          tableId,
          openedBy: auth.userId,
          guests: body.data.guests,
          openedAt: new Date(),
        })
        .returning();
      return row;
    });

    if (result === "table_not_found") return reply.code(404).send({ error: "mesa no encontrada" });
    if (result === "already_open") return reply.code(409).send({ error: "la mesa ya tiene una sesión abierta" });
    return reply.code(201).send(result);
  });

  // Órdenes (con sus ítems) de una sesión de mesa.
  app.get("/venues/:venueId/table-sessions/:sessionId/orders", async (request, reply) => {
    const auth = await requireVenueAuth(request, reply);
    if (!auth) return;
    const { sessionId } = request.params as { sessionId: string };
    return withContext({ tenantId: auth.tenantId, venueId: auth.venueId }, async (tx) => {
      const orderRows = await tx.select().from(orders).where(eq(orders.sessionId, sessionId));
      if (orderRows.length === 0) return [];
      const itemRows = await tx
        .select()
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderRows.map((o) => o.id)));
      return orderRows.map((o) => ({ ...o, items: itemRows.filter((i) => i.orderId === o.id) }));
    });
  });
}
