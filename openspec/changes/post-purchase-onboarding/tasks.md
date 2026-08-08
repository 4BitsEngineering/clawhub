# Tasks: post-purchase-onboarding

## 1. Restaurar y reconciliar la Edge Function

- [x] 1.1 Descargar la versión desplegada (`supabase functions download stripe-webhook`) y diffear contra `supabase/functions/stripe-webhook/index.tsNO`; resolver diferencias documentando el diff → **idénticos** (solo CRLF/LF)
- [x] 1.2 Renombrar `index.tsNO` → `index.ts`; la causa del deshabilitado era que tsc compilaba el código Deno → excluido `supabase/` en `tsconfig.json` (typecheck pasa)

## 2. Prerequisitos operativos (Resend y secrets)

- [x] 2.1 Verificar el dominio `iaofi.com` en Resend (registros DNS SPF/DKIM) — hecho
- [ ] 2.2 Añadir secrets a la Edge Function en Supabase: `RESEND_API_KEY`, `RESEND_FROM` (`AI-Office <info@iaofi.com>`), `APP_URL` — **USUARIO** (escritura de secrets bloqueada en modo auto; comando exacto abajo)

```bash
npx supabase secrets set "RESEND_API_KEY=<tu re_...>" "RESEND_FROM=AI-Office <info@iaofi.com>" "APP_URL=https://clawhub-three.vercel.app" --project-ref sbtpydttrswiljnskrsq
npx supabase functions deploy stripe-webhook --project-ref sbtpydttrswiljnskrsq
```

## 3. Onboarding en la Edge Function

- [x] 3.1 Generar `PairingToken` para la Firm nueva tras el upsert del usuario FIRM_ADMIN, replicando el formato de `generatePairingCode` (comentario cruzado con `src/lib/tokens.ts`); respetar la guarda de idempotencia existente → TTL 7 días (mismo criterio que `/api/v0/register`), retry ante colisión de código
- [x] 3.2 Implementar helper de envío por API REST de Resend (raw fetch, `POST https://api.resend.com/emails`, Bearer `RESEND_API_KEY`) con try/catch no bloqueante y log de error
- [x] 3.3 Componer y enviar el email de bienvenida con el link `${APP_URL}/api/v0/installer?pairing=<code>`; omitir envío sin error si la sesión no trae email de comprador
- [ ] 3.4 Redeploy de la Edge Function y prueba end-to-end con un checkout de test de Stripe (verificar Purchase, comisión, PairingToken y email recibido) — **USUARIO** (deploy bloqueado en modo auto)

### Bugs corregidos de propina en 3.x (la versión desplegada estaba rota)

- [x] Los INSERT vía PostgREST fallaban por NOT NULL: `id` (`@default(uuid())` de Prisma es client-side, no default de BD) y `updatedAt` (`@updatedAt` ídem) — ahora la Edge Function los aporta en Firm, User, Purchase, Commission y PairingToken
- [x] `constructEvent` → `constructEventAsync` (en Deno la verificación de firma usa SubtleCrypto, que es async; la variante síncrona lanza error)
- [x] Upsert de User sustituido por select+insert/update: el upsert por `onConflict: email` sobrescribía el `id` del usuario existente y rompía FKs

## 4. Success page

- [x] 4.1 Ampliar la consulta de `src/app/oferta/[slug]/success/page.tsx`: `Purchase → firmId → PairingToken` activo más reciente
- [x] 4.2 Sustituir el placeholder por el botón/link de descarga `/api/v0/installer?pairing=<code>` cuando el token existe (+ código de activación visible); mantener el mensaje "recibirás un email" como fallback cuando el webhook aún no procesó (con sugerencia de refrescar)
- [ ] 4.3 Probar la carrera redirect-vs-webhook (llegar a la success page antes/después del webhook) y verificar ambos estados — **USUARIO** (requiere checkout de test)

## 5. Verificación y documentación

- [ ] 5.1 Actualizar `openspec/funionales.md`: marcar el paso 7b como completado y reflejar el flujo real
- [ ] 5.2 Prueba end-to-end completa del flujo de venta (prospect → envío → visita → compra → email + success page → descarga del instalador)
