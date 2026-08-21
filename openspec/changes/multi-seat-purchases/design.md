# Design: multi-seat-purchases

## Decisiones

### D1 — Resolución de firma en el webhook (orden estricto)

1. `metadata.firmId` presente (flujo "Ampliar equipos") → validar que la firma existe y está activa → **ampliación**.
2. Sin firmId: buscar User por `buyerEmail` con rol FIRM_ADMIN y `firmId`; si su firma tiene la **misma modalidad** (`tokenProvision` de su última compra) → **ampliación**.
3. Resto → **firma nueva** (comportamiento actual).

Ampliación = `Firm.seatsPurchased += seats`, la Purchase se cuelga de la firma existente, NO se toca el baseline ni el equipo de agentes, y no se re-crea el usuario. El PairingToken + email de bienvenida se emiten igual (el cliente necesita códigos para los PCs nuevos).

### D2 — Cantidad: line item quantity, no unit_amount inflado

`createUnifiedCheckout({ seats })`: `quantity: seats` con el mismo `unit_amount` unitario. Así el recibo de Stripe muestra "N × cuota" y los cupones porcentuales aplican bien. `metadata.seats = String(seats)`. Clamp servidor 1–10.

### D3 — Comisión

`feeAmountCents` en metadata pasa a ser el software efectivo **unitario**; el webhook calcula la comisión sobre `feeAmountCents × seats`. Se mantiene el nombre del campo para compat (compras antiguas: seats ausente ⇒ 1).

### D4 — CIF/NIF

- Un campo por tarjeta (patrón email/emailAlt ya existente): `taxId` / `taxIdAlt`; manda el de la tarjeta usada; sin valor → redirect con `?err=taxid` (aviso en la sección de precios).
- Normalización: trim, uppercase, quitar espacios/guiones. Regex laxa `^[A-Z0-9]{8,12}$` — no verificamos checksum ni bloqueamos ids extranjeros.
- `Purchase.buyerTaxId String?`; `Firm.taxId String?` se fija solo si estaba NULL (la primera compra manda; una ampliación con otro CIF no lo pisa — se loguea en Activity para revisión).
- Viaja en metadata (`buyerTaxId`).

### D5 — "Ampliar equipos" en /firm

Tarjeta nueva en el portal: selector de cantidad + botón → server action que llama a `createUnifiedCheckout` con la modalidad y periodo de la última compra de la firma, `firmId` en metadata, `houseSale` según el origen de la firma (una ampliación no genera comisión nueva de captación → `houseSale: true` y sin trackingToken; decisión comercial: la comisión del comercial es por la venta inicial, no por ampliaciones — si se quiere comisionar ampliaciones será otra spec).

### D6 — Hook para tokens

Tras una ampliación, el webhook emite la actualización de presupuesto del team LiteLLM (15 €/seat × total) si la firma tiene `litellmTeamId` — implementado en `litellm-token-provisioning`; aquí solo se garantiza que el punto de extensión existe (función `onSeatsChanged(firmId, totalSeats)`).

## Riesgos

- **Doble webhook / reintentos**: la idempotencia por `stripeSessionId` ya existe y cubre la ampliación (no se suman seats dos veces).
- **Firma suspendida**: ampliación sobre firma `status != active` → se procesa el cobro pero se loguea Activity de alerta para el operator (no podemos rechazar post-pago).
