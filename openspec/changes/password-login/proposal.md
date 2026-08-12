# Proposal: password-login

## Why

El único acceso en producción es el magic link. Para operar y probar con agilidad (y para usuarios que prefieren credenciales), se quiere poder entrar con **email + contraseña**, sin depender del correo. El magic link se mantiene — la contraseña es una vía adicional, solo para usuarios que la tengan asignada.

## What Changes

- Login con **email + contraseña** en `/login`, conviviendo con el magic link.
- `User.passwordHash` (nullable): solo los usuarios con contraseña asignada pueden usar esta vía; el resto siguen con magic link.
- Hashing con **scrypt** (nativo de Node, sin dependencias nuevas), sal aleatoria por usuario y comparación en tiempo constante.
- La sesión de NextAuth pasa de estrategia **database a JWT** — requisito técnico: el provider Credentials de NextAuth v5 no funciona con sesiones en BD. El magic link sigue funcionando igual (el adapter Prisma se mantiene para usuarios y tokens de verificación).
- Asignación de contraseñas: por script/BD (sin UI de gestión de momento — la UI de "cambiar contraseña" queda como iteración futura).

## Capabilities

### New Capabilities

- `password-login`: autenticación por email + contraseña (scrypt, opt-in por usuario) coexistiendo con el magic link, con sesión JWT.

## Impact

- **Código:** `src/lib/auth.ts` (estrategia JWT, provider Credentials, callbacks jwt/session), `src/lib/password.ts` (nuevo, hash/verify scrypt), `src/app/login/page.tsx` (campo contraseña + manejo de error).
- **Modelo:** `User.passwordHash String?` (aditivo).
- **Sesiones existentes:** al cambiar a JWT, las sesiones en BD dejan de leerse (los usuarios activos tendrán que volver a entrar una vez). El bypass dev (`DEV_AUTH_ENABLED`) no se ve afectado.
- **Seguridad:** misma regla de acceso (solo emails dados de alta); un fallo de credenciales muestra error genérico sin revelar si el email existe.
- **Fuera de alcance:** UI de gestión/cambio/restablecimiento de contraseña; políticas de complejidad; bloqueo por intentos (rate limit básico de NextAuth).
