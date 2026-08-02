# Tasks: post-purchase-onboarding

## 1. Restaurar y reconciliar la Edge Function

- [ ] 1.1 Descargar la versión desplegada (`supabase functions download stripe-webhook`) y diffear contra `supabase/functions/stripe-webhook/index.tsNO`; resolver diferencias documentando el diff
- [ ] 1.2 Renombrar `index.tsNO` → `index.ts` y verificar que `supabase functions deploy stripe-webhook --dry-run` (o deploy a un entorno de prueba) encuentra el entrypoint

## 2. Prerequisitos operativos (Resend y secrets)

- [ ] 2.1 Verificar el dominio `4bitsengineering.com` en Resend (registros DNS SPF/DKIM)
- [ ] 2.2 Añadir secrets a la Edge Function en Supabase: `RESEND_API_KEY`, `RESEND_FROM` (`AI-Office <info@4bitsengineering.com>`), `APP_URL`

## 3. Onboarding en la Edge Function

- [ ] 3.1 Generar `PairingToken` para la Firm nueva tras el upsert del usuario FIRM_ADMIN, replicando el formato de `generatePairingCode` (comentario cruzado con `src/lib/tokens.ts`); respetar la guarda de idempotencia existente
- [ ] 3.2 Implementar helper de envío por API REST de Resend (raw fetch, `POST https://api.resend.com/emails`, Bearer `RESEND_API_KEY`) con try/catch no bloqueante y log de error
- [ ] 3.3 Componer y enviar el email de bienvenida con el link `${APP_URL}/api/v0/installer?pairing=<code>`; omitir envío sin error si la sesión no trae email de comprador
- [ ] 3.4 Redeploy de la Edge Function y prueba end-to-end con un checkout de test de Stripe (verificar Purchase, comisión, PairingToken y email recibido)

## 4. Success page

- [ ] 4.1 Ampliar la consulta de `src/app/oferta/[slug]/success/page.tsx`: `Purchase → firmId → PairingToken` activo más reciente
- [ ] 4.2 Sustituir el placeholder por el botón/link de descarga `/api/v0/installer?pairing=<code>` cuando el token existe; mantener el mensaje "recibirás un email" como fallback cuando el webhook aún no procesó
- [ ] 4.3 Probar la carrera redirect-vs-webhook (llegar a la success page antes/después del webhook) y verificar ambos estados

## 5. Verificación y documentación

- [ ] 5.1 Actualizar `openspec/funionales.md`: marcar el paso 7b como completado y reflejar el flujo real
- [ ] 5.2 Prueba end-to-end completa del flujo de venta (prospect → envío → visita → compra → email + success page → descarga del instalador)
