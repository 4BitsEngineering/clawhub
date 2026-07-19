import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireEmpresa } from "@/lib/session";
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

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SCHEDULED: "Programada",
  SENT: "Enviada",
  CANCELLED: "Cancelada",
};

export default async function EmpresaCampaignsPage() {
  const session = await requireEmpresa();

  async function createCampaignAction(formData: FormData) {
    "use server";
    const s = await requireEmpresa();

    const name = ((formData.get("name") as string) ?? "").trim();
    const subject = ((formData.get("subject") as string) ?? "").trim();
    const bodyEmail = ((formData.get("bodyEmail") as string) ?? "").trim();
    const bodySms =
      ((formData.get("bodySms") as string) ?? "").trim() || null;

    if (!name || !subject || !bodyEmail) return;

    // Ensure a default landing page exists
    const landing = await db.landingPage.upsert({
      where: { slug: "ai-office" },
      update: {},
      create: {
        slug: "ai-office",
        headline: "Transforma tu empresa con AI-Office",
        videoUrl: "",
        bodyHtml: "",
      },
    });

    await db.campaign.create({
      data: {
        name,
        subject,
        bodyEmail,
        bodySms,
        landingId: landing.id,
        createdById: s.user.id,
      },
    });

    revalidatePath("/empresa/campaigns");
  }

  const campaigns = await db.campaign.findMany({
    include: {
      _count: { select: { sends: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <EmpresaShell email={session.user.email}>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Campañas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Diseña las plantillas de email y SMS que los comerciales enviarán a
            sus prospects.
          </p>
        </div>

        {/* Nueva campaña */}
        <Card className="card-paper">
          <CardHeader>
            <CardTitle>Nueva campaña</CardTitle>
            <CardDescription>
              Usa{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                {"{{link}}"}
              </code>{" "}
              en el cuerpo para insertar el enlace de seguimiento único de cada
              prospect.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createCampaignAction} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs">
                    Nombre interno *
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder="Lanzamiento julio 2026"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-xs">
                    Asunto del email *
                  </Label>
                  <Input
                    id="subject"
                    name="subject"
                    required
                    placeholder="Transforma tu empresa con IA — oferta exclusiva"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bodyEmail" className="text-xs">
                  Cuerpo del email (HTML) *
                </Label>
                <textarea
                  id="bodyEmail"
                  name="bodyEmail"
                  required
                  rows={6}
                  placeholder={`Hola,\n\nTe presentamos AI-Office, la solución que transforma la productividad de tu equipo.\n\nDescubre más y aprovecha el descuento de hoy: {{link}}\n\nUn saludo`}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 resize-y"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bodySms" className="text-xs">
                  Cuerpo SMS{" "}
                  <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="bodySms"
                  name="bodySms"
                  placeholder="AI-Office: descuento exclusivo hoy. Más info: {{link}}"
                />
              </div>
              <Button
                type="submit"
                style={{
                  backgroundColor: "var(--brand)",
                  color: "var(--brand-foreground)",
                }}
              >
                Crear campaña
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Campañas existentes
          </h2>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin campañas todavía. Crea la primera arriba.
            </p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <Card
                  key={c.id}
                  className="card-paper hover:bg-muted/10 transition-colors"
                >
                  <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="space-y-0.5">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.subject}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-[11px]">
                        {c._count.sends} envíos
                      </Badge>
                      <Badge
                        variant={
                          c.status === "SENT" ? "default" : "secondary"
                        }
                        className="text-[11px]"
                      >
                        {STATUS_LABELS[c.status] ?? c.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {c.createdAt.toLocaleDateString("es-ES")}
                      </span>
                      <Link href={`/empresa/campaigns/${c.id}`}>
                        <Button variant="outline" size="sm">
                          Ver →
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </EmpresaShell>
  );
}
