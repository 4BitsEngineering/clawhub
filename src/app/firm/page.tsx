// Portal del cliente (FIRM_ADMIN) — change firm-client-portal.
// Una sola página con: instalador, código de activación, consumo y
// facturación (Stripe Billing Portal). Estética AI-Office autocontenida
// (navy + serif + amarillo); no usa los shells internos ni el tema global.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { resolveCatalogTeam } from "@/lib/agent-catalog-db";
import { stripe } from "@/lib/stripe";
import { createUnifiedCheckout, clampSeats, MAX_SEATS } from "@/lib/checkout";
import { generatePairingCode } from "@/lib/tokens";
import { requireFirmAdmin } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";
import type { TokenBillingPeriod } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// Paleta AI-Office (referencia: producto)
const NAVY = "#0c2b3d";
const NAVY_DEEP = "#082130";
const CREAM = "#f5efe4";
const YELLOW = "#f2c94c";
const SERIF = "Georgia, 'Times New Roman', serif";

// Código de instalación de larga vida (mismo criterio que el flujo de compra)
const PAIRING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function fmtInt(n: number) {
  return n.toLocaleString("es-ES");
}

export default async function FirmPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string; expand?: string }>;
}) {
  const session = await requireFirmAdmin();
  const firmId = session.user.firmId;
  const params = await searchParams;
  const billingError = params?.billing === "err";
  const expandError = params?.expand === "err";

  // ── Actions ────────────────────────────────────────────────────────────────

  async function generateCodeAction() {
    "use server";
    const s = await requireFirmAdmin();
    const fid = s.user.firmId;
    // Cuota de asientos: no repartir códigos que /api/v0/pair rechazará.
    const [seatsUsed, firm] = await Promise.all([
      db.instance.count({ where: { firmId: fid } }),
      db.firm.findUnique({ where: { id: fid }, select: { seatsPurchased: true } }),
    ]);
    if (!firm || seatsUsed >= firm.seatsPurchased) {
      redirect("/firm?quota=1");
    }
    await db.pairingToken.create({
      data: {
        firmId: fid,
        code: generatePairingCode(),
        expiresAt: new Date(Date.now() + PAIRING_TTL_MS),
      },
    });
    revalidatePath("/firm");
  }

  async function expandSeatsAction(formData: FormData) {
    "use server";
    const s = await requireFirmAdmin();
    const fid = s.user.firmId;
    const seats = clampSeats(formData.get("seats"));

    // La ampliación hereda modalidad, periodo Y selección de agentes de la
    // última compra; el firmId en metadata hace que el webhook sume seats en
    // vez de crear firma nueva. Sin heredar selectedAgents, la Purchase nueva
    // quedaba con [] (= catálogo completo) y, como el pair usa la ÚLTIMA
    // compra, la ampliación borraba el equipo elegido en la compra original.
    // Sin comisión de captación (houseSale + sin tracking).
    const [firm, last] = await Promise.all([
      db.firm.findUnique({ where: { id: fid }, select: { taxId: true } }),
      db.purchase.findFirst({
        where: { firmId: fid, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        select: {
          tokenProvision: true,
          tokenBillingPeriod: true,
          selectedAgents: true,
        },
      }),
    ]);
    if (!last) redirect("/firm?expand=err");

    const url = await createUnifiedCheckout({
      slug: "ai-office",
      provision: last.tokenProvision === "EXTERNAL" ? "EXTERNAL" : "BUNDLED",
      period: (last.tokenBillingPeriod as TokenBillingPeriod | null) ?? null,
      email: s.user.email ?? "",
      trackingToken: null,
      houseSale: true,
      selectedAgents: last.selectedAgents,
      seats,
      buyerTaxId: firm?.taxId ?? undefined,
      firmId: fid,
    });
    if (!url) redirect("/firm?expand=err");
    redirect(url);
  }

  async function billingPortalAction() {
    "use server";
    const s = await requireFirmAdmin();
    if (!stripe) redirect("/firm?billing=err");

    // Customer de Stripe derivado de la última compra con suscripción.
    const purchase = await db.purchase.findFirst({
      where: {
        firmId: s.user.firmId,
        status: "COMPLETED",
        stripeSubscriptionId: { not: null },
      },
      orderBy: { completedAt: "desc" },
      select: { stripeSubscriptionId: true, stripeSessionId: true },
    });
    if (!purchase) redirect("/firm?billing=err");

    let customerId: string | null = null;
    try {
      // Solo compras del flujo con suscripción tienen Customer garantizado
      // (el checkout antiguo en modo pago no creaba Customer en Stripe).
      if (!purchase.stripeSubscriptionId) redirect("/firm?billing=err");
      const sub = await stripe.subscriptions.retrieve(purchase.stripeSubscriptionId);
      customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      if (!customerId) redirect("/firm?billing=err");

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/firm`,
      });
      redirect(portal.url);
    } catch (err) {
      if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
      console.error("[firm-portal] Billing portal error:", (err as Error).message);
      redirect("/firm?billing=err");
    }
  }

  // ── Datos ──────────────────────────────────────────────────────────────────

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [firm, activeCode, usageMonth, usagePrev, purchase, seatsUsed] =
    await Promise.all([
      db.firm.findUnique({
        where: { id: firmId },
        select: { name: true, seatsPurchased: true, status: true },
      }),
      db.pairingToken.findFirst({
        where: { firmId, usedAt: null, expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
        select: { code: true, expiresAt: true },
      }),
      db.usageRecord.aggregate({
        where: { firmId, startTime: { gte: monthStart } },
        _sum: { inputTokens: true, outputTokens: true },
        _count: { id: true },
      }),
      db.usageRecord.aggregate({
        where: { firmId, startTime: { gte: prevMonthStart, lt: monthStart } },
        _sum: { inputTokens: true, outputTokens: true },
        _count: { id: true },
      }),
      db.purchase.findFirst({
        // Solo compras con suscripción pueden abrir el Billing Portal (las del
        // flujo antiguo en modo pago no tienen Customer en Stripe).
        where: { firmId, status: "COMPLETED", stripeSubscriptionId: { not: null } },
        orderBy: { completedAt: "desc" },
        select: {
          stripeSubscriptionId: true,
          stripeSessionId: true,
          selectedAgents: true,
        },
      }),
      db.instance.count({ where: { firmId } }),
    ]);

  if (!firm) redirect("/login");

  // Equipo contratado, resuelto contra el catálogo vivo de la BD
  // (AgentCatalogEntry); acepta agentKeys nuevas e ids legacy de compras viejas.
  const contractedTeam = await resolveCatalogTeam(purchase?.selectedAgents);

  const tokensMonth =
    (usageMonth._sum.inputTokens ?? 0) + (usageMonth._sum.outputTokens ?? 0);
  const tokensPrev =
    (usagePrev._sum.inputTokens ?? 0) + (usagePrev._sum.outputTokens ?? 0);
  const billingAvailable = !!stripe && !!purchase;
  const quotaFull = seatsUsed >= firm.seatsPurchased;

  const monthLabel = now.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  return (
    <main
      className="min-h-screen"
      style={{
        background: `linear-gradient(160deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)`,
        color: CREAM,
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b"
        style={{ borderColor: "rgba(245,239,228,0.12)", backgroundColor: NAVY }}
      >
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight" style={{ color: CREAM }}>
              AI&nbsp;Office
            </span>
            <span
              className="hidden sm:inline-block text-[11px] px-2.5 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: YELLOW, color: NAVY_DEEP }}
            >
              {firm.name}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm" style={{ color: "rgba(245,239,228,0.7)" }}>
            <span className="hidden md:inline">{session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        {/* Hero */}
        <div className="space-y-2">
          <h1
            className="text-4xl sm:text-5xl font-bold leading-tight"
            style={{ fontFamily: SERIF, color: CREAM }}
          >
            Tu AI-Office<span style={{ color: YELLOW }}>.</span>
          </h1>
          <p className="text-base" style={{ color: "rgba(245,239,228,0.75)" }}>
            Descarga, activa y gestiona tu suscripción. Todo lo demás lo hacemos
            nosotros.
          </p>
        </div>

        {/* Tarjetas */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* ── Instalador ── */}
          <section
            className="rounded-2xl p-7 space-y-4 shadow-xl"
            style={{ backgroundColor: CREAM, color: NAVY_DEEP }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#8a8574" }}>
              Instalador
            </p>
            <h2 className="text-2xl font-bold" style={{ fontFamily: SERIF }}>
              Descarga AI-Office<span style={{ color: YELLOW }}>.</span>
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "#4a4a42" }}>
              Ejecuta el instalador en el equipo de trabajo. Durante la
              instalación te pedirá tu código de activación.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/api/v0/installer?platform=windows"
                className="inline-block rounded-xl px-6 py-3.5 font-semibold text-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: NAVY, color: CREAM }}
              >
                ⬇ Para Windows
              </a>
              <a
                href="/api/v0/installer?platform=darwin"
                className="inline-block rounded-xl px-6 py-3.5 font-semibold text-sm transition-opacity hover:opacity-90 border-2"
                style={{ borderColor: NAVY, color: NAVY_DEEP }}
              >
                ⬇ Para Mac
              </a>
            </div>
          </section>

          {/* ── Código de activación ── */}
          <section
            className="rounded-2xl p-7 space-y-4 shadow-xl"
            style={{ backgroundColor: CREAM, color: NAVY_DEEP }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#8a8574" }}>
              Código de activación · {seatsUsed} de {firm.seatsPurchased}{" "}
              equipos activados
            </p>
            {activeCode ? (
              <>
                <div
                  className="rounded-xl px-5 py-4 text-center"
                  style={{ backgroundColor: NAVY, color: CREAM }}
                >
                  <span
                    className="font-mono text-3xl font-bold tracking-[0.15em]"
                    style={{ color: YELLOW }}
                  >
                    {activeCode.code}
                  </span>
                </div>
                <p className="text-sm" style={{ color: "#4a4a42" }}>
                  Válido hasta el{" "}
                  <strong>
                    {activeCode.expiresAt.toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "long",
                    })}
                  </strong>{" "}
                  · un solo uso. Introdúcelo cuando el instalador te lo pida.
                </p>
              </>
            ) : quotaFull ? (
              <p className="text-sm leading-relaxed" style={{ color: "#4a4a42" }}>
                Has activado los <strong>{firm.seatsPurchased}</strong> equipos
                de tu plan. Para ampliar puestos, escríbenos a{" "}
                <a href="mailto:info@iaofi.com" className="underline font-semibold">
                  info@iaofi.com
                </a>
                .
              </p>
            ) : (
              <>
                <p className="text-sm leading-relaxed" style={{ color: "#4a4a42" }}>
                  No tienes ningún código activo. Genera uno nuevo para activar
                  tu equipo.
                </p>
                <form action={generateCodeAction}>
                  <button
                    type="submit"
                    className="rounded-xl px-6 py-3 font-semibold text-sm transition-opacity hover:opacity-90"
                    style={{ backgroundColor: YELLOW, color: NAVY_DEEP }}
                  >
                    Generar código
                  </button>
                </form>
              </>
            )}
          </section>

          {/* ── Consumo ── */}
          <section
            className="rounded-2xl p-7 space-y-4 shadow-xl"
            style={{ backgroundColor: CREAM, color: NAVY_DEEP }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#8a8574" }}>
              Consumo · {monthLabel}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-3xl font-bold tabular-nums" style={{ fontFamily: SERIF }}>
                  {fmtInt(tokensMonth)}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#8a8574" }}>
                  tokens usados
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold tabular-nums" style={{ fontFamily: SERIF }}>
                  {fmtInt(usageMonth._count.id)}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#8a8574" }}>
                  tareas ejecutadas
                </div>
              </div>
            </div>
            <p className="text-sm pt-1" style={{ color: "#4a4a42" }}>
              Mes anterior: {fmtInt(tokensPrev)} tokens ·{" "}
              {fmtInt(usagePrev._count.id)} tareas.
            </p>
          </section>

          {/* ── Facturación ── */}
          <section
            className="rounded-2xl p-7 space-y-4 shadow-xl"
            style={{ backgroundColor: CREAM, color: NAVY_DEEP }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#8a8574" }}>
              Facturación
            </p>
            <h2 className="text-2xl font-bold" style={{ fontFamily: SERIF }}>
              Tus recibos y suscripciones<span style={{ color: YELLOW }}>.</span>
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "#4a4a42" }}>
              Descarga tus facturas y gestiona la suscripción de software y el
              plan de tokens desde el portal seguro de pago.
            </p>
            {billingError && (
              <p className="text-sm font-semibold" style={{ color: "#b3261e" }}>
                No hemos podido abrir el portal de facturación. Escríbenos a
                info@iaofi.com y lo resolvemos.
              </p>
            )}
            {billingAvailable ? (
              <form action={billingPortalAction}>
                <button
                  type="submit"
                  className="rounded-xl px-6 py-3.5 font-semibold text-sm transition-opacity hover:opacity-90"
                  style={{ backgroundColor: NAVY, color: CREAM }}
                >
                  Gestionar facturación →
                </button>
              </form>
            ) : (
              <p className="text-sm italic" style={{ color: "#8a8574" }}>
                Disponible próximamente para tu cuenta.
              </p>
            )}
          </section>
        </div>

        {/* ── Tu equipo contratado ── */}
        <section
          className="rounded-2xl p-7 space-y-4 shadow-xl"
          style={{ backgroundColor: CREAM, color: NAVY_DEEP }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#8a8574" }}>
            Tu equipo
          </p>
          <h2 className="text-2xl font-bold" style={{ fontFamily: SERIF }}>
            Especialistas incluidos<span style={{ color: YELLOW }}>.</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {contractedTeam.map((a) => (
              <span
                key={a.agent}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
                style={{ backgroundColor: NAVY, color: CREAM }}
              >
                <span>{a.icon}</span> {a.displayName}
              </span>
            ))}
          </div>
          <p className="text-sm" style={{ color: "#4a4a42" }}>
            {!purchase || purchase.selectedAgents.length === 0
              ? "Tu plan incluye el equipo completo de especialistas."
              : "El equipo que elegiste al contratar. Para ampliarlo, escríbenos a info@iaofi.com."}
          </p>
        </section>

        {/* ── Ampliar equipos ── */}
        <section
          className="rounded-2xl p-7 space-y-4 shadow-xl"
          style={{ backgroundColor: CREAM, color: NAVY_DEEP }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#8a8574" }}>
            Ampliar
          </p>
          <h2 className="text-2xl font-bold" style={{ fontFamily: SERIF }}>
            ¿Más equipos?<span style={{ color: YELLOW }}>.</span>
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "#4a4a42" }}>
            Añade AI-Office a más ordenadores de tu empresa con las mismas
            condiciones de tu plan. Tras el pago podrás generar los códigos de
            activación nuevos desde aquí.
          </p>
          {expandError && (
            <p className="text-sm font-semibold" style={{ color: "#b3261e" }}>
              No hemos podido iniciar la ampliación. Escríbenos a
              info@iaofi.com y lo resolvemos.
            </p>
          )}
          <form action={expandSeatsAction} className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              Equipos a añadir
              <select
                name="seats"
                defaultValue="1"
                className="h-10 rounded-lg px-2 text-sm tabular-nums"
                style={{ border: `1px solid rgba(8,33,48,0.25)`, backgroundColor: "#fff" }}
              >
                {Array.from({ length: MAX_SEATS }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-xl px-6 py-3 font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: NAVY, color: CREAM }}
            >
              Ampliar ahora →
            </button>
          </form>
        </section>

        {/* Pie */}
        <p className="text-sm text-center pt-4" style={{ color: "rgba(245,239,228,0.55)" }}>
          ¿Necesitas ayuda? Escríbenos a{" "}
          <a href="mailto:info@iaofi.com" className="underline" style={{ color: CREAM }}>
            info@iaofi.com
          </a>{" "}
          y te acompañamos en la instalación.
        </p>
      </div>
    </main>
  );
}
