# Proposal: unified-pricing-token-options

## Why

El modelo actual (change `checkout-fee-and-token-subscription`) muestra al cliente **dos conceptos separados** (fee de software + plan de tokens) y monta dos suscripciones en Stripe. La decisión comercial nueva es distinta:

1. Si el cliente consume los tokens **con nosotros (4Bits)**, el precio debe ser **unificado de cara al cliente** — no se separa software y tokens en la oferta ni en el cobro. Solo internamente se separa para calcular la **comisión del comercial** (que sigue siendo solo sobre el software).
2. Debe existir la alternativa de que el cliente use **su propio proveedor LLM** (tokens externos), pagando solo el software.

Además, los precios deben ser **configurables desde el panel de administración** y debe poderse ofrecer **cupones de descuento** y **descuentos directos** sobre software y tokens.

## What Changes

### Modalidad 1 — Tokens incluidos (precio unificado)

- Precio total anual = **software (200 €) + tokens (20 €/mes × 12)** = 440 €/año, presentado como **un único precio**, sin desglose visible para el cliente.
- Periodos de pago a elegir: **mensual, trimestral, semestral o anual** — la cuota es el total anual dividido por los pagos del año (mensual ≈ 36,67 €, trimestral 110 €, semestral 220 €).
- **Pronto pago anual**: si elige pago anual, los tokens bajan a **15 €/mes** → total 200 + 15×12 = **380 €/año**.
- En Stripe: **una sola suscripción** con el intervalo del periodo elegido (sustituye al esquema de dos suscripciones del modelo anterior).
- **Comisión del comercial**: solo sobre la componente de **software efectiva** (con su descuento si lo hay), nunca sobre los tokens — igual que hasta ahora (`feeAmountCents`).

### Modalidad 2 — Tokens externos (proveedor LLM del cliente)

- El cliente paga **solo el software: 200 €/año** (suscripción anual).
- La config de instalación que reciba debe contemplar que usará su propio proveedor (fuera del alcance de esta spec el mecanismo técnico del instalador; se registra la modalidad en la compra).

### Configuración y descuentos (panel de administración, solo OPERATOR)

- Precios configurables: **software anual**, **tokens €/mes estándar**, **tokens €/mes con pago anual** (pronto pago), y qué **periodos** se ofrecen.
- **Descuentos directos**: el descuento configurable existente sobre el software (importe o %) se mantiene; los precios de tokens son directamente editables (bajar 20 → X es el descuento).
- **Cupones**: el checkout acepta **códigos promocionales de Stripe** (`allow_promotion_codes`) — los cupones se crean en el dashboard de Stripe (crearlos desde el panel propio queda como iteración futura).

### Landing

- Primer paso: elegir modalidad — «Tokens incluidos» vs «Usaré mi propio proveedor de IA».
- Con tokens incluidos: selector de periodo mostrando la **cuota unificada** de cada periodo y el ahorro del pago anual. Sin desglose software/tokens.
- Con tokens externos: precio único anual.

## Capabilities

### New Capabilities

- `unified-pricing-token-options`: precio unificado software+tokens con periodos de pago y pronto pago anual, modalidad de tokens externos (solo software), configuración de precios por el administrador, y soporte de cupones/descuentos.

### Modified Capabilities

- Sustituye el modelo de checkout de `checkout-fee-and-token-subscription` (dos conceptos visibles / dos suscripciones) por el modelo unificado. La base de comisión (`feeAmountCents`) y el onboarding post-compra (licencia, email, portal) se conservan.

## Impact

- **Código:** landing pública (selector de modalidad + cuotas unificadas), `checkoutAction` (una suscripción, `allow_promotion_codes`), webhook (sin segunda suscripción; registra modalidad y desglose interno), editor de landing (precio de tokens anual + textos), portal `/firm` (facturación sigue igual con la suscripción única).
- **Modelo de datos (aditivo):** `LandingPage.tokenMonthlyPriceAnnualCents` (default 1500); `Purchase.tokenProvision` (enum `BUNDLED | EXTERNAL`). Campos existentes (`feeAmountCents`, `tokenBillingPeriod`, `tokenAmountCents`, `stripeSubscriptionId`) se reutilizan; `stripeFeeSubscriptionId` queda como histórico del modelo anterior.
- **Stripe:** requiere `allow_promotion_codes` en el checkout; los cupones se gestionan en el dashboard.
- **Fuera de alcance:** creación de cupones desde el panel propio; el mecanismo del instalador para proveedor LLM externo (config `openclaw.json` alternativa — candidato a spec propia); migración de las suscripciones ya creadas con el modelo anterior (se conservan tal cual).
