import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSalesRep } from "@/lib/session";
import { SalesShell } from "@/components/sales-shell";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { sendSms } from "@/lib/sms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const SEND_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  SENT: "Enviado",
  FAILED: "Fallido",
  BOUNCED: "Rebotado",
};

// Statuses that shouldn't be overwritten by CAMPAIGN_SENT
const ADVANCED_STATUSES = new Set(["VISITED_LANDING", "PURCHASED"]);

export default async function SalesCampaignSendPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSalesRep();
  const { id } = await params;

  async function sendCampaignAction(formData: FormData) {
    "use server";
    const s = await requireSalesRep();

    const salesRep = await db.salesRep.findUnique({
      where: { userId: s.user.id },
    });
    if (!salesRep) return;

    const campaignId = ((formData.get("campaignId") as string) ?? "").trim();
    const channel = ((formData.get("channel") as string) ?? "EMAIL") as
      | "EMAIL"
      | "SMS"
      | "BOTH";
    const prospectIds = (formData.getAll("prospectId") as string[]).filter(
      Boolean,
    );
    if (!campaignId || prospectIds.length === 0) return;

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) return;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    for (const prospectId of prospectIds) {
      // Security: ensure prospect belongs to this comercial
      const prospect = await db.prospect.findFirst({
        where: { id: prospectId, salesRepId: salesRep.id },
      });
      if (!prospect) continue;

      const channels: Array<"EMAIL" | "SMS"> =
        channel === "BOTH" ? ["EMAIL", "SMS"] : [channel];

      for (const ch of channels) {
        const trackingToken = crypto.randomUUID();
        const trackingUrl = `${appUrl}/api/t/${trackingToken}`;

        const send = await db.campaignSend.create({
          data: {
            campaignId,
            prospectId,
            channel: ch,
            trackingToken,
            status: "PENDING",
          },
        });

        let externalId: string | undefined;
        let success = false;

        if (ch === "EMAIL") {
          const html = campaign.bodyEmail.replace(
            /\{\{link\}\}/g,
            `<a href="${trackingUrl}" style="color:#7c3aed;font-weight:600">${trackingUrl}</a>`,
          );
          const result = await sendEmail({
            to: prospect.email,
            subject: campaign.subject,
            html,
          });
          success = !result.error;
          externalId = result.id;
        } else if (ch === "SMS" && prospect.phone) {
          const body = (campaign.bodySms ?? campaign.subject).replace(
            /\{\{link\}\}/g,
            trackingUrl,
          );
          const result = await sendSms({ to: prospect.phone, body });
          success = !result.error;
          externalId = result.sid;
        } else {
          // SMS requested but no phone — skip, keep PENDING
          continue;
        }

        await db.campaignSend.update({
          where: { id: send.id },
          data: {
            status: success ? "SENT" : "FAILED",
            externalId: externalId ?? null,
            sentAt: success ? new Date() : null,
          },
        });
      }

      // Advance prospect status unless already further in the funnel
      if (!ADVANCED_STATUSES.has(prospect.status)) {
        await db.prospect.update({
          where: { id: prospect.id },
          data: { status: "CAMPAIGN_SENT" },
        });
      }
    }

    // Mark campaign as SENT if it was still DRAFT
    await db.campaign.update({
      where: { id: campaignId, status: "DRAFT" },
      data: { status: "SENT", sentAt: new Date() },
    }).catch(() => {/* already sent, no-op */});

    revalidatePath(`/sales/campaigns/${campaignId}`);
  }

  const [campaign, salesRep] = await Promise.all([
    db.campaign.findUnique({ where: { id } }),
    db.salesRep.findUnique({
      where: { userId: session.user.id },
      include: {
        prospects: {
          where: { status: { notIn: ["PURCHASED", "LOST"] } },
          orderBy: { name: "asc" },
        },
      },
    }),
  ]);

  if (!campaign) notFound();

  // Prior sends of THIS campaign to this comercial's prospects
  const priorSends = salesRep
    ? await db.campaignSend.findMany({
        where: {
          campaignId: id,
          prospect: { salesRepId: salesRep.id },
        },
        include: {
          prospect: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const alreadySentIds = new Set(priorSends.map((s) => s.prospectId));

  // Vista previa: el {{link}} se sustituye por una etiqueta visual — en el
  // envío real cada prospect recibe su enlace de seguimiento único.
  const LINK_CHIP =
    '<span style="display:inline-block;background:#ecfdf5;color:#047857;border:1px dashed #34d399;border-radius:6px;padding:0 6px;font-size:12px">enlace personalizado del prospect</span>';
  const emailPreviewHtml = campaign.bodyEmail.replace(/\{\{link\}\}/g, LINK_CHIP);
  const smsPreview = campaign.bodySms
    ? campaign.bodySms.replace(/\{\{link\}\}/g, "[enlace personalizado]")
    : null;

  return (
    <SalesShell email={session.user.email}>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {campaign.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {campaign.subject}
          </p>
        </div>

        {/* Vista previa del mensaje */}
        <Card className="card-paper">
          <CardHeader>
            <CardTitle>Qué recibirá el prospect</CardTitle>
            <CardDescription>
              Vista previa exacta del mensaje. El enlace se personaliza para
              cada prospect (lleva su seguimiento individual).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Email */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/40 px-4 py-2.5 border-b border-border space-y-0.5">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Email
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Asunto:</span>{" "}
                  <span className="font-medium">{campaign.subject}</span>
                </p>
              </div>
              <div
                className="px-4 py-4 text-sm leading-relaxed [&_a]:text-emerald-700 [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: emailPreviewHtml }}
              />
            </div>

            {/* SMS */}
            {smsPreview && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="bg-muted/40 px-4 py-2.5 border-b border-border">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    SMS
                  </p>
                </div>
                <p className="px-4 py-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {smsPreview}
                </p>
              </div>
            )}
            {!smsPreview && (
              <p className="text-xs text-muted-foreground">
                Esta campaña no tiene versión SMS — si envías por SMS se usará
                el asunto como texto.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Enviar */}
        <Card className="card-paper">
          <CardHeader>
            <CardTitle>Enviar a prospects</CardTitle>
            <CardDescription>
              Selecciona los prospects a los que quieres enviar esta campaña.
              Los que ya la han recibido aparecen marcados con{" "}
              <Badge variant="secondary" className="text-[10px]">
                ya enviado
              </Badge>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!salesRep || salesRep.prospects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tienes prospects activos todavía.
              </p>
            ) : (
              <form action={sendCampaignAction} className="space-y-5">
                <input type="hidden" name="campaignId" value={id} />

                {/* Canal */}
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Canal
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    {[
                      { value: "EMAIL", label: "Email" },
                      { value: "SMS", label: "SMS" },
                      { value: "BOTH", label: "Email + SMS" },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="channel"
                          value={opt.value}
                          defaultChecked={opt.value === "EMAIL"}
                          className="accent-violet-600"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Prospects */}
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Prospects ({salesRep.prospects.length})
                  </p>
                  <div className="space-y-1.5 max-h-80 overflow-y-auto border rounded-lg p-3">
                    {salesRep.prospects.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors"
                      >
                        <input
                          type="checkbox"
                          name="prospectId"
                          value={p.id}
                          className="accent-violet-600 h-4 w-4"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {p.email}
                          </span>
                        </span>
                        {alreadySentIds.has(p.id) && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] shrink-0"
                          >
                            ya enviado
                          </Badge>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  style={{
                    backgroundColor: "var(--brand)",
                    color: "var(--brand-foreground)",
                  }}
                >
                  Enviar a seleccionados
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Historial */}
        {priorSends.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Mis envíos de esta campaña
            </h2>
            <Card className="card-paper p-0 overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        {[
                          "Prospect",
                          "Canal",
                          "Estado",
                          "Click",
                          "Enviado",
                        ].map((h) => (
                          <TableHead
                            key={h}
                            className="text-[11px] font-semibold uppercase tracking-wider"
                          >
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {priorSends.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div className="font-medium">
                              {s.prospect.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {s.prospect.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-[11px] font-mono"
                            >
                              {s.channel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                s.status === "SENT"
                                  ? "default"
                                  : s.status === "FAILED"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="text-[11px]"
                            >
                              {SEND_STATUS_LABELS[s.status] ?? s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {s.clickedAt
                              ? s.clickedAt.toLocaleString("es-ES")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {s.sentAt
                              ? s.sentAt.toLocaleString("es-ES")
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </SalesShell>
  );
}
