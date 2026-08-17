# Tasks: root-sales-landing

## 1. Modelo y checkout compartido

- [x] 1.1 `Purchase.houseSale Boolean @default(false)` + push + generate
- [x] 1.2 `src/lib/checkout.ts`: `createUnifiedCheckout(...)` extraída de `/oferta/[slug]`; refactor de la página de oferta para usarla

## 2. Landing raíz

- [x] 2.1 `src/app/page.tsx`: sesión → panel; anónimo → landing
- [x] 2.2 Secciones: hero (headline del panel), equipo IA (11 especialistas), cómo funciona (3 pasos), vídeo opcional, precios (2 modalidades, cuotas), FAQ, footer con contacto y /login
- [x] 2.3 Identidad AI-Office (.aio-canvas, serif+punto, chips amarillos, tarjetas crema)

## 3. Venta de la casa

- [x] 3.1 Checkout raíz con `houseSale: "1"` en metadata (sin trackingToken)
- [x] 3.2 Webhook: persistir `houseSale` en Purchase
- [x] 3.3 `/empresa/commissions`: "Compras sin atribuir" excluye `houseSale: true`

## 4. Verificación

- [x] 4.1 Typecheck + render de la raíz (anónimo) con cuotas correctas; sesión sigue redirigiendo
- [ ] 4.2 **USUARIO**: compra de test desde la raíz → Purchase houseSale, sin comisión, no aparece en sin-atribuir, onboarding completo
- [x] 4.3 Paridad: compra desde /oferta sigue funcionando (refactor sin regresión)

## 5. Docs

- [x] 5.1 `openspec/funionales.md` + `ACCIONES-PENDIENTES.md` (redeploy webhook)
