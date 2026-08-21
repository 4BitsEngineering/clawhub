# Proposal: multi-seat-purchases

## Why

Hoy cada compra crea una firma con **1 seat** fijo y cada compra posterior del mismo comprador crea una **firma nueva** (partiendo al cliente en licencias inconexas). Los clientes reales necesitan instalar AI-Office en varios equipos: N PCs en una misma compra, y ampliar más adelante. Además, la compra no recoge **CIF/NIF**, imprescindible para facturar (muchas asesorías son autónomos con NIF, no SL).

## What Changes

### Cantidad de equipos en la compra

- Selector **"¿Cuántos equipos?"** (1–10, por defecto 1) junto al periodo en `/` y `/oferta`, para ambas modalidades.
- Stripe: **cantidad del line item** (cuota × N en BUNDLED, software anual × N en EXTERNAL). Una sola suscripción.
- Webhook: `Purchase.seats = N`, `Firm.seatsPurchased = N`.
- **Comisión**: sobre la componente software × N (misma base, multiplicada).
- Precio por equipo idéntico (sin descuento por volumen; si hace falta, cupón de Stripe o iteración futura).

### CIF/NIF en el checkout

- Campo obligatorio **"CIF / NIF"** junto al email en cada tarjeta de plan.
- Validación laxa en servidor (formato NIF/CIF/NIE español normalizado a mayúsculas sin guiones; no bloquear formatos extranjeros).
- Se persiste en `Purchase.buyerTaxId` y en `Firm.taxId` (la primera compra lo fija). Visible en el detalle de compra del operator para facturación.

### Ampliación (compras posteriores sobre la misma firma)

- **Camino explícito**: botón **"Ampliar equipos"** en `/firm` → checkout con `firmId` en la metadata. El webhook NO crea firma: suma seats a la existente, registra la compra sobre ella y dispara la actualización de presupuesto de tokens (hook consumido por `litellm-token-provisioning`).
- **Red de seguridad**: compra orgánica desde la landing con un email que ya es FIRM_ADMIN de una firma **con la misma modalidad** → se trata como ampliación de esa firma.
- La ampliación **hereda modalidad y equipo de agentes** de la firma (el baseline es por firma). El flujo "Ampliar" desde /firm no ofrece elegir modalidad ni agentes.
- Los códigos de activación por seat ya existen (portal /firm + quota en pair): la ampliación simplemente eleva el tope.

## Non-goals

- Descuento por volumen.
- Bloqueo parcial de seats por impago (el kill-switch por firma vive en `litellm-token-provisioning`).
- Mezclar modalidades BUNDLED/EXTERNAL dentro de una firma.
- Validación fiscal formal del CIF/NIF (checksum) — v1 es formato laxo.

## Edge conocido (documentado, no resuelto)

Compra orgánica de un email con firma existente pero **modalidad distinta**: se mantiene el comportamiento actual (firma nueva y el usuario queda reasignado a la última). El camino recomendado y comunicado al cliente es "Ampliar equipos" desde su portal.

## Capabilities

- `multi-seat-purchases`: cantidad en la compra, CIF/NIF, ampliación de seats sobre firma existente.
