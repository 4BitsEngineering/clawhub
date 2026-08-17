# Tasks: buyer-account-activation

## 1. Modelo de datos

- [x] 1.1 `AccountSetupToken { id, userId, tokenHash @unique, expiresAt, usedAt?, createdAt }` + relación User
- [x] 1.2 `prisma db push` + `generate` + reiniciar dev server

## 2. Webhook (Deno)

- [x] 2.1 Al crear/reutilizar el User FIRM_ADMIN sin passwordHash: generar token (32 bytes), guardar hash SHA-256, componer enlace `/activar?token=`
- [x] 2.2 Añadir bloque "Tu cuenta" al email de licencia (botón "Activa tu cuenta"); omitirlo si ya hay contraseña
- [ ] 2.3 Secret APP_URL en la Edge Function (pedir confirmación para `supabase secrets set`) + redeploy (pedir confirmación)

## 3. Página /activar

- [x] 3.1 GET: validar token → form contraseña (2 campos, mín. 8) con estilos AI-Office; inválido → mensaje + form de reenvío
- [x] 3.2 Server action de alta: revalidar, scrypt, marcar usedAt, redirect `/login?activated=1`
- [x] 3.3 Server action de reenvío: respuesta neutra, invalidar tokens previos, email vía Resend, rate-limit por IP (patrón PairAttempt)
- [x] 3.4 `/login`: aviso "cuenta activada" con `?activated=1` y enlace "¿Primera vez? Activa tu cuenta"

## 4. Verificación

- [x] 4.1 `tsc` + render de /activar (token válido, inválido, reenvío)
- [ ] 4.2 Ciclo real: compra de prueba → email con enlace → alta de contraseña → login → /firm
- [ ] 4.3 Reenvío para comprador antiguo sin contraseña
