# Design: litellm-token-provisioning

## Contexto

- Proxy LiteLLM v1.95.0 en `proxyllm.smartbotics.eu`, doc en `doc-litellm/` (⚠️ contiene credenciales de la UI — NO commitear; carpeta en .gitignore).
- El baseline por defecto se genera en `/api/v0/pair` (`defaultBaselineFiles`), plantilla MiniMax con `${MINIMAX_API_KEY}`.
- El webhook (Deno) ya maneja `checkout.session.completed`; habrá que suscribir también `invoice.payment_failed`, `invoice.paid` y `customer.subscription.deleted` en el endpoint de Stripe.

## Decisiones

### D1 — Nombres y modelo

`TEAM-<firmId8>` / `KEY-<firmId8>` (8 primeros chars del uuid de la firma — únicos en la práctica y trazables; el uuid completo queda en columnas). Modelo compartido `MODEL-AIOFFICE-MINIMAX` (alta manual única); su alias vive en config (`LITELLM_MODEL_ALIAS`) para poder cambiarlo sin tocar código.

### D2 — Dónde se hace el alta (revisado en implementación)

El alta vive **solo en el pair**: es el único momento donde la key se necesita en claro (inyección en el baseline), y así el cifrado existe en una sola implementación (Node). El pair reintenta en cada pareo hasta lograrlo; idempotente (`litellmTeamId` persistido, team por alias como verificación, key regenerada si quedó huérfana — los alias de key son ÚNICOS en el proxy). El webhook queda para block/unblock y actualización de presupuesto en ampliaciones.

### D3 — Cifrado de la virtual key

`litellmKeyEncrypted` con AES-256-GCM; clave derivada (scrypt) de `LITELLM_KEY_SECRET` (env nueva; NO reutilizar AUTH_SECRET para poder rotarlos por separado). Helper `src/lib/crypto-box.ts` (encrypt/decrypt). El webhook Deno cifra con Web Crypto (mismo formato: `v1$<ivB64>$<cipherB64>`).

### D4 — Config del alta

Valores en env con defaults sensatos (iteración futura: moverlos al panel):
- `LITELLM_BASE_URL`, `LITELLM_ADMIN_KEY` (Vercel + secrets de la Edge Function)
- `LITELLM_MODEL_ALIAS` (default `MODEL-AIOFFICE-MINIMAX`)
- `LITELLM_BUDGET_PER_SEAT` (default `16` ≈ 15 €), `LITELLM_TPM` (100000), `LITELLM_RPM` (1000)

### D5 — Baseline con key inline

`defaultBaselineFiles(firmName, selectedAgents, llm?: { baseUrl, model, apiKey })`:
- Con `llm`: `models.providers.litellm = { baseUrl, apiKey (inline), api: "openai-completions", models: [alias] }`, `agents.defaults.model.primary = "litellm/<alias>"` (fallback ollama se mantiene), y `instance-manifest.env = []`.
- Sin `llm`: plantilla MiniMax actual.
La key queda en claro dentro del `openclaw.json` del cliente — asumido: es una key acotada (presupuesto/expiración) y bloqueable; el riesgo es equivalente al `.env` del flujo configurator.

### D6 — Block/unblock

Eventos Stripe → firma vía `stripeSubscriptionId` de sus Purchases → `POST /key/block|unblock` con `litellmKeyId`. Estado espejo en `Firm.tokensBlocked Boolean` para pintar el panel sin llamar al proxy. Regla v1: cualquier `payment_failed`/`deleted` bloquea; `invoice.paid` de cualquier suscripción de la firma desbloquea.

### D7 — Ampliaciones

`onSeatsChanged(firmId, totalSeats)` (definido en multi-seat-purchases) → `POST /team/update { max_budget: perSeat × totalSeats }`. Si multi-seat aún no está implementado, el alta usa `seatsPurchased` vigente y no hay más que hacer.

## Riesgos

- **Proxy caído en compra Y en pair** → baseline MiniMax sin key utilizable; el gateway arranca pero el LLM falla. Mitigación: Activity de error visible al operator + reintento en el siguiente pair/regeneración de baseline.
- **Baselines ya generados** no se actualizan solos al dar de alta la key después: regenerar baseline (borrar el system-default para que el siguiente pair lo recree) — operación documentada para el operator.
- **La key aparece en los files del baseline en DB**: acceso ya restringido a operator; asumido en v1.
