/**
 * Único helper de formateo de plata (regla no negociable #1: bigint centavos
 * en todo el sistema, nunca float/numeric en TypeScript). Todo lo demás
 * (inputs de precio, remarcación, etc.) debería pasar por acá o por su
 * inversa, nunca reinventar el redondeo.
 */
const formatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCents(cents: number): string {
  return formatter.format(cents / 100);
}

/** Convierte un input de usuario ("1234,56" o "1234.56") a centavos enteros. */
export function parseCents(input: string): number {
  const normalized = input.trim().replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`Monto inválido: "${input}"`);
  }
  return Math.round(value * 100);
}
