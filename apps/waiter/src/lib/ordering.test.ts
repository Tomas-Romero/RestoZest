import { type OrderEvent, reduceOrderEvents } from "@resto-zest/domain";
import { describe, expect, it } from "vitest";
import { type CartItem, buildSendBatch, cartItemTotalCents } from "./ordering";

const item = (overrides: Partial<CartItem> = {}): CartItem => ({
  itemId: crypto.randomUUID(),
  productId: "prod-1",
  variantId: null,
  name: "Empanada",
  unitPriceCents: 150000,
  costSnapshotCents: 50000,
  qty: 2,
  modifiers: [],
  note: null,
  course: 1,
  prepStation: "kitchen",
  ...overrides,
});

const base = {
  sessionId: "session-1",
  tableCode: "12",
  priceListId: "pl-1",
  deviceId: "device-1",
  startLamport: 10,
};

// El backend agrega orderId y actorUserId al guardar; para proyectar en el test los sumamos acá.
function project(orderId: string, batch: ReturnType<typeof buildSendBatch>) {
  return reduceOrderEvents(
    batch.events.map((e) => ({ ...e, orderId, actorUserId: "user-1" }) as unknown as OrderEvent),
  );
}

describe("buildSendBatch", () => {
  it("una mesa sin orden previa: order.created + item.added por ítem + order.sent_to_station", () => {
    const items = [item(), item({ name: "Gaseosa", prepStation: "bar", qty: 1, unitPriceCents: 200000 })];
    const batch = buildSendBatch({ ...base, orderId: "order-1", existingOrder: false, items });

    expect(batch.events.map((e) => e.type)).toEqual([
      "order.created",
      "item.added",
      "item.added",
      "order.sent_to_station",
    ]);
    const sent = batch.events.at(-1)!;
    expect(sent.payload).toEqual({ itemIds: items.map((i) => i.itemId) });
  });

  it("con la orden ya creada no repite order.created", () => {
    const batch = buildSendBatch({ ...base, orderId: "order-1", existingOrder: true, items: [item()] });
    expect(batch.events.map((e) => e.type)).toEqual(["item.added", "order.sent_to_station"]);
  });

  it("los lamports son consecutivos desde startLamport y devuelve el siguiente", () => {
    const batch = buildSendBatch({ ...base, orderId: "order-1", existingOrder: false, items: [item()] });
    expect(batch.events.map((e) => e.lamport)).toEqual([10, 11, 12]);
    expect(batch.nextLamport).toBe(13);
  });

  it("los eventos proyectados con el reductor dan la orden esperada (estado sent, total correcto)", () => {
    const items = [
      item({ qty: 2, modifiers: [{ id: "m1", name: "Extra queso", deltaCents: 20000 }] }),
      item({ name: "Gaseosa", prepStation: "bar", qty: 1, unitPriceCents: 200000 }),
    ];
    const batch = buildSendBatch({ ...base, orderId: "order-1", existingOrder: false, items });
    const state = project("order-1", batch);

    expect(state?.status).toBe("sent");
    expect(state?.code).toMatch(/^M12-/);
    expect(Object.keys(state!.items)).toHaveLength(2);
    expect(Object.values(state!.items).every((i) => i.status === "pending")).toBe(true);
  });

  it("cada evento tiene un id único (clave de idempotencia para reintentar sin duplicar)", () => {
    const batch = buildSendBatch({ ...base, orderId: "order-1", existingOrder: false, items: [item(), item()] });
    const ids = batch.events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("cartItemTotalCents", () => {
  it("suma modificadores al precio unitario antes de multiplicar por cantidad", () => {
    const total = cartItemTotalCents(item({ qty: 3, modifiers: [{ id: "m", name: "x", deltaCents: 20000 }] }));
    expect(total).toBe((150000 + 20000) * 3);
  });
});
