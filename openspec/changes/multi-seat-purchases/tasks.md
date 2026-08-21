# Tasks: multi-seat-purchases

## 1. Modelo de datos (aditivo)

- [x] 1.1 `Purchase.seats Int @default(1)`, `Purchase.buyerTaxId String?`, `Firm.taxId String?`
- [x] 1.2 `prisma db push` + `generate` + reiniciar dev server

## 2. Checkout

- [x] 2.1 `createUnifiedCheckout({ seats, buyerTaxId, firmId? })`: quantity = seats (clamp 1–10), metadata `seats`, `buyerTaxId`, `firmId`
- [x] 2.2 Landings `/` y `/oferta`: selector "¿Cuántos equipos?" + campo CIF/NIF por tarjeta (taxId/taxIdAlt); errores `?err=taxid`
- [x] 2.3 Normalización y validación laxa del tax id en el server action

## 3. Webhook (Deno)

- [x] 3.1 Resolución de firma: metadata.firmId → ampliación; email FIRM_ADMIN + misma modalidad → ampliación; resto → firma nueva
- [x] 3.2 Ampliación: seats += N, Purchase sobre la firma, sin recrear baseline/usuario; Activity de ampliación
- [x] 3.3 Comisión = fee unitario × seats
- [x] 3.4 Persistir buyerTaxId; fijar Firm.taxId si NULL (mismatch → Activity)
- [x] 3.5 Punto de extensión `onSeatsChanged(firmId, totalSeats)` (lo consume litellm-token-provisioning)
- [ ] 3.6 Redeploy de la función (pedir confirmación)

## 4. Portal /firm

- [x] 4.1 Tarjeta "Ampliar equipos": selector de cantidad + checkout con firmId (modalidad/periodo heredados, sin comisión)
- [x] 4.2 Mostrar "X de N equipos activados"

## 5. Operator

- [x] 5.1 CIF/NIF y seats visibles en el detalle de compra (/empresa/commissions) y en la firma

## 6. Verificación

- [x] 6.1 `tsc` + render de landings (selector + CIF/NIF) y /firm (ampliar)
- [ ] 6.2 Ciclo: compra 2 seats → 2 códigos → tope en el 3º; ampliación +1 → 3er código OK
- [ ] 6.3 Recompra orgánica mismo email → no crea firma duplicada
