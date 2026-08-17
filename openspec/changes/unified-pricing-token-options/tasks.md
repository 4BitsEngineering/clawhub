# Tasks: unified-pricing-token-options

## 1. Modelo de datos (aditivo)

- [x] 1.1 `LandingPage.tokenMonthlyPriceAnnualCents Int @default(1500)` (pronto pago)
- [x] 1.2 Enum `TokenProvision { BUNDLED, EXTERNAL }` + `Purchase.tokenProvision TokenProvision?`
- [x] 1.3 `prisma db push` + `generate`
- [x] 1.4 Sin descuento inicial (D7): poner `discountPriceCents = 20000` en la fila actual de la landing (dato, no código); el mecanismo de descuento del panel queda disponible

## 2. Pricing helper

- [x] 2.1 Ampliar `src/lib/pricing.ts`: `bundledAnnualTotalCents(landing, period)` (software efectivo + tokensMes×12 con pronto pago si ANNUAL) y `periodInstallmentCents(total, period)` (round(total/pagos)); pagos por año 12/4/2/1

## 3. Landing pública

- [x] 3.1 Selector de modalidad: «Tokens incluidos» / «Mi propio proveedor de IA»
- [x] 3.2 Bundled: selector de periodo con cuota unificada por periodo y destacado del ahorro anual; SIN desglose software/tokens
- [x] 3.3 External: precio único anual (software efectivo)
- [x] 3.4 Quitar de la UI pública el desglose «hoy pagas fee + tokens»

## 4. Checkout

- [x] 4.1 Bundled: `mode: subscription`, un único line item recurrente con la cuota del periodo; `allow_promotion_codes: true`
- [x] 4.2 External: suscripción anual del software efectivo; `allow_promotion_codes: true`
- [x] 4.3 Metadata: `tokenProvision`, `feeAmountCents` (software efectivo), `tokenAmountCents` (componente anual tokens o null), `tokenBillingPeriod`, tracking

## 5. Webhook

- [x] 5.1 Eliminar la creación de la segunda suscripción del fee (el modelo nuevo es una sola); conservar el código para compras antiguas ya procesadas (no reprocesan)
- [x] 5.2 Persistir `tokenProvision` y el desglose; comisión = `round(feeAmountCents × rate)` (sin cambios de fórmula)

## 6. Editor de landing (OPERATOR)

- [x] 6.1 Campo «Tokens €/mes con pago anual» con validación ≤ estándar
- [x] 6.2 Revisar textos del editor al modelo unificado

## 7. Verificación

- [x] 7.1 Typecheck + render landing (ambas modalidades, cuotas correctas 36,67/110/220/380 con defaults)
- [ ] 7.2 **USUARIO** Checkout test bundled por cada periodo: un solo cargo por la cuota, suscripción única, metadata correcta, comisión sobre software
- [ ] 7.3 **USUARIO** Checkout test external: cargo anual solo-software
- [ ] 7.4 **USUARIO** Cupón de Stripe aplicado en un checkout de prueba (descuento en el cargo; comisión intacta)
- [ ] 7.5 **USUARIO** Portal /firm: facturación funciona con la suscripción única

## 8. Documentación

- [x] 8.1 `openspec/funionales.md`: modelo de precios nuevo (sustituye al desglosado)
- [x] 8.2 `ACCIONES-PENDIENTES.md`: redeploy del webhook + nota de cupones en dashboard de Stripe
