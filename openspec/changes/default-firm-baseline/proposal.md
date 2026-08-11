# Proposal: default-firm-baseline

## Why

Una firma creada por **compra** (webhook de Stripe) no tiene ningún `FirmBaseline` promovido. El instalador, tras parear con el código, descarga el baseline promovido de la firma para provisionar el overlay; al no existir, falla con "La firma no tiene un paquete (baseline) promovido en clawhub" y el cliente no puede completar la instalación.

Hoy el único camino que deja un baseline es el **configurator** (`/api/v0/register`), que sube el paquete del wizard como baseline promovido. El flujo de compra (post-purchase-onboarding) entrega el código de instalación directamente desde el webhook, sin pasar por el configurator, por lo que la firma queda sin paquete.

Objetivo de producto: tras la compra, el cliente descarga el instalador y, durante la instalación, **solo introduce el código (key) que se le ha generado**. Todo lo demás está **ya configurado** — el proveedor de IA y su clave los provee el propio instalador/bridge (no los introduce el cliente ni los entrega clawhub). Así la instalación queda **100% operativa** sin que el cliente configure nada más.

De momento la config por defecto usa la plantilla existente de **MiniMax/Ollama** (`openspec/revisar/openclaw.template.json`); migrar el proveedor por defecto a **OpenRouter** queda anotado como iteración futura.

La única pieza que falta para una firma comprada es el **paquete de configuración** (`FirmBaseline` con `openclaw.json`) que deja la config lista y referencia esos secretos compartidos — el error observado en el instalador fue precisamente "no tiene un paquete (baseline)", no "falta la API key".

## What Changes

- Cuando el instalador parea (`/api/v0/pair`) y la firma **no tiene** baseline promovido, el sistema SHALL provisionar un **baseline por defecto** promovido (config AI-Office estándar) y devolver su id, de modo que la descarga posterior (`/api/v0/baselines/[id]`) tenga contenido.
- El contenido del baseline por defecto se define en una **única fuente en el repo** (plantilla `openclaw.json` canónica, con los placeholders que el instalador ya sustituye), reutilizable y editable.
- La provisión es **idempotente**: solo se crea si la firma no tiene ya un baseline promovido; no pisa baselines subidos por el configurator ni por el firm_admin.
- No cambia el contrato de `/api/v0/pair` ni `/api/v0/baselines/[id]`: el instalador sigue igual.

## Capabilities

### New Capabilities

- `default-firm-baseline`: provisión automática de un paquete de configuración AI-Office por defecto (promovido) para firmas que no tienen ninguno, de forma que el instalador pueda completar la instalación tras una compra sin pasar por el configurator.

### Modified Capabilities

<!-- Ninguna spec previa en openspec/specs/. Complementa post-purchase-onboarding
     (que crea Firm + PairingToken) cerrando el hueco del baseline. -->

## Impact

- **Código afectado:**
  - `src/app/api/v0/pair/route.ts` — si la firma no tiene baseline promovido al parear, crear el baseline por defecto antes de resolver `promoted_baseline_id`.
  - `src/lib/default-baseline.ts` (nuevo) — fuente única del contenido por defecto (openclaw.json canónico + archivos mínimos), derivado de `openspec/revisar/openclaw.template.json`.
- **Modelo de datos:** sin migración. Se reutilizan `FirmBaseline` + `FirmBaselineFile` existentes.
- **Sistemas:** ninguno nuevo. La creación ocurre en Next.js (no en la Edge Function), donde ya vive la lógica de baselines y Prisma.
- **Fuera de alcance:** el flujo del configurator (wizard) — sigue funcionando y su baseline tiene prioridad; personalización avanzada de la config por defecto; la **provisión de la clave de IA** (la hace el instalador/bridge de `autonomous-agents`, no clawhub); la **medición/límite de consumo de tokens por cliente** (todos comparten la clave de IA, así que enforcar el plan de tokens es un concern de billing aparte — ver Open Questions del design).
