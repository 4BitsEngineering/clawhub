import Stripe from "npm:stripe@16";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  // @ts-ignore — custom API version
  apiVersion: "2026-06-24.dahlia",
});

// Service role key: bypasses RLS y puede acceder a todos los schemas
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// Todas las tablas viven en el schema 'clawhub'
// Prerrequisito: Settings → API → Extra schemas → añadir 'clawhub'
const db = supabase.schema("clawhub");

// NOTA sobre ids/updatedAt: los @default(uuid()/cuid()) y @updatedAt de Prisma
// se generan en el CLIENTE Prisma, no en la BD. Al insertar vía PostgREST hay
// que aportarlos explícitamente o el INSERT falla por NOT NULL.

Deno.serve(async (req: Request) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("[stripe-webhook] Signature error:", msg);
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    try {
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
      );
    } catch (err) {
      // El fallo se registra en logs pero respondemos 200 igualmente: si el
      // error es transitorio, Stripe reintenta; si es de datos, un 500 solo
      // provocaría reintentos en bucle. Revisar logs de la función ante fallos.
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[stripe-webhook] handler error:", msg);
    }
  }

  return new Response("ok", { status: 200 });
});

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Idempotencia: si ya existe, ignorar
  const { data: existing, error: existingErr } = await db
    .from("Purchase")
    .select("id")
    .eq("stripeSessionId", session.id)
    .maybeSingle();

  // Un error aquí casi siempre es de acceso al schema/tabla (schema clawhub no
  // expuesto en la Data API, o falta GRANT a service_role). Lo propagamos para
  // no seguir a ciegas y crear registros a medias.
  if (existingErr) {
    throw new Error(
      `select Purchase falló: ${existingErr.message} (code ${existingErr.code}). ` +
        `¿Schema 'clawhub' expuesto en Data API y con GRANT a service_role?`,
    );
  }
  if (existing) return;

  const meta = session.metadata ?? {};
  const trackingToken = (meta.trackingToken as string | undefined) || null;
  const amountCents = session.amount_total ?? 0; // total cobrado (fee año 1 + tokens)
  const currency = (session.currency ?? "eur").toUpperCase();
  const buyerEmail =
    (session.customer_details as { email?: string } | null)?.email ?? null;
  const buyerName =
    (session.customer_details as { name?: string } | null)?.name ?? null;
  const now = new Date().toISOString();

  // Desglose fee/tokens desde la metadata del checkout. feeAmountCents es la
  // BASE DE COMISIÓN (los tokens quedan siempre excluidos). Con compras del
  // flujo antiguo (sin estos campos) caemos al total como fee.
  const feeAmountCents = meta.feeAmountCents
    ? parseInt(meta.feeAmountCents as string, 10)
    : amountCents;
  const feeRenewalCents = meta.feeRenewalCents
    ? parseInt(meta.feeRenewalCents as string, 10)
    : feeAmountCents;
  const tokenBillingPeriod = (meta.tokenBillingPeriod as string | undefined) || null;
  const tokenAmountCents = meta.tokenAmountCents
    ? parseInt(meta.tokenAmountCents as string, 10)
    : null;
  // Modelo unificado (unified-pricing-token-options): BUNDLED | EXTERNAL.
  // Su presencia marca que la compra es del modelo de UNA sola suscripción
  // (la cuota ya prorratea el software) — no se crea la 2ª sub del fee.
  const tokenProvision = (meta.tokenProvision as string | undefined) || null;
  // Venta de la casa (landing raíz, sin comercial): sin comisión y excluida
  // de la atribución manual.
  const houseSale = meta.houseSale === "1";
  // Equipo elegido antes del pago (agent-selection-before-checkout): ids con
  // coma; "" o ausente = catálogo completo. Validado ya en el checkout; el
  // pair vuelve a intersectar con el catálogo por defensa.
  const selectedAgents = ((meta.selectedAgents as string | undefined) || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Suscripción de tokens creada por el checkout, y el customer para anclar la
  // segunda suscripción (renovación anual del fee).
  const tokenSubscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;
  const customerId =
    typeof session.customer === "string" ? session.customer : null;

  // ── Resolver atribución ──────────────────────────────────────────────────
  let prospectId: string | null = null;
  let salesRepId: string | null = null;

  if (trackingToken) {
    const { data: send } = await db
      .from("CampaignSend")
      .select("prospectId")
      .eq("trackingToken", trackingToken)
      .maybeSingle();

    if (send) {
      prospectId = send.prospectId;

      const { data: prospect } = await db
        .from("Prospect")
        .select("salesRepId")
        .eq("id", prospectId)
        .maybeSingle();

      salesRepId = prospect?.salesRepId ?? null;

      // Marcar visita de landing como convertida
      await db
        .from("LandingVisit")
        .update({ convertedAt: now })
        .eq("trackingToken", trackingToken)
        .is("convertedAt", null);
    }
  }

  // ── Nombre para la Firm ──────────────────────────────────────────────────
  let firmName = buyerName ?? buyerEmail ?? "Nueva empresa";
  if (prospectId) {
    const { data: p } = await db
      .from("Prospect")
      .select("name")
      .eq("id", prospectId)
      .maybeSingle();
    if (p?.name) firmName = p.name;
  }

  // ── Crear Firm ───────────────────────────────────────────────────────────
  const { data: firm, error: firmErr } = await db
    .from("Firm")
    .insert({
      id: crypto.randomUUID(),
      name: firmName,
      plan: "STARTER",
      seatsPurchased: 1,
      status: "active",
      // Sin overlayId el instalador falla en stack-manifest ("no overlay
      // publicado"). Este control plane vende AI-Office.
      overlayId: "ai-office",
      updatedAt: now,
    })
    .select("id")
    .single();

  if (firmErr || !firm) {
    throw new Error(
      `insert Firm falló: ${firmErr?.message ?? "sin fila devuelta"}` +
        (firmErr?.code ? ` (code ${firmErr.code})` : ""),
    );
  }

  // ── Crear/actualizar usuario FIRM_ADMIN ──────────────────────────────────
  // No usamos upsert: sobrescribiría el id del usuario existente y rompería FKs.
  if (buyerEmail) {
    const { data: existingUser } = await db
      .from("User")
      .select("id")
      .eq("email", buyerEmail)
      .maybeSingle();

    if (existingUser) {
      await db
        .from("User")
        .update({
          name: buyerName,
          role: "FIRM_ADMIN",
          firmId: firm.id,
          emailVerified: now,
          updatedAt: now,
        })
        .eq("id", existingUser.id);
    } else {
      await db.from("User").insert({
        id: crypto.randomUUID(),
        email: buyerEmail,
        name: buyerName,
        role: "FIRM_ADMIN",
        firmId: firm.id,
        emailVerified: now,
        updatedAt: now,
      });
    }
  }

  // ── Renovación anual del fee (SOLO modelo antiguo) ───────────────────────
  // En el modelo unificado (tokenProvision presente) hay UNA sola suscripción
  // cuya cuota ya incluye el software prorrateado — no se crea nada más.
  // El código se conserva para reintentos de eventos del flujo antiguo.
  const feeSubscriptionId = tokenProvision
    ? null
    : await createFeeRenewalSubscription({
        customerId,
        renewalCents: feeRenewalCents,
        currency: (session.currency ?? "eur").toLowerCase(),
      });

  // ── Registrar Purchase ───────────────────────────────────────────────────
  const { data: purchase, error: purchaseErr } = await db
    .from("Purchase")
    .insert({
      id: crypto.randomUUID(),
      stripeSessionId: session.id,
      stripePaymentIntent:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null,
      productType: "ANNUAL_LICENSE",
      amountCents,
      feeAmountCents,
      tokenBillingPeriod,
      tokenAmountCents,
      tokenProvision,
      houseSale,
      selectedAgents,
      stripeSubscriptionId: tokenSubscriptionId,
      stripeFeeSubscriptionId: feeSubscriptionId,
      currency,
      status: "COMPLETED",
      firmId: firm.id,
      buyerEmail,
      buyerName,
      completedAt: now,
      prospectId,
      trackingToken,
    })
    .select("id")
    .single();

  if (purchaseErr || !purchase) {
    throw new Error(
      `insert Purchase falló: ${purchaseErr?.message ?? "sin fila devuelta"}` +
        (purchaseErr?.code ? ` (code ${purchaseErr.code})` : ""),
    );
  }

  // ── Actualizar Prospect ──────────────────────────────────────────────────
  if (prospectId) {
    await db
      .from("Prospect")
      .update({ status: "PURCHASED", convertedFirmId: firm.id })
      .eq("id", prospectId);
  }

  // ── Crear Comisión ───────────────────────────────────────────────────────
  if (salesRepId) {
    const { data: rep } = await db
      .from("SalesRep")
      .select("commissionRate")
      .eq("id", salesRepId)
      .maybeSingle();

    if (rep) {
      // Comisión SOLO sobre el fee, nunca sobre el total (excluye tokens).
      await db.from("Commission").insert({
        id: crypto.randomUUID(),
        purchaseId: purchase.id,
        salesRepId,
        rate: rep.commissionRate,
        amountCents: Math.round(feeAmountCents * rep.commissionRate),
        status: "PENDING",
      });
    }
  }

  // ── Onboarding: PairingToken + email de bienvenida ───────────────────────
  // El fallo de cualquiera de los dos NO bloquea el webhook: la compra y la
  // comisión ya están registradas y la success page es la vía redundante.
  const pairingCode = await createPairingToken(firm.id);
  if (pairingCode && buyerEmail) {
    await sendWelcomeEmail({
      to: buyerEmail,
      name: buyerName,
      code: pairingCode,
    });
  }

  console.log(
    `[stripe-webhook] ✓ Compra procesada — Firm "${firmName}" (${firm.id}) · total ${amountCents / 100} ${currency}` +
      ` · fee ${feeAmountCents / 100}` +
      (tokenBillingPeriod ? ` · tokens ${tokenBillingPeriod}` : "") +
      (salesRepId ? ` · comisión para ${salesRepId}` : "") +
      (feeSubscriptionId ? ` · fee-sub ${feeSubscriptionId}` : " · SIN fee-sub") +
      (pairingCode ? ` · pairing ${pairingCode}` : " · SIN pairing token"),
  );
}

