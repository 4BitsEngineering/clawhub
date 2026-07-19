# Acciones pendientes — Sales Suite

Todo lo que necesitas configurar para que el sistema funcione en producción (y en local con servicios reales). Sin estas variables todo sigue funcionando en modo silencioso: emails/SMS se loguean en consola, Stripe queda deshabilitado.

---

## 1. Variables de entorno

Añade esto en `.env.local` (local) y en tu plataforma de despliegue (Vercel, Railway, etc.):

```bash
# ── General ────────────────────────────────────────────────────────────────
# URL pública de la app — necesaria para que los links de tracking funcionen
NEXT_PUBLIC_APP_URL=https://tudominio.com

# ── Resend (email) ─────────────────────────────────────────────────────────
# https://resend.com → API Keys
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Dominio verificado en Resend
RESEND_FROM=AI-Office <noreply@tudominio.com>

# ── Twilio (SMS) ────────────────────────────────────────────────────────────
# https://console.twilio.com → Account Info
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Número de teléfono Twilio (con prefijo internacional)
TWILIO_FROM=+34900000000

# ── Stripe (pagos) ──────────────────────────────────────────────────────────
# https://dashboard.stripe.com → Developers → API keys
STRIPE_SECRET_KEY=sk_live_xxxx          # sk_test_xxxx en dev
# Ver sección 2 para obtener este valor
STRIPE_WEBHOOK_SECRET=whsec_xxxx
```

---

## 2. Stripe — webhook

### En local (desarrollo)

1. Instala el [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. En una terminal aparte, mientras corre `npm run dev`:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
3. Copia el `whsec_...` que imprime y ponlo como `STRIPE_WEBHOOK_SECRET` en `.env.local`
4. Reinicia el servidor de desarrollo

### En producción

1. En el dashboard de Stripe → **Developers → Webhooks → Add endpoint**
2. URL: `https://tudominio.com/api/stripe/webhook`
3. Evento a escuchar: `checkout.session.completed`
4. Copia el **Signing secret** (`whsec_...`) y añádelo como variable de entorno en tu plataforma

---

## 3. Resend — verificación de dominio

1. Crea cuenta en [resend.com](https://resend.com)
2. Ve a **Domains → Add Domain** y añade `tudominio.com`
3. Añade los registros DNS que te indican (SPF, DKIM, DMARC)
4. Espera la verificación (suele ser inmediata una vez añadidos los registros)
5. Copia la API key y ponla en `RESEND_API_KEY`

---

## 4. Twilio — número de teléfono

1. Crea cuenta en [twilio.com](https://twilio.com)
2. Ve a **Phone Numbers → Buy a number** y compra uno con capacidad SMS para España
3. Copia el **Account SID** y **Auth Token** del dashboard principal
4. Ponlos en `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y `TWILIO_FROM`

> Si solo quieres probar SMS en dev sin gastar, Twilio tiene un sandbox gratuito. El número de prueba no envía SMS reales pero sí registra los envíos.

---

## 5. Verificación final

Una vez configuradas las variables, comprueba:

- [ ] Los links de tracking en campañas apuntan a `NEXT_PUBLIC_APP_URL/api/t/...`
- [ ] El email de prueba llega (revisa spam la primera vez)
- [ ] El webhook de Stripe recibe el evento `checkout.session.completed` y crea la Firm + Comisión
- [ ] La landing muestra el botón "Contratar ahora" (confirma que `STRIPE_SECRET_KEY` está presente)
