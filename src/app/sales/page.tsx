import { revalidatePath } from "next/cache";
import { requireSalesRep } from "@/lib/session";
import { SalesShell } from "@/components/sales-shell";
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

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  CAMPAIGN_SENT: "Campaña enviada",
  VISITED_LANDING: "Visitó landing",
  PURCHASED: "Compró",
  LOST: "Perdido",
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  NEW: "secondary",
  CONTACTED: "outline",
  CAMPAIGN_SENT: "outline",
  VISITED_LANDING: "default",
  PURCHASED: "default",
  LOST: "destructive",
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

export default async function SalesPage() {
  const session = await requireSalesRep();

  async function addProspectAction(formData: FormData) {
    "use server";
    const s = await requireSalesRep();
    const salesRep = await db.salesRep.findUnique({
      where: { userId: s.user.id },
    });
    if (!salesRep) return;

    const name = ((formData.get("name") as string) ?? "").trim();
    const email = ((formData.get("email") as string) ?? "")
      .trim()
      .toLowerCase();
    if (!name || !email) return;

    await db.prospect.create({
      data: {
        name,
        email,
        cif: ((formData.get("cif") as string) ?? "").trim() || null,
        phone: ((formData.get("phone") as string) ?? "").trim() || null,
        contactName:
          ((formData.get("contactName") as string) ?? "").trim() || null,
        notes: ((formData.get("notes") as string) ?? "").trim() || null,
        salesRepId: salesRep.id,
        createdById: s.user.id,
      },
    });
    revalidatePath("/sales");
  }

  async function updateStatusAction(formData: FormData) {
    "use server";
    await requireSalesRep();
    const id = ((formData.get("id") as string) ?? "").trim();
    const status = ((formData.get("status") as string) ?? "").trim();
    if (!id || !(VALID_STATUSES as readonly string[]).includes(status)) return;
    await db.prospect.update({
      where: { id },
      data: { status: status as ProspectStatus },
    });
    revalidatePath("/sales");
  }

  const salesRep = await db.salesRep.findUnique({
    where: { userId: session.user.id },
    include: { prospects: { orderBy: { createdAt: "desc" } } },
  });

  if (!salesRep) {
    return (
      <SalesShell email={session.user.email}>
        <p className="text-sm text-muted-foreground">
          Tu cuenta de comercial está siendo configurada. Contacta con el
          equipo.
        </p>
      </SalesShell>
    );
  }

  const byStatus = salesRep.prospects.reduce<Record<string, number>>(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <SalesShell email={session.user.email}>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Mis ventas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona tus prospects y sigue su estado.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total prospects", value: salesRep.prospects.length },
            { label: "Nuevos", value: byStatus["NEW"] ?? 0 },
            {
              label: "Visitaron landing",
              value:
                (byStatus["VISITED_LANDING"] ?? 0) +
                (byStatus["PURCHASED"] ?? 0),
            },
            {
              label: "Compraron",
              value: byStatus["PURCHASED"] ?? 0,
              color: "text-green-600 dark:text-green-400",
            },
          ].map((kpi) => (
            <div key={kpi.label} className="card-paper p-5 space-y-1.5">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {kpi.label}
              </div>
              <div
                className={`text-3xl font-semibold tabular-nums leading-none ${kpi.color ?? ""}`}
              >
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        {/* Añadir prospect */}
        <Card className="card-paper">
          <CardHeader>
            <CardTitle>Añadir prospect</CardTitle>
            <CardDescription>
              Registra una nueva empresa potencial.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={addProspectAction}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <div className="space-y-2">
                <Label htmlFor="p-name" className="text-xs">
                  Empresa *
                </Label>
                <Input
                  id="p-name"
                  name="name"
                  required
                  placeholder="Nombre de la empresa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-email" className="text-xs">
                  Email *
                </Label>
                <Input
                  id="p-email"
                  name="email"
                  type="email"
                  required
                  placeholder="contacto@empresa.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cif" className="text-xs">
                  CIF
                </Label>
                <Input id="p-cif" name="cif" placeholder="B12345678" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-phone" className="text-xs">
                  Teléfono
                </Label>
                <Input
                  id="p-phone"
                  name="phone"
                  placeholder="600 000 000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-contact" className="text-xs">
                  Nombre contacto
                </Label>
                <Input
                  id="p-contact"
                  name="contactName"
                  placeholder="Responsable de la empresa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-notes" className="text-xs">
                  Notas
                </Label>
                <Input
                  id="p-notes"
                  name="notes"
                  placeholder="Interés mostrado, observaciones…"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Button
                  type="submit"
                  style={{
                    backgroundColor: "var(--brand)",
                    color: "var(--brand-foreground)",
                  }}
                >
                  + Añadir prospect
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Lista de prospects */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Mis prospects{" "}
            <span className="text-muted-foreground font-normal text-base">
              ({salesRep.prospects.length})
            </span>
          </h2>
          {salesRep.prospects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin prospects todavía. Añade el primero arriba.
            </p>
          ) : (
            <Card className="card-paper p-0 overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        {[
                          "Empresa",
                          "Contacto",
                          "Teléfono",
                          "Estado",
                          "Añadido",
                          "Actualizar",
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
                      {salesRep.prospects.map((p) => (
                        <TableRow
                          key={p.id}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <TableCell>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.email}
                            </div>
                            {p.cif && (
                              <div className="text-xs text-muted-foreground font-mono">
                                {p.cif}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.contactName ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.phone ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                STATUS_VARIANT[p.status] ?? "secondary"
                              }
                              className="text-[11px]"
                            >
                              {STATUS_LABELS[p.status] ?? p.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {p.createdAt.toLocaleDateString("es-ES")}
                          </TableCell>
                          <TableCell>
                            <form
                              action={updateStatusAction}
                              className="flex gap-1.5 items-center"
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={p.id}
                              />
                              <select
                                name="status"
                                defaultValue={p.status}
                                className="text-xs h-8 rounded-lg border border-input bg-transparent px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                              >
                                {VALID_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {STATUS_LABELS[s]}
                                  </option>
                                ))}
                              </select>
                              <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                              >
                                ✓
                              </Button>
                            </form>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </SalesShell>
  );
}
