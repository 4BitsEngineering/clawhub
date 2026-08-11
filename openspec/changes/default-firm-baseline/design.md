# Design: default-firm-baseline

## Context

Flujo del instalador (confirmado en código):
1. `POST /api/v0/pair` con el código → crea la `Instance`, y devuelve `promoted_baseline_id` = el `FirmBaseline` con `isPromoted: true` de la firma (o `null` si no hay).
2. `GET /api/v0/baselines/[id]` con el `instance_token` → descarga los `FirmBaselineFile` para provisionar.

`FirmBaseline` (1 promovido por firma) tiene `FirmBaselineFile[]` con `path`, `category` (`OPENCLAW_CONFIG`/`SKILL`/`WORKSPACE`/`ENTERPRISE`/`OTHER`), `content` (utf8/base64), `sha256`, `sizeBytes`. El mínimo viable para provisionar es un `openclaw.json` (`OPENCLAW_CONFIG`).

El configurator (`/api/v0/register`) ya crea baselines promovidos con versión monotónica por firma (`@@unique([firmId, version])`, retry ante carrera) y desmarca el promovido anterior en una transacción. Existe una plantilla canónica de config en `openspec/revisar/openclaw.template.json` con placeholders (`__GATEWAY_TOKEN__`, `__STACK_ROOT__`, `${MINIMAX_API_KEY}`…) que el instalador ya sustituye.

La firma de una compra la crea el webhook (Deno) sin baseline. El `pair` corre en Next.js (Prisma completo).

## Goals / Non-Goals

**Goals:**

- Que el instalador complete la instalación tras una compra, sin configurator.
- Contenido por defecto en una única fuente mantenible en el repo.
- Idempotencia: no duplicar ni pisar baselines existentes (configurator / firm_admin).

**Non-Goals:**

- Reemplazar el configurator (su baseline tiene prioridad y sigue igual).
- Inyectar las claves del proveedor de IA del cliente (las pone tras instalar).
- Editor de la config por defecto desde UI (candidato futuro).

## Decisions

### D1 — Provisión lazy en `/api/v0/pair`, no en el webhook

El baseline por defecto se crea en `pair` (Next.js) cuando la firma no tiene ninguno promovido, justo antes de resolver `promoted_baseline_id`.

- **Por qué:** (a) el baseline solo se necesita al parear (el instalador se descarga y ejecuta después de la compra), así que crearlo aquí garantiza el momento correcto; (b) `pair` ya está en Next.js con Prisma y la lógica de baselines — la plantilla (grande) vive en TypeScript, no hay que embeberla en la Edge Function Deno; (c) cubre **cualquier** firma sin baseline (compra, alta manual…), no solo las de compra.
- **Alternativa descartada:** crearlo en el webhook Deno al comprar — duplicaría la plantilla en Deno, la acoplaría al runtime de la Edge Function y no cubriría firmas creadas por otras vías.

### D2 — Contenido: `openclaw.json` operativo (plantilla MiniMax) desde una fuente única

`src/lib/default-baseline.ts` exporta la lista de archivos del baseline por defecto: el `openclaw.json` (`OPENCLAW_CONFIG`) con la **config completa y operativa** de AI-Office, tomada **tal cual de `openspec/revisar/openclaw.template.json`** (MiniMax/Ollama) con sus placeholders intactos (`${MINIMAX_API_KEY}`, `__GATEWAY_TOKEN__`, `__STACK_ROOT__`, resolvers `bridge_tokens`…). El helper calcula `sha256`/`sizeBytes` por archivo.

- **Por qué 100% operativo:** durante la instalación el cliente solo introduce el código (key) generado; el proveedor y su clave compartida ya están en la config y los resuelve el instalador/bridge en la máquina (el gateway arranca con `MINIMAX_API_KEY` en su entorno; hay `service-key-activator`). Es la misma plantilla que usan las instalaciones del configurator.
- **Fuente única:** versionable en git y editable sin tocar la lógica de `pair`; una sola verdad para la config por defecto.
- **Proveedor por defecto (decisión actual):** MiniMax/Ollama, reutilizando la plantilla existente sin adaptarla. Migrar a **OpenRouter** es una iteración futura (requerirá el bloque `models`/`agents.defaults.model` de OpenRouter y el nombre del secreto de su clave).
- **Alcance inicial:** el `openclaw.json` es lo mínimo que arranca un AI-Office operativo. Workspaces/skills/agentes por defecto se añaden de forma incremental (misma estructura `FirmBaselineFile`).

