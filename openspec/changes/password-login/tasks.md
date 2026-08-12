# Tasks: password-login

## 1. Modelo y hashing

- [x] 1.1 `User.passwordHash String?` + `prisma db push` + `generate`
- [x] 1.2 `src/lib/password.ts`: `hashPassword`/`verifyPassword` con scrypt nativo (sal 16B, `timingSafeEqual`)

## 2. NextAuth

- [x] 2.1 `session.strategy = "jwt"` + callback `jwt` (id/role/firmId al token en login) + `session` desde el token
- [x] 2.2 Provider `Credentials`: authorize por email + verifyPassword; fallo genérico si no existe/no tiene hash/contraseña incorrecta
- [x] 2.3 Verificar que el guard del magic link (signIn callback) sigue intacto

## 3. UI de login

- [x] 3.1 Sección "Entrar con contraseña" (email + contraseña + botón); error genérico vía `?error=cred`
- [x] 3.2 Mantener la sección de magic link

## 4. Contraseñas de prueba

- [x] 4.1 Asignar contraseña a los 4 usuarios de prueba (operator/empresa/comercial/firm_admin) vía script con hash scrypt

## 5. Verificación y docs

- [x] 5.1 Typecheck en verde; login por contraseña y por magic link probados en local (los 4 roles aterrizan en su panel)
- [x] 5.2 Actualizar `openspec/funionales.md` (sección Login)
