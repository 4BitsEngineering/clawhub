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

Deno.serve(async (req: Request) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
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
    await handleCheckoutCompleted(
      event.data.object as Stripe.Checkout.Session,
    );
  }

  return new Response("ok", { status: 200 });
});

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Idempotencia: si ya existe, ignorar
  const { data: existing } = await db
    .from("Purchase")
    .select("id")
    .eq("stripeSessionId", session.id)
    .maybeSingle();

  if (existing) return;

  const trackingToken =
    (session.metadata?.trackingToken as string | undefined) ?? null;
  const amountCents = session.amount_total ?? 0;
  const currency = (session.currency ?? "eur").toUpperCase();
  const buyerEmail =
    (session.customer_details as { email?: string } | null)?.email ?? null;
  const buyerName =
    (session.customer_details as { name?: string } | null)?.name ?? null;

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
        .update({ convertedAt: new Date().toISOString() })
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
      name: firmName,
      plan: "STARTER",
      seatsPurchased: 1,
      status: "active",
    })
    .select("id")
    .single();

  if (firmErr || !firm) {
    console.error("[stripe-webhook] Error creando Firm:", firmErr);
    return;
  }

  // ── Crear usuario FIRM_ADMIN ─────────────────────────────────────────────
  if (buyerEmail) {
    await db.from("User").upsert(
      {
        email: buyerEmail,
        name: buyerName,
        role: "FIRM_ADMIN",
        firmId: firm.id,
        emailVerified: new Date().toISOString(),
      },
      { onConflict: "email" },
    );
  }

  // ── Registrar Purchase ───────────────────────────────────────────────────
  const { data: purchase, error: purchaseErr } = await db
    .from("Purchase")
    .insert({
      stripeSessionId: session.id,
      stripePaymentIntent:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null,
      productType: "ANNUAL_LICENSE",
      amountCents,
      currency,
      status: "COMPLETED",
      firmId: firm.id,
      buyerEmail,
      buyerName,
      completedAt: new Date().toISOString(),
      prospectId,
      trackingToken,
    })
    .select("id")
    .single();

  if (purchaseErr || !purchase) {
    console.error("[stripe-webhook] Error creando Purchase:", purchaseErr);
    return;
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
      await db.from("Commission").insert({
        purchaseId: purchase.id,
        salesRepId,
        rate: rep.commissionRate,
        amountCents: Math.round(amountCents * rep.commissionRate),
        status: "PENDING",
      });
    }
  }

  console.log(
    `[stripe-webhook] ✓ Compra procesada — Firm "${firmName}" (${firm.id}) · ${amountCents / 100} ${currency}` +
      (salesRepId ? ` · comisión para ${salesRepId}` : ""),
  );
}
