// Landing de venta en la raíz (change root-sales-landing).
// Anónimos → escaparate + compra directa (venta de la casa, sin comercial).
// Usuarios con sesión → su panel (comportamiento anterior conservado).
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import {
  createUnifiedCheckout,
  normalizeTaxId,
  clampSeats,
  MAX_SEATS,
} from "@/lib/checkout";
import {
  TOKEN_PERIODS_ORDER,
  TOKEN_PERIOD_LABEL,
  effectiveFirstYearFeeCents,
  bundledAnnualTotalCents,
  periodInstallmentCents,
  fmtEuros,
} from "@/lib/pricing";
import { selectionFromFormDataDb } from "@/lib/agent-catalog-db";
import type { TokenBillingPeriod } from "@/generated/prisma/client";
import { AgentPicker } from "@/components/agent-picker";
import pkg from "../../package.json";

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

// Ejemplos reales de peticiones: lo que le escribes al agente y lo que hace.
const EXAMPLES = [
  {
    ask: "Revisa mi bandeja de esta mañana y proponme una respuesta para cada correo pendiente.",
    agent: "Agenda y Correo",
    icon: "📅",
    result: "Triaje hecho y borradores listos para que solo tengas que aprobar y enviar.",
  },
  {
    ask: "Entra en el portal de mi proveedor, descarga las facturas de julio y archívalas.",
    agent: "Web y Publicación",
    icon: "🌐",
    result: "Navega el portal como lo harías tú, descarga los PDF y los deja ordenados por fecha.",
  },
  {
    ask: "Prepárame un borrador de contrato de prestación de servicios con estos datos.",
    agent: "Asesoría Jurídica",
    icon: "⚖️",
    result: "Borrador redactado con la normativa vigente, listo para tu revisión antes de firmar.",
  },
  {
    ask: "Planifica las publicaciones de la semana y déjame el calendario preparado.",
    agent: "Redes Sociales",
    icon: "📣",
    result: "Propuesta de textos e imágenes para cada red, programada y pendiente de tu visto bueno.",
  },
  {
    ask: "¿Qué plazos fiscales tengo este trimestre y qué me falta por preparar?",
    agent: "Asesoría Fiscal",
    icon: "🧾",
    result: "Calendario de plazos con lo que ya está cubierto y lo que requiere tu atención.",
  },
  {
    ask: "Avísame cada vez que entre un pedido nuevo y regístralo en mi hoja de cálculo.",
    agent: "Automatizaciones",
    icon: "⚙️",
    result: "Monta el flujo, te lo enseña y no lo activa hasta que tú lo apruebes.",
  },
  {
    ask: "Compárame estos tres presupuestos y hazme un informe con tu recomendación.",
    agent: "Redacción",
    icon: "✍️",
    result: "Informe comparativo claro, con tabla de diferencias y una recomendación argumentada.",
  },
  {
    ask: "Calcula el coste de contratar a media jornada con el convenio de oficinas.",
    agent: "Asesoría Laboral",
    icon: "👥",
    result: "Desglose de salario, cotizaciones y coste total de empresa según el convenio.",
  },
] as const;