// ── Renovación anual del fee ─────────────────────────────────────────────────

// Crea la 2ª suscripción (fee anual) sobre el mismo customer, sin cobro ahora:
// trial_end a +1 año → el primer cargo ocurre en la renovación. El año 1 ya se
// pagó como line item one-time en el checkout. Idempotencia: no se crea si no
// hay customer. Fallo no bloqueante (se registra y se devuelve null).
async function createFeeRenewalSubscription(opts: {
  customerId: string | null;
  renewalCents: number;
  currency: string;
}): Promise<string | null> {
  if (!opts.customerId) {
    console.warn("[stripe-webhook] Sin customer — no se crea la sub de fee");
    return null;
  }
  if (!opts.renewalCents || opts.renewalCents <= 0) return null;

  // +1 año en segundos (evitamos new Date() por el runtime; usamos el epoch).
  const oneYear = 365 * 24 * 60 * 60;
  const trialEnd = Math.floor(Date.now() / 1000) + oneYear;

  try {
    // subscriptions.create NO acepta product_data inline (a diferencia de
    // Checkout): necesita un Price existente. Reutilizamos por lookup_key
    // (uno por importe/moneda) y lo creamos si aún no existe.
    const lookupKey = `aioffice-fee-renewal-${opts.currency}-${opts.renewalCents}`;
    let priceId: string;
    const existing = await stripe.prices.list({
      lookup_keys: [lookupKey],
      limit: 1,
    });
    if (existing.data[0]) {
      priceId = existing.data[0].id;
    } else {
      const price = await stripe.prices.create({
        currency: opts.currency,
        unit_amount: opts.renewalCents,
        recurring: { interval: "year" },
        lookup_key: lookupKey,
        product_data: { name: "AI-Office · Licencia Anual" },
      });
      priceId = price.id;
    }

    const sub = await stripe.subscriptions.create({
      customer: opts.customerId,
      items: [{ price: priceId }],
      trial_end: trialEnd,
      proration_behavior: "none",
      metadata: { kind: "fee-renewal" },
    });
    return sub.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] Error creando sub de renovación del fee:", msg);
    return null;
  }
}

