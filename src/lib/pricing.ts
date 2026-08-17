// Modelo de precios de la venta: fee de licencia (suscripción anual) + tokens
// (suscripción de consumo con periodo elegible). Lógica compartida entre el
// editor de landing, la landing pública, el checkout y (replicada) el webhook.

import type { TokenBillingPeriod, DiscountType } from "@/generated/prisma/client";

// Meses que cubre cada periodo de facturación de tokens. El precio del periodo
// es tokenMonthlyPriceCents × meses (múltiplo exacto, sin descuento).
export const TOKEN_PERIOD_MONTHS: Record<TokenBillingPeriod, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

export const TOKEN_PERIOD_LABEL: Record<TokenBillingPeriod, string> = {
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
};

// Orden canónico para mostrar los periodos.
export const TOKEN_PERIODS_ORDER: TokenBillingPeriod[] = [
  "MONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
];

export function tokenPeriodAmountCents(
  monthlyCents: number,
  period: TokenBillingPeriod,
): number {
  return monthlyCents * TOKEN_PERIOD_MONTHS[period];
}

// Intervalo recurrente de Stripe para cada periodo de tokens.
export function tokenStripeInterval(period: TokenBillingPeriod): {
  interval: "month" | "year";
  interval_count: number;
} {
  if (period === "ANNUAL") return { interval: "year", interval_count: 1 };
  return { interval: "month", interval_count: TOKEN_PERIOD_MONTHS[period] };
}

// Precio efectivo del primer año del fee a partir de la configuración de
// descuento. Si es PERCENT, se calcula desde el precio de renovación; si es
// ABSOLUTE, es directamente discountPriceCents. Nunca supera el de renovación
// ni baja de 0.
export function effectiveFirstYearFeeCents(opts: {
  originalPriceCents: number;
  discountPriceCents: number;
  feeDiscountType: DiscountType;
  feeDiscountPercent: number | null;
}): number {
  if (opts.feeDiscountType === "PERCENT") {
    const pct = Math.min(100, Math.max(0, opts.feeDiscountPercent ?? 0));
    return Math.round((opts.originalPriceCents * (100 - pct)) / 100);
  }
  return Math.min(opts.discountPriceCents, opts.originalPriceCents);
}

export function fmtEuros(cents: number): string {
  return (cents / 100).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

// ── Modelo unificado (unified-pricing-token-options) ─────────────────────────
// Un solo precio visible: software prorrateado + tokens, cobrado como cuota
// recurrente del periodo elegido. El desglose solo vive en metadata/BD.

// Pagos por año de cada periodo (la cuota = total anual / pagos)
export const PERIOD_PAYMENTS_PER_YEAR: Record<TokenBillingPeriod, number> = {
  MONTHLY: 12,
  QUARTERLY: 4,
  SEMIANNUAL: 2,
  ANNUAL: 1,
};

type UnifiedPricingInput = {
  originalPriceCents: number;
  discountPriceCents: number;
  feeDiscountType: DiscountType;
  feeDiscountPercent: number | null;
  tokenMonthlyPriceCents: number;
  tokenMonthlyPriceAnnualCents: number;
};

// Componente anual de tokens según periodo: pronto pago si es ANUAL.
export function tokenAnnualComponentCents(
  lp: UnifiedPricingInput,
  period: TokenBillingPeriod,
): number {
  const monthly =
    period === "ANNUAL"
      ? Math.min(lp.tokenMonthlyPriceAnnualCents, lp.tokenMonthlyPriceCents)
      : lp.tokenMonthlyPriceCents;
  return monthly * 12;
}

// Total anual del pack (software efectivo + tokens del periodo).
export function bundledAnnualTotalCents(
  lp: UnifiedPricingInput,
  period: TokenBillingPeriod,
): number {
  return effectiveFirstYearFeeCents(lp) + tokenAnnualComponentCents(lp, period);
}

// Cuota por periodo: round(total anual / pagos). El desvío por redondeo es de
// céntimos al año y se asume (ej. 440/12 = 36,67 → 440,04 €/año).
export function periodInstallmentCents(
  totalAnnualCents: number,
  period: TokenBillingPeriod,
): number {
  return Math.round(totalAnnualCents / PERIOD_PAYMENTS_PER_YEAR[period]);
}
