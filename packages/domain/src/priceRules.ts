export type RoundingOption = 10 | 50 | 100;

export type PriceRule =
  | { op: "percent"; percent: number; rounding?: RoundingOption }
  | { op: "fixed"; amountCents: number; rounding?: RoundingOption };

/**
 * Remarcación masiva (Fase 1.4). Siempre en centavos enteros — regla no
 * negociable #1. El redondeo es a múltiplos de pesos (10/50/100), no de
 * centavos: por eso multiplica por 100 antes de dividir.
 */
export function applyPriceRule(baseCents: number, rule: PriceRule): number {
  const raw =
    rule.op === "percent" ? baseCents * (1 + rule.percent / 100) : baseCents + rule.amountCents;

  const rounded = rule.rounding ? roundToPesos(raw, rule.rounding) : Math.round(raw);

  return Math.max(0, rounded);
}

function roundToPesos(cents: number, pesos: RoundingOption): number {
  const stepCents = pesos * 100;
  return Math.round(cents / stepCents) * stepCents;
}
