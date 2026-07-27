# Acciones pendientes — Sales Suite

Todo lo que necesitas configurar para que el sistema funcione en producción. Sin estas variables todo sigue funcionando en modo silencioso: emails/SMS se loguean en consola, Stripe queda deshabilitado.

---

## 1. Variables de entorno en `.env.local`

```bash
# URL pública de la app — necesaria para links de tracking
NEXT_PUBLIC_APP_URL=https://tudominio.com

# Resend (email) — resend.com → API Keys
RESEND_API_KEY=re_xxxx
RESEND_FROM=AI-Office <noreply@tudominio.com>

# Twilio (SMS) — console.twilio.com
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_FROM=+34900000000

# Stripe (solo para activar el checkout en la landing)
STRIPE_SECRET_KEY=sk_live_xxxx   # sk_test_xxxx en dev
```

> `STRIPE_WEBHOOK_SECRET` ya NO va aquí — el webhook vive en Supabase (ver sección 2).

---

## 2. Stripe — webhook en Supabase Edge Function

El webhook está en `supabase/functions/stripe-webhook/index.ts`.
Su URL pública es siempre:
```
https://sbtpydttrswiljnskrsq.supabase.co/functions/v1/stripe-webhook
```

### Paso A — Exponer el schema `clawhub` en Supabase

Supabase Dashboard → **Settings → API → Extra schemas** → añadir `clawhub` → Guardar.

### Paso B — Añadir secrets a la Edge Function

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxx
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxx
```

### Paso C — Desplegar la función

```bash
npx supabase functions deploy stripe-webhook --project-ref sbtpydttrswiljnskrsq
```

### Paso D — Configurar en Stripe

Dashboard de Stripe → **Developers → Webhooks → Add endpoint**
- URL: `https://sbtpydttrswiljnskrsq.supabase.co/functions/v1/stripe-webhook`
- Evento: `checkout.session.completed`
- Copia el **Signing secret** (`whsec_...`) y úsalo en el paso B.

### Para probar en local

```bash
npx supabase functions serve stripe-webhook --env-file .env.local
```
Y en otra terminal:
```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

---

## 3. Resend — verificar dominio

1. resend.com → Domains → Add Domain → añade `tudominio.com`
2. Añade registros DNS (SPF, DKIM, DMARC) en tu proveedor
3. Copia la API key → `RESEND_API_KEY` en `.env.local`

---

## 4. Twilio — número de teléfono

1. twilio.com → Phone Numbers → Buy a number (con SMS para España)
2. Copia Account SID + Auth Token del dashboard

---

## 5. Verificación final

- [ ] Schema `clawhub` expuesto en Supabase API settings
- [ ] Edge Function desplegada (`supabase functions deploy`)
- [ ] Webhook apunta a la URL de Supabase en el dashboard de Stripe
- [ ] `STRIPE_SECRET_KEY` en `.env.local` (activa el checkout en la landing)
- [ ] Links de tracking apuntan a `NEXT_PUBLIC_APP_URL/api/t/...`
- [ ] Email de prueba llega correctamente
