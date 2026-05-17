# clawhub

> Control plane multi-tenant para flotas de copilotos IA on-prem.

clawhub es el panel cloud que gestiona N firmas (asesorías, despachos, PYMES)
y M instancias de OpenClaw Copilot desplegadas en los PCs de cada firma. Los
datos sensibles del trabajador (correo, conversaciones, memoria del agente)
NUNCA salen del PC. clawhub solo orquesta: pairing, comandos remotos,
distribución de software, telemetría agregada.

## Para quién

- **Operator (tú, el proveedor)**: registra firmas, publica versiones del
  stack, monitoriza alertas, audita actividad global.
- **Firm admin (tu cliente)**: da de alta a sus trabajadores (PCs), ve
  consumo agregado, gestiona usuarios, encola comandos remotos como
  "reload skills" o "reset to baseline".
- **Trabajador**: descarga el `.exe`, mete su pairing code una vez, y
  trabaja localmente con sus copilotos sin más fricción.

## Arquitectura on-prem

```
┌───────────────────────────────┐         ┌─────────────────────────────┐
│  clawhub (Vercel + Supabase)  │         │      PC del trabajador      │
│                               │ ◄─ HTTPS┤                             │
│  - Multi-tenant DB            │  outbound│  clawgents-desktop (.exe)   │
│  - Stack manifest per firm    │  only   │   ├─ OpenClaw runtime       │
│  - Command queue              │ ────────► ├─ Bridge (autonomous-agents)│
│  - Bundle registry            │         │   ├─ Overlay (asesoria…)   │
│  - Audit log                  │         │   └─ Datos LOCALES          │
└───────────────────────────────┘         └─────────────────────────────┘
```

- El PC del trabajador **solo hace HTTPS saliente** al control plane.
- No abre puertos entrantes, no necesita VPN, no expone credenciales.
- Los bundles del software se descargan desde clawhub (vía manifest pinneado
  por firma) tras el primer pairing.

## Stack técnico

- **Next.js 16** + App Router + Turbopack
- **Prisma 7** + `prisma-client` + `@prisma/adapter-pg`
- **PostgreSQL** (Supabase, eu-central-1 Frankfurt)
- **NextAuth v5** (dev login activo; Resend/SES pendiente)
- **shadcn/ui** + **Tailwind v4**
- Despliegue: **Vercel**

## Capacidades actuales

### Para Firm admin (`/firm`)

- ✅ Alta de trabajador con pairing code de un solo uso (8 chars)
- ✅ Descarga del installer desde un link estable (`/api/v0/installer`)
- ✅ Quota enforcement (no se pueden parear más PCs que `seatsPurchased`)
- ✅ Listado de instancias online/offline con último heartbeat
- ✅ Panel por instancia: stack local, uso 24h, comandos remotos, versiones,
  baselines, heartbeats
- ✅ Dashboard de consumo (`/firm/usage`): tokens y coste agregados por
  rango temporal, top agentes y PCs
- ✅ Gestión de usuarios (`/firm/users`): invitar otros firm_admins
- ✅ Ajustes (`/firm/settings`): nombre de firma, plan, link a soporte
- ✅ Timeline de actividad: quién hizo qué cuándo

### Para Operator (`/operator`)

- ✅ Lista de firmas con counters
- ✅ Mass actions (`/operator/mass-actions`): encolar comando seguro a N
  instancias filtradas
- ✅ Audit global (`/operator/activity`) con filtros (firma, kind,
  instancia)
- ✅ Stack versions (`/operator/stack`): bundles + pinneo per-firma
- ✅ Detalle de firma con Skills, Usuarios, Edit
- ✅ Alertas en home: PCs offline >24h detectados por cron diario

### Comandos remotos disponibles

11 kinds, todos con auth Bearer instance_token, idempotency garantizada:

| Kind                | Qué hace                                             |
| ------------------- | ---------------------------------------------------- |
| `ping`              | round-trip básico                                    |
| `reload_skills`     | re-escanea directorio skills y recarga registry      |
| `fetch_logs`        | descarga últimas N líneas del log del bridge         |
| `clear_cache`       | re-sincroniza caches del bridge                      |
| `snapshot_config`   | pide openclaw.json redactado (sin tokens)            |
| `snapshot_to_baseline` ⭐ | sube snapshot completo como nuevo baseline      |
| `reset_to_baseline` ⭐ | restaura overlay a un baseline (preserva MEMORY.md) |
| `push_config_patch` | edita openclaw.json (allowlist 8 paths)              |
| `restart_bridge`    | mata bridge (requiere supervisor)                    |
| `restart_gateway`   | mata gateway (requiere supervisor)                   |
| `apply_stack_update`| descarga + activa versiones nuevas del manifest      |

### Token attribution

El bridge persiste cada turno de agente en `trace_spans` con datos
autoritativos del proveedor (tokens in/out/cache, coste $, modelo). El agent
los sube periódicamente a `/api/v0/usage`. Idempotente por `spanId`.

### Distribución del software

clawhub funciona como package manager de su propio stack:

1. **Publica bundles** vía `scripts/release-bundle.ts` o auto-CI
   (`scripts/ci-templates/`)
2. **Pinea versiones** por firma vía `/operator/stack`
3. **El cliente bootstrappea**: en primer arranque tras pairing,
   `clawhub-client` descarga manifest, baja los bundles que falten, verifica
   sha256, los descomprime, y los runners (gateway, bridge) los usan