const FAQ = [
  [
    "¿Necesito conocimientos técnicos?",
    "No. Contratas, descargas el instalador y metes tu código de activación. Todo lo demás viene configurado y te acompañamos en la puesta en marcha.",
  ],
  [
    "¿Dónde se instala?",
    "En tu propio equipo de trabajo, Windows o Mac. Tus datos se quedan en tu equipo; el equipo de IA trabaja para ti desde ahí.",
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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const err = (await searchParams)?.err;
  const emailError = err === "email";
  const taxError = err === "taxid";
  const session = await getSession();
  if (session?.user?.role === "OPERATOR") redirect("/operator");
  if (session?.user?.role === "EMPRESA") redirect("/empresa");
  if (session?.user?.role === "COMERCIAL") redirect("/sales");
  if (session?.user?.role === "FIRM_ADMIN") redirect("/firm");

  const landing = await db.landingPage.findUnique({ where: { slug: SLUG } });
  const stripeEnabled = !!stripe && !!landing?.isActive;

  async function buyAction(formData: FormData) {
    "use server";
    const provision =
      formData.get("tokenProvision") === "EXTERNAL" ? "EXTERNAL" : "BUNDLED";
    // Cada tarjeta lleva su propio campo de email (email / emailAlt) para que
    // el campo esté junto al botón de pago. Manda el de la tarjeta usada.
    const emailMain = ((formData.get("email") as string) ?? "").trim().toLowerCase();
    const emailAlt = ((formData.get("emailAlt") as string) ?? "").trim().toLowerCase();
    const email =
      (provision === "EXTERNAL" ? emailAlt || emailMain : emailMain || emailAlt);
    if (!email) redirect("/?err=email#precios");

    // CIF/NIF (facturación) y nº de equipos — mismo patrón por-tarjeta.
    const taxMain = normalizeTaxId((formData.get("taxId") as string) ?? "");
    const taxAlt = normalizeTaxId((formData.get("taxIdAlt") as string) ?? "");
    const buyerTaxId =
      provision === "EXTERNAL" ? taxAlt || taxMain : taxMain || taxAlt;
    if (!buyerTaxId) redirect("/?err=taxid#precios");
    const seats = clampSeats(
      provision === "EXTERNAL" ? formData.get("seatsAlt") : formData.get("seats"),
    );
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
      selectedAgents: await selectionFromFormDataDb(formData),
      seats,
      buyerTaxId,
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
          <a href="#ejemplos" className="hover:underline" style={{ color: "rgba(245,239,228,0.8)" }}>
            Ejemplos
          </a>
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

      {/* ═══ BANDA NAVY: ejemplos + precios ═══ */}
      <div className="max-w-5xl mx-auto px-6 py-20 space-y-24">
        {/* ── Ejemplos de uso ── */}
        <section id="ejemplos" className="space-y-8 scroll-mt-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
              Pídeselo con tus palabras<span style={{ color: YELLOW }}>.</span>
            </h2>
            <p style={{ color: "rgba(245,239,228,0.75)" }}>
              Ejemplos reales de lo que puedes pedirle a tu equipo desde el
              primer día.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {EXAMPLES.map((ex) => (
              <div key={ex.ask} className="card-paper rounded-2xl p-6 space-y-4">
                <p className="text-sm font-medium leading-relaxed">
                  <span className="text-lg leading-none mr-1" style={{ color: "#d4a514" }}>“</span>
                  {ex.ask}
                  <span className="text-lg leading-none ml-1" style={{ color: "#d4a514" }}>”</span>
                </p>
                <div className="flex items-start gap-3 border-t border-border pt-3">
                  <span className="text-xl leading-none">{ex.icon}</span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {ex.agent}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ex.result}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-center" style={{ color: "rgba(245,239,228,0.55)" }}>
            Todo queda pendiente de tu aprobación: los agentes preparan, tú decides.
          </p>
        </section>

        {/* ── Precios ── */}
        <section id="precios" className="space-y-8 scroll-mt-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
              Un precio, todo dentro<span style={{ color: YELLOW }}>.</span>
            </h2>
            <p style={{ color: "rgba(245,239,228,0.75)" }}>
              Sin costes ocultos. Cancela cuando quieras.
            </p>
            {(emailError || taxError) && (
              <p
                className="inline-block text-sm font-semibold px-4 py-2 rounded-xl"
                style={{
                  backgroundColor: "rgba(179,38,30,0.15)",
                  color: "#ffb4a9",
                  border: "1px solid rgba(179,38,30,0.4)",
                }}
              >
                {emailError
                  ? "Escribe tu email de empresa en la tarjeta del plan elegido para continuar con el pago."
                  : "Escribe un CIF/NIF válido en la tarjeta del plan elegido para continuar con el pago."}
              </p>
            )}
          </div>

          {stripeEnabled && landing ? (
            <form action={buyAction} className="space-y-10">
              {/* ── Elige tu equipo ── */}
              <section id="equipo" className="space-y-4 scroll-mt-8">
                <div className="text-center space-y-1">
                  <h3 className="text-2xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
                    Elige tu equipo<span style={{ color: YELLOW }}>.</span>
                  </h3>
                  <p className="text-sm" style={{ color: "rgba(245,239,228,0.75)" }}>
                    Toca un especialista para quitarlo o añadirlo. El precio no
                    cambia por el número de especialistas.
                  </p>
                </div>
                <AgentPicker />
              </section>

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
                      Software + consumo de IA en una sola cuota. Precios por
                      equipo.
                    </p>
                  </div>
                  <div className="space-y-4">
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
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                      <span className="text-sm font-medium">¿Cuántos equipos?</span>
                      <select
                        name="seats"
                        defaultValue="1"
                        className="h-9 rounded-md border border-border bg-white px-2 text-sm tabular-nums"
                      >
                        {Array.from({ length: MAX_SEATS }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                    <input
                      type="text"
                      name="taxId"
                      placeholder="CIF / NIF (facturación)"
                      autoComplete="off"
                      className={emailInputCls}
                    />
                    <input
                      type="email"
                      name="email"
                      placeholder="Tu email de empresa"
                      autoComplete="email"
                      className={emailInputCls}
                    />
                    <button
                      type="submit"
                      name="tokenProvision"
                      value="BUNDLED"
                      className="w-full px-8 py-4 rounded-xl font-semibold text-white text-lg transition-opacity hover:opacity-90"
                      style={{ backgroundColor: "var(--brand)" }}
                    >
                      Contratar ahora →
                    </button>
                  </div>
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
                    <span className="text-muted-foreground"> / año por equipo</span>
                  </div>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                    <span className="text-sm font-medium">¿Cuántos equipos?</span>
                    <select
                      name="seatsAlt"
                      defaultValue="1"
                      className="h-9 rounded-md border border-border bg-white px-2 text-sm tabular-nums"
                    >
                      {Array.from({ length: MAX_SEATS }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                  <input
                    type="text"
                    name="taxIdAlt"
                    placeholder="CIF / NIF (facturación)"
                    autoComplete="off"
                    className={emailInputCls}
                  />
                  <input
                    type="email"
                    name="emailAlt"
                    placeholder="Tu email de empresa"
                    autoComplete="email"
                    className={emailInputCls}
                  />
                  <button
                    type="submit"
                    name="tokenProvision"
                    value="EXTERNAL"
                    className="w-full px-8 py-4 rounded-xl font-semibold text-lg border-2 transition-colors hover:bg-muted/30"
                    style={{ borderColor: "var(--brand)", color: "var(--brand)" }}
                  >
                    Contratar solo software →
                  </button>
                  <p className="text-[11px] text-muted-foreground">
                    La conexión con tu proveedor se configura durante la instalación.
                  </p>
                </div>
              </div>
            </form>
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
            <strong style={{ color: "rgba(245,239,228,0.85)" }}>AI Office</strong> · iaofi.com · v{pkg.version}
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
