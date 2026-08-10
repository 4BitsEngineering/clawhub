# Design: checkout-fee-and-token-subscription

## Context

Hoy `/oferta/[slug]/page.tsx` crea una Checkout Session en `mode: "payment"` con un único `line_item` (el fee con descuento) y toda la venta llega al webhook como `session.amount_total`. El webhook (`stripe-webhook/index.ts`) calcula la comisión sobre ese total. `LandingPage` ya tiene `originalPriceCents` (200€) y `discountPriceCents` (149€) editables por el OPERATOR, además de campos sin uso `stripeProductId`/`stripeAnnualPriceId`.

Decisiones de negocio confirmadas:
- **Fee**: suscripción **anual**. Año 1 al precio con descuento (`discountPriceCents`, 149€); renovaciones al precio de lista (`originalPriceCents`, 200€).
- **Tokens**: 20€/mes, periodo elegible (mensual/trimestral/semestral/anual) = **múltiplo exacto** (×1/×3/×6/×12), sin descuento por compromiso.
- **Comisión**: solo sobre el fee realmente pagado (149€ el primer año). Tokens y renovaciones excluidos.

Restricción técnica clave de Stripe: **una misma Subscription no puede mezclar intervalos** (el fee es anual y los tokens pueden ser mensuales/trimestrales…). Por tanto fee y tokens son **suscripciones distintas**, y una Checkout Session crea **una sola** suscripción. El diseño resuelve esto con **una única interacción del cliente** (una tarjeta, una autorización, una pantalla de pago): ver D1+D2.

## Goals / Non-Goals

**Goals:**

- Un solo checkout, un solo consentimiento del cliente, que cobra fee año 1 + primera factura de tokens.
- Fee que renueva anualmente; tokens que renuevan en su periodo.
- Comisión calculada exclusivamente sobre el fee pagado.
- Fee, descuento del primer año y precio de tokens configurables por el administrador.

**Non-Goals:**

- Descuento por compromiso en periodos largos de tokens (múltiplo exacto).
- Autoservicio del cliente para cambiar/cancelar suscripciones (se gestiona en Stripe).
- Comisión recurrente por renovaciones (la comisión es única, sobre el fee inicial).
- Contabilidad/facturación avanzada más allá de registrar importes e IDs.

## Decisions

### D1 — Un checkout en modo suscripción: tokens como suscripción, fee año 1 en la primera factura

La Checkout Session se crea en `mode: "subscription"` para la **suscripción de tokens** (intervalo según el periodo elegido). El **fee del año 1** (con descuento, 149€) se añade a la **primera factura** de esa sesión como cargo puntual (one-time), de modo que el cliente paga fee + primer periodo de tokens en un único pago que ve y autoriza.

- **Por qué:** una sola sesión, un solo consentimiento, y el importe total es visible en el checkout (correcto legalmente). Evita SCA en cargos off-session posteriores para el año 1.
- **Mecánica exacta a confirmar en implementación:** one-time line item en subscription mode vs `subscription_data.add_invoice_items`. Ambos añaden el cargo a la primera factura; se elige el soportado por la versión de API.

### D2 — Renovación anual del fee como segunda suscripción, anclada al año siguiente

Tras el checkout, el webhook (servidor, **sin el cliente delante**) crea una **suscripción anual del fee** sobre el mismo `customer`, a precio de renovación (`originalPriceCents`, 200€), con `billing_cycle_anchor` a **+1 año** y sin prorrateo, de forma que **no cobra nada ahora** (el año 1 ya se pagó en D1) y empieza a cobrar en la primera renovación.

- **Por qué:** el fee debe recurrir anualmente pero con distinto intervalo que los tokens; no cabe en la misma suscripción. Anclar al año siguiente evita el doble cobro del año 1.
- **Una sola interacción del cliente:** el cliente solo actúa en D1 (introduce tarjeta y autoriza el pago inicial). Crear esta segunda suscripción con cobro futuro y sin cargo inmediato **no requiere ninguna acción suya** — la tarjeta ya quedó guardada en el `customer` durante el checkout. No hay segunda pantalla de pago.
- **Alternativa descartada:** crear ambas suscripciones vía API con un SetupIntent (checkout en modo `setup`) — el cliente no vería el importe al pagar; peor UX y encaje legal. También descartado: dos checkouts (dos interacciones).
- **Riesgo (SCA):** si una renovación futura requiere autenticación, Stripe envía email de pago; fuera del flujo inicial. El cargo del año 1 es on-session (autenticado en el checkout).

### D3 — La comisión se calcula sobre `feeAmountCents`, nunca sobre `amount_total`

El importe del fee pagado se pasa explícitamente en `metadata.feeAmountCents` de la sesión y se persiste en `Purchase.feeAmountCents`. El webhook calcula `commission.amountCents = round(feeAmountCents * salesRep.commissionRate)`.

- **Por qué:** `amount_total` incluiría los tokens. La comisión depende solo del fee; hacerlo explícito lo blinda ante cambios de precio o periodo.
- **Coherencia:** la atribución manual (`manual-commission-attribution`) también debe usar `feeAmountCents` como base (hoy usa `purchase.amountCents`). Se ajusta ahí.

