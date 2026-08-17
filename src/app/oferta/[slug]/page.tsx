import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { createUnifiedCheckout } from "@/lib/checkout";
import {
  TOKEN_PERIODS_ORDER,
  TOKEN_PERIOD_LABEL,
  effectiveFirstYearFeeCents,
  bundledAnnualTotalCents,
  periodInstallmentCents,
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

    // Checkout unificado compartido (src/lib/checkout.ts). Modalidad BUNDLED
    // (cuota software+tokens) o EXTERNAL (solo software, anual).
    const provision =
      formData.get("tokenProvision") === "EXTERNAL" ? "EXTERNAL" : "BUNDLED";
    const period =
      (formData.get("tokenPeriod") as TokenBillingPeriod | null) ?? null;

    const url = await createUnifiedCheckout({
      slug,
      provision,
      period,
      email: customerEmail,
      trackingToken: attribution,
      houseSale: false,
    });
    if (url) redirect(url);
  }

  // Si llegó por link de campaña, ya sabemos quién es → precargar su email
  const knownEmail = await emailFromAttribution();

  // Registrar visita orgánica (sin bloquear el render)
  after(async () => {
    await db.landingVisit.create({
      data: { landingId: landing.id },
    });
  });

  // Precios derivados para la UI (modelo unificado: la cuota ya incluye
  // software + tokens; el desglose no se muestra al público)
  const softwareCents = effectiveFirstYearFeeCents(landing);
  const softwarePrice = fmtEuros(softwareCents);
  const hasDiscount = softwareCents < landing.originalPriceCents;

  // Cuotas por periodo ofrecido; el ahorro del anual se calcula contra el
  // total anual pagando mensual (tokens a precio estándar)
  const annualAtStandard = bundledAnnualTotalCents(
    { ...landing, tokenMonthlyPriceAnnualCents: landing.tokenMonthlyPriceCents },
    "ANNUAL",
  );
  const offered = TOKEN_PERIODS_ORDER.filter((p) =>
    landing.tokenPeriods.includes(p),
  ).map((p) => {
    const total = bundledAnnualTotalCents(landing, p);
    const installment = periodInstallmentCents(total, p);
    const savingsCents = p === "ANNUAL" ? annualAtStandard - total : 0;
    return {
      period: p,
      label: TOKEN_PERIOD_LABEL[p],
      installment,
      perLabel:
        p === "MONTHLY" ? "/ mes" : p === "QUARTERLY" ? "/ trimestre" : p === "SEMIANNUAL" ? "/ semestre" : "/ año",
      savingsCents,
    };
  });

  return (
    <main className="aio-canvas min-h-screen">
      <div className="relative max-w-3xl mx-auto px-6 py-20 space-y-14">
        {/* ── Cabecera ── */}
        <header className="text-center space-y-5">
          <span
            className="inline-block text-[11px] px-3 py-1 rounded-full font-bold uppercase tracking-[0.14em]"
            style={{ backgroundColor: "#f2c94c", color: "#082130" }}
          >
            AI Office
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
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

        {/* ── CTA: precio unificado, dos modalidades ── */}
        {landing.discountEndsAt && (
          <CountdownTimer endsAt={landing.discountEndsAt.getTime()} />
        )}

        {stripeEnabled ? (
          <div className="grid md:grid-cols-2 gap-6 items-start">
            {/* ── Modalidad 1: Todo incluido (recomendado) ── */}
            <div className="card-paper rounded-2xl p-7 space-y-5 shadow-xl border-2 border-[var(--brand)]/40 relative">
              <span
                className="absolute -top-3 left-6 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: "#f2c94c", color: "#082130" }}
              >
                Recomendado
              </span>
              <div className="space-y-1 pt-1">
                <h2 className="text-xl font-bold">Todo incluido</h2>
                <p className="text-sm text-muted-foreground">
                  Software + consumo de IA en una sola cuota. Sin
                  configuraciones: instalas y funciona.
                </p>
              </div>

              {offered.length > 0 ? (
                <form action={checkoutAction} className="space-y-4">
                  <input type="hidden" name="tokenProvision" value="BUNDLED" />
                  <div className="grid gap-2">
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
                        <span className="text-sm tabular-nums text-right">
                          <span className="font-semibold">
                            {fmtEuros(o.installment)}
                          </span>
                          <span className="text-muted-foreground"> {o.perLabel}</span>
                          {o.savingsCents > 0 && (
                            <span className="block text-[11px] text-emerald-600 font-semibold">
                              ahorra {fmtEuros(o.savingsCents)} al año
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
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
                    className="w-full px-8 py-4 rounded-xl font-semibold text-white text-lg transition-opacity hover:opacity-90 active:opacity-75"
                    style={{ backgroundColor: "var(--brand)" }}
                  >
                    Contratar ahora →
                  </button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No disponible temporalmente.
                </p>
              )}
            </div>

            {/* ── Modalidad 2: Proveedor de IA propio ── */}
            <div className="card-paper rounded-2xl p-7 space-y-5 shadow-xl">
              <div className="space-y-1">
                <h2 className="text-xl font-bold">Mi propio proveedor de IA</h2>
                <p className="text-sm text-muted-foreground">
                  ¿Ya tienes contrato con un proveedor de IA? Usa tu propia
                  clave y paga solo el software.
                </p>
              </div>

              <div className="text-center py-2">
                <span className="text-4xl font-bold tracking-tight tabular-nums">
                  {softwarePrice}
                </span>
                <span className="text-muted-foreground"> / año</span>
                {hasDiscount && (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                    descuento aplicado
                  </p>
                )}
              </div>

              <form action={checkoutAction} className="space-y-4">
                <input type="hidden" name="tokenProvision" value="EXTERNAL" />
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
                  className="w-full px-8 py-4 rounded-xl font-semibold text-lg border-2 transition-colors hover:bg-muted/30"
                  style={{ borderColor: "var(--brand)", color: "var(--brand)" }}
                >
                  Contratar solo software →
                </button>
              </form>
              <p className="text-[11px] text-muted-foreground">
                La conexión con tu proveedor se configura durante la
                instalación.
              </p>
            </div>
          </div>
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
          Pago seguro con Stripe · ¿Tienes un cupón? Podrás aplicarlo en el
          pago · Activación inmediata · Sin permanencia
        </p>
      </div>
    </main>
  );
}
