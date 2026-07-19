import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { stripe, ANNUAL_LICENSE_NAME, ANNUAL_LICENSE_DESC } from "@/lib/stripe";
import { CountdownTimer } from "@/components/countdown-timer";

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

  async function checkoutAction() {
    "use server";
    if (!stripe) return;

    const cookieStore = await cookies();
    const attribution = cookieStore.get("clawhub-attribution")?.value ?? null;

    // Pre-fill email from attribution if available
    let customerEmail: string | undefined;
    if (attribution) {
      const send = await db.campaignSend.findUnique({
        where: { trackingToken: attribution },
        include: { prospect: { select: { email: true } } },
      });
      customerEmail = send?.prospect.email;
    }

    const lp = await db.landingPage.findUnique({ where: { slug } });
    if (!lp) return;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: lp.currency.toLowerCase(),
            product_data: {
              name: ANNUAL_LICENSE_NAME,
              description: ANNUAL_LICENSE_DESC,
            },
            unit_amount: lp.discountPriceCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        trackingToken: attribution ?? "",
        landingSlug: slug,
      },
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      success_url: `${appUrl}/oferta/${slug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/oferta/${slug}`,
    });

    if (session.url) redirect(session.url);
  }

  // Registrar visita orgánica (sin bloquear el render)
  after(async () => {
    await db.landingVisit.create({
      data: { landingId: landing.id },
    });
  });

  const originalPrice = (landing.originalPriceCents / 100).toLocaleString(
    "es-ES",
    { style: "currency", currency: "EUR" },
  );
  const discountPrice = (landing.discountPriceCents / 100).toLocaleString(
    "es-ES",
    { style: "currency", currency: "EUR" },
  );

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
        <div className="card-paper rounded-2xl p-8 sm:p-10 text-center space-y-6 shadow-xl">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
              Oferta especial · Solo hoy
            </p>
            <div className="flex items-center justify-center gap-5 pt-2">
              <span className="text-2xl text-muted-foreground line-through">
                {originalPrice}
              </span>
              <span className="text-5xl sm:text-6xl font-bold tracking-tight">
                {discountPrice}
              </span>
            </div>
            <p className="text-sm text-muted-foreground pt-1">
              Licencia anual · AI-Office para tu empresa
            </p>
          </div>

          {landing.discountEndsAt && (
            <CountdownTimer
              endsAt={landing.discountEndsAt.getTime()}
            />
          )}

          {stripeEnabled ? (
            <form action={checkoutAction}>
              <button
                type="submit"
                className="w-full sm:w-auto px-12 py-4 rounded-xl font-semibold text-white text-lg transition-opacity hover:opacity-90 active:opacity-75"
                style={{ backgroundColor: "var(--brand)" }}
              >
                Contratar ahora →
              </button>
            </form>
          ) : (
            <button
              disabled
              className="w-full sm:w-auto px-12 py-4 rounded-xl font-semibold text-white text-lg opacity-50 cursor-not-allowed select-none"
              style={{ backgroundColor: "var(--brand)" }}
            >
              Contratar ahora — próximamente
            </button>
          )}

          <p className="text-xs text-muted-foreground">
            Pago seguro con Stripe · Activación inmediata · Sin permanencia
          </p>
        </div>
      </div>
    </main>
  );
}
