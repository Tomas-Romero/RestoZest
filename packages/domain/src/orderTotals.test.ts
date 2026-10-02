import { describe, expect, it } from "vitest";
import type { OrderState } from "./orderEvents";
import { computeOrderSubtotalCents } from "./orderTotals";

function stateWithItems(items: OrderState["items"]): OrderState {
  return {
    id: "order-1",
    venueId: "venue-1",
    sessionId: null,
    channel: "dine_in",
    code: "M1-001",
    priceListId: "pl-1",
    status: "open",
    items,
    createdAt: new Date().toISOString(),
  };
}

const baseItem: OrderState["items"][string] = {
  id: "item-1",
  productId: "prod-1",
  variantId: null,
  nameSnapshot: "Empanada",
  unitPriceCents: 150000,
  costSnapshotCents: null,
  qty: 1,
  modifiers: [],
  note: null,
  course: 1,
  prepStation: "kitchen",
  status: "pending",
  voidReason: null,
};

describe("computeOrderSubtotalCents", () => {
  it("suma unitPriceCents * qty de cada item", () => {
    const state = stateWithItems({
      "item-1": { ...baseItem, qty: 2 },
      "item-2": { ...baseItem, id: "item-2", unitPriceCents: 200000, qty: 1 },
    });
    expect(computeOrderSubtotalCents(state)).toBe(150000 * 2 + 200000);
  });

  it("suma el delta de los modificadores antes de multiplicar por qty", () => {
    const state = stateWithItems({
      "item-1": {
        ...baseItem,
        qty: 3,
        modifiers: [
          { id: "m1", name: "Extra queso", deltaCents: 20000 },
          { id: "m2", name: "Sin sal", deltaCents: 0 },
        ],
      },
    });
    // (150000 + 20000) * 3
    expect(computeOrderSubtotalCents(state)).toBe(510000);
  });

  it("excluye los items anulados (void)", () => {
    const state = stateWithItems({
      "item-1": { ...baseItem, qty: 1 },
      "item-2": { ...baseItem, id: "item-2", qty: 5, status: "void", voidReason: "error de carga" },
    });
    expect(computeOrderSubtotalCents(state)).toBe(150000);
  });

  it("da 0 para una orden sin items", () => {
    expect(computeOrderSubtotalCents(stateWithItems({}))).toBe(0);
  });
});
