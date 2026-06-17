# Flujo unificado: configurator → clawhub → instalador → máquina

Estado: **diseño** (rama `feat/configurator-install-flow`, sobre `feat/kill-switch`).
Decisiones (17-jun): **reactivar + terminar huecos** (NO rehacer clawhub) · **clawhub
es la autoridad de licencia** (smartbotics se retira o solo registra la venta).

## Por qué NO se rehace
clawhub ya modela todo el flujo. Mapa concepto → tabla/endpoint EXISTENTE:

| Concepto | Tabla | Endpoint |
|---|---|---|
| Licencia / cliente | `Firm` (plan, `status` active/suspended) | `operator/firms/*`, suspend/resume |
| Código de instalación | `PairingToken.code` | `v0/pair` |
| Máquina + heartbeat | `Instance` (`os`, lastHeartbeat) | `v0/heartbeat` |
| Paquete (config+agentes) | `FirmBaseline` + `FirmBaselineFile` | `v0/baselines`, `v0/baselines/[id]` |
| Instalador `.exe` | `StackBundle` kind=`INSTALLER` | `v0/installer`, `v0/bundles/register` |
| Equipo de agentes | `AgentCatalogEntry`+`FirmAgentInstall`+`OfficeTemplate` | `v0/agents`, `v0/office-templates` |
| Kill-switch | `InstanceCommand` + `Firm.status` | suspend/resume |
| Uso/billing | `UsageRecord` | `v0/usage` |

## Flujo objetivo
1. **Configurator (web/Vercel)** — el cliente hace el wizard (provider/canales/agentes…)
   y en el step **Registro**: se identifica (licencia clawhub) → clawhub valida que la
   `Firm` existe y está `active` → crea una `Instance` pendiente + emite un
   `PairingToken.code` → guarda el **paquete** del wizard como `FirmBaseline` de esa
   firma → muestra el **código** + botón **descargar instalador** (`StackBundle` INSTALLER).
2. **Instalador (.exe)** — el cliente lo ejecuta, introduce/lleva el `code` → `v0/pair`
   crea/liga la `Instance`, **registra la MAC** (gap) → baja su `FirmBaseline` y lo
   provisiona (`setup-from-config.ps1` / `provision_from_package`) → arranca.
3. **Operación** — heartbeat + kill-switch (suspend/resume) + usage, ya existentes.

## Huecos a cerrar (pequeños, sobre lo existente)
1. **MAC en `Instance`** — añadir campo `mac`/`deviceId` y capturarlo en `v0/pair`
   (verificar qué identidad de dispositivo recoge hoy `pair`; `os` ya existe).
2. **Registro desde el configurator** — endpoint para que el configurator (app aparte
   en Vercel) cree `Firm`(si toca)/`Instance` + emita `code` + suba el paquete como
   `FirmBaseline`. Auth máquina-a-máquina (API key de operador/servicio), NO la sesión
   de navegador. Reusar `v0/baselines` para subir el paquete.
3. **Servir el paquete por `code`** — el instalador, tras `pair`, baja su `FirmBaseline`
   (o un `StackBundle`) y lo extrae a `configurator-package`. Verificar si `v0/pair` o
   `v0/baselines` ya devuelve el baseline promovido; si no, añadir.
4. **clawhub = autoridad** — el registro valida contra `Firm` (existe + active), NO
   contra smartbotics. smartbotics → retirar del instalador o dejar que solo CREE la
   `Firm` (alta de venta). El `validate_license` del instalador apuntaría a clawhub.
5. **Mapear el paquete del configurator → `FirmBaseline`** — `base/openclaw.json` =
   category OPENCLAW_CONFIG; workspaces = WORKSPACE; (el overlay-config se traduce a la
   selección `FirmAgentInstall` o se guarda como OTHER). Definir el mapeo exacto.

## Bloqueante inmediato
**Supabase `pjjixcylawrqimtdzjzy` está PAUSADO** → sin BD no se puede correr ni probar
clawhub. Acción del operador: restaurar/redeploy el proyecto Supabase (o crear uno y
re-apuntar `DATABASE_URL`). Hasta entonces solo se puede diseñar/escribir código, no
validar.

Caveat: clawhub usa **Next.js bleeding-edge + Prisma 7** (ver `AGENTS.md`: leer
`node_modules/next/dist/docs/` antes de tocar). Migraciones aditivas (no destructivas).

## Plan
0. **Reactivar Supabase** (operador). Mergear `feat/kill-switch` → main cuando esté ok.
1. Migración aditiva: `Instance.mac` (+ índice). Capturar en `v0/pair`.
2. Endpoint registro M2M para el configurator (crea instancia + code + sube baseline).
3. Configurator: reactivar step **Registro** → llama a clawhub → muestra code + descarga.
4. Instalador: `pair(code)` + baja baseline + `provision_from_package` + liga MAC.
5. Retirar smartbotics del instalador (o reducir a alta de Firm).
