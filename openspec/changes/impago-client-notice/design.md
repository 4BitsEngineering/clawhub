# Design: impago-client-notice

## Dónde

En la Edge Function (Deno), dentro de los handlers que ya existen:

- `invoice.payment_failed` → `setTokensBlockedForInvoice(inv, true)` (ya) **+ `sendPaymentFailedEmail(firm, invoice)`**.
- `invoice.paid` → `setTokensBlockedForInvoice(inv, false)` (ya). Si la firma **estaba** bloqueada (transición true→false), **+ `sendPaymentRecoveredEmail(firm)`**.

La resolución firma↔suscripción ya está implementada (`Purchase.stripeSubscriptionId`/`stripeFeeSubscriptionId`). El email del destinatario = FIRM_ADMIN de la firma (`User` con `role=FIRM_ADMIN` y `firmId`), o `Purchase.buyerEmail` como fallback.

## Email

Reutiliza el patrón de Resend por `fetch` que ya usa el webhook (`sendWelcomeEmail`). Dos plantillas cortas, estilo AI-Office:

- **Impago**: asunto "Problema con el cobro de tu suscripción AI-Office". Cuerpo: no hemos podido cobrar tu cuota; para no interrumpir el servicio, actualiza tu método de pago. Botón → `${APP_URL}/firm` (desde ahí abre el Billing Portal).
- **Regularización**: asunto "Tu suscripción AI-Office está al día". Cuerpo: gracias, el pago se ha procesado y tu servicio sigue activo.

## Idempotencia

Stripe reemite `invoice.payment_failed` en cada reintento. Para no spamear:

- Tabla ligera `PaymentNotice { id, invoiceId @unique, kind, sentAt }` (o reutilizar un marcador en Activity). Antes de enviar el email de impago, insertar por `invoiceId` con `kind=failed`; si el `@@unique` choca, no reenviar.
- El email de regularización se envía solo en la transición `tokensBlocked` true→false (que ya es un cambio de estado único), así que no necesita marcador propio.

## A quién

- v1: solo al cliente (FIRM_ADMIN). El hook para copiar a la Suite queda como TODO comentado (cuando `campaigns-suite-branding`/`clientes-crm` expongan el email de contacto de la Suite del cliente).

## Riesgos

- **Falta APP_URL/RESEND en la función**: ya están (se usan en el email de bienvenida). Sin ellos, el aviso se omite con log (no bloquea el kill-switch).
- **Ruido en pruebas**: `invoice.paid` es frecuente; el email de regularización solo sale tras un bloqueo real, no en cada cobro — clave respetar la condición de transición.
