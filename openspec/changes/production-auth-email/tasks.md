# Tasks: production-auth-email

## 1. Prerequisitos operativos

- [ ] 1.1 Verificar el dominio `4bitsengineering.com` en Resend (SPF/DKIM) — compartido con `post-purchase-onboarding`; si ya está hecho allí, marcar y seguir
- [ ] 1.2 Definir `RESEND_API_KEY` y `RESEND_FROM=AI-Office <info@4bitsengineering.com>` en `.env` local y en las variables de entorno de Vercel (preview y producción)

## 2. Magic link real

- [x] 2.1 Unificar el fallback de remitente en `src/lib/mailer.ts` a `AI-Office <info@4bitsengineering.com>`
- [x] 2.2 Sustituir el `console.log` de `sendVerificationRequest` en `src/lib/auth.ts` por `sendEmail({ to, subject, html })` con el enlace de Auth.js (el modo dev sin API key sigue logueando en consola) → además `pages.verifyRequest = "/login?sent=1"` para reutilizar la UI existente de "enlace enviado"
- [ ] 2.3 Probar login end-to-end en local con `RESEND_API_KEY` real: solicitar magic link, recibir email, abrir enlace, sesión creada con rol correcto — **USUARIO**

### Añadido en 2.x (exigido por el spec, faltaba en el código)

- [x] Callback `signIn` en `auth.ts`: sin él, el PrismaAdapter creaba un User nuevo (rol por defecto FIRM_ADMIN) a cualquier email que pidiera magic link. Ahora se bloquea al solicitar el enlace si el email no existe en `User` — no se envía email a desconocidos ni hay self-signup

## 3. Invitaciones sin auto-login dev

- [x] 3.1 Eliminar el auto-login por cookie dev en `src/app/invite/[token]/page.tsx`; al aceptar, se dispara `signIn("nodemailer", { email, redirectTo })` → magic link al invitado y redirect a `/login?sent=1`
- [ ] 3.2 Probar el flujo de invitación completo con `DEV_AUTH_ENABLED=true` y con el flag apagado (mismo comportamiento: magic link) — **USUARIO**

## 4. Configuración de producción

- [ ] 4.1 En Vercel producción: `AUTH_URL` a la URL pública, `AUTH_TRUST_HOST` según corresponda, `DEV_AUTH_ENABLED` ausente, `RESEND_API_KEY` + `RESEND_FROM` definidas — **USUARIO**
- [ ] 4.2 Verificar en producción que el login dev no opera y que la cookie `clawhub-dev-user` no concede sesión — **USUARIO**
- [ ] 4.3 Prueba end-to-end de magic link en producción con un usuario real de cada rol (OPERATOR, EMPRESA, COMERCIAL, FIRM_ADMIN) — **USUARIO**

## 5. Documentación

- [x] 5.1 Actualizar `openspec/funionales.md`: marcar los pendientes de login/producción resueltos y reflejar el flujo real
- [x] 5.2 Actualizar `.env.example` con `RESEND_API_KEY`, `RESEND_FROM` y notas de `AUTH_URL`/`DEV_AUTH_ENABLED` por entorno (+ Twilio, Stripe y `NEXT_PUBLIC_APP_URL`, que faltaban)
