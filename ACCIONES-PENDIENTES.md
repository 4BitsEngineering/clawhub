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
- [x] Schema `clawhub` **expuesto en Data API** (Settings → API → Data API → Exposed schemas → marcar `clawhub`). ⚠️ Sin esto la Edge Function respondía 200 pero no escribía nada.
- [x] **GRANT a `service_role`** sobre el schema `clawhub` (ver SQL abajo). Prisma crea el schema con el rol `postgres` y Supabase no da permisos automáticos a `service_role` sobre schemas custom.
- [x] Secrets añadidos a la Edge Function (`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `RESEND_API_KEY` + `RESEND_FROM` + `APP_URL`)
- [x] Edge Function desplegada (`supabase functions deploy stripe-webhook`)
- [x] Webhook configurado en Stripe → URL de Supabase, evento `checkout.session.completed`
- [x] **Flujo de compra verificado end-to-end** (2026-08-08): pago → Purchase + Firm + usuario FIRM_ADMIN + licencia (PairingToken) + email de bienvenida + success page con código y descarga. ✅

### SQL de permisos para `service_role` (ejecutado en SQL Editor)

Necesario tras cada migración que cree tablas nuevas en `clawhub` (o dejar el
toggle "Automatically expose new tables" activado + estos default privileges):

```sql
GRANT USAGE ON SCHEMA clawhub TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA clawhub TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA clawhub TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA clawhub GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA clawhub GRANT ALL ON SEQUENCES TO service_role;
```

### `.env.local` actual
```bash
DATABASE_URL="postgresql://postgres.sbtpydttrswiljnskrsq:...@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.sbtpydttrswiljnskrsq:...@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?schema=clawhub"

AUTH_SECRET="..."
AUTH_URL="http://localhost:3001"   # app corre en 3001 (3000 → AI-Office)
AUTH_TRUST_HOST="true"
DEV_AUTH_ENABLED="true"           # quitar en producción

NEXT_PUBLIC_APP_URL=https://ia-suite-chi.vercel.app

RESEND_API_KEY=re_xxxx
RESEND_FROM=AI-Office <info@iaofi.com>

TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_FROM=+34911062412

STRIPE_SECRET_KEY=sk_test_xxxx    # cambiar a sk_live en producción
# STRIPE_WEBHOOK_SECRET → está en Supabase secrets, NO aquí
```

---

## Pendiente

### Redeploy del webhook — change `checkout-fee-and-token-subscription`
El webhook se amplió (comisión sobre el fee, creación de la suscripción de renovación del fee, registro de periodo/importe de tokens). **Requiere redeploy** para que las compras nuevas del modelo fee+tokens se procesen bien:
```bash
npx supabase functions deploy stripe-webhook --project-ref sbtpydttrswiljnskrsq
```
- La migración de BD (columnas nuevas en `LandingPage` y `Purchase`) **ya está aplicada** (`prisma db push`), y el GRANT a `service_role` sobre las tablas ya cubre las columnas nuevas.
- Prueba de test tras el redeploy: comprar en la landing eligiendo un periodo de tokens → verificar en Stripe la factura inicial (fee + tokens), la suscripción de tokens activa y la de renovación del fee en `trialing` (sin cobro), y en la BD que la comisión = rate × fee (sin tokens).

### Stripe Billing Portal — change `firm-client-portal`
El portal del cliente (`/firm`) enlaza al Billing Portal de Stripe (facturas + gestión de suscripciones). **Requiere configurarlo una vez**: dashboard de Stripe → Settings → **Billing → Customer portal** → revisar opciones (permitir cancelar suscripción, ver historial de facturas) → **Save**. Sin esto, el botón "Gestionar facturación" dará error (la tarjeta muestra aviso de contactar soporte).

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
| clawhub | http://localhost:3001 | https://ia-suite-chi.vercel.app |
| AI-Office | http://localhost:3000 | — |
| Supabase | — | https://sbtpydttrswiljnskrsq.supabase.co |
| Webhook URL | localhost:54321/functions/v1/stripe-webhook | https://sbtpydttrswiljnskrsq.supabase.co/functions/v1/stripe-webhook |