// ── PairingToken ───────────────────────────────────────────────────────────

// Código de instalación de larga vida: el comprador puede abrir el email horas
// o días después. Mismo criterio que DEFAULT_PAIRING_MINUTES en
// src/app/api/v0/register/route.ts (7 días).
const PAIRING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function createPairingToken(firmId: string): Promise<string | null> {
  // code es @unique → reintento ante colisión (rarísima)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generatePairingCode();
    const { error } = await db.from("PairingToken").insert({
      id: crypto.randomUUID(),
      firmId,
      code,
      expiresAt: new Date(Date.now() + PAIRING_TTL_MS).toISOString(),
    });
    if (!error) return code;
    if (error.code === "23505") continue;
    console.error("[stripe-webhook] Error creando PairingToken:", error);
    return null;
  }
  console.error("[stripe-webhook] PairingToken: colisiones agotadas");
  return null;
}

// Réplica en Deno del formato de generatePairingCode (src/lib/tokens.ts):
// XXXX-XXXX, 8 chars, alfabeto sin 0/O/1/I/L. La Edge Function no puede
// importar código de src/ — mantener ambos en sincronía si cambia el formato.
function generatePairingCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[randomInt(alphabet.length)];
    if (i === 3) code += "-";
  }
  return code;
}

// Equivalente sin sesgo de módulo a crypto.randomInt de Node (rejection sampling)
function randomInt(max: number): number {
  const limit = Math.floor(256 / max) * max;
  const buf = new Uint8Array(1);
  let v: number;
  do {
    crypto.getRandomValues(buf);
    v = buf[0];
  } while (v >= limit);
  return v % max;
}

