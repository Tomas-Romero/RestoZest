import { describe, expect, it } from "vitest";
import { generateId } from "./id";

describe("generateId", () => {
  it("genera UUIDs con formato válido y el nibble de versión 7", () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("es monótono en el tiempo: IDs generados después ordenan después", async () => {
    const first = generateId();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = generateId();
    expect(first < second).toBe(true);
  });

  it("no repite IDs en generación masiva", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()));
    expect(ids.size).toBe(1000);
  });
});
