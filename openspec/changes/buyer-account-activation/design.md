# Design: buyer-account-activation

## Contexto

- El webhook (Supabase Edge Function, Deno + supabase-js) ya crea/reutiliza el User FIRM_ADMIN al completar la compra y envía el email de licencia vía Resend.
- Login: NextAuth v5 con Credentials (scrypt en `src/lib/password.ts`); el magic link de NextAuth quedó solo para invitaciones.
- El webhook NO puede generar tokens de NextAuth (vive fuera de Next) → el token de activación es propio.

## Decisiones

### D1 — Token propio, hasheado, un solo uso

Tabla `AccountSetupToken { id, userId, tokenHash, expiresAt (7d), usedAt, createdAt }`. El webhook genera el token aleatorio (32 bytes url-safe), guarda solo el hash (SHA-256, mismo patrón que instance tokens) e incluye `https://<app>/activar?token=<plain>` en el email de licencia. Reintentos del webhook no generan tokens duplicados: si el usuario ya tiene passwordHash, no se crea token ni se incluye el bloque en el email.

### D2 — Página `/activar` (App Router, estilos AI-Office)

- GET con `?token=`: valida (hash existe, no usado, no caducado, usuario sin contraseña) → form de contraseña (2 campos, mín. 8). Inválido → mensaje + form de reenvío.
- Server action: vuelve a validar, `passwordHash = scrypt(pwd)`, marca `usedAt`, e inicia sesión (redirect a `/login?activated=1` con aviso "cuenta activada, entra con tu contraseña" — evitamos acoplarnos a signIn programático de NextAuth en la primera iteración).
- Reenvío: server action con email → si existe FIRM_ADMIN sin `passwordHash`, invalida tokens previos, crea uno nuevo y envía email corto vía Resend. Respuesta neutra siempre ("Si existe una cuenta pendiente de activar, recibirás un email"). Rate-limit por IP reutilizando el patrón de `PairAttempt`.

### D3 — Email

Se amplía el email de licencia existente (webhook) con un bloque "Tu cuenta" y el botón de activación. El reenvío usa una plantilla mínima propia (asunto "Activa tu cuenta de AI-Office").

### D4 — Compat

- Compradores antiguos sin contraseña: pueden usar el form de reenvío de `/activar` (enlace "¿No puedes entrar? Activa tu cuenta" en `/login`).
- El flujo de invitaciones (comerciales) no se toca.

## Riesgos

- El webhook necesita `NEXT_PUBLIC_APP_URL`/APP_URL como secret de la función para componer el enlace (añadir a las env de la Edge Function; pedir confirmación para `supabase secrets set`).
- Enlace en email = superficie de phishing: el email deja claro dominio oficial (iaofi.com) y que nunca pedimos la contraseña actual.
