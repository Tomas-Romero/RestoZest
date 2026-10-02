import { describe, expect, it } from "vitest";
import type { OrderEvent } from "./orderEvents";
import { reduceOrderEvents } from "./orderReducer";

const venueId = "venue-1";
const orderId = "order-1";
const deviceId = "device-a";
const actorUserId = "user-1";

function created(lamport: number, overrides: Partial<OrderEvent & { type: "order.created" }> = {}): OrderEvent {
  return {
    id: `evt-created-${lamport}`,
    orderId,
    type: "order.created",
    payload: { venueId, sessionId: "session-1", channel: "dine_in", code: "M12-001", priceListId: "pl-1" },
    actorUserId,
    deviceId,
    lamport,
    occurredAt: new Date(2026, 0, 1, 20, 0, lamport).toISOString(),
    ...overrides,
  } as OrderEvent;
}

function itemAdded(
  lamport: number,
  itemId: string,
  overrides: Partial<{ qty: number; course: number; prepStation: string; note: string | null }> = {},
): OrderEvent {
  return {
    id: `evt-item-added-${itemId}`,
    orderId,
    type: "item.added",
    payload: {
      itemId,
      productId: "prod-empanada",
      variantId: null,
      nameSnapshot: "Empanada",
      unitPriceCents: 150000,
      costSnapshotCents: 50000,
      qty: overrides.qty ?? 1,
      modifiers: [],
      note: overrides.note ?? null,
      course: overrides.course ?? 1,
      prepStation: overrides.prepStation ?? "kitchen",
    },
    actorUserId,
    deviceId,
    lamport,
    occurredAt: new Date(2026, 0, 1, 20, 0, lamport).toISOString(),
  };
}

