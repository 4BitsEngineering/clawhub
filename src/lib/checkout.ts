// Checkout unificado (unified-pricing-token-options) — una sola verdad para
// crear la sesión de Stripe, compartida por /oferta/[slug] y la landing raíz.
//
// BUNDLED: una cuota recurrente (software prorrateado + tokens) del periodo.
// EXTERNAL: suscripción anual solo-software (el cliente trae su proveedor LLM).
// Cupones: allow_promotion_codes (se crean en el dashboard de Stripe).

import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe, ANNUAL_LICENSE_NAME, ANNUAL_LICENSE_DESC } from "@/lib/stripe";
import {
  TOKEN_PERIOD_LABEL,
  tokenStripeInterval,
  effectiveFirstYearFeeCents,
  tokenAnnualComponentCents,
  bundledAnnualTotalCents,
  periodInstallmentCents,
} from "@/lib/pricing";
import { sanitizeSelectionDb } from "@/lib/agent-catalog-db";
import type { TokenBillingPeriod } from "@/generated/prisma/client";

export type UnifiedCheckoutInput = {
  slug: string;
  provision: "BUNDLED" | "EXTERNAL";
  period: TokenBillingPeriod | null; // requerido si BUNDLED
  email: string;
  trackingToken: string | null; // atribución de comercial (null en venta de la casa)
  houseSale: boolean; // venta desde la landing raíz (sin comercial)
  // Equipo elegido en la landing (ids del catálogo; se sanea aquí).
  // undefined/[] tras sanear = catálogo completo → no viaja en metadata.
  selectedAgents?: string[];
  // Nº de equipos (quantity del line item). Clamp 1–10 (multi-seat-purchases).
  seats?: number;
  // CIF/NIF normalizado (facturación). Se valida en el server action.
  buyerTaxId?: string;
  // Ampliación: la compra se registra sobre esta firma (botón de /firm).
  firmId?: string;
};

export const MAX_SEATS = 10;

// Normaliza un CIF/NIF/NIE: mayúsculas, sin espacios ni guiones. Devuelve ""
// si tras normalizar no pasa la validación LAXA (8–12 alfanuméricos) — no
// verificamos checksum ni bloqueamos identificadores extranjeros.
export function normalizeTaxId(raw: string): string {
  const s = (raw ?? "").toUpperCase().replace(/[\s\-.]/g, "");
  return /^[A-Z0-9]{8,12}$/.test(s) ? s : "";
}

export function clampSeats(raw: unknown): number {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_SEATS);
}

// Devuelve la URL de la sesión de Stripe, o null si no se pudo crear
// (Stripe sin configurar, landing inexistente o periodo no ofrecido).
export async function createUnifiedCheckout(
  input: UnifiedCheckoutInput,
): Promise<string | null> {
  if (!stripe) return null;

  const lp = await db.landingPage.findUnique({ where: { slug: input.slug } });
  if (!lp) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const currency = lp.currency.toLowerCase();
  const softwareCents = effectiveFirstYearFeeCents(lp); // base de comisión

  let unitAmount: number;
  let interval: { interval: "month" | "year"; interval_count: number };
  let productName: string;
  let period: TokenBillingPeriod | null = null;
  let tokenAnnualCents: number | null = null;

  if (input.provision === "BUNDLED") {
    const p = input.period;
    if (!p || !lp.tokenPeriods.includes(p)) return null;
    period = p;
    tokenAnnualCents = tokenAnnualComponentCents(lp, p);
    unitAmount = periodInstallmentCents(bundledAnnualTotalCents(lp, p), p);
    interval = tokenStripeInterval(p);
    productName = `AI-Office · Todo incluido (${TOKEN_PERIOD_LABEL[p]})`;
  } else {
    unitAmount = softwareCents;
    interval = { interval: "year", interval_count: 1 };
    productName = `${ANNUAL_LICENSE_NAME} · Proveedor de IA propio`;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    // Tarjeta; Managed Payments desactivado para cobrar el importe anunciado
    // sin que Stripe añada IVA por encima (el IVA lo facturamos nosotros).
    payment_method_types: ["card"],
    managed_payments: { enabled: false },
    // Cupones del dashboard de Stripe. El descuento lo aplica Stripe sobre la
    // cuota; NO altera feeAmountCents (base de comisión) — los descuentos que
    // deben bajar la comisión se configuran en el panel (descuento del software).
    allow_promotion_codes: true,
    line_items: [
      {
        price_data: {
          currency,
          product_data: { name: productName, description: ANNUAL_LICENSE_DESC },
          unit_amount: unitAmount,
          recurring: {
            interval: interval.interval,
            interval_count: interval.interval_count,
          },
        },
        // Multi-seat: N × cuota unitaria como quantity — el recibo muestra
        // "N × …" y los cupones porcentuales aplican bien.
        quantity: clampSeats(input.seats ?? 1),
      },
    ],
    metadata: {
      trackingToken: input.trackingToken ?? "",
      landingSlug: input.slug,
      tokenProvision: input.provision,
      // Software efectivo UNITARIO — el webhook multiplica por seats para la
      // base de comisión (compat: compras antiguas sin seats ⇒ 1).
      feeAmountCents: String(softwareCents),
      tokenBillingPeriod: period ?? "",
      tokenAmountCents: tokenAnnualCents != null ? String(tokenAnnualCents) : "",
      houseSale: input.houseSale ? "1" : "",
      // agentKeys con coma (límite Stripe 500 chars). "" = todos. Saneado
      // contra el catálogo vivo de la BD (AgentCatalogEntry).
      selectedAgents: (await sanitizeSelectionDb(input.selectedAgents ?? [])).join(","),
      seats: String(clampSeats(input.seats ?? 1)),
      buyerTaxId: input.buyerTaxId ?? "",
      // Ampliación sobre firma existente (botón "Ampliar equipos" de /firm).
      firmId: input.firmId ?? "",
    },
    customer_email: input.email,
    success_url: `${appUrl}/oferta/${input.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: input.houseSale ? `${appUrl}/` : `${appUrl}/oferta/${input.slug}`,
  } as Stripe.Checkout.SessionCreateParams);

  return session.url ?? null;
}
