# Design: production-auth-email

## Context

Auth es NextAuth v5 con adapter Prisma y sesión en base de datos (`src/lib/auth.ts`). El provider de magic link es `Nodemailer` apuntando a `localhost:1025` con `sendVerificationRequest` sobrescrito a `console.log` — el email nunca se envía. En paralelo:

- `src/lib/session.ts` mira primero la cookie de dev (`clawhub-dev-user`) y solo cae a `auth()` si no existe; el bypass se activa con `DEV_AUTH_ENABLED=true`.
- `/invite/[token]/page.tsx:108` hace auto-login con esa cookie al aceptar una invitación ("mientras Resend no está").
- `src/lib/mailer.ts` ya envía por Resend cuando hay `RESEND_API_KEY` y hace console.log en dev; su fallback de remitente (`noreply@aioffice.es`) diverge del documentado (`info@iaofi.com`).
- Solo emails preexistentes en la tabla `User` pueden entrar (regla actual que se conserva).

## Goals / Non-Goals

**Goals:**

- Magic links entregados por email real en cualquier entorno con `RESEND_API_KEY` configurada.
- Flujo de invitación funcional sin `DEV_AUTH_ENABLED`.
- Remitente único y canónico en toda la app.
- Producción lista para `DEV_AUTH_ENABLED` apagado y `AUTH_URL` correcto.

**Non-Goals:**

- Cambiar la estrategia de sesión, roles o la regla "solo emails dados de alta".
- Quitar el bypass de dev en `/login` (sigue existiendo, condicionado a `DEV_AUTH_ENABLED`).
- Emails transaccionales del flujo de compra (cambio `post-purchase-onboarding`).
- Registro público / self-signup.

## Decisions

### D1 — Reutilizar `sendEmail` de `src/lib/mailer.ts` para el magic link

`sendVerificationRequest` pasa a llamar a `sendEmail({ to: identifier, subject, html })` con el enlace `url` que provee Auth.js.

- **Por qué:** `mailer.ts` ya encapsula Resend y el modo dev (console.log sin API key), así que el comportamiento actual de desarrollo se conserva gratis y no se duplica cliente.
- **Alternativa descartada:** provider `Resend` nativo de Auth.js — añade otra ruta de envío distinta de la del resto de la app y no aprovecha el modo dev existente.

### D2 — Mantener el provider Nodemailer como contenedor, solo cambiando `sendVerificationRequest`

Se conserva `next-auth/providers/nodemailer` con el override; el transporte SMTP configurado nunca se usa.

- **Por qué:** cambio mínimo; el id de provider (`"nodemailer"`) ya está referenciado en `signIn("nodemailer", ...)` en `/login`. Cambiar de provider obligaría a tocar más superficie sin beneficio funcional.

### D3 — Remitente canónico `AI-Office <info@iaofi.com>` vía `RESEND_FROM`

Se corrige el fallback de `mailer.ts` para que coincida con el valor documentado, y `RESEND_FROM` se define en todos los entornos (local, Vercel, y secrets de la Edge Function del otro cambio).

- **Por qué:** un único remitente evita sorpresas de deliverability y de verificación de dominio (aioffice.es no está verificado en Resend).

### D4 — Invitación sin auto-login: aceptar redirige al magic link

`/invite/[token]` deja de plantar la cookie de dev; tras aceptar, dispara `signIn("nodemailer", { email })` (o redirige a `/login` con el email precargado) para que el invitado entre por el flujo normal.

- **Por qué:** el auto-login era un parche "mientras Resend no está"; con D1 el magic link ya funciona y la invitación queda alineada con el resto del auth.
- **Trade-off aceptado:** el invitado necesita un segundo email (el magic link) además del de invitación. Simplicidad y una sola ruta de auth pesan más que ahorrar un clic.

### D5 — `DEV_AUTH_ENABLED` queda como flag exclusivamente de desarrollo

No se elimina código: el bypass de `/login` y la cookie dev siguen tras el flag. Producción se configura con el flag ausente/false, `AUTH_URL` a la URL pública de Vercel y `AUTH_TRUST_HOST` según corresponda.

- **Por qué:** el bypass es valioso en local; el riesgo es solo su presencia en producción, que se resuelve por configuración y se verifica en tasks.

## Risks / Trade-offs

- [Dominio Resend sin verificar → magic links no llegan y nadie puede entrar en prod] → prerequisito operativo bloqueante en tasks; verificar entrega real antes de apagar `DEV_AUTH_ENABLED`.
- [Deliverability (spam) de magic links] → remitente canónico con SPF/DKIM verificados; asunto y cuerpo simples con un solo enlace.
- [Invitados con el email de invitación antiguo (link a `/login`) tras el cambio] → el flujo sigue funcionando: `/login` pide el email y envía magic link.
- [Olvido de variables en Vercel (`AUTH_URL`, `RESEND_*`)] → checklist explícito en tasks con verificación en preview antes de producción.
- [El override de Nodemailer deja de ser llamado en futuras versiones de Auth.js] → riesgo bajo; cubierto por la prueba end-to-end de login en tasks.
