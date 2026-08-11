# Tasks: default-firm-baseline

## 1. Fuente del contenido por defecto

- [x] 1.1 Crear `src/lib/default-baseline.ts`: exporta `defaultBaselineFiles()` → array `{ path, category, content, sha256, sizeBytes, isBinary }` con `openclaw.json` (`OPENCLAW_CONFIG`) tomado tal cual de `openspec/revisar/openclaw.template.json` (MiniMax/Ollama, placeholders de secretos intactos). Calcular `sha256`/`sizeBytes` desde el content. (OpenRouter = iteración futura)
- [x] 1.2 Constante de `label`/`description` del baseline por defecto (p. ej. "Config AI-Office por defecto")

## 2. Provisión en el pairing

- [x] 2.1 En `src/app/api/v0/pair/route.ts`, tras resolver la firma y antes de devolver `promoted_baseline_id`: si `firmBaseline.findFirst({ firmId, isPromoted: true })` es null, crear el baseline por defecto
- [x] 2.2 Replicar el patrón de `/api/v0/register`: versión `max+1`, desmarcar promovido anterior, crear `FirmBaseline` (`isPromoted: true`, `createdBy/promotedBy: "system-default"`) + `FirmBaselineFile[]` en transacción; retry ante colisión `@@unique([firmId, version])`
- [x] 2.3 Envolver en try/catch: si falla, log y continuar con `promoted_baseline_id: null` (no romper el pairing)
- [x] 2.4 Devolver el id del baseline recién creado como `promoted_baseline_id`

## 3. Verificación

- [x] 3.1 Typecheck (`npx tsc --noEmit`) en verde
- [x] 3.2 Prueba: firma de compra sin baseline → `POST /api/v0/pair` con su código → respuesta con `promoted_baseline_id` no nulo; `GET /api/v0/baselines/[id]` devuelve el `openclaw.json`
- [x] 3.3 Prueba de prioridad: firma con baseline del configurator → pair devuelve ése, no crea el por defecto
- [x] 3.4 Prueba de idempotencia: segundo pair de la misma firma no crea un segundo baseline por defecto
- [ ] 3.5 Prueba end-to-end real con el instalador: parear con el código de una compra y verificar que (a) ya no da "no tiene un paquete (baseline)", (b) provisiona el `openclaw.json`, y (c) **el AI-Office arranca operativo y responde a un chat** (si no resolviera la clave de IA, es fallo del instalador/bridge, no del baseline)

## 4. Documentación

- [x] 4.1 Actualizar `openspec/funionales.md`: nota de que la compra deja la firma lista para instalar con un baseline por defecto (el configurator/firm_admin lo sobrescriben)
