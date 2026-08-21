# Tasks: litellm-token-provisioning

## 0. Previos (manuales, una vez)

- [x] 0.1 Crear el modelo compartido `MODEL-AIOFFICE-MINIMAX` en la UI del proxy (health OK)
- [ ] 0.2 Env: `LITELLM_BASE_URL`, `LITELLM_ADMIN_KEY`, `LITELLM_KEY_SECRET` (+ opcionales alias/budget/TPM/RPM) en `.env.local`, Vercel y secrets de la Edge Function (pedir confirmación para `supabase secrets set`)
- [x] 0.3 Añadir `doc-litellm/` a `.gitignore` (contiene credenciales)
- [x] 0.4 Suscribir `invoice.payment_failed`, `invoice.paid`, `customer.subscription.deleted` en el webhook endpoint de Stripe (dashboard)

## 1. Modelo de datos (aditivo)

- [x] 1.1 `Firm.litellmTeamId String?`, `litellmKeyId String?`, `litellmKeyEncrypted String?`, `tokensBlocked Boolean @default(false)`
- [x] 1.2 `prisma db push` + `generate` + reiniciar dev server

## 2. Cliente LiteLLM + cifrado

- [x] 2.1 `src/lib/litellm.ts`: createTeam, generateKey, updateTeamBudget, blockKey, unblockKey, findTeamByAlias (fetch + admin key; timeouts cortos)
- [x] 2.2 `src/lib/crypto-box.ts`: AES-256-GCM encrypt/decrypt (`v1$iv$cipher`) con clave scrypt de `LITELLM_KEY_SECRET`
- [x] 2.3 Equivalentes Deno (Web Crypto) para el webhook

## 3. Alta

- [x] 3.1 Webhook: tras crear la Firm BUNDLED → team + key + persistencia (idempotente por litellmTeamId; no bloqueante)
- [x] 3.2 Pair: fallback de alta si BUNDLED sin key; descifrar y pasar `llm` a `defaultBaselineFiles`
- [x] 3.3 `onSeatsChanged` → updateTeamBudget

## 4. Baseline

- [x] 4.1 `defaultBaselineFiles(..., llm?)`: proveedor litellm inline + primary `litellm/<alias>` + manifest sin env; sin llm → plantilla actual

## 5. Kill-switch

- [x] 5.1 Webhook: handlers de `invoice.payment_failed` / `customer.subscription.deleted` → blockKey + `tokensBlocked=true` + Activity
- [x] 5.2 `invoice.paid` → unblockKey + `tokensBlocked=false` + Activity
- [ ] 5.3 Redeploy de la función (pedir confirmación)

## 6. Operator

- [x] 6.1 Detalle de firma: estado tokens (team, presupuesto, bloqueada sí/no) + botones block/unblock manuales

## 7. Verificación

- [x] 7.1 `tsc` + unit del baseline con llm (provider inline, manifest env vacío)
- [ ] 7.2 Ciclo real: compra BUNDLED → team+key en el proxy → instalación sin pedir clave → petición LLM servida y gasto en el team
- [ ] 7.3 Simular impago (Stripe test clock o evento manual) → key bloqueada → invoice.paid → desbloqueada
