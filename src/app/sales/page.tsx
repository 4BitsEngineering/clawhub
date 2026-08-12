import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireSalesRep } from "@/lib/session";
import { SalesShell } from "@/components/sales-shell";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { sendSms } from "@/lib/sms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  CAMPAIGN_SENT: "Campaña enviada",
  VISITED_LANDING: "Visitó landing",
  PURCHASED: "Compró",
  LOST: "Perdido",
};

const STATUS_PILL: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  CONTACTED: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  CAMPAIGN_SENT: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  VISITED_LANDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  PURCHASED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  LOST: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300",
};

const STATUS_ROW_BORDER: Record<string, string> = {
  NEW: "border-l-slate-200 dark:border-l-slate-700",
  CONTACTED: "border-l-sky-300 dark:border-l-sky-700",
  CAMPAIGN_SENT: "border-l-violet-400 dark:border-l-violet-700",
  VISITED_LANDING: "border-l-amber-400 dark:border-l-amber-600",
  PURCHASED: "border-l-emerald-500 dark:border-l-emerald-600",
  LOST: "border-l-rose-300 dark:border-l-rose-800",
};

const VALID_STATUSES = [
  "NEW",
  "CONTACTED",
  "CAMPAIGN_SENT",
  "VISITED_LANDING",
  "PURCHASED",
  "LOST",
] as const;
type ProspectStatus = (typeof VALID_STATUSES)[number];

const FUNNEL = [
  { key: "NEW", label: "Nuevos", bar: "bg-slate-300 dark:bg-slate-600", num: "" },
  { key: "CONTACTED", label: "Contactados", bar: "bg-sky-400 dark:bg-sky-600", num: "text-sky-600 dark:text-sky-400" },
  { key: "CAMPAIGN_SENT", label: "Campaña", bar: "bg-violet-500 dark:bg-violet-600", num: "text-violet-600 dark:text-violet-400" },
  { key: "VISITED_LANDING", label: "Landing", bar: "bg-amber-400 dark:bg-amber-600", num: "text-amber-600 dark:text-amber-400" },
  { key: "PURCHASED", label: "Compraron", bar: "bg-emerald-500 dark:bg-emerald-600", num: "text-emerald-600 dark:text-emerald-400" },
] as const;

const selectCls =
  "text-xs h-8 rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer";

