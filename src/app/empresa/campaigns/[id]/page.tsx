import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOperator } from "@/lib/session";
import { EmpresaShell } from "@/components/empresa-shell";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default async function EmpresaCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireOperator();
  const { id } = await params;

  async function updateCampaignAction(formData: FormData) {
    "use server";
    await requireOperator();
    const name = ((formData.get("name") as string) ?? "").trim();
    const subject = ((formData.get("subject") as string) ?? "").trim();
    const bodyEmail = ((formData.get("bodyEmail") as string) ?? "").trim();
    const bodySms =
      ((formData.get("bodySms") as string) ?? "").trim() || null;
    if (!name || !subject || !bodyEmail) return;
    await db.campaign.update({
      where: { id },
      data: { name, subject, bodyEmail, bodySms },
    });
    revalidatePath(`/empresa/campaigns/${id}`);
  }

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      sends: {
        include: {
          prospect: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: { select: { sends: true } },
    },
  });

  if (!campaign) notFound();

  const sentCount = campaign.sends.filter((s) => s.status === "SENT").length;
  const failedCount = campaign.sends.filter(
    (s) => s.status === "FAILED",
  ).length;
  const clickedCount = campaign.sends.filter((s) => s.clickedAt).length;

  return (
    <EmpresaShell email={session.user.email} isOperator>
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {campaign.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {campaign.subject}
            </p>
          </div>
          <Badge
            variant={campaign.status === "SENT" ? "default" : "secondary"}
          >
            {campaign.status === "DRAFT"
              ? "Borrador"
              : campaign.status === "SENT"
                ? "Enviada"
                : campaign.status}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total envíos", value: campaign._count.sends },
            { label: "Enviados OK", value: sentCount },
            { label: "Fallidos", value: failedCount },
            { label: "Clicks", value: clickedCount },
          ].map((kpi) => (
            <div key={kpi.label} className="card-paper p-5 space-y-1.5">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {kpi.label}
              </div>
              <div className="text-3xl font-semibold tabular-nums leading-none">
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        {/* Editar campaña */}
        <Card className="card-paper">
          <CardHeader>
            <CardTitle>Editar campaña</CardTitle>
            <CardDescription>
              Los cambios solo afectan a futuros envíos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateCampaignAction} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs">
                    Nombre interno
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    defaultValue={campaign.name}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-xs">
                    Asunto del email
                  </Label>
                  <Input
                    id="subject"
                    name="subject"
                    required
                    defaultValue={campaign.subject}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bodyEmail" className="text-xs">
                  Cuerpo email (HTML)
                </Label>
                <textarea
                  id="bodyEmail"
                  name="bodyEmail"
                  required
                  rows={6}
                  defaultValue={campaign.bodyEmail}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 resize-y"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bodySms" className="text-xs">
                  Cuerpo SMS (opcional)
                </Label>
                <Input
                  id="bodySms"
                  name="bodySms"
                  defaultValue={campaign.bodySms ?? ""}
                />
              </div>
              <Button type="submit" variant="outline">
                Guardar cambios
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Historial de envíos */}
        {campaign.sends.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Historial de envíos
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
                      {campaign.sends.map((s) => (
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
    </EmpresaShell>
  );
}
