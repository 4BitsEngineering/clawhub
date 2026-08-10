# Proposal: checkout-fee-and-token-subscription

## Why

Hoy la landing cobra un **único pago** con la licencia (fee) mezclada en `session.amount_total`, y la comisión del comercial se calcula sobre ese total. El modelo de negocio real tiene **dos conceptos separados**:

1. **Fee de licencia** — suscripción **anual**: 200€/año de lista, con descuento configurable el primer año (hoy 149€).
2. **Tokens** — suscripción de consumo a **20€/mes**, facturable en periodo **mensual, trimestral, semestral o anual** (múltiplo exacto: trimestral 60€, semestral 120€, anual 240€), a elección del cliente **antes de pagar**.

La comisión del comercial debe calcularse **solo sobre el fee**, nunca sobre los tokens. El checkout actual no separa ambos conceptos ni ofrece elegir el periodo de tokens, y el webhook calcula la comisión sobre el total (incluiría los tokens).

## What Changes

- La **landing pública** muestra un selector de periodo de tokens (mensual / trimestral / semestral / anual) con su precio, **antes** del botón de pago, y el desglose fee + primer cobro de tokens.
- El **checkout de Stripe** pasa a modo suscripción y, en una sola sesión y un solo consentimiento del cliente, cobra:
  - el **fee del año 1** (precio con descuento, p. ej. 149€) en la primera factura,
  - la **primera factura de tokens** según el periodo elegido,
  - deja programada la **renovación anual del fee** (a precio de lista, p. ej. 200€) y la **renovación de tokens** en su periodo.
- El **cálculo de comisión** se hace **solo sobre el fee pagado** (`feeAmountCents`), no sobre el total. Los tokens quedan siempre excluidos, incluidas las renovaciones (que no generan comisión nueva).
- El **fee y su descuento son configurables** por el administrador: precio de renovación (antes "precio original") y descuento del primer año, que puede expresarse en **importe absoluto o en porcentaje**. Se añade la configuración del **precio de tokens** (€/mes) y de **qué periodos de tokens se ofrecen** (el admin elige cuáles de mensual/trimestral/semestral/anual se muestran).
- El **modelo de datos** registra explícitamente: importe del fee (base de comisión), periodo e importe de tokens, y los identificadores de suscripción de Stripe.

## Capabilities

### New Capabilities

- `checkout-fee-and-token-subscription`: checkout de dos conceptos (fee de licencia anual + suscripción de tokens con periodo elegible), con la comisión del comercial calculada exclusivamente sobre el fee y la configuración de precios (fee, descuento del primer año y precio de tokens) editable por el administrador.

### Modified Capabilities

<!-- Ninguna spec previa en openspec/specs/. Ajusta el comportamiento del flujo
     de compra descrito en post-purchase-onboarding (webhook), que sigue vigente
     para la generación de licencia/onboarding; aquí solo cambia la base de
     comisión y el registro de importes. -->

## Impact

- **Código afectado:**
  - `src/app/oferta/[slug]/page.tsx` — selector de periodo de tokens + desglose; `checkoutAction` en modo suscripción.
  - `supabase/functions/stripe-webhook/index.ts` — comisión sobre `feeAmountCents`; registrar periodo/importe de tokens y IDs de suscripción; programar la renovación anual del fee.
  - `src/app/empresa/landing/page.tsx` — añadir configuración del precio de tokens (€/mes); aclarar semántica de precio original (renovación) vs descuento (primer año).
  - `src/lib/stripe.ts` — helpers/constantes de precios y periodos.
- **Modelo de datos (migración aditiva):**
  - `LandingPage`: `tokenMonthlyPriceCents` (default 2000), `tokenPeriods` (lista de periodos ofrecidos, default los cuatro), `feeDiscountType` (ABSOLUTE/PERCENT) y `feeDiscountPercent`.
  - `Purchase`: `feeAmountCents`, `tokenBillingPeriod` (enum), `tokenAmountCents`, `stripeSubscriptionId`, `stripeFeeSubscriptionId` (nullable).
  - Nuevos enums `TokenBillingPeriod { MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL }` y `DiscountType { ABSOLUTE, PERCENT }`.
- **Stripe:** productos/precios para fee (recurrente anual) y tokens (recurrente por intervalo). El cliente autoriza una vez; la renovación del fee queda anclada al año siguiente.
- **Prerequisito operativo:** claves de Stripe ya configuradas (test/live). Sin `STRIPE_SECRET_KEY` el checkout sigue deshabilitado (comportamiento actual).
- **Una sola interacción del cliente:** aunque en Stripe existan dos suscripciones (fee anual + tokens), el cliente introduce la tarjeta y autoriza el pago **una única vez**; la suscripción de renovación del fee se crea en el servidor sin cobro inmediato ni acción del cliente.
- **Fuera de alcance:** descuentos por compromiso en tokens (periodos largos = múltiplo exacto); prorrateos/cambios de periodo de tokens tras la compra; panel de gestión de suscripciones del cliente; facturación/contabilidad de las renovaciones más allá de registrarlas.
