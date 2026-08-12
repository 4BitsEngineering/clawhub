# Design: password-login

## Context

Auth es NextAuth v5 con PrismaAdapter y sesión `database`. El provider de magic link (Nodemailer con `sendVerificationRequest` → Resend) y el guard `signIn` (solo emails dados de alta) ya funcionan. `src/lib/session.ts` mira primero la cookie dev y luego `auth()`.

Restricción técnica: el provider **Credentials** de NextAuth v5 no crea sesiones de BD — solo funciona con estrategia **JWT**. Con un adapter presente, se puede fijar `session.strategy = "jwt"` y el adapter sigue usándose para usuarios y verification tokens (magic link intacto).

## Goals / Non-Goals

**Goals:** contraseña opcional por usuario conviviendo con magic link; sin dependencias nuevas; misma regla "solo emails dados de alta".

**Non-Goals:** UI de gestión de contraseñas; reset por email; políticas de complejidad; bloqueo por intentos.

## Decisions

### D1 — Estrategia de sesión: database → JWT

Necesaria para Credentials. Callbacks: `jwt` copia `id/role/firmId` del user al token en el login; `session` los lee del token. El magic link sigue igual (verification tokens vía adapter).

- **Coste asumido:** las sesiones de BD existentes dejan de leerse (re-login único). La cookie dev no cambia.

### D2 — Hash scrypt nativo (sin dependencias)

`src/lib/password.ts`: `hashPassword` (sal 16B aleatoria + `crypto.scryptSync`, formato `scrypt$salt$hash` en base64) y `verifyPassword` con `timingSafeEqual`.

- **Por qué no bcryptjs:** scrypt viene en Node, es memory-hard (mejor que bcrypt frente a GPU) y evita otra dependencia.

### D3 — Credentials opt-in por usuario

`authorize`: busca el user por email; si no existe o no tiene `passwordHash`, falla igual que una contraseña incorrecta (error genérico, sin revelar existencia). Usuarios sin hash → solo magic link.

### D4 — UI: sección "Entrar con contraseña" en `/login`

Formulario email + contraseña separado del de magic link. En fallo, redirect a `/login?error=cred` con mensaje genérico "Email o contraseña incorrectos".

### D5 — Alta de contraseñas por script

Sin UI de gestión: las contraseñas se asignan generando el hash por script (operador). Iteración futura: "cambiar contraseña" en el perfil.

## Risks / Trade-offs

- [JWT no revocable hasta caducar] → maxAge 30 días como las sesiones actuales; aceptable para este producto (mismo perfil de riesgo que la cookie dev). Revocación fina = iteración futura.
- [Fuerza bruta sobre /login] → error genérico + scrypt costoso; rate limiting explícito como iteración futura.
- [Sesiones BD huérfanas tras el cambio] → inofensivas; se pueden purgar.

## Open Questions

- ¿UI de cambio de contraseña en el perfil (comercial/admin)? Futuro.
- ¿Rate limiting explícito en login? Futuro (patrón PairAttempt ya existe en el repo).
