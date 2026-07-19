import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!stripe) {
    return new Response("Stripe not configured", { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("STRIPE_WEBHOOK_SECRET not set", { status: 503 });
  }

  const payload = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe webhook] Signature verification failed:", msg);
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    await handleCheckoutCompleted(
      event.data.object as Stripe.Checkout.Session,
    );
  }

  return new Response("ok", { status: 200 });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Idempotency: skip if already processed
  const existing = await db.purchase.findUnique({
    where: { stripeSessionId: session.id },
  });
  if (existing) return;

  const trackingToken =
    (session.metadata?.trackingToken as string | undefined) ?? null;
  const amountCents = session.amount_total ?? 0;
  const currency = (session.currency ?? "eur").toUpperCase();
  const buyerEmail =
    (session.customer_details as { email?: string } | null)?.email ?? null;
  const buyerName =
    (session.customer_details as { name?: string } | null)?.name ?? null;

  // Resolve attribution
  let prospectId: string | null = null;
  let salesRepId: string | null = null;

  if (trackingToken) {
    const send = await db.campaignSend.findUnique({
      where: { trackingToken },
      include: {
        prospect: { select: { id: true, name: true, email: true } },
      },
    });
    if (send) {
      prospectId = send.prospectId;

      const prospect = await db.prospect.findUnique({
        where: { id: send.prospectId },
        select: { salesRepId: true },
      });
      salesRepId = prospect?.salesRepId ?? null;

      // Mark landing visit as converted
      await db.landingVisit.updateMany({
        where: { trackingToken, convertedAt: null },
        data: { convertedAt: new Date() },
      });
    }
  }

  // ── Crear Firma ──────────────────────────────────────────────────────────
  const prospectForFirm = prospectId
    ? await db.prospect.findUnique({
        where: { id: prospectId },
        select: { name: true, email: true },
      })
    : null;

  const firmName = prospectForFirm?.name ?? buyerName ?? buyerEmail ?? "Nueva empresa";

  const firm = await db.firm.create({
    data: {
      name: firmName,
      plan: "STARTER",
      seatsPurchased: 1,
      status: "active",
    },
  });

  // ── Crear usuario FIRM_ADMIN ──────────────────────────────────────────────
  const adminEmail = buyerEmail ?? prospectForFirm?.email;
  if (adminEmail) {
    await db.user.upsert({
      where: { email: adminEmail },
      update: { role: "FIRM_ADMIN", firmId: firm.id, name: buyerName ?? undefined },
      create: {
        email: adminEmail,
        name: buyerName,
        role: "FIRM_ADMIN",
        firmId: firm.id,
      },
    });
  }

  // ── Registrar Purchase ────────────────────────────────────────────────────
  const purchase = await db.purchase.create({
    data: {
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
      completedAt: new Date(),
      prospectId,
      trackingToken,
    },
  });

  // ── Actualizar Prospect ───────────────────────────────────────────────────
  if (prospectId) {
    await db.prospect.update({
      where: { id: prospectId },
      data: { status: "PURCHASED", convertedFirmId: firm.id },
    });
  }

  // ── Crear Comisión ────────────────────────────────────────────────────────
  if (salesRepId) {
    const salesRep = await db.salesRep.findUnique({
      where: { id: salesRepId },
      select: { commissionRate: true },
    });
    if (salesRep) {
      await db.commission.create({
        data: {
          purchaseId: purchase.id,
          salesRepId,
          rate: salesRep.commissionRate,
          amountCents: Math.round(amountCents * salesRep.commissionRate),
          status: "PENDING",
        },
      });
    }
  }

  console.log(
    `[stripe webhook] Compra completada — firma "${firmName}" (${firm.id}) · ${amountCents / 100} ${currency}` +
      (salesRepId ? ` · comisión para salesRep ${salesRepId}` : ""),
  );
}