### D3 — Reutilizar el patrón de creación promovida del configurator

La creación replica el patrón de `/api/v0/register`: versión = `max(version)+1` de la firma, desmarcar el promovido anterior (no habrá, pero por robustez), crear `FirmBaseline` (`isPromoted: true`, `createdBy: "system-default"`, `promotedBy: "system-default"`) + `FirmBaselineFile[]` en una transacción; retry ante colisión de `@@unique([firmId, version])`.

- **Por qué:** consistencia con el mecanismo existente y protección ante carreras (dos PCs pareando la misma firma a la vez).

### D4 — Idempotencia y prioridad

Solo se crea si `findFirst({ firmId, isPromoted: true })` es `null`. Si el configurator o el firm_admin ya dejaron un baseline promovido, se usa ése y no se crea el por defecto.

- **Por qué:** el baseline propio del cliente siempre gana; el por defecto es solo un fallback para firmas sin configurar.

### D5 — Fallo no bloqueante del pairing

Si la creación del baseline por defecto falla, `pair` sigue devolviendo la respuesta de pairing (con `promoted_baseline_id: null`) y registra el error. El pairing (identidad del PC) no se pierde por un fallo al generar el paquete.

- **Por qué:** separar la identidad del PC (crítica) de la provisión del paquete (recuperable: se puede promover un baseline luego y reintentar la descarga).

## Risks / Trade-offs

- [Que el AI-Office no arranque operativo tras instalar] → la operatividad depende de que el instalador/bridge resuelva los secretos compartidos (`MINIMAX_API_KEY` vía host env / `service-key-activator`). Esa maquinaria vive en `autonomous-agents` y ya existe (el error observado fue el baseline, no la clave). Mitigación: la tarea de prueba end-to-end verifica que el chat responde tras instalar; si no resolviera la clave, sería un fallo del instalador (fuera de clawhub), no del baseline.
- [Todos los clientes comparten la misma clave de IA] → el consumo no se limita por cliente en el proveedor. Enforzar el plan de tokens (que el cliente no gaste más IA de la que paga) requiere medición/kill-switch en clawhub ligado a la suscripción de tokens — concern de billing SEPARADO, no bloquea la operatividad. Ver Open Questions.
- [Carrera: dos `pair` simultáneos de la misma firma sin baseline] → transacción + retry por `@@unique([firmId, version])`; si ambos crean, el segundo reintenta y solo queda uno promovido (desmarca anterior).
- [La plantilla canónica evoluciona] → fuente única en `src/lib/default-baseline.ts`; los baselines ya creados no se tocan (cada firma conserva el suyo).
- [Placeholders no sustituidos por el instalador] → el instalador ya sustituye los del configurator; se reutilizan los mismos. Verificar en la prueba end-to-end.

## Open Questions

- ¿El baseline por defecto debe incluir algún **workspace/agente** de ejemplo (para que el cliente tenga agentes listos), o solo `openclaw.json`? Empezamos con solo la config; ampliable con más `FirmBaselineFile`.
- **Medición de consumo de tokens por cliente** (billing): como todos comparten la clave de IA, hay que decidir si/ cómo clawhub limita el consumo al plan de tokens contratado (UsageRecord + kill-switch por firma). Cambio aparte; candidato a spec propia.
- ¿Conviene un **editor en `/operator`** para la config por defecto (en vez de en código)? Fuera de alcance; candidato si cambia a menudo.
- Confirmar en la prueba end-to-end que, con el baseline por defecto, el AI-Office instalado **responde** (chat operativo), no solo que provisiona sin error.
