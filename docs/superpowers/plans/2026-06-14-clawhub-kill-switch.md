# clawhub kill-switch — suspender/reactivar instancias por suscripción (Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o executing-plans. Steps con checkbox.

**Goal:** clawhub puede **suspender** (cortar) y **reactivar** una instancia instalada por estado de suscripción; la instancia entra en "modo suspendido real" (el bridge rechaza tareas) y vuelve al reactivar. Monitor + corte, probable contra el stack vivo (ai-office) usando la Supabase configurada.

**Architecture:** clawhub gana `Firm.status`; el heartbeat (que la instancia ya envía cada 60s) devuelve `firm_status`; el cliente dispatcher traduce eso a `/api/admin/suspend|resume` del bridge; el bridge guarda un flag de suspensión y **gatea** la creación de tareas/chat. Reutiliza todo lo existente (pairing, heartbeat, command auth, admin endpoints).

**Tech Stack:** clawhub = Next.js 16 + Prisma 7 + PostgreSQL (Supabase). bridge = Node CJS (`bridge/lib/routes/*`). cliente = `clawhub/clients/shared/dispatcher.js`.

**Constraints:** El BUILD no toca la BD (schema change = código; la migración se aplica en el test). Ramas: clawhub `feat/kill-switch`, autonomous-agents `feat/instance-suspend`. eqeqeq en el bridge. NO mergear hasta validar.

---

## Task 1 — clawhub: Firm.status + heartbeat devuelve firm_status (schema + ruta)
**Files:** `prisma/schema.prisma`; `src/app/api/v0/heartbeat/route.ts`; (migración se crea en el test, no aquí).

- [ ] Step 1: En `prisma/schema.prisma`, en `model Firm`, añadir:
```prisma
  status          String    @default("active")  // active | suspended
  suspendedAt     DateTime?
  suspendedReason String?
```
- [ ] Step 2: `npx prisma generate` (genera el client; NO migrate — no tocar la BD).
- [ ] Step 3: En `src/app/api/v0/heartbeat/route.ts`, tras validar el token y cargar la instancia, cargar la firma y AÑADIR `firm_status` a la respuesta JSON. Si `firm.status !== 'active'`, devolver `commands: []` (no despachar comandos a una firma suspendida) y `firm_status: firm.status`, `suspended_reason: firm.suspendedReason`. Mantener HTTP 200 (no romper el loop de heartbeat → seguimos monitorizando la instancia aunque esté suspendida). Ejemplo del shape de respuesta: `{ ok:true, next_heartbeat_in_s:60, firm_status:'active'|'suspended', suspended_reason?:string, commands:[...] }`.
- [ ] Step 4: tsc/lint del repo (`npm run lint`) y commit en rama `feat/kill-switch`.

## Task 2 — clawhub: endpoint operador suspend/resume
**Files:** `src/app/api/operator/firms/[id]/route.ts` (o el patrón de rutas operador existente — leer cómo se autentica el operator y cómo se registra Activity).

- [ ] Step 1: Añadir `POST .../suspend` (body `{reason}`) → `firm.status='suspended'`, `suspendedAt=now`, `suspendedReason=reason`; y `POST .../resume` → `status='active'`, limpia suspendedAt/Reason. Auth: sesión operator (mismo guard que otras rutas operator). Registrar Activity (`firm.suspended`/`firm.resumed`).
- [ ] Step 2: lint + commit.

## Task 3 — bridge: estado suspendido + endpoints + gate
**Files:** `autonomous-agents/work-console/bridge/lib/routes/admin.js`; `bridge/lib/routes/tasks.js`; `bridge/lib/routes/chat.js`; `bridge/lib/routes/health.js`. Rama `feat/instance-suspend`.

- [ ] Step 1: Estado de suspensión persistente: un fichero flag (p.ej. `<BRIDGE_DATA_DIR>/.suspended` con `{reason, at}`), helpers `isSuspended()`/`setSuspended(reason)`/`clearSuspended()` en un módulo `bridge/lib/suspension.js`. Persistente para sobrevivir reinicios.
- [ ] Step 2: En `admin.js`, añadir `POST /api/admin/suspend` (body `{reason}`) y `POST /api/admin/resume`, auth igual que restart (Bearer instance_token / el guard que use admin.js). suspend→setSuspended, resume→clearSuspended. Idempotentes.
- [ ] Step 3: GATE en `tasks.js` (creación de tarea, `POST /api/tasks`) y `chat.js` (`POST /api/chat/send`): si `isSuspended()` → responder 402 `{error:'subscription_suspended', message:'Servicio suspendido — contacta con tu proveedor para reactivar la suscripción.', reason}` ANTES de despachar. eqeqeq.
- [ ] Step 4: En `health.js`, añadir `suspended: isSuspended()` (+reason) a la respuesta para que la web pueda mostrar un banner.
- [ ] Step 5: smoke `scripts/smoke-suspension.js`: suspend→/api/tasks 402; resume→/api/tasks ya no 402 (mockear lo mínimo, estilo smoke-slack-config). lint + commit.

## Task 4 — cliente dispatcher: traducir firm_status a suspend/resume del bridge
**Files:** `clawhub/clients/shared/dispatcher.js`.

- [ ] Step 1: En el loop de heartbeat, leer `firm_status` de la respuesta. Si `'suspended'` y la instancia no está ya suspendida → `POST {bridgeUrl}/api/admin/suspend` (Bearer instanceToken, `x-confirm-destructive` si admin lo exige). Si `'active'` y estaba suspendida → `POST .../resume`. Mantener estado local para no repetir. Log claro.
- [ ] Step 2: commit (rama de clawhub; el cliente vive en clawhub repo).

## Task 5 — Test E2E contra el stack vivo (Supabase) — PASO CONTROLADO (con JJ)
**Prerrequisitos / cuidado:** aplica la migración a la Supabase real.

- [ ] Step 1: `npx prisma migrate dev --name add_firm_status` (aplica la columna a Supabase; aditiva). Verificar en el panel.
- [ ] Step 2: Levantar clawhub en local en un puerto libre (NO :3000, ocupado por ai-office web): `PORT=3010 npm run dev` (o `next dev -p 3010`).
- [ ] Step 3: Crear/seed una firma + instancia para la ai-office viva (vía seed o insert directo Prisma) y obtener `instance_token`. (Pairing por UI requiere navegador — alternativa: insertar Instance + token hasheado por script.)
- [ ] Step 4: Simular el heartbeat de la ai-office (curl POST `:3010/api/v0/heartbeat` con el token) → confirmar `firm_status:'active'` y que la instancia aparece monitorizada (GET instances / Activity).
- [ ] Step 5: Suspender la firma (`POST /api/operator/firms/<id>/suspend`) → el siguiente heartbeat devuelve `firm_status:'suspended'`; correr el dispatcher (o simular) para que llame a `/api/admin/suspend` del bridge :3700 → `POST :3700/api/tasks` debe dar **402 subscription_suspended**. Reactivar → /api/tasks vuelve a funcionar.
- [ ] Step 6: Limpiar filas de test si procede; documentar resultado.

## Self-Review
- Cobertura: status+heartbeat (T1), suspend/resume operador (T2), corte real en el bridge (T3), traducción cliente (T4), E2E (T5). 
- El corte es "modo suspendido real" (gate en tasks/chat), reversible, no mata procesos (decisión JJ).
- Riesgo: migración sobre Supabase real (aditiva). El build no toca BD; solo T5.
- eqeqeq en bridge; auth de admin reutilizada; idempotencia en suspend/resume.