export default async function SalesPage() {
  const session = await requireSalesRep();

  async function addProspectAction(formData: FormData) {
    "use server";
    const s = await requireSalesRep();
    const salesRep = await db.salesRep.findUnique({ where: { userId: s.user.id } });
    if (!salesRep) return;
    const name = ((formData.get("name") as string) ?? "").trim();
    const email = ((formData.get("email") as string) ?? "").trim().toLowerCase();
    if (!name || !email) return;
    await db.prospect.create({
      data: {
        name,
        email,
        cif: ((formData.get("cif") as string) ?? "").trim() || null,
        phone: ((formData.get("phone") as string) ?? "").trim() || null,
        contactName: ((formData.get("contactName") as string) ?? "").trim() || null,
        notes: ((formData.get("notes") as string) ?? "").trim() || null,
        salesRepId: salesRep.id,
        createdById: s.user.id,
      },
    });
    revalidatePath("/sales");
  }

  async function quickSendAction(formData: FormData) {
    "use server";
    const s = await requireSalesRep();
    const salesRep = await db.salesRep.findUnique({ where: { userId: s.user.id } });
    if (!salesRep) return;
    const campaignId = ((formData.get("campaignId") as string) ?? "").trim();
    const prospectId = ((formData.get("prospectId") as string) ?? "").trim();
    const channel = ((formData.get("channel") as string) ?? "EMAIL") as "EMAIL" | "SMS" | "BOTH";
    if (!campaignId || !prospectId) return;
    const [campaign, prospect] = await Promise.all([
      db.campaign.findUnique({ where: { id: campaignId } }),
      db.prospect.findFirst({ where: { id: prospectId, salesRepId: salesRep.id } }),
    ]);
    if (!campaign || !prospect) return;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const channels: Array<"EMAIL" | "SMS"> = channel === "BOTH" ? ["EMAIL", "SMS"] : [channel];
    for (const ch of channels) {
      const trackingToken = crypto.randomUUID();
      const trackingUrl = `${appUrl}/api/t/${trackingToken}`;
      const send = await db.campaignSend.create({
        data: { campaignId, prospectId, channel: ch, trackingToken, status: "PENDING" },
      });
      let externalId: string | undefined;
      let success = false;
      if (ch === "EMAIL") {
        const html = campaign.bodyEmail.replace(
          /\{\{link\}\}/g,
          `<a href="${trackingUrl}" style="color:#059669;font-weight:600">${trackingUrl}</a>`,
        );
        const result = await sendEmail({ to: prospect.email, subject: campaign.subject, html });
        success = !result.error;
        externalId = result.id;
      } else if (ch === "SMS" && prospect.phone) {
        const body = (campaign.bodySms ?? campaign.subject).replace(/\{\{link\}\}/g, trackingUrl);
        const result = await sendSms({ to: prospect.phone, body });
        success = !result.error;
        externalId = result.sid;
      } else {
        continue;
      }
      await db.campaignSend.update({
        where: { id: send.id },
        data: { status: success ? "SENT" : "FAILED", externalId: externalId ?? null, sentAt: success ? new Date() : null },
      });
    }
    const ADVANCED = new Set(["VISITED_LANDING", "PURCHASED"]);
    if (!ADVANCED.has(prospect.status)) {
      await db.prospect.update({ where: { id: prospect.id }, data: { status: "CAMPAIGN_SENT" } });
    }
    await db.campaign.update({
      where: { id: campaignId, status: "DRAFT" },
      data: { status: "SENT", sentAt: new Date() },
    }).catch(() => {});
    revalidatePath("/sales");
  }

  async function updateStatusAction(formData: FormData) {
    "use server";
    await requireSalesRep();
    const id = ((formData.get("id") as string) ?? "").trim();
    const status = ((formData.get("status") as string) ?? "").trim();
    if (!id || !(VALID_STATUSES as readonly string[]).includes(status)) return;
    await db.prospect.update({ where: { id }, data: { status: status as ProspectStatus } });
    revalidatePath("/sales");
  }

  const [salesRep, commissionSummary, campaigns] = await Promise.all([
    db.salesRep.findUnique({
      where: { userId: session.user.id },
      include: { prospects: { orderBy: { createdAt: "desc" } } },
    }),
    db.salesRep
      .findUnique({ where: { userId: session.user.id }, select: { id: true } })
      .then((rep) =>
        rep
          ? db.commission.aggregate({
              // No transferido aún = pendiente + incidencia
              where: { salesRepId: rep.id, status: { in: ["PENDING", "INCIDENT"] } },
              _sum: { amountCents: true },
            })
          : null,
      ),
    db.campaign.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!salesRep) {
    return (
      <SalesShell email={session.user.email}>
        <p className="text-sm text-muted-foreground">
          Tu cuenta está siendo configurada. Contacta con el equipo.
        </p>
      </SalesShell>
    );
  }

  const byStatus = salesRep.prospects.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  const pendingCommCents = commissionSummary?._sum?.amountCents ?? 0;

  return (
    <SalesShell email={session.user.email}>
      <div className="space-y-8">

        {/* ── Cabecera ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">
              Panel comercial
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Pipeline de ventas
            </h1>
          </div>
          {pendingCommCents > 0 && (
            <Link
              href="/sales/commissions"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            >
              <span className="text-amber-600 dark:text-amber-400 font-mono text-[11px] font-semibold uppercase tracking-wider">
                Comisión pendiente
              </span>
              <span className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300">
                {(pendingCommCents / 100).toLocaleString("es-ES", {
                  style: "currency",
                  currency: "EUR",
                })}
              </span>
              <span className="text-amber-500 text-xs">→</span>
            </Link>
          )}
        </div>

        {/* ── Pipeline funnel ── */}
        <div className="card-paper rounded-2xl overflow-hidden">
          <div className="grid grid-cols-5 divide-x divide-border">
            {FUNNEL.map((stage) => (
              <div key={stage.key} className="relative flex flex-col items-center py-6 px-3">
                <div className={`absolute inset-x-0 top-0 h-[3px] ${stage.bar}`} />
                <span
                  className={`text-3xl sm:text-4xl font-bold tabular-nums leading-none ${stage.num}`}
                >
                  {byStatus[stage.key] ?? 0}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-2 text-center leading-tight">
                  {stage.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Añadir prospect (colapsable) ── */}
        <details className="card-paper rounded-2xl overflow-hidden group">
          <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none select-none hover:bg-muted/30 transition-colors">
            <span className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 rounded-full items-center justify-center text-white text-base font-bold bg-emerald-600 dark:bg-emerald-700 shrink-0 leading-none">
                +
              </span>
              <span className="font-semibold text-sm">Añadir nuevo prospect</span>
            </span>
            <span className="text-muted-foreground text-xs font-mono">▾</span>
          </summary>
          <div className="px-6 pb-6 pt-1 border-t border-border">
            <form
              action={addProspectAction}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4"
            >
              <div className="space-y-2">
                <Label htmlFor="p-name" className="text-xs">Empresa *</Label>
                <Input id="p-name" name="name" required placeholder="Nombre de la empresa" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-email" className="text-xs">Email *</Label>
                <Input id="p-email" name="email" type="email" required placeholder="contacto@empresa.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cif" className="text-xs">CIF</Label>
                <Input id="p-cif" name="cif" placeholder="B12345678" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-phone" className="text-xs">Teléfono</Label>
                <Input id="p-phone" name="phone" placeholder="600 000 000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-contact" className="text-xs">Persona de contacto</Label>
                <Input id="p-contact" name="contactName" placeholder="Nombre del responsable" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-notes" className="text-xs">Notas</Label>
                <Input id="p-notes" name="notes" placeholder="Interés, observaciones…" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3 pt-1">
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Añadir prospect
                </Button>
              </div>
            </form>
          </div>
        </details>

        {/* ── Lista de prospects ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Mis prospects
              <span className="ml-2 text-base font-normal text-muted-foreground">
                ({salesRep.prospects.length})
              </span>
            </h2>
          </div>

          {salesRep.prospects.length === 0 ? (
            <div className="card-paper rounded-2xl p-12 text-center space-y-2">
              <p className="text-muted-foreground text-sm">
                Sin prospects todavía.
              </p>
              <p className="text-xs text-muted-foreground">
                Usa el formulario de arriba para añadir el primero.
              </p>
            </div>
          ) : (
            <div className="card-paper rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">
                        Empresa
                      </th>
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-3">
                        Contacto
                      </th>
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-3">
                        Estado
                      </th>
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-3">
                        Añadido
                      </th>
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-3 pr-5">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {salesRep.prospects.map((p) => (
                      <tr
                        key={p.id}
                        className={`border-l-[3px] ${STATUS_ROW_BORDER[p.status] ?? "border-l-transparent"} hover:bg-muted/20 transition-colors`}
                      >
                        {/* Empresa */}
                        <td className="px-5 py-4 align-top">
                          <div className="font-semibold text-foreground leading-snug">
                            {p.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {p.email}
                          </div>
                          {p.cif && (
                            <div className="text-[11px] text-muted-foreground/70 font-mono mt-0.5">
                              {p.cif}
                            </div>
                          )}
                        </td>

                        {/* Contacto */}
                        <td className="px-3 py-4 align-top">
                          <div className="text-foreground">
                            {p.contactName ?? <span className="text-muted-foreground">—</span>}
                          </div>
                          {p.phone && (
                            <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                              {p.phone}
                            </div>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="px-3 py-4 align-top">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${STATUS_PILL[p.status] ?? ""}`}
                          >
                            {STATUS_LABELS[p.status]}
                          </span>
                        </td>

                        {/* Añadido */}
                        <td className="px-3 py-4 align-top text-muted-foreground text-xs whitespace-nowrap">
                          {p.createdAt.toLocaleDateString("es-ES")}
                        </td>

                        {/* Acciones */}
                        <td className="px-3 py-4 pr-5 align-top">
                          <div className="space-y-2 min-w-[200px]">
                            {/* Enviar campaña */}
                            {campaigns.length > 0 ? (
                              <form action={quickSendAction} className="flex items-center gap-1.5">
                                <input type="hidden" name="prospectId" value={p.id} />
                                {campaigns.length === 1 ? (
                                  <input type="hidden" name="campaignId" value={campaigns[0].id} />
                                ) : (
                                  <select name="campaignId" className={selectCls}>
                                    {campaigns.map((c) => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                  </select>
                                )}
                                <select name="channel" className={selectCls}>
                                  <option value="EMAIL">Email</option>
                                  <option value="SMS">SMS</option>
                                  <option value="BOTH">Ambos</option>
                                </select>
                                <button
                                  type="submit"
                                  className="h-8 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                                >
                                  Enviar →
                                </button>
                              </form>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">
                                Sin campañas
                              </span>
                            )}

                            {/* Actualizar estado */}
                            <form action={updateStatusAction} className="flex items-center gap-1.5">
                              <input type="hidden" name="id" value={p.id} />
                              <select
                                name="status"
                                defaultValue={p.status}
                                className={selectCls}
                              >
                                {VALID_STATUSES.map((s) => (
                                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                ))}
                              </select>
                              <button
                                type="submit"
                                className="h-8 w-8 rounded-md border border-input hover:bg-muted transition-colors text-xs flex items-center justify-center text-muted-foreground hover:text-foreground"
                                title="Actualizar estado"
                              >
                                ✓
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </SalesShell>
  );
}
