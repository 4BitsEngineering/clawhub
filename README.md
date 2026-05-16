# clawhub

> Cloud control plane para instancias de OpenClaw Copilot desplegadas en clientes.

`clawhub` es el SaaS multi-tenant que gestiona N firmas (asesorías) y M instancias de `clawgents-desktop` por firma. Es el componente comercial cerrado de la suite OpenClaw Copilot.

## Qué hace

- **Admin Console firma** — el socio/responsable de la asesoría ve sus instancias, uso, estado.
- **Admin Console operator** — vosotros véis todas las firmas, MRR agregado, salud del fleet.
- **Phone-home sink** — recibe heartbeats y telemetría de cada `clawgents-desktop` en ejecución.
- **Pairing** — registra una instancia nueva contra una firma mediante token de uso único.
- **Knowledge library publisher** (v0.5) — push de skills/SOPs firma-wide a todas las instancias.
- **License + billing engine** (v0.5) — Stripe, plans, seats, facturación.
- **Channel broker** (v1) — broker WebSocket que permite a las instancias de los workers comunicarse entre sí con permiso.
- **Auto-update channel** (v1) — release management y actualización de instancias.

## Qué NO hace

- No corre lógica de agentes (eso es `clawgents-desktop` + `autonomous-agents`).
- No expone wizard de setup inicial (eso es `openclaw-configurator`, embebido en el flujo de primer arranque del desktop).
- No accede a ficheros ni correo del worker (eso solo lo hace la instancia local en el PC).
- No procesa llamadas LLM (eso es `axet-gateway`).

## Repos relacionados

| Repo | Rol | Audiencia |
|---|---|---|
| `clawgents-desktop` (+ bridge embebido) | Appliance local del worker | Trabajador, en su PC |
| `openclaw-configurator` | Wizard de setup de UNA instancia | Worker o white-glove durante install |
| **`clawhub`** | Control plane multi-instancia | Operador (vosotros) + socio firma |
| `autonomous-agents` | Bridge runtime (corre dentro del desktop) | Desarrolladores OpenClaw |

## Status

🚧 **v0 en construcción.** Scope inicial: phone-home + Admin Console mínima en 2 semanas.

Especificación detallada en [SPEC.md](./SPEC.md).
Contexto producto en [`../PLAN-COPILOTOS-ASESORIAS.md`](../PLAN-COPILOTOS-ASESORIAS.md).

## Stack

- **Next.js 15** (App Router) — backend + UI en el mismo proyecto.
- **PostgreSQL** — persistencia de tenants, instancias, telemetría.
- **shadcn/ui** + **Tailwind** — UI.
- **NextAuth.js** con magic link — auth para operator + firma admin.
- **Prisma** (o Drizzle, TBD) — ORM.
- **Vercel** + Postgres managed (Supabase / Neon / Railway, TBD) — hosting.

## Desarrollo local

🚧 Pendiente scaffold inicial. Ver [SPEC.md § Setup](./SPEC.md#setup-local).
