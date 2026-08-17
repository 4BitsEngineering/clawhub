// Landing de venta en la raíz (change root-sales-landing).
// Anónimos → escaparate + compra directa (venta de la casa, sin comercial).
// Usuarios con sesión → su panel (comportamiento anterior conservado).
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
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

export const dynamic = "force-dynamic";

const SLUG = "ai-office"; // misma config de precios que edita el admin

const YELLOW = "#f2c94c";
const NAVY_DEEP = "#082130";

// El equipo de especialistas IA que trae AI-Office
const TEAM = [
  ["📅", "Agenda y Correo", "Gestiona tu bandeja y tu calendario"],
  ["📂", "Gestor documental", "Ordena, busca y archiva por ti"],
  ["⚙️", "Automatizaciones", "Conecta tus herramientas y procesos"],
  ["🌐", "Web y Publicación", "Opera portales sin API: consulta, descarga, rellena"],
  ["⚖️", "Asesoría Jurídica", "Contratos, BOE y normativa al día"],
  ["📣", "Redes Sociales", "Planifica y publica tu presencia"],
  ["📈", "Marketing", "Campañas, análisis y captación"],
  ["✍️", "Redacción", "Informes, propuestas y comunicaciones"],
  ["💻", "Desarrollo de Software", "Scripts y herramientas a medida"],
  ["🧾", "Asesoría Fiscal", "Impuestos y plazos bajo control"],
  ["👥", "Asesoría Laboral", "Nóminas, altas y convenios"],
] as const;

const FAQ = [
  [
    "¿Necesito conocimientos técnicos?",
    "No. Contratas, descargas el instalador y metes tu código de activación. Todo lo demás viene configurado y te acompañamos en la puesta en marcha.",
  ],
  [
    "¿Dónde se instala?",
    "En tu propio PC de trabajo (Windows). Tus datos se quedan en tu equipo; el equipo de IA trabaja para ti desde ahí.",
  ],
  [
    "¿Qué incluye la cuota?",
    "En el plan Todo incluido: el software y el consumo de IA, sin sorpresas. Si prefieres usar tu propio proveedor de IA, pagas solo el software (anual).",
  ],
  [
    "¿Puedo cancelar?",
    "Sí, sin permanencia. Gestionas tu suscripción y tus facturas desde tu portal de cliente en cualquier momento.",
  ],
] as const;

