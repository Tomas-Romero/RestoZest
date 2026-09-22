import { describe, expect, it } from "vitest";
import { applyPriceRule } from "./priceRules";

describe("applyPriceRule", () => {
  it("aplica un porcentaje positivo", () => {
    expect(applyPriceRule(100000, { op: "percent", percent: 15 })).toBe(115000);
  });

  it("aplica un porcentaje negativo (descuento)", () => {
    expect(applyPriceRule(100000, { op: "percent", percent: -10 })).toBe(90000);
  });

  it("aplica un monto fijo", () => {
    expect(applyPriceRule(100000, { op: "fixed", amountCents: 5000 })).toBe(105000);
    expect(applyPriceRule(100000, { op: "fixed", amountCents: -30000 })).toBe(70000);
  });

  it("redondea al múltiplo de pesos configurado", () => {
    // 100000 (=$1000) +12% = 112000 (=$1120) → redondeo a $50 → $1100 = 110000
    expect(applyPriceRule(100000, { op: "percent", percent: 12, rounding: 50 })).toBe(110000);
    // → redondeo a $100 → $1100 = 110000 también en este caso
    expect(applyPriceRule(100000, { op: "percent", percent: 12, rounding: 100 })).toBe(110000);
    // → redondeo a $10 → $1120 = 112000 (ya es múltiplo de 10)
    expect(applyPriceRule(100000, { op: "percent", percent: 12, rounding: 10 })).toBe(112000);
  });

  it("sin rounding, no redondea", () => {
    // +11% de 100000 = 111000 exacto, no hay caso fraccionario que probar acá;
    // se prueba con un caso que SÍ daría fraccionario si hubiera bug de redondeo
    expect(applyPriceRule(99999, { op: "percent", percent: 10 })).toBe(109999); // round(109998.9) = 109999
  });

  it("nunca da un precio negativo (clampea en 0)", () => {
    expect(applyPriceRule(1000, { op: "fixed", amountCents: -500000 })).toBe(0);
    expect(applyPriceRule(1000, { op: "percent", percent: -1000 })).toBe(0);
  });
});
