# auth-email

## ADDED Requirements

### Requirement: Magic link enviado por email real
Cuando un usuario solicita acceso desde `/login`, el sistema SHALL enviar el magic link de NextAuth por email mediante `sendEmail` (`src/lib/mailer.ts` → Resend) cuando `RESEND_API_KEY` está configurada. Sin `RESEND_API_KEY`, el sistema SHALL mantener el comportamiento de desarrollo actual (log del enlace en consola, sin error).

#### Scenario: Envío en entorno con Resend configurado
- **WHEN** un usuario existente en la tabla `User` solicita el magic link y `RESEND_API_KEY` está definida
- **THEN** recibe un email desde el remitente `RESEND_FROM` con el enlace de acceso funcional

#### Scenario: Entorno de desarrollo sin API key
- **WHEN** se solicita un magic link y `RESEND_API_KEY` no está definida
- **THEN** el enlace se registra en consola y el flujo de login no falla

#### Scenario: Email no dado de alta
- **WHEN** se solicita un magic link para un email que no existe en la tabla `User`
- **THEN** el sistema no crea usuario ni concede acceso (regla existente conservada)

### Requirement: Remitente canónico unificado
Todos los emails de la aplicación SHALL usar el remitente configurado en `RESEND_FROM`, con valor canónico `AI-Office <info@iaofi.com>`, y el fallback por defecto de `src/lib/mailer.ts` SHALL coincidir con ese valor.

#### Scenario: Envío sin RESEND_FROM definido
- **WHEN** se envía cualquier email y `RESEND_FROM` no está definida en el entorno
- **THEN** el remitente usado es `AI-Office <info@iaofi.com>`

### Requirement: Aceptación de invitación sin bypass de desarrollo
La aceptación de una invitación en `/invite/[token]` SHALL completarse mediante el flujo de magic link, sin plantar la cookie de auto-login de desarrollo, con independencia del valor de `DEV_AUTH_ENABLED`.

#### Scenario: Invitado acepta con Resend operativo
- **WHEN** un invitado acepta la invitación válida
- **THEN** el sistema dispara el envío del magic link a su email (o le redirige a `/login` con el email precargado) y el acceso se completa al abrir el enlace

#### Scenario: DEV_AUTH_ENABLED activo no cambia el flujo de invitación
- **WHEN** un invitado acepta la invitación con `DEV_AUTH_ENABLED=true`
- **THEN** no se produce auto-login por cookie de desarrollo; el flujo es el mismo magic link

### Requirement: Producción sin bypass de desarrollo
Con `DEV_AUTH_ENABLED` ausente o distinto de `true`, el sistema SHALL rechazar toda vía de acceso de desarrollo: la acción de login dev no opera y la cookie `clawhub-dev-user` no concede sesión.

#### Scenario: Flag apagado bloquea el login dev
- **WHEN** `DEV_AUTH_ENABLED` no es `true` y se intenta usar el login de desarrollo o se presenta la cookie dev
- **THEN** no se concede sesión y la única vía de acceso es el magic link

#### Scenario: Configuración de producción verificada
- **WHEN** la app corre en producción (Vercel)
- **THEN** `AUTH_URL` apunta a la URL pública, `RESEND_API_KEY` y `RESEND_FROM` están definidas y el login por magic link funciona end-to-end
