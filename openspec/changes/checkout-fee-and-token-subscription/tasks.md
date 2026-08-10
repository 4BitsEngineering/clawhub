# Tasks: checkout-fee-and-token-subscription

## 0. Spike previo (Stripe) — RESUELTO

- [x] 0.1 **Confirmado** (stripe@22.3.2, tipos Checkout): en `mode: "subscription"` se pueden pasar hasta 20 line items recurrentes + 20 one-time; *"Line items with one-time Prices will be on the initial invoice only"*. → Checkout con `line_items = [tokens recurring price_data, fee año-1 one-time price_data]`. Ambos con `price_data` inline (no hace falta pre-crear productos/precios). Un solo pago/autorización
- [x] 0.2 **Confirmado**: `SubscriptionCreateParams` soporta `trial_end: 'now' | number`, `billing_cycle_anchor`, `proration_behavior`. → La sub anual del fee se crea con `trial_end = now + 1 año` (no cobra ahora, primer cargo en la renovación) usando `items[].price_data` recurrente anual

## 1. Modelo de datos (migración aditiva)

- [x] 1.1 `prisma/schema.prisma`: enums `TokenBillingPeriod { MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL }` y `DiscountType { ABSOLUTE, PERCENT }`
- [x] 1.2 `LandingPage`: `tokenMonthlyPriceCents Int @default(2000)`, `tokenPeriods TokenBillingPeriod[]` (default los cuatro), `feeDiscountType DiscountType @default(ABSOLUTE)`, `feeDiscountPercent Int?`
- [x] 1.3 `Purchase`: `feeAmountCents Int?`, `tokenBillingPeriod TokenBillingPeriod?`, `tokenAmountCents Int?`, `stripeSubscriptionId String?`, `stripeFeeSubscriptionId String?`
- [x] 1.4 Migración `prisma migrate` (aditiva) + `prisma generate`; recordar GRANT a `service_role` si Supabase no auto-expone las columnas nuevas (ver ACCIONES-PENDIENTES.md)

## 2. Configuración de precios (editor de landing, solo OPERATOR)

- [x] 2.1 Re-etiquetar en `src/app/empresa/landing/page.tsx`: "Precio original" → "Precio de renovación anual"; el descuento del primer año con selector de tipo (importe € / porcentaje %) → `feeDiscountType` + valor; al guardar, calcular `discountPriceCents` efectivo (si PERCENT: `round(originalPriceCents*(100-percent)/100)`)
- [x] 2.2 Añadir campo "Precio de tokens (€/mes)" → `tokenMonthlyPriceCents`; persistir en `saveLandingAction`
- [x] 2.3 Añadir cuatro checkboxes de periodos ofrecidos → `tokenPeriods`; validar al menos uno

## 3. Landing pública: selector de periodo + desglose

- [x] 3.1 `src/app/oferta/[slug]/page.tsx`: selector de periodo de tokens mostrando **solo** los de `tokenPeriods`, con importe = `tokenMonthlyPriceCents × meses`
- [x] 3.2 Desglose visible: fee primer año + primer cobro de tokens del periodo elegido; requerir selección antes de pagar
- [x] 3.3 Mantener el campo de email (ya existente) y la atribución por cookie de tracking

## 4. Checkout (server action)

- [x] 4.1 `checkoutAction`: `mode: "subscription"` con la suscripción de tokens (intervalo del periodo elegido) + fee año 1 en la primera factura (mecanismo de 0.1)
- [x] 4.2 Validar en servidor que el periodo recibido está en `tokenPeriods`; si no, no crear sesión
- [x] 4.3 Pasar en `metadata`: `feeAmountCents` (base de comisión), `tokenBillingPeriod`, `tokenAmountCents`, `trackingToken`, `landingSlug`, email
- [x] 4.4 Mantener `customer_email` (del formulario o atribución) y método de pago tarjeta

## 5. Webhook (Edge Function)

- [x] 5.1 Leer del `metadata`: `feeAmountCents`, `tokenBillingPeriod`, `tokenAmountCents`; persistir en `Purchase` junto a `stripeSubscriptionId` (tokens)
- [x] 5.2 Crear la suscripción anual del fee (precio de renovación) anclada a +1 año sin cobro inmediato; guardar `stripeFeeSubscriptionId`; idempotente ante reenvío del evento
- [x] 5.3 Comisión = `round(feeAmountCents * salesRep.commissionRate)` (NO `amount_total`); resto del onboarding (Firm, FIRM_ADMIN, PairingToken, email) sin cambios
- [x] 5.4 Asegurar que las renovaciones (`invoice.paid` / futuros eventos) no generan comisión (no se procesan aquí)

## 6. Coherencia con atribución manual

- [x] 6.1 `src/app/empresa/commissions/page.tsx`: `attributePurchaseAction` calcula la comisión sobre `purchase.feeAmountCents` (fallback a `amountCents` para compras antiguas sin el campo)

## 7. Verificación

- [x] 7.1 Typecheck (`npx tsc --noEmit`) en verde
- [x] 7.1b Render en local: landing muestra los 4 periodos con importes 20/60/120/240€ y fee 149€ (primer año) / 200€ (renovación); editor muestra los campos nuevos; lógica de descuento %/importe y comisión-sobre-fee verificada
- [ ] 7.2 Prueba end-to-end con Stripe test — **USUARIO** (requiere redeploy del webhook + checkout de test): comprar eligiendo cada periodo → cobro inicial (fee + tokens del periodo), suscripción de tokens activa, renovación anual del fee programada sin cobro inmediato, comisión = 35% × fee (no incluye tokens)
- [ ] 7.3 Prueba de comisión — **USUARIO**: compra atribuida con tokens ≠ 0 → comisión ignora los tokens; atribución manual usa `feeAmountCents`
- [ ] 7.4 Prueba de idempotencia — **USUARIO**: reenviar el evento no duplica compra, comisión ni suscripción de fee

## 8. Documentación

- [x] 8.1 Actualizar `openspec/funionales.md`: modelo de precios (fee anual + tokens por periodo), comisión solo sobre el fee, configuración de precios del administrador
- [x] 8.2 Actualizar `ACCIONES-PENDIENTES.md`: redeploy del webhook + nota del GRANT (cubierto por tabla) + prueba de Stripe test
