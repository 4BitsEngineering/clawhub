# Tasks: agent-selection-before-checkout

## 1. Catálogo compartido

- [ ] 1.1 Extraer `DEFAULT_TEAM` de `src/lib/default-baseline.ts` a `src/lib/agent-catalog.ts` (`AGENT_CATALOG`, `MANDATORY_AGENTS = ["planner"]`, helper `sanitizeSelection(ids: string[]): string[]` — intersección con catálogo ∪ planner; vacío ⇒ [])
- [ ] 1.2 `default-baseline.ts` importa del catálogo; `defaultBaselineFiles(firmName, selectedAgents?)` filtra agentes de `overlay-config.json` y roles/namePool de `dispatch.config.json`

## 2. Modelo de datos (aditivo)

- [ ] 2.1 `Purchase.selectedAgents String[] @default([])` en `prisma/schema.prisma`
- [ ] 2.2 `npx prisma db push` + `npx prisma generate` + reiniciar dev server

## 3. Checkout

- [ ] 3.1 `createUnifiedCheckout({ ..., selectedAgents?: string[] })`: sanitizar y añadir `selectedAgents: ids.join(",")` a metadata solo si la selección es un subconjunto propio (≠ catálogo completo)
- [ ] 3.2 Server actions de `/` y `/oferta/[slug]`: leer checkboxes `agent_<id>` del FormData y pasar la selección

## 4. Landings

- [ ] 4.1 `/` (raíz): grid de tarjetas de agentes con checkbox (todos marcados; planner bloqueado con hidden input) dentro del form de compra, estilos AI-Office (banda coherente con el resto)
- [ ] 4.2 `/oferta/[slug]`: mismo bloque
- [ ] 4.3 Nota de precio: "El precio no cambia por el número de especialistas"

## 5. Webhook (Deno)

- [ ] 5.1 Leer `selectedAgents` de la metadata y persistir en `Purchase` (split por coma; ausente ⇒ `[]`)
- [ ] 5.2 Redeploy: `npx supabase functions deploy stripe-webhook --project-ref sbtpydttrswiljnskrsq` (pedir confirmación al usuario)

## 6. Pair / baseline

- [ ] 6.1 `provisionDefaultBaseline(firmId, firmName)`: consultar última `Purchase` de la firma y pasar `selectedAgents` a `defaultBaselineFiles`

## 7. Visualización

- [ ] 7.1 `/empresa` detalle de compras: chips del equipo contratado ("Equipo completo" si vacío)
- [ ] 7.2 `/firm`: equipo contratado en el bloque de licencia

## 8. Verificación

- [ ] 8.1 `npx tsc --noEmit` + render-test de `/` y `/oferta` (checkboxes presentes, planner bloqueado)
- [ ] 8.2 Test de ciclo: compra con selección reducida → webhook persiste → pair genera baseline con N agentes (verificar `overlay-config.json` del paquete)
- [ ] 8.3 Compra sin tocar selección → baseline con catálogo completo