describe("reduceOrderEvents", () => {
  it("proyecta order.created + item.added a un estado de orden con sus items", () => {
    const events: OrderEvent[] = [created(1), itemAdded(2, "item-1")];
    const state = reduceOrderEvents(events);

    expect(state?.id).toBe(orderId);
    expect(state?.status).toBe("open");
    expect(state?.items["item-1"]).toMatchObject({
      nameSnapshot: "Empanada",
      unitPriceCents: 150000,
      qty: 1,
      status: "pending",
    });
  });

  it("item.qty_changed actualiza la cantidad del item correspondiente, no otros", () => {
    const events: OrderEvent[] = [
      created(1),
      itemAdded(2, "item-1"),
      itemAdded(3, "item-2"),
      { id: "evt-qty", orderId, type: "item.qty_changed", payload: { itemId: "item-1", qty: 3 }, actorUserId, deviceId, lamport: 4, occurredAt: new Date().toISOString() },
    ];
    const state = reduceOrderEvents(events);

    expect(state?.items["item-1"]?.qty).toBe(3);
    expect(state?.items["item-2"]?.qty).toBe(1);
  });

  it("item.voided marca el item como void con su motivo, sin borrarlo", () => {
    const events: OrderEvent[] = [
      created(1),
      itemAdded(2, "item-1"),
      { id: "evt-void", orderId, type: "item.voided", payload: { itemId: "item-1", reason: "cliente se arrepintió" }, actorUserId, deviceId, lamport: 3, occurredAt: new Date().toISOString() },
    ];
    const state = reduceOrderEvents(events);

    expect(state?.items["item-1"]?.status).toBe("void");
    expect(state?.items["item-1"]?.voidReason).toBe("cliente se arrepintió");
  });

  it("item.status_changed mueve el item por el pipeline del KDS", () => {
    const events: OrderEvent[] = [
      created(1),
      itemAdded(2, "item-1"),
      { id: "evt-status-1", orderId, type: "item.status_changed", payload: { itemId: "item-1", status: "preparing" }, actorUserId, deviceId, lamport: 3, occurredAt: new Date().toISOString() },
      { id: "evt-status-2", orderId, type: "item.status_changed", payload: { itemId: "item-1", status: "ready" }, actorUserId, deviceId, lamport: 4, occurredAt: new Date().toISOString() },
    ];
    const state = reduceOrderEvents(events);

    expect(state?.items["item-1"]?.status).toBe("ready");
  });

  it("order.sent_to_station pasa la orden de open a sent", () => {
    const events: OrderEvent[] = [
      created(1),
      itemAdded(2, "item-1"),
      { id: "evt-sent", orderId, type: "order.sent_to_station", payload: { itemIds: ["item-1"] }, actorUserId, deviceId, lamport: 3, occurredAt: new Date().toISOString() },
    ];
    expect(reduceOrderEvents(events)?.status).toBe("sent");
  });

  it("order.closed y order.reopened alternan el estado de la orden", () => {
    const base: OrderEvent[] = [created(1), itemAdded(2, "item-1")];
    const closed = reduceOrderEvents([...base, { id: "evt-closed", orderId, type: "order.closed", payload: {}, actorUserId, deviceId, lamport: 3, occurredAt: new Date().toISOString() }]);
    expect(closed?.status).toBe("served");

    const reopened = reduceOrderEvents([
      ...base,
      { id: "evt-closed", orderId, type: "order.closed", payload: {}, actorUserId, deviceId, lamport: 3, occurredAt: new Date().toISOString() },
      { id: "evt-reopened", orderId, type: "order.reopened", payload: {}, actorUserId, deviceId, lamport: 4, occurredAt: new Date().toISOString() },
    ]);
    expect(reopened?.status).toBe("sent");
  });

  it("devuelve null para una lista de eventos vacía", () => {
    expect(reduceOrderEvents([])).toBeNull();
  });

  it("tira un error si el primer evento no es order.created (log corrupto)", () => {
    expect(() => reduceOrderEvents([itemAdded(1, "item-1")])).toThrow();
  });

  it("es tolerante a un evento que referencia un item inexistente (no explota el replay)", () => {
    const events: OrderEvent[] = [
      created(1),
      itemAdded(2, "item-1"),
      { id: "evt-qty-ghost", orderId, type: "item.qty_changed", payload: { itemId: "item-fantasma", qty: 9 }, actorUserId, deviceId, lamport: 3, occurredAt: new Date().toISOString() },
    ];
    expect(() => reduceOrderEvents(events)).not.toThrow();
    expect(reduceOrderEvents(events)?.items["item-1"]?.qty).toBe(1);
  });

  it("REPLAY DETERMINÍSTICO: el mismo set de eventos en cualquier orden de llegada, ordenado por (lamport, device_id), da siempre el mismo estado final", () => {
    const events: OrderEvent[] = [
      created(1),
      itemAdded(2, "item-1"),
      itemAdded(3, "item-2", { qty: 2 }),
      { id: "evt-qty", orderId, type: "item.qty_changed", payload: { itemId: "item-1", qty: 5 }, actorUserId, deviceId, lamport: 4, occurredAt: new Date().toISOString() },
      { id: "evt-sent", orderId, type: "order.sent_to_station", payload: { itemIds: ["item-1", "item-2"] }, actorUserId, deviceId, lamport: 5, occurredAt: new Date().toISOString() },
      { id: "evt-status", orderId, type: "item.status_changed", payload: { itemId: "item-2", status: "preparing" }, actorUserId, deviceId, lamport: 6, occurredAt: new Date().toISOString() },
    ];

    const canonical = reduceOrderEvents(events);

    // 20 barajadas al azar del mismo set de eventos.
    for (let i = 0; i < 20; i++) {
      const shuffled = [...events].sort(() => Math.random() - 0.5);
      expect(reduceOrderEvents(shuffled)).toEqual(canonical);
    }
  });

  it("REPLAY: con lamports empatados, device_id desempata siempre igual", () => {
    const eventsA: OrderEvent[] = [
      created(1),
      { id: "evt-x", orderId, type: "item.added", payload: { itemId: "item-x", productId: "p", nameSnapshot: "X", unitPriceCents: 100, qty: 1, modifiers: [], course: 1, prepStation: "kitchen" }, actorUserId, deviceId: "device-a", lamport: 2, occurredAt: new Date().toISOString() },
      { id: "evt-y", orderId, type: "item.added", payload: { itemId: "item-y", productId: "p", nameSnapshot: "Y", unitPriceCents: 100, qty: 1, modifiers: [], course: 1, prepStation: "kitchen" }, actorUserId, deviceId: "device-b", lamport: 2, occurredAt: new Date().toISOString() },
    ];
    const eventsB = [eventsA[0]!, eventsA[2]!, eventsA[1]!]; // mismo set, otro orden de llegada

    expect(reduceOrderEvents(eventsA)).toEqual(reduceOrderEvents(eventsB));
  });
});
