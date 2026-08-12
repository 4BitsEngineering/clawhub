# Design: firm-client-portal

## Context

`/firm` (rol FIRM_ADMIN, guard `requireFirmAdmin`) hoy: dashboard operativo con instances, generación de pairing (10 min), actividad, y subpáginas baselines/users/instances/[id]/mcp/settings/usage. El FIRM_ADMIN se crea automáticamente al comprar. La firma tiene compras (`Purchase`) con `stripeSubscriptionId` (tokens) y `stripeFeeSubscriptionId` (fee anual) desde el change `checkout-fee-and-token-subscription`. `UsageRecord` registra consumo por instance con `firmId` denormalizado.

Referencia visual del producto AI-Office: fondo azul marino profundo, titulares serif con punto final ("Operador web."), chips amarillos, tarjetas claras redondeadas, tono cercano.

## Goals / Non-Goals

**Goals:** portal de cliente mínimo (instalador, código, consumo, facturación), estética AI-Office, cero capacidades operativas internas para el cliente.

**Non-Goals:** cambiar el tema global de la app; gestión de plan/asientos desde el portal; gráficas de consumo; tocar el panel del operador.

## Decisions

### D1 — Una sola página; subrutas redirigen

`/firm` concentra todo. `/firm/baselines`, `/firm/users`, `/firm/instances/[id]`, `/firm/mcp`, `/firm/settings`, `/firm/usage` → `redirect("/firm")`. No se borran los archivos internos que reutiliza el operador (no los hay: el operador tiene los suyos); las páginas del cliente se sustituyen por el redirect.

- **Por qué redirect y no 404:** enlaces antiguos o marcadores del cliente aterrizan suavemente en el portal.

### D2 — Código de activación: reutilizar PairingToken con TTL de 7 días

El bloque muestra el pairing activo más reciente (no usado, no caducado). Si no hay, botón "Generar código" → server action con la validación de cuota existente y `expiresAt = +7 días` (mismo criterio que el flujo de compra y `/api/v0/register`; el TTL de 10 min actual era para el alta manual de trabajador, no para un cliente autoservicio).

### D3 — Consumo del mes desde `UsageRecord`, sin costes

Agregado del mes en curso para la firma: `SUM(inputTokens+outputTokens)` como "tokens usados" y `COUNT` de registros como "tareas ejecutadas" (+ mes anterior como referencia). No se muestra `costUsd` (coste mayorista interno) ni desglose por modelo/proveedor.

- **Por qué:** el cliente paga una suscripción plana de tokens; el coste interno es información de la casa.

### D4 — Facturación vía Stripe Billing Portal, customer derivado de la suscripción

Server action "Gestionar facturación": última `Purchase` COMPLETED de la firma → `stripeSubscriptionId` → `stripe.subscriptions.retrieve` → `customer` → `stripe.billingPortal.sessions.create({ customer, return_url: APP_URL/firm })` → redirect a la URL del portal. Desde el portal de Stripe el cliente descarga facturas/recibos y gestiona ambas suscripciones (tokens y fee).

- **Por qué derivar y no persistir `stripeCustomerId`:** evita migración y backfill; una llamada extra a Stripe solo al pulsar el botón. Si más adelante molesta, se persiste.
- **Fallbacks:** sin Stripe configurado o sin compra con suscripción → la tarjeta muestra "disponible próximamente" sin botón (p. ej. firmas creadas a mano).
- **Prerequisito:** Billing Portal configurado en el dashboard de Stripe (guardar la config por defecto una vez).

### D5 — Estética AI-Office autocontenida en la página

La página pinta su propio lienzo (fondo navy `#0c2b3d`→`#0a2333`, texto crema `#f5efe4`), titulares con serif (`Georgia/'Times New Roman', serif` inline — la app no carga ninguna serif y añadir una webfont queda fuera de alcance) y punto final amarillo, chips amarillo `#f2c94c`, tarjetas crema redondeadas (`rounded-2xl`) con texto oscuro. Header propio minimal (wordmark "AI Office", nombre de la firma, salir). No usa `EmpresaShell`/`SalesShell` ni cambia tokens globales.

## Risks / Trade-offs

- [El cliente pierde capacidades que quizá usaba (re-pair, ver PCs)] → decisión de producto explícita del usuario; el operador conserva todo en su panel y puede asistir por soporte.
- [Billing Portal sin configurar en Stripe → error al crear la sesión] → try/catch: si falla, mensaje "contacta con soporte" y log; prerequisito documentado.
- [Serif del sistema ≠ tipografía exacta del producto] → aproximación aceptable sin cargar webfonts; iteración futura si se quiere la fuente exacta.
- [Compras antiguas sin `stripeSubscriptionId`] → fallback a derivar customer desde `stripeSessionId` (checkout session) si existe; si tampoco, tarjeta sin botón.

## Open Questions

- ¿Mostrar también el estado de la licencia (activa/suspendida) y fecha de renovación del fee en el portal? Candidato a iteración.
- ¿Webfont serif de marca (la del producto) en vez de Georgia? Iteración estética futura.
