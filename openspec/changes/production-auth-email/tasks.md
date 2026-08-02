# Tasks: production-auth-email

## 1. Prerequisitos operativos

- [ ] 1.1 Verificar el dominio `4bitsengineering.com` en Resend (SPF/DKIM) — compartido con `post-purchase-onboarding`; si ya está hecho allí, marcar y seguir
- [ ] 1.2 Definir `RESEND_API_KEY` y `RESEND_FROM=AI-Office <info@4bitsengineering.com>` en `.env` local y en las variables de entorno de Vercel (preview y producción)

## 2. Magic link real

- [ ] 2.1 Unificar el fallback de remitente en `src/lib/mailer.ts` a `AI-Office <info@4bitsengineering.com>`
- [ ] 2.2 Sustituir el `console.log` de `sendVerificationRequest` en `src/lib/auth.ts` por `sendEmail({ to, subject, html })` con el enlace de Auth.js (el modo dev sin API key sigue logueando en consola vía mailer)
- [ ] 2.3 Probar login end-to-end en local con `RESEND_API_KEY` real: solicitar magic link, recibir email, abrir enlace, sesión creada con rol correcto

## 3. Invitaciones sin auto-login dev

- [ ] 3.1 Eliminar el auto-login por cookie dev en `src/app/invite/[token]/page.tsx`; al aceptar, disparar `signIn("nodemailer", { email })` o redirigir a `/login` con el email precargado
- [ ] 3.2 Probar el flujo de invitación completo con `DEV_AUTH_ENABLED=true` y con el flag apagado (mismo comportamiento: magic link)

## 4. Configuración de producción

- [ ] 4.1 En Vercel producción: `AUTH_URL` a la URL pública, `AUTH_TRUST_HOST` según corresponda, `DEV_AUTH_ENABLED` ausente
- [ ] 4.2 Verificar en producción que el login dev no opera y que la cookie `clawhub-dev-user` no concede sesión
- [ ] 4.3 Prueba end-to-end de magic link en producción con un usuario real de cada rol (OPERATOR, EMPRESA, COMERCIAL, FIRM_ADMIN)

## 5. Documentación

- [ ] 5.1 Actualizar `openspec/funionales.md`: marcar los pendientes de login/producción resueltos y reflejar el flujo real
- [ ] 5.2 Actualizar `.env.example` con `RESEND_API_KEY`, `RESEND_FROM` y notas de `AUTH_URL`/`DEV_AUTH_ENABLED` por entorno
