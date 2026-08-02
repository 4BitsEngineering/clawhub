# Design: post-purchase-onboarding

## Context

Tras `checkout.session.completed`, la Edge Function `stripe-webhook` (Deno, Supabase) crea Firm, usuario FIRM_ADMIN, Purchase, actualiza el Prospect y calcula la comisión — y ahí termina. El comprador no recibe acceso al instalador de AI-Office.

Piezas existentes pero desconectadas:

- `GET /api/v0/installer?channel=&platform=` (`src/app/api/v0/installer/route.ts`): público, redirige 302 a la signed URL del último `StackBundle` tipo `INSTALLER`. El parámetro `?pairing=` está contemplado en el docstring pero comentado.
- `PairingToken` + `generatePairingCode` (`src/lib/tokens.ts`) + validación de cuota de asientos (`/api/v0/pair`), usados hoy solo desde el panel `/firm`.
- Success page `/oferta/[slug]/success/page.tsx`: ya lee la `Purchase` por `stripeSessionId` vía Prisma, pero muestra texto placeholder.

Restricciones:

- El archivo de la Edge Function está deshabilitado en el repo (`index.tsNO`); lo desplegado en Supabase puede diferir.
- La Edge Function corre en Deno y no puede importar `src/lib/mailer.ts` ni `src/lib/tokens.ts`.
- El proyecto ya usa el patrón "raw fetch, sin SDK" para Twilio.

## Goals / Non-Goals

**Goals:**

- El comprador obtiene el link de descarga del instalador por dos vías redundantes: email de bienvenida y success page.
- El webhook sigue siendo idempotente y el envío de email nunca bloquea el registro de la compra.
- El repo vuelve a ser la fuente de verdad de la Edge Function desplegada.

**Non-Goals:**

- Activar la validación/telemetría del parámetro `pairing` en `/api/v0/installer` (sigue siendo decorativo/informativo; se registra como cuestión abierta).
- Magic links de NextAuth ni emails de invitación a comerciales (cambio `production-auth-email`).
- Cambios en el cálculo de comisiones o en el contrato del webhook de Stripe.
- Página de "gracias" nueva: se reutiliza la success page existente.

## Decisions

### D1 — Email desde la Edge Function con la API REST de Resend (raw fetch, sin SDK)

`fetch POST https://api.resend.com/emails` con `Authorization: Bearer ${RESEND_API_KEY}`, sin `npm:resend`.

- **Por qué:** mantiene la Edge Function sin dependencias npm (menos superficie en el deploy de Deno), replica el patrón ya establecido con Twilio, y la API de Resend es un único POST JSON.
- **Alternativas descartadas:** `npm:resend` en Deno (resolución de paquetes en deploy, riesgo de versiones); enviar el email desde Next.js tras el webhook (añade un salto y un punto de fallo; la Edge Function ya tiene todo el contexto).

### D2 — PairingToken generado en la Edge Function, mismo formato que `generatePairingCode`

La Edge Function inserta el `PairingToken` directamente (schema `clawhub`, service role), replicando en Deno el formato de código de `src/lib/tokens.ts` (no puede importarlo).

- **Por qué:** el token debe existir antes de enviar el email y antes de que el comprador llegue a la success page; generarlo en el webhook garantiza ambas cosas en una sola transacción lógica.
- **Alternativa descartada:** generarlo lazy en la success page — dejaría el email sin link utilizable si el comprador no visita la página.
- **Nota:** documentar en ambos archivos que el formato está duplicado deliberadamente.

### D3 — Fallo de email no bloqueante

El `fetch` a Resend va envuelto en try/catch con `console.error`; el webhook responde 200 igualmente.

- **Por qué:** Purchase, comisión y PairingToken ya están registrados; la success page es la vía redundante. Un 5xx haría a Stripe reintentar y chocar con la guarda de idempotencia sin beneficio.

### D4 — Success page resuelve el link vía Prisma

`Purchase (stripeSessionId) → firmId → PairingToken` más reciente activo, y pinta `/api/v0/installer?pairing=<code>`. Si el webhook aún no ha procesado (carrera Stripe-redirect vs webhook), la página mantiene el mensaje "recibirás un email" como fallback sin link.

- **Por qué:** la página ya lee la Purchase; solo se amplía la consulta. La carrera es real: el redirect de Stripe puede llegar antes que el webhook.

### D5 — Restaurar `index.tsNO` como primera tarea, reconciliando con lo desplegado

Descargar la versión desplegada (`supabase functions download stripe-webhook`), diffear contra `index.tsNO`, resolver diferencias y renombrar a `index.ts`.

- **Por qué:** tocar el webhook sin saber qué hay en producción invita a regresiones silenciosas en el flujo de dinero.

### D6 — Secrets nuevos en Supabase

`RESEND_API_KEY`, `RESEND_FROM` (valor canónico: `AI-Office <info@4bitsengineering.com>`) y `APP_URL` (para construir el link del instalador en el email).

## Risks / Trade-offs

- [Lo desplegado en Supabase difiere del `.tsNO`] → D5: download + diff antes de cualquier edición; el diff se adjunta a la PR.
- [Dominio Resend sin verificar → emails no salen] → prerequisito operativo explícito en tasks; mientras tanto D3 garantiza que el flujo de compra no se rompe y la success page cubre la entrega.
- [Carrera redirect vs webhook en la success page] → fallback sin link (D4); opcionalmente el usuario puede refrescar.
- [Formato de PairingToken duplicado en dos lenguajes] → comentario cruzado en ambos archivos; riesgo bajo (formato estable).
- [Cuota de asientos: el token del webhook consume lógica distinta a `/api/v0/pair`] → el webhook crea el token directamente sin pasar por la validación de cuota (la Firm es nueva, `seatsPurchased: 1`, sin uso previo); documentado.

## Open Questions

- ¿El email de bienvenida debe incluir también acceso al panel `/firm` (magic link)? Depende de `production-auth-email`; de momento el email solo lleva el link del instalador.
- ¿Activar validación/registro del parámetro `pairing` en `/api/v0/installer` (hoy comentado)? Fuera de alcance; candidato a cambio futuro.
