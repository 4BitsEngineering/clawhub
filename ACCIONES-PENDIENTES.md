# Estado del proyecto — Sales Suite (clawhub)

Última actualización: 2026-07-27

---

## Estado general

**Sales Suite (fases 1-6) completada e integrada.** Todas las piezas de infraestructura están desplegadas.

---

## Completado ✓

### Código (fases 1–6)
- `/empresa` — KPIs globales + tabla de comerciales + crear/invitar comerciales
- `/empresa/prospects` — lista de todos los prospects con filtros por rep y estado
- `/empresa/commissions` — gestión de comisiones (marcar pagadas / bulk)
- `/empresa/landing` — editor de landing page (upsert con defaults)
- `/sales` — panel del comercial: pipeline + añadir prospects + envío rápido por fila
- `/sales/campaigns` — gestión de campañas
- `/sales/commissions` — historial de comisiones del comercial (solo lectura)
- `/oferta/ai-office` — landing pública de venta (corregido 404 con upsert)
- Webhook Stripe migrado a Supabase Edge Function (`supabase/functions/stripe-webhook/index.ts`)

### Infraestructura (acciones tuyas — completadas)
- [x] Schema `clawhub` expuesto en Supabase API (Settings → API → Extra schemas)
- [x] Secrets añadidos a la Edge Function (`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`)
- [x] Edge Function desplegada (`supabase functions deploy stripe-webhook`)
- [x] Webhook configurado en Stripe → URL de Supabase, evento `checkout.session.completed`

### `.env.local` actual
```bash
DATABASE_URL="postgresql://postgres.sbtpydttrswiljnskrsq:...@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.sbtpydttrswiljnskrsq:...@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?schema=clawhub"

AUTH_SECRET="..."
AUTH_URL="http://localhost:3001"   # app corre en 3001 (3000 → AI-Office)
AUTH_TRUST_HOST="true"
DEV_AUTH_ENABLED="true"           # quitar en producción

NEXT_PUBLIC_APP_URL=https://clawhub-three.vercel.app

RESEND_API_KEY=re_xxxx
RESEND_FROM=AI-Office <info@4bitsengineering.com>

TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_FROM=+34911062412

STRIPE_SECRET_KEY=sk_test_xxxx    # cambiar a sk_live en producción
# STRIPE_WEBHOOK_SECRET → está en Supabase secrets, NO aquí
```

---

## Pendiente

### Antes de ir a producción
- [ ] Cambiar `STRIPE_SECRET_KEY` a `sk_live_...` (en `.env.local` y en Supabase secrets)
- [ ] Cambiar `DEV_AUTH_ENABLED` a `false` o quitar la variable
- [ ] Cambiar `AUTH_URL` a la URL de producción (no localhost)
- [ ] Verificar dominio en Resend (resend.com → Domains → Add Domain → registros DNS)
- [ ] Crear webhook de Stripe de producción apuntando a la misma URL de Supabase

### Funcionalidades que podrían añadirse después
- Dashboard de analítica de landing (visitas, conversión por comercial)
- Notificación al comercial cuando se cobra su comisión
- Exportar comisiones a CSV
- Login por email (magic link) en producción — actualmente solo dev bypass

---

## Arquitectura del webhook de Stripe

```
Stripe → checkout.session.completed
       → supabase/functions/stripe-webhook (Deno)
       → supabase.schema("clawhub")
          ├─ Purchase (idempotente por stripeSessionId)
          ├─ Firm (nueva empresa cliente)
          ├─ User (FIRM_ADMIN con el email del comprador)
          ├─ Prospect.status = PURCHASED
          └─ Commission (si hay salesRepId vinculado por trackingToken)
```

### Probar en local
```bash
# Terminal 1
npx supabase functions serve stripe-webhook --env-file .env.local

# Terminal 2
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

---

## Referencia rápida

| Proyecto | URL local | URL producción |
|---|---|---|
| clawhub | http://localhost:3001 | https://clawhub-three.vercel.app |
| AI-Office | http://localhost:3000 | — |
| Supabase | — | https://sbtpydttrswiljnskrsq.supabase.co |
| Webhook URL | localhost:54321/functions/v1/stripe-webhook | https://sbtpydttrswiljnskrsq.supabase.co/functions/v1/stripe-webhook |