export default async function HomePage() {
  const session = await getSession();
  if (session?.user?.role === "OPERATOR") redirect("/operator");
  if (session?.user?.role === "EMPRESA") redirect("/empresa");
  if (session?.user?.role === "COMERCIAL") redirect("/sales");
  if (session?.user?.role === "FIRM_ADMIN") redirect("/firm");

  const landing = await db.landingPage.findUnique({ where: { slug: SLUG } });
  const stripeEnabled = !!stripe && !!landing?.isActive;

  async function buyAction(formData: FormData) {
    "use server";
    const email = ((formData.get("email") as string) ?? "").trim().toLowerCase();
    if (!email) return;
    const provision =
      formData.get("tokenProvision") === "EXTERNAL" ? "EXTERNAL" : "BUNDLED";
    const period =
      (formData.get("tokenPeriod") as TokenBillingPeriod | null) ?? null;

    // Venta de la casa: sin comercial, sin tracking → sin comisión.
    const url = await createUnifiedCheckout({
      slug: SLUG,
      provision,
      period,
      email,
      trackingToken: null,
      houseSale: true,
    });
    if (url) redirect(url);
  }

  // Cuotas por periodo ofrecido (misma matemática que /oferta)
  const softwarePrice = landing ? fmtEuros(effectiveFirstYearFeeCents(landing)) : "—";
  const annualAtStandard = landing
    ? bundledAnnualTotalCents(
        { ...landing, tokenMonthlyPriceAnnualCents: landing.tokenMonthlyPriceCents },
        "ANNUAL",
      )
    : 0;
  const offered = landing
    ? TOKEN_PERIODS_ORDER.filter((p) => landing.tokenPeriods.includes(p)).map((p) => {
        const total = bundledAnnualTotalCents(landing, p);
        return {
          period: p,
          label: TOKEN_PERIOD_LABEL[p],
          installment: periodInstallmentCents(total, p),
          perLabel:
            p === "MONTHLY" ? "/ mes" : p === "QUARTERLY" ? "/ trimestre" : p === "SEMIANNUAL" ? "/ semestre" : "/ año",
          savingsCents: p === "ANNUAL" ? annualAtStandard - total : 0,
        };
      })
    : [];

  const emailInputCls =
    "w-full px-4 py-3 rounded-xl border border-border bg-white text-center text-base focus:outline-none focus:ring-2 focus:ring-[var(--brand)]";

  // Ancla de precio para el hero: la cuota mensual (o la primera ofrecida)
  const fromInstallment =
    offered.find((o) => o.period === "MONTHLY") ?? offered[0] ?? null;

  return (
    <main className="aio-canvas min-h-screen">
      {/* ── Barra superior ── */}
      <header className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">AI&nbsp;Office</span>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#precios" className="hover:underline" style={{ color: "rgba(245,239,228,0.8)" }}>
            Precios
          </a>
          <Link
            href="/login"
            className="px-4 py-1.5 rounded-full text-sm font-semibold"
            style={{ backgroundColor: YELLOW, color: NAVY_DEEP }}
          >
            Entrar
          </Link>
        </nav>
      </header>

      {/* ═══ BANDA NAVY: hero ═══ */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <section className="text-center pt-14 space-y-6">
          <span
            className="inline-block text-[11px] px-3 py-1 rounded-full font-bold uppercase tracking-[0.14em]"
            style={{ backgroundColor: YELLOW, color: NAVY_DEEP }}
          >
            AI Office
          </span>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight max-w-3xl mx-auto">
            {landing?.headline ?? "Tu oficina, con IA"}
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: "rgba(245,239,228,0.78)" }}>
            Un equipo completo de especialistas de IA trabajando en tu propio
            PC: correo, documentos, marketing, fiscal, laboral… Tú diriges,
            ellos ejecutan.
          </p>
          {fromInstallment && (
            <p className="text-sm font-semibold" style={{ color: YELLOW }}>
              Desde {fmtEuros(fromInstallment.installment)}
              {fromInstallment.perLabel}, todo incluido
            </p>
          )}
          <div className="flex items-center justify-center gap-4 pt-1">
            <a
              href="#precios"
              className="px-8 py-4 rounded-xl font-semibold text-lg shadow-lg"
              style={{ backgroundColor: YELLOW, color: NAVY_DEEP }}
            >
              Empezar ahora →
            </a>
            <a
              href="#como-funciona"
              className="px-6 py-4 text-sm underline underline-offset-4"
              style={{ color: "rgba(245,239,228,0.8)" }}
            >
              Cómo funciona
            </a>
          </div>

          {/* Franja de confianza */}
          <div
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-6 text-xs"
            style={{ color: "rgba(245,239,228,0.6)" }}
          >
            <span>✓ Pago seguro con Stripe</span>
            <span>✓ Sin permanencia</span>
            <span>✓ Tus datos, en tu PC</span>
            <span>✓ Acompañamiento en la puesta en marcha</span>
          </div>
        </section>

        {/* Vídeo (si está configurado en el panel) */}
        {landing?.videoUrl && (
          <section className="rounded-2xl overflow-hidden aspect-video shadow-2xl mt-14">
            <iframe
              src={landing.videoUrl}
              title="AI-Office demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            />
          </section>
        )}
      </div>

      {/* ═══ BANDA CLARA: equipo + cómo funciona ═══ */}
      <div className="aio-band-light">
        <div className="max-w-5xl mx-auto px-6 py-20 space-y-20">
          {/* El equipo */}
          <section className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
                Tu nuevo equipo<span style={{ color: "#d4a514" }}>.</span>
              </h2>
              <p className="text-muted-foreground">
                Once especialistas listos desde el primer día. Les pides las
                cosas como se las pedirías a una persona.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TEAM.map(([icon, name, desc]) => (
                <div key={name} className="card-paper rounded-2xl p-5 flex items-start gap-4">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="font-semibold text-sm">{name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Cómo funciona */}
          <section id="como-funciona" className="space-y-8 scroll-mt-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
                En marcha en una tarde<span style={{ color: "#d4a514" }}>.</span>
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                ["1", "Contrata tu plan", "Elige Todo incluido o trae tu propio proveedor de IA. Pago seguro con Stripe."],
                ["2", "Instala con tu código", "Recibes por email tu código de activación y el instalador. Un solo ejecutable, sin configuraciones."],
                ["3", "Tu equipo, a trabajar", "AI-Office arranca configurado y te acompañamos en la puesta en marcha. Sin permanencia."],
              ].map(([n, title, desc]) => (
                <div key={n} className="card-paper rounded-2xl p-6 space-y-3">
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full font-bold"
                    style={{ backgroundColor: YELLOW, color: NAVY_DEEP }}
                  >
                    {n}
                  </span>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
            <div className="text-center pt-2">
              <a
                href="#precios"
                className="inline-block px-8 py-4 rounded-xl font-semibold text-lg shadow-md"
                style={{ backgroundColor: NAVY_DEEP, color: "#f5efe4" }}
              >
                Ver planes y precios →
              </a>
            </div>
          </section>
        </div>
      </div>

      {/* ═══ BANDA NAVY: precios ═══ */}
      <div className="max-w-5xl mx-auto px-6 py-20 space-y-24">
        {/* ── Precios ── */}
        <section id="precios" className="space-y-8 scroll-mt-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
              Un precio, todo dentro<span style={{ color: YELLOW }}>.</span>
            </h2>
            <p style={{ color: "rgba(245,239,228,0.75)" }}>
              Sin costes ocultos. Cancela cuando quieras.
            </p>
          </div>

          {stripeEnabled && landing ? (
            <div className="grid md:grid-cols-2 gap-6 items-start max-w-4xl mx-auto">
              {/* Todo incluido */}
              <div className="card-paper rounded-2xl p-7 space-y-5 shadow-xl border-2 border-[var(--brand)]/40 relative">
                <span
                  className="absolute -top-3 left-6 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: YELLOW, color: NAVY_DEEP }}
                >
                  Recomendado
                </span>
                <div className="space-y-1 pt-1">
                  <h3 className="text-xl font-bold">Todo incluido</h3>
                  <p className="text-sm text-muted-foreground">
                    Software + consumo de IA en una sola cuota.
                  </p>
                </div>
                <form action={buyAction} className="space-y-4">
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
                          <span className="font-semibold">{fmtEuros(o.installment)}</span>
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
                    placeholder="Tu email de empresa"
                    autoComplete="email"
                    className={emailInputCls}
                  />
                  <button
                    type="submit"
                    className="w-full px-8 py-4 rounded-xl font-semibold text-white text-lg transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "var(--brand)" }}
                  >
                    Contratar ahora →
                  </button>
                </form>
              </div>

              {/* Proveedor propio */}
              <div className="card-paper rounded-2xl p-7 space-y-5 shadow-xl">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold">Mi propio proveedor de IA</h3>
                  <p className="text-sm text-muted-foreground">
                    ¿Ya tienes contrato con un proveedor de IA? Usa tu clave y
                    paga solo el software.
                  </p>
                </div>
                <div className="text-center py-2">
                  <span className="text-4xl font-bold tracking-tight tabular-nums">
                    {softwarePrice}
                  </span>
                  <span className="text-muted-foreground"> / año</span>
                </div>
                <form action={buyAction} className="space-y-4">
                  <input type="hidden" name="tokenProvision" value="EXTERNAL" />
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="Tu email de empresa"
                    autoComplete="email"
                    className={emailInputCls}
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
                  La conexión con tu proveedor se configura durante la instalación.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-center" style={{ color: "rgba(245,239,228,0.7)" }}>
              La contratación online estará disponible muy pronto. Escríbenos a{" "}
              <a href="mailto:info@iaofi.com" className="underline">info@iaofi.com</a>.
            </p>
          )}

          <p className="text-xs text-center" style={{ color: "rgba(245,239,228,0.55)" }}>
            Pago seguro con Stripe · ¿Tienes un cupón? Podrás aplicarlo en el
            pago · Activación inmediata · Sin permanencia
          </p>
        </section>

      </div>

      {/* ═══ BANDA CLARA: FAQ ═══ */}
      <div className="aio-band-light">
        <div className="max-w-3xl mx-auto px-6 py-20 space-y-6">
          <h2 className="text-3xl font-bold text-center" style={{ fontFamily: "Georgia, serif" }}>
            Preguntas frecuentes<span style={{ color: "#d4a514" }}>.</span>
          </h2>
          <div className="space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card-paper rounded-2xl px-6 py-4 group">
                <summary className="cursor-pointer font-semibold text-sm list-none flex items-center justify-between">
                  {q}
                  <span className="text-muted-foreground group-open:rotate-45 transition-transform">＋</span>
                </summary>
                <p className="text-sm text-muted-foreground pt-3">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Footer (navy) ═══ */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <footer
          className="text-sm flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ color: "rgba(245,239,228,0.6)" }}
        >
          <span>
            <strong style={{ color: "rgba(245,239,228,0.85)" }}>AI Office</strong> · iaofi.com
          </span>
          <span className="flex items-center gap-5">
            <a href="mailto:info@iaofi.com" className="underline">info@iaofi.com</a>
            <Link href="/login" className="underline">Acceso clientes</Link>
          </span>
        </footer>
      </div>
    </main>
  );
}