// ── Email de bienvenida (API REST de Resend, raw fetch sin SDK) ────────────

async function sendWelcomeEmail(opts: {
  to: string;
  name: string | null;
  code: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn(
      "[stripe-webhook] RESEND_API_KEY ausente — email de bienvenida omitido",
    );
    return;
  }

  const from =
    Deno.env.get("RESEND_FROM") ?? "AI-Office <info@iaofi.com>";
  const appUrl = Deno.env.get("APP_URL") ?? "https://ia-suite-chi.vercel.app";
  const installerUrl = `${appUrl}/api/v0/installer?pairing=${opts.code}`;
  const firstName = opts.name?.split(" ")[0] ?? null;

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
  <h1 style="font-size:22px;margin:0 0 8px">¡Bienvenido a AI-Office${firstName ? `, ${firstName}` : ""}! 🎉</h1>
  <p style="color:#555;line-height:1.6">
    Tu licencia anual está activa. Para empezar, descarga el instalador y
    usa tu código de activación cuando te lo pida.
  </p>
  <div style="text-align:center;margin:28px 0">
    <a href="${installerUrl}"
       style="display:inline-block;background:#065f46;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600">
      Descargar AI-Office
    </a>
  </div>
  <div style="background:#f6f6f4;border-radius:10px;padding:16px 20px;margin:20px 0">
    <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#888">Tu código de activación</p>
    <p style="margin:0;font-size:24px;font-weight:700;font-family:ui-monospace,Consolas,monospace;letter-spacing:.1em">${opts.code}</p>
    <p style="margin:8px 0 0;font-size:12px;color:#888">Válido durante 7 días. Si caduca, escríbenos y te enviamos uno nuevo.</p>
  </div>
  <p style="color:#555;line-height:1.6;font-size:14px">
    ¿Dudas? Responde a este email y te ayudamos con la instalación.
  </p>
  <p style="color:#aaa;font-size:12px;margin-top:32px">AI-Office · 4bits Engineering</p>
</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: "Tu acceso a AI-Office — descarga el instalador",
        html,
      }),
    });
    if (!res.ok) {
      console.error(
        `[stripe-webhook] Resend ${res.status}:`,
        await res.text(),
      );
    } else {
      console.log(`[stripe-webhook] ✓ Email de bienvenida enviado a ${opts.to}`);
    }
  } catch (err) {
    console.error("[stripe-webhook] Error enviando email de bienvenida:", err);
  }
}
