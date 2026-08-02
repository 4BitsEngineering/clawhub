# Proposal: post-purchase-onboarding

## Why

El flujo de venta termina hoy en un callejón sin salida: tras la compra, la Edge Function de Stripe crea la Firm y el usuario FIRM_ADMIN, pero el comprador no recibe ningún acceso al instalador de AI-Office — la success page muestra texto placeholder y no se envía ningún email (paso 7b de `openspec/funionales.md`). La infraestructura de instalador (`/api/v0/installer`, `PairingToken`, cuota de asientos) ya existe pero está desconectada del flujo de compra.

Además, el archivo de la Edge Function está deshabilitado en el repo (`supabase/functions/stripe-webhook/index.tsNO`), con riesgo de divergencia respecto a lo desplegado en Supabase.

## What Changes

- Restaurar `supabase/functions/stripe-webhook/index.tsNO` → `index.ts` y reconciliar con la versión desplegada en Supabase.
- La Edge Function, tras crear Firm + FIRM_ADMIN, genera un `PairingToken` para la Firm nueva.
- La Edge Function envía un email de bienvenida al comprador vía **API REST de Resend (raw fetch, sin SDK)** con el link de descarga del instalador `/api/v0/installer?pairing=<code>` (mismo patrón raw-fetch que Twilio).
- El fallo del envío de email NO bloquea el webhook: la Purchase y la comisión se registran igualmente.
- La success page (`/oferta/[slug]/success`) resuelve vía Prisma `Purchase → Firm → PairingToken` y muestra el link real de descarga del instalador, sustituyendo el placeholder.
- Nuevos secrets en Supabase Edge Function: `RESEND_API_KEY`, `RESEND_FROM`, `NEXT_PUBLIC_APP_URL` (para construir el link).

## Capabilities

### New Capabilities

- `post-purchase-onboarding`: entrega del acceso al instalador de AI-Office tras la compra — generación de PairingToken en el webhook, email de bienvenida vía Resend API y link real en la página de éxito del checkout.

### Modified Capabilities

<!-- Ninguna: no existen specs previos en openspec/specs/. -->

## Impact

- **Código afectado:**
  - `supabase/functions/stripe-webhook/index.tsNO` → renombrar a `index.ts` y ampliar (PairingToken + email Resend).
  - `src/app/oferta/[slug]/success/page.tsx` — link real al instalador.
  - `src/lib/tokens.ts` — reutilización de `generatePairingCode` (referencia de formato; la Edge Function replica la generación en Deno).
- **Sistemas:** Supabase Edge Functions (redeploy), Resend (requiere dominio verificado), Stripe webhook (sin cambios de contrato).
- **Secrets:** añadir `RESEND_API_KEY`, `RESEND_FROM`, `NEXT_PUBLIC_APP_URL` a los secrets de la Edge Function.
- **Dependencias:** ninguna nueva (raw fetch, sin SDK).
- **Prerequisito operativo:** verificar el dominio de envío en Resend (`info@4bitsengineering.com`).