4. **Auto-update**: heartbeat reporta versiones running. Si diff vs manifest
   y `stackAutoUpdate=true`, encola `apply_stack_update`

## Setup local

```bash
git clone <repo>
cd clawhub
npm install

# Configurar Supabase
cp .env.example .env.local
# Editar .env.local: DATABASE_URL, DIRECT_URL, DEV_AUTH_ENABLED=true

# Migraciones
npx prisma migrate dev
npx prisma generate

# Seed (crea operator + firma demo + dev user)
npx tsx scripts/seed.ts

# Dev server
npm run dev
# → http://localhost:3000
```

Login dev: `operator@clawhub.local` o el email del firm_admin del seed.
Cookie `clawhub-dev-user` se setea automáticamente desde el dropdown de
login.

## Despliegue a producción

### Variables de entorno requeridas

```bash
DATABASE_URL=postgresql://...        # pooler de Supabase
DIRECT_URL=postgresql://...          # conexión directa (para migrations)
AUTH_SECRET=<openssl rand -base64 32>
NEXT_PUBLIC_APP_URL=https://clawhub.tuempresa.com

# CI/CD auto-bundle (opcional)
OPERATOR_API_KEY=<openssl rand -hex 32>

# Cron offline-sweep (Vercel lo envía automáticamente si está en vercel.json)
CRON_SECRET=<openssl rand -hex 32>

# Soporte (opcional, default soporte@clawhub.es)
NEXT_PUBLIC_SUPPORT_EMAIL=soporte@tuempresa.com
NEXT_PUBLIC_OPERATOR_ORG=Tu Empresa S.L.

# Cuando llegue auth real
DEV_AUTH_ENABLED=  # vacío en prod
RESEND_API_KEY=    # cuando se active magic link
```

### Vercel

```bash
vercel link
vercel env pull .env.local

# Por defecto vercel.json ya define:
# - Cron diario /api/cron/sweep-offline (9:00 UTC)
```

### Migraciones en prod

```bash
DIRECT_URL=$PROD_DIRECT_URL npx prisma migrate deploy
```

## CI/CD: auto-publicar bundles desde tus repos

Plantillas listas en `scripts/ci-templates/`:

- `release-overlay.yml` — overlays (asesoria, ai-office, content, …)
- `release-bridge.yml` — autonomous-agents
- `release-openclaw.yml` — tu fork de openclaw
- `release-installer.yml` — clawgents-desktop (Windows `.exe`)

Cada workflow se dispara al pushear un tag `v*` y registra el bundle
automáticamente vía `POST /api/v0/bundles/register`. Ver
`scripts/ci-templates/README.md` para detalles.

## Estructura del repo

```
clawhub/
├── prisma/
│   ├── schema.prisma        # Firm, Instance, InstanceCommand, Baselines,
│   │                        # UsageRecord, StackBundle, Activity, Invitation
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/                # NextAuth handlers
│   │   │   ├── cron/sweep-offline/  # diario, detecta PCs offline >24h
│   │   │   ├── invitations/         # crear/aceptar invites
│   │   │   └── v0/
│   │   │       ├── pair/            # pairing
│   │   │       ├── heartbeat/       # status report + dispatch comandos
│   │   │       ├── commands/[id]/result/  # agent reporta resultado
│   │   │       ├── baselines/       # snapshot upload + apply
│   │   │       ├── usage/           # token attribution
│   │   │       ├── skills/          # SOPs firma-wide
│   │   │       ├── stack-manifest/  # qué versiones corre la firma
│   │   │       ├── installer/       # 302 redirect al .exe
│   │   │       └── bundles/register/# auto-registro CI/CD
│   │   ├── firm/                    # admin firma
│   │   ├── operator/                # admin sistema
│   │   ├── invite/[token]/          # aceptar invitación
│   │   └── legal/{privacy,terms}/   # política y términos
│   ├── lib/
│   │   ├── activity.ts              # audit log helper
│   │   ├── baseline-diff.ts         # diff entre baselines
│   │   ├── commands.ts              # catálogo + MASS_ACTION_KINDS
│   │   └── ...
│   ├── components/
│   │   └── activity-timeline.tsx
│   └── generated/prisma/            # Prisma Client
├── clients/
│   ├── headless/                    # agent CLI standalone
│   └── shared/                      # dispatcher + usage-sync + stack-bootstrap
└── scripts/
    ├── release-bundle.ts            # registrar bundle manual
    ├── release-installer.ts
    ├── pin-firm-stack.ts            # pinear versiones a una firma
    ├── seed.ts
    └── ci-templates/                # workflows para auto-publicar
```

## Repos relacionados

| Repo                     | Rol                                  |
| ------------------------ | ------------------------------------ |
| **clawhub**              | Control plane multi-tenant (este)    |
| `clawgents-desktop`      | Installer Electron + tray runtime    |
| `autonomous-agents`      | Bridge runtime + work-console        |
| `openclaw` (fork)        | Runtime gateway + CLI                |
| Overlays (`asesoria`, …) | Configuración + agentes por vertical |

## Estado del producto

✅ **MVP completo y vendible** (mayo 2026). Capacidades distribuidas en 5
fases ya implementadas: command queue, baselines con secrets redact,
token attribution real, stack manifest + bundles, bootstrap desktop +
auto-update, build slim sin firma, UI alta de trabajador completa.

Para detalle por fases y roadmap futuro ver
[PLAN-COPILOTOS-ASESORIAS.md](../PLAN-COPILOTOS-ASESORIAS.md).

## Licencia

Privado. © clawhub. Todos los derechos reservados.
