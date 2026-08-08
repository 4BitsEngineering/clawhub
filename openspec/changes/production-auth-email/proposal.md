# Proposal: production-auth-email

## Why

El login por magic link no funciona fuera de desarrollo: `sendVerificationRequest` en `src/lib/auth.ts` está sobrescrito para hacer `console.log` del enlace en vez de enviarlo, y la aceptación de invitaciones (`/invite/[token]`) depende del auto-login de `DEV_AUTH_ENABLED`. Sin esto resuelto no se puede desactivar el bypass de desarrollo en producción, que es un requisito de seguridad explícito de `openspec/funionales.md`.

Además hay una divergencia de remitente: `src/lib/mailer.ts` usa el fallback `noreply@aioffice.es` mientras la configuración documentada es `info@iaofi.com`.

## What Changes

- Sustituir el `console.log` de `sendVerificationRequest` por envío real del magic link vía Resend (`src/lib/mailer.ts`), manteniendo el log en consola solo cuando no hay `RESEND_API_KEY` (comportamiento dev actual).
- Unificar el remitente: `RESEND_FROM` canónico `AI-Office <info@iaofi.com>` y actualizar el fallback de `mailer.ts`.
- Eliminar el auto-login de `/invite/[token]` condicionado a `DEV_AUTH_ENABLED`: la aceptación de invitación pasa a apoyarse en el magic link real.
- Documentar y dejar listo el apagado de `DEV_AUTH_ENABLED` en producción (el bypass de `/login` sigue disponible en dev).
- Variables de entorno de producción: `AUTH_URL` apuntando a la URL pública (Vercel), `RESEND_API_KEY` y `RESEND_FROM` presentes en el entorno de la app.

## Capabilities

### New Capabilities

- `auth-email`: entrega de magic links de NextAuth por email real (Resend), remitente unificado, flujo de invitación sin dependencia del bypass de desarrollo y condiciones para desactivar `DEV_AUTH_ENABLED` en producción.

### Modified Capabilities

<!-- Ninguna: no existen specs previos en openspec/specs/. -->

## Impact

- **Código afectado:**
  - `src/lib/auth.ts` — `sendVerificationRequest` con envío real vía `sendEmail`.
  - `src/lib/mailer.ts` — fallback de `RESEND_FROM` unificado.
  - `src/app/invite/[token]/page.tsx` — quitar auto-login dev; redirigir al flujo de magic link.
  - `src/app/login/page.tsx` — sin cambios funcionales previstos (bypass dev se conserva tras `DEV_AUTH_ENABLED`).
- **Sistemas:** Resend (dominio verificado es prerequisito), Vercel (variables de entorno de producción).
- **Dependencias:** ninguna nueva; se reutiliza `sendEmail` existente. Se elimina la dependencia funcional del provider Nodemailer sobre un SMTP local inexistente.
- **Relación con otros cambios:** comparte el prerequisito de dominio Resend verificado con `post-purchase-onboarding`; ambos usan el mismo `RESEND_FROM` canónico.
