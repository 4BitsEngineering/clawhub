import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe, ANNUAL_LICENSE_NAME, ANNUAL_LICENSE_DESC } from "@/lib/stripe";
import {
  TOKEN_PERIODS_ORDER,
  TOKEN_PERIOD_LABEL,
  tokenPeriodAmountCents,
  tokenStripeInterval,
  effectiveFirstYearFeeCents,
  fmtEuros,
} from "@/lib/pricing";
import type { TokenBillingPeriod } from "@/generated/prisma/client";
import { CountdownTimer } from "@/components/countdown-timer";

// Email del prospect si llegó por un link de tracking de campaña
async function emailFromAttribution(): Promise<string | null> {
  const cookieStore = await cookies();
  const attribution = cookieStore.get("clawhub-attribution")?.value ?? null;
  if (!attribution) return null;
  const send = await db.campaignSend.findUnique({
    where: { trackingToken: attribution },
    include: { prospect: { select: { email: true } } },
  });
  return send?.prospect.email ?? null;
}

export const dynamic = "force-dynamic";

export default async function LandingPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const landing = await db.landingPage.findUnique({ where: { slug } });
  if (!landing || !landing.isActive) notFound();

  const stripeEnabled = !!stripe;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  async function checkoutAction(formData: FormData) {
    "use server";
    if (!stripe) return;

    const cookieStore = await cookies();
    const attribution = cookieStore.get("clawhub-attribution")?.value ?? null;

    // Email: el que escribe el cliente en la landing; si no, el del prospect
    // atribuido por tracking. Siempre se pasa a Stripe (checkout no lo pide).
    const formEmail = ((formData.get("email") as string) ?? "")
      .trim()
      .toLowerCase();
    const customerEmail = formEmail || (await emailFromAttribution()) || null;
    if (!customerEmail) return;

    const lp = await db.landingPage.findUnique({ where: { slug } });
    if (!lp) return;

    // Periodo de tokens elegido — debe estar entre los ofrecidos por el admin.
    const period = formData.get("tokenPeriod") as TokenBillingPeriod | null;
    if (!period || !lp.tokenPeriods.includes(period)) return;

    const currency = lp.currency.toLowerCase();
    const feeCents = effectiveFirstYearFeeCents(lp);
    const renewalCents = lp.originalPriceCents;
    const tokenCents = tokenPeriodAmountCents(lp.tokenMonthlyPriceCents, period);
    const tokenInterval = tokenStripeInterval(period);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      // Tarjeta; Managed Payments desactivado para cobrar el importe anunciado
      // sin que Stripe añada IVA por encima (el IVA lo facturamos nosotros).
      payment_method_types: ["card"],
      managed_payments: { enabled: false },
      line_items: [
        // Suscripción de tokens (recurrente en el periodo elegido).
        {
          price_data: {
            currency,
            product_data: { name: `AI-Office · Tokens (${TOKEN_PERIOD_LABEL[period]})` },
            unit_amount: tokenCents,
            recurring: {
              interval: tokenInterval.interval,
              interval_count: tokenInterval.interval_count,
            },
          },
          quantity: 1,
        },
        // Fee del primer año: precio one-time → cae solo en la primera factura.
        // La renovación anual del fee la crea el webhook como 2ª suscripción.
        {
          price_data: {
            currency,
            product_data: {
              name: ANNUAL_LICENSE_NAME,
              description: ANNUAL_LICENSE_DESC,
            },
            unit_amount: feeCents,
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          trackingToken: attribution ?? "",
          landingSlug: slug,
          kind: "tokens",
        },
      },
      metadata: {
        trackingToken: attribution ?? "",
        landingSlug: slug,
        feeAmountCents: String(feeCents),
        feeRenewalCents: String(renewalCents),
        tokenBillingPeriod: period,
        tokenAmountCents: String(tokenCents),
      },
      customer_email: customerEmail,
      success_url: `${appUrl}/oferta/${slug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/oferta/${slug}`,
    } as Stripe.Checkout.SessionCreateParams);

    if (session.url) redirect(session.url);
  }

  // Si llegó por link de campaña, ya sabemos quién es → precargar su email
  const knownEmail = await emailFromAttribution();

  // Registrar visita orgánica (sin bloquear el render)
  after(async () => {
    await db.landingVisit.create({
      data: { landingId: landing.id },
    });
  });

  // Precios derivados para la UI
  const feeFirstYearCents = effectiveFirstYearFeeCents(landing);
  const originalPrice = fmtEuros(landing.originalPriceCents);
  const discountPrice = fmtEuros(feeFirstYearCents);
  const hasDiscount = feeFirstYearCents < landing.originalPriceCents;

  // Periodos de tokens ofrecidos (en orden canónico) con su importe
  const offered = TOKEN_PERIODS_ORDER.filter((p) =>
    landing.tokenPeriods.includes(p),
  ).map((p) => ({
    period: p,
    label: TOKEN_PERIOD_LABEL[p],
    cents: tokenPeriodAmountCents(landing.tokenMonthlyPriceCents, p),
  }));

  return (
    <main className="min-h-screen bg-background">
      {/* Spotlight superior */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[500px] opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, hsl(var(--brand) / 0.3), transparent)",
        }}
      />

      <div className="relative max-w-3xl mx-auto px-6 py-20 space-y-14">
        {/* ── Cabecera ── */}
        <header className="text-center space-y-4">
          <div className="eyebrow-chip mx-auto w-fit">AI-Office</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            {landing.headline}
          </h1>
        </header>

        {/* ── Vídeo ── */}
        {landing.videoUrl && (
          <div className="rounded-2xl overflow-hidden aspect-video shadow-2xl ring-1 ring-border">
            <iframe
              src={landing.videoUrl}
              title="AI-Office demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        )}

        {/* ── Cuerpo ── */}
        {landing.bodyHtml && (
          <section
            className="text-base leading-relaxed text-foreground/90 space-y-4 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-8 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-brand [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: landing.bodyHtml }}
          />
        )}

        {/* ── CTA y precio ── */}
        <div className="card-paper rounded-2xl p-8 sm:p-10 space-y-6 shadow-xl">
          {/* Fee de licencia */}
          <div className="text-center space-y-1">
            {hasDiscount && (
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                Oferta primer año
              </p>
            )}
            <div className="flex items-center justify-center gap-4 pt-1">
              {hasDiscount && (
                <span className="text-2xl text-muted-foreground line-through">
                  {originalPrice}
                </span>
              )}
              <span className="text-5xl sm:text-6xl font-bold tracking-tight">
                {discountPrice}
              </span>
            </div>
            <p className="text-sm text-muted-foreground pt-1">
              Licencia AI-Office · primer año
              {hasDiscount && (
                <>
                  {" "}
                  <span className="text-muted-foreground/80">
                    (renovación {originalPrice}/año)
                  </span>
                </>
              )}
            </p>
          </div>

          {landing.discountEndsAt && (
            <CountdownTimer endsAt={landing.discountEndsAt.getTime()} />
          )}

          {stripeEnabled && offered.length > 0 ? (
            <form action={checkoutAction} className="max-w-md mx-auto space-y-4">
              {/* Selector de periodo de tokens */}
              <div className="space-y-2 text-left">
                <p className="text-sm font-medium">Plan de tokens</p>
                <p className="text-xs text-muted-foreground -mt-1">
                  Consumo de IA. Elige cada cuánto se factura.
                </p>
                <div className="grid gap-2 pt-1">
                  {offered.map((o, i) => (
                    <label
                      key={o.period}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand)]/5"
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="tokenPeriod"
                          value={o.period}
                          required
                          defaultChecked={i === 0}
                          className="accent-[var(--brand)] h-4 w-4"
                        />
                        <span className="text-sm font-medium">{o.label}</span>
                      </span>
                      <span className="text-sm tabular-nums">
                        {fmtEuros(o.cents)}
                        <span className="text-muted-foreground">
                          {" "}
                          / {o.label.toLowerCase()}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <input
                type="email"
                name="email"
                required
                defaultValue={knownEmail ?? undefined}
                placeholder="Tu email de empresa"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-center text-base focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              />

              <button
                type="submit"
                className="w-full px-12 py-4 rounded-xl font-semibold text-white text-lg transition-opacity hover:opacity-90 active:opacity-75"
                style={{ backgroundColor: "var(--brand)" }}
              >
                Contratar ahora →
              </button>
              <p className="text-xs text-muted-foreground text-center">
                Hoy pagas el primer año de licencia ({discountPrice}) + el
                primer periodo de tokens del plan elegido. Te enviaremos la
                licencia y el instalador a tu email.
              </p>
            </form>
          ) : (
            <button
              disabled
              className="w-full sm:w-auto px-12 py-4 rounded-xl font-semibold text-white text-lg opacity-50 cursor-not-allowed select-none block mx-auto"
              style={{ backgroundColor: "var(--brand)" }}
            >
              Contratar ahora — próximamente
            </button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Pago seguro con Stripe · Activación inmediata · Sin permanencia
          </p>
        </div>
      </div>
    </main>
  );
}
