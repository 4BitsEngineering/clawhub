# Design: unified-pricing-token-options

## Context

Modelo vigente (`checkout-fee-and-token-subscription`): el cliente ve fee 149/200 € + plan de tokens por separado; Stripe monta la suscripción de tokens (checkout) y el webhook crea una segunda suscripción anual del fee anclada a +1 año. La comisión se calcula sobre `feeAmountCents`. El editor de landing ya configura: precio de renovación del software, descuento del primer año (€/%), tokens €/mes y periodos ofrecidos.

Decisión comercial nueva: precio **unificado** cuando los tokens son nuestros (una cifra, un cobro), pronto pago anual con tokens a 15 €/mes, y modalidad alternativa de **tokens externos** (solo software, anual). Cupones y descuentos configurables.

## Goals / Non-Goals

**Goals:** un solo precio visible y un solo cobro por periodo; pronto pago anual; modalidad solo-software; comisión interna sobre software intacta; precios y descuentos configurables; cupones en el checkout.

**Non-Goals:** gestor de cupones propio (se usan los de Stripe); migrar suscripciones existentes; la config del instalador para LLM externo (spec aparte); cambio del flujo post-compra (licencia/email/portal siguen igual).

## Decisions

### D1 — Una sola suscripción de Stripe con la cuota del periodo

Total anual bundled = `softwareEfectivo + tokensMes × 12` (con `tokensMes = 15 €` si el periodo es anual, `20 €` en el resto — valores configurables). Cuota del periodo = `round(totalAnual / pagosPorAño)` (12/4/2/1). Checkout `mode: subscription` con **un único line item recurrente** por esa cuota; sin line item one-time y sin segunda suscripción en el webhook.

- **Por qué:** refleja el precio unificado (un cargo por periodo que ya incluye el software prorrateado), elimina la complejidad de dos suscripciones y de la renovación anclada. La renovación es natural: la suscripción sigue cobrando la cuota.
- **Redondeo:** la cuota se redondea al céntimo; el desvío máximo anual es de unos céntimos y se asume (ej. mensual 36,67 → 440,04 €/año).
- **Trade-off asumido:** el software deja de cobrarse como 200 € upfront — va prorrateado en la cuota. Si un cliente mensual cancela al mes 3, ha pagado ~110 € (≈55 € de software). Es la consecuencia directa del precio unificado por periodos; se acepta. (Mitigación posible como iteración: permanencia mínima o solo periodos largos, configurable con `tokenPeriods`.)

### D2 — Desglose interno solo en metadata (base de comisión)

El checkout pasa en metadata: `tokenProvision` (BUNDLED/EXTERNAL), `feeAmountCents` (software efectivo con su descuento — base de comisión), `tokenAmountCents` (componente anual de tokens), `tokenBillingPeriod`, y el webhook los persiste como hasta ahora. La comisión sigue siendo `round(feeAmountCents × rate)` — **una sola vez, en la compra inicial** (las cuotas recurrentes no generan comisión, igual que las renovaciones de antes).

### D3 — Modalidad EXTERNAL: suscripción anual solo-software

Con tokens externos: una suscripción anual por el software efectivo (con descuento si lo hay). `tokenBillingPeriod`/`tokenAmountCents` nulos, `tokenProvision = EXTERNAL`. La comisión usa el mismo `feeAmountCents`.

### D4 — Configuración en el editor de landing

Campos: precio software anual + descuento €/% (existentes), `tokenMonthlyPriceCents` (existente, estándar 20 €), **`tokenMonthlyPriceAnnualCents` (nuevo, pronto pago, default 15 €)**, periodos ofrecidos (existente). Validación: precio anual de tokens ≤ precio estándar.

### D5 — Cupones vía códigos promocionales de Stripe

`allow_promotion_codes: true` en la Checkout Session: el cliente introduce el código en la pantalla de pago de Stripe y el descuento lo aplica Stripe (sobre la cuota). Los cupones se crean/gestionan en el dashboard de Stripe (producto Coupons/Promotion codes).

- **Por qué:** cero código de gestión propia, redención y contabilidad las lleva Stripe. Crear cupones desde el panel = iteración futura si se necesita.
- **Nota comisión:** el cupón descuenta el cobro de Stripe pero `feeAmountCents` (metadata) se calcula ANTES del cupón — decisión: la comisión no se ve afectada por cupones de Stripe (el descuento comercial "oficial" al software se hace con el descuento configurable del panel, que sí baja la base). Documentado para evitar sorpresas.

### D6 — Landing: modalidad primero, sin desglose

Dos tarjetas/toggle: «Tokens incluidos» (recomendado) y «Mi propio proveedor de IA». En bundled, el selector de periodos muestra solo la cuota resultante («36,67 €/mes», «380 €/año — ahorra 60 €») sin mencionar la partición software/tokens. En external, precio único anual. El desglose desaparece de la UI pública (solo vive en metadata/BD).

## Risks / Trade-offs

- [Cliente mensual cancela pronto → software cobrado solo en parte] → asumido (D1); mitigable restringiendo periodos ofrecidos.
- [Cupones de Stripe no afectan a la comisión] → decisión explícita (D5); los descuentos que deben bajar la comisión se hacen desde el panel.
- [Purchases antiguas con dos suscripciones conviven con el modelo nuevo] → `stripeFeeSubscriptionId` se conserva como histórico; el portal de facturación muestra lo que el customer tenga en Stripe, ambas generaciones funcionan.
- [El instalador aún no diferencia EXTERNAL] → se registra la modalidad en la compra; el baseline por defecto actual sirve para BUNDLED. Config para EXTERNAL = spec futura (open question).

### D7 — Sin descuento inicial por defecto (decidido)

El software arranca a precio de lista (200 €) **sin oferta de lanzamiento**: en datos, `discountPriceCents = originalPriceCents` por defecto. El mecanismo de descuento del panel (importe/%) se conserva intacto — si el administrador configura un descuento, se aplica al software efectivo (y por tanto a la base de comisión).

## Open Questions

- Config del instalador para el proveedor LLM (tanto el nuestro como el externo del cliente) **vía API** — spec propia pendiente de la documentación de esa API. Esta spec solo registra la modalidad (`tokenProvision`) en la compra.
- ¿Permanencia mínima o restricción de periodos para proteger el software prorrateado en cancelaciones tempranas?
