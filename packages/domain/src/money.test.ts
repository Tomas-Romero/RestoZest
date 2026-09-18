import { describe, expect, it } from "vitest";
import { formatCents, parseCents } from "./money";

describe("formatCents", () => {
  it("formatea centavos a pesos argentinos", () => {
    expect(formatCents(123456)).toBe("$ 1.234,56");
    expect(formatCents(0)).toBe("$ 0,00");
    expect(formatCents(100)).toBe("$ 1,00");
  });
});

describe("parseCents", () => {
  it("interpreta formato argentino (punto de miles, coma decimal)", () => {
    expect(parseCents("1.234,56")).toBe(123456);
    expect(parseCents("10")).toBe(1000);
    expect(parseCents("10,5")).toBe(1050);
  });

  it("es la inversa exacta de formatCents para valores redondos", () => {
    for (const cents of [0, 100, 1050, 123456, 999999]) {
      expect(parseCents(formatCents(cents).replace(/[^0-9,.-]/g, ""))).toBe(cents);
    }
  });

  it("rechaza entradas no numéricas", () => {
    expect(() => parseCents("abc")).toThrow();
  });
});
