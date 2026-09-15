# Proposal: impago-client-notice

## Why

Apunte de la reunión: "Aviso al cliente cuando haya impago". Hoy el webhook ya captura `invoice.payment_failed` y bloquea los tokens del cliente (kill-switch de `litellm-token-provisioning`), pero **el cliente no recibe ningún aviso** — se queda sin servicio sin saber por qué. Falta el email de notificación.

Esta spec es autónoma: reutiliza el evento de Stripe que ya está enganchado.

## What Changes

### Email de aviso de impago al cliente

- En el handler de `invoice.payment_failed` del webhook, además de bloquear los tokens, enviar un **email al FIRM_ADMIN de la firma** avisando del impago, con enlace al portal de facturación (Stripe Billing Portal / `/firm`) para regularizar.
- Tono claro y accionable: "no hemos podido cobrar tu cuota; tu servicio puede verse interrumpido; actualiza tu método de pago aquí".
- **Aviso de regularización**: en `invoice.paid` tras un impago (la firma estaba `tokensBlocked`), enviar un email de "todo en orden, servicio restablecido".

### A quién se avisa

- Al **cliente final** (FIRM_ADMIN de la firma). Decisión confirmada en el diseño de negocio: 4bits cobra al cliente final.
- **A la Suite** (opcional, decisión de diseño): copia al email de contacto de la Suite a la que pertenece el cliente, para que su comercial esté al tanto. Por defecto: no en v1 (evita ruido); se deja el hook.

### Anti-spam / idempotencia

- No reenviar el aviso de impago si ya se envió uno para la misma factura (Stripe reintenta y reemite el evento). Marca por `invoiceId`.

## Non-goals

- Gestión de dunning avanzada (secuencia de recordatorios escalados) — un solo aviso de impago + uno de regularización.
- Reintentos de cobro (los gestiona Stripe).
- Cambiar el kill-switch de tokens (ya existe).

## Capabilities

- `impago-client-notice`: email al cliente en `invoice.payment_failed` (y de regularización en `invoice.paid`), idempotente por factura.
