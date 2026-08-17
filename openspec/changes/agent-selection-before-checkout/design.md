# Design: agent-selection-before-checkout

## Contexto

El catálogo de agentes vive hoy en `DEFAULT_TEAM` dentro de `src/lib/default-baseline.ts` (14 entradas con los defaults exactos de los `manifest.json` de clawcrew: agent, slug, displayName, shortName, icon, color, workingVerb, voice, blurb). El baseline por defecto se genera al parear (`/api/v0/pair` → `provisionDefaultBaseline`) y produce el paquete que consume `setup-from-config.ps1`.

## Decisiones

### D1 — Fuente del catálogo: módulo compartido, no DB

Extraer `DEFAULT_TEAM` a `src/lib/agent-catalog.ts` exportando `AGENT_CATALOG` (mismo shape actual) y `MANDATORY_AGENTS = ["planner"]`. `default-baseline.ts` y las landings importan de ahí. No se usa el modelo Prisma `AgentCatalogEntry` (catálogo del operator para otro flujo) para no acoplar la venta a datos mutables de DB: el catálogo vendible debe ir en lockstep con la biblioteca clawcrew del bundle overlay, que se versiona con el código.

### D2 — Transporte: metadata de Stripe, ids separados por coma

`createUnifiedCheckout({ ..., selectedAgents?: string[] })` añade `selectedAgents: ids.join(",")` a la metadata (límite Stripe 500 chars/valor; los 14 ids suman ~130). El server action valida contra `AGENT_CATALOG` (ids desconocidos se descartan) y fuerza la inclusión de `planner`. Lista vacía tras validar ⇒ no se envía la key (= todos).

### D3 — Persistencia: `Purchase.selectedAgents String[]`

Columna nueva `selectedAgents String[] @default([])` en `Purchase` (Postgres `text[]`). El webhook (Deno) la rellena desde la metadata (`split(",")`, sin validar — la validación ya ocurrió en el checkout; el pair vuelve a intersectar con el catálogo como defensa). Array vacío = todos (compat con compras existentes; no hay migración de datos).

Se descarta una tabla propia: la selección es un atributo inmutable de la compra, sin ciclo de vida propio.

### D4 — Generación del baseline: parámetro en `defaultBaselineFiles`

`defaultBaselineFiles(firmName, selectedAgents?: string[])`: filtra `AGENT_CATALOG` a la selección (∪ planner; intersección con ids válidos; resultado vacío ⇒ catálogo completo). `overlay-config.json.agents` y `dispatch.config.json.roles/namePool` salen del subconjunto. `provisionDefaultBaseline` obtiene la selección de la **última `Purchase` de la firma** (`orderBy createdAt desc`); las firmas sin compra (creadas por operator/script) reciben el catálogo completo.

### D5 — UI: grid de tarjetas con checkbox, dentro del form de compra

En `/` y `/oferta/[slug]`, entre la elección de modalidad/periodo y el email: grid de tarjetas (icono + nombre + blurb corto) con `<input type="checkbox" name="agent_<id>" defaultChecked>`. Planner: `checked disabled` + `<input type="hidden">` (los disabled no se envían) y nota "Incluido siempre — coordina a tu equipo". El server action lee `agent_*` del FormData. Sin JS de estado: server components + form nativo, como el resto de la landing.

### D6 — Visualización

- `/empresa` (operator, detalle de compras): chips `icono + nombre` del equipo contratado; "Equipo completo" si array vacío.
- `/firm`: misma representación en el bloque de licencia.

## Riesgos

- **Webhook desplegado a mano**: si se olvida el redeploy, `selectedAgents` no se persiste y el pair cae al catálogo completo — degradación benigna, pero hay que incluir el redeploy en las tareas.
- **Renombres en clawcrew** (`manifest.previousIds`): los ids del catálogo deben seguir a la biblioteca del bundle. Mitigación: `agent-cli` ya resuelve renombres al instalar; la intersección defensiva del pair evita ids huérfanos.
- **Compra sin firma todavía** (webhook crea la firma en el mismo evento): el orden actual (Firm → Purchase) ya garantiza que al parear la compra existe.