### D4 — Precios de tokens: múltiplo exacto calculado desde `tokenMonthlyPriceCents`

`tokenMonthlyPriceCents` (default 2000 = 20€) se configura en el editor de landing. El importe por periodo = `tokenMonthlyPriceCents × meses` (1/3/6/12). El intervalo de Stripe: `month`/`interval_count` 1, 3, 6 o `year`/1 para anual.

- **Por qué:** un solo precio base configurable; los periodos se derivan. Sin tablas de precios por periodo.
- **Nota:** los `Price` recurrentes de Stripe se crean con `price_data` en la sesión o se cachean como IDs; a decidir en implementación (los IDs cacheados evitan recrear precios).

### D5 — Semántica de los campos de precio del fee (reutilización, sin campos nuevos para el fee)

`discountPriceCents` = precio del **primer año** (lo que se cobra y base de comisión). `originalPriceCents` = precio de **renovación** anual. El editor de landing ya edita ambos; se re-etiquetan en la UI para dejar clara esta semántica.

- **Por qué:** ambos importes ya existen y ya son editables; solo cambia su significado explícito. El "descuento" (200→149) es real: primer año 149, renovaciones 200.
- **Consecuencia:** `discountEndsAt` sigue rigiendo la vigencia de la oferta del primer año en la landing.

### D7 — Descuento del primer año configurable en importe **o** porcentaje

El editor de landing permite elegir el tipo de descuento: **absoluto** (precio del primer año en €) o **porcentaje** (% sobre el precio de renovación). Se persiste el tipo y el valor, y al guardar se calcula siempre el **precio efectivo del primer año** (`discountPriceCents`) para que el checkout, la landing y la base de comisión no tengan que ramificar.

- **Modelo:** enum `DiscountType { ABSOLUTE, PERCENT }`; `LandingPage.feeDiscountType` (default ABSOLUTE) y `LandingPage.feeDiscountPercent Int?`. Cuando es PERCENT: `discountPriceCents = round(originalPriceCents * (100 - feeDiscountPercent) / 100)`.
- **Por qué:** downstream sigue leyendo un único importe efectivo (`discountPriceCents`); el tipo/porcentaje solo sirve para el editor y para recomputar al cambiar el precio de renovación.

### D8 — El administrador elige qué periodos de tokens se ofrecen

La landing muestra solo los periodos habilitados por el OPERATOR. El checkout valida que el periodo recibido esté dentro del conjunto ofrecido.

- **Modelo:** `LandingPage.tokenPeriods TokenBillingPeriod[]` (lista escalar Postgres), default los cuatro. Editor con cuatro checkboxes.
- **Por qué:** flexibilidad comercial (p. ej. ofrecer solo anual y semestral) sin tocar código. Validar en servidor evita que un periodo deshabilitado llegue por manipulación del formulario.
- **Guarda:** si el cliente envía un periodo no ofrecido, el checkout lo rechaza (no crea sesión).

### D6 — Nuevos datos en `Purchase` y enum de periodo

Migración aditiva: `Purchase.feeAmountCents`, `Purchase.tokenBillingPeriod` (enum `TokenBillingPeriod`), `Purchase.tokenAmountCents`, `Purchase.stripeSubscriptionId` (tokens), `Purchase.stripeFeeSubscriptionId` (fee). `amountCents` se mantiene como total cobrado en el checkout (fee año 1 + primer periodo de tokens) para trazabilidad.

- **Por qué:** separar la base de comisión (fee) del total, y poder auditar qué periodo eligió el cliente y qué suscripciones quedaron activas.

## Risks / Trade-offs

- [Mezclar one-time + recurrente en subscription mode depende de la versión de API] → D1: confirmar el parámetro soportado (`add_invoice_items` o one-time line item) al implementar; ambos son patrones oficiales.
- [Dos suscripciones por cliente (fee + tokens)] → mayor complejidad en Stripe, pero es la única forma con intervalos distintos; documentado y con IDs persistidos para soporte.
- [Doble cobro del año 1 si el anclaje de la sub del fee falla] → D2: `billing_cycle_anchor` a +1 año + `proration_behavior: none`; prueba explícita en tasks de que la sub del fee no cobra al crearse.
- [La comisión cambiaría si se calculara sobre el total] → D3: base explícita `feeAmountCents`; test de que los tokens no inflan la comisión.
- [Idempotencia del webhook con dos suscripciones] → mantener la guarda por `stripeSessionId`; la creación de la sub del fee debe ser idempotente (no duplicar si el evento se reenvía).

## Open Questions

- ¿El descuento del primer año debe poder expresarse como **porcentaje** además de importe absoluto? De momento se mantienen los dos importes (renovación / primer año) que ya existen.
- ¿Se ofrecen **siempre los cuatro periodos** de tokens o el administrador elige cuáles mostrar? Por defecto los cuatro; configurable es candidato a iteración.
- ¿Registrar las **renovaciones** (fee y tokens) como nuevas filas/eventos para reporting? Fuera de alcance ahora; el webhook solo procesa la compra inicial.
- Confirmar el **mecanismo Stripe exacto** de D1 contra la versión de API `2026-06-24.dahlia` (one-time line item vs add_invoice_items) en un spike antes de codificar el checkout.
