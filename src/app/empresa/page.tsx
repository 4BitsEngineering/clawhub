import { revalidatePath } from "next/cache";
import { requireEmpresa } from "@/lib/session";
import { EmpresaShell } from "@/components/empresa-shell";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
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

function fmt(cents: number) {
  return (cents / 100).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

export default async function EmpresaPage() {
  const session = await requireEmpresa();

  async function addComercialAction(formData: FormData) {
    "use server";
    await requireEmpresa();
    const email = ((formData.get("email") as string) ?? "").trim().toLowerCase();
    const name = ((formData.get("name") as string) ?? "").trim() || null;
    const territory = ((formData.get("territory") as string) ?? "").trim() || null;
    const rateRaw = parseFloat((formData.get("commissionRate") as string) ?? "35");
    const commissionRate = isNaN(rateRaw) ? 0.35 : Math.max(0, Math.min(1, rateRaw / 100));
    const sendInvite = formData.get("sendInvite") === "true";
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    const user = await db.user.upsert({
      where: { email },
      update: { role: "COMERCIAL", ...(name ? { name } : {}) },
      create: { email, name, role: "COMERCIAL", emailVerified: new Date() },
    });
    await db.salesRep.upsert({
      where: { userId: user.id },
      update: { territory, commissionRate },
      create: { userId: user.id, territory, commissionRate },
    });
    if (sendInvite) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      await sendEmail({
        to: email,
        subject: "Tu acceso a AI-Office como comercial",
        html: `<p>Hola${name ? ` ${name}` : ""},</p>
<p>Se ha creado tu cuenta de comercial en AI-Office.</p>
<p>Puedes acceder con tu email en:</p>
<p><a href="${appUrl}/login">${appUrl}/login</a></p>`,
      });
    }
    revalidatePath("/empresa");
  }

  async function toggleStatusAction(formData: FormData) {
    "use server";
    await requireEmpresa();
    const id = ((formData.get("id") as string) ?? "").trim();
    const current = ((formData.get("current") as string) ?? "").trim();
    if (!id) return;
    await db.salesRep.update({
      where: { id },
      data: { status: current === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
    });
    revalidatePath("/empresa");
  }

  const [
    salesReps,
    funnelData,
    revenueData,
    purchasedByRep,
    pendingCommByRep,
  ] = await Promise.all([
    db.salesRep.findMany({
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { prospects: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.prospect.groupBy({ by: ["status"], _count: { _all: true } }),
    db.purchase.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    db.prospect.groupBy({
      by: ["salesRepId"],
      where: { salesRepId: { not: null }, status: "PURCHASED" },
      _count: { _all: true },
    }),
    db.commission.groupBy({
      by: ["salesRepId"],
      where: { status: "PENDING" },
      _sum: { amountCents: true },
    }),
  ]);

  const statusMap = new Map(funnelData.map((f) => [f.status, f._count._all]));
  const totalProspects = funnelData.reduce((s, f) => s + f._count._all, 0);
  const visitedCount =
    (statusMap.get("VISITED_LANDING") ?? 0) + (statusMap.get("PURCHASED") ?? 0);
  const purchasedCount = statusMap.get("PURCHASED") ?? 0;
  const totalRevenueCents = revenueData._sum.amountCents ?? 0;
  const totalPendingCommCents = pendingCommByRep.reduce(
    (s, r) => s + (r._sum.amountCents ?? 0),
    0,
  );

  const purchasedMap = new Map(
    purchasedByRep.map((r) => [r.salesRepId as string, r._count._all]),
  );
  const pendingCommMap = new Map(
    pendingCommByRep.map((r) => [r.salesRepId, r._sum.amountCents ?? 0]),
  );

  return (
    <EmpresaShell email={session.user.email}>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Panel Empresa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visión global de comerciales, prospects y ventas.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Comerciales", value: salesReps.length },
            { label: "Prospects", value: totalProspects },
            { label: "Visitaron landing", value: visitedCount },
            {
              label: "Compras",
              value: purchasedCount,
              color: purchasedCount > 0 ? "text-green-600 dark:text-green-400" : undefined,
            },
            {
              label: "Ingresos",
              value: fmt(totalRevenueCents),
              color: totalRevenueCents > 0 ? "text-green-600 dark:text-green-400" : undefined,
            },
            {
              label: "Comisión pendiente",
              value: fmt(totalPendingCommCents),
              color: totalPendingCommCents > 0 ? "text-amber-600 dark:text-amber-400" : undefined,
            },
          ].map((kpi) => (
            <div key={kpi.label} className="card-paper p-5 space-y-1.5">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {kpi.label}
              </div>
              <div
                className={`text-2xl font-semibold tabular-nums leading-none ${kpi.color ?? ""}`}
              >
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        {/* Añadir comercial */}
        <Card className="card-paper">
          <CardHeader>
            <CardTitle>Añadir comercial</CardTitle>
            <CardDescription>
              Crea la cuenta de un nuevo comercial. Si el email ya existe,
              actualiza sus datos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={addComercialAction}
              className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end"
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs">Email *</Label>
                <Input id="email" name="email" type="email" required placeholder="comercial@email.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs">Nombre</Label>
                <Input id="name" name="name" placeholder="Nombre completo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="territory" className="text-xs">Territorio</Label>
                <Input id="territory" name="territory" placeholder="Valencia, Madrid…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commissionRate" className="text-xs">Comisión %</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="commissionRate"
                    name="commissionRate"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    defaultValue="35"
                    className="w-24"
                  />
                  <Button
                    type="submit"
                    name="sendInvite"
                    value="false"
                    variant="outline"
                    className="shrink-0"
                  >
                    Crear
                  </Button>
                  <Button
                    type="submit"
                    name="sendInvite"
                    value="true"
                    className="shrink-0"
                    style={{ backgroundColor: "var(--brand)", color: "var(--brand-foreground)" }}
                  >
                    Crear e invitar
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Tabla comerciales */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Comerciales
          </h2>
          {salesReps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin comerciales todavía. Invita el primero arriba.
            </p>
          ) : (
            <Card className="card-paper p-0 overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        {[
                          "Comercial",
                          "Territorio",
                          "Comisión",
                          "Prospects",
                          "Compras",
                          "Conversión",
                          "Comis. pendiente",
                          "Estado",
                          "Acciones",
                        ].map((h) => (
                          <TableHead
                            key={h}
                            className="text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                          >
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesReps.map((rep) => {
                        const purchased = purchasedMap.get(rep.id) ?? 0;
                        const total = rep._count.prospects;
                        const pct =
                          total > 0 ? Math.round((purchased / total) * 100) : 0;
                        const pendingComm = pendingCommMap.get(rep.id) ?? 0;
                        return (
                          <TableRow
                            key={rep.id}
                            className="hover:bg-muted/20 transition-colors"
                          >
                            <TableCell>
                              <div className="font-medium">
                                {rep.user.name ?? rep.user.email}
                              </div>
                              {rep.user.name && (
                                <div className="text-xs text-muted-foreground">
                                  {rep.user.email}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {rep.territory ?? "—"}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {Math.round(rep.commissionRate * 100)}%
                            </TableCell>
                            <TableCell className="tabular-nums">{total}</TableCell>
                            <TableCell className="tabular-nums font-medium">
                              {purchased > 0 ? (
                                <span className="text-green-600 dark:text-green-400">
                                  {purchased}
                                </span>
                              ) : (
                                "0"
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {total > 0 ? `${pct}%` : "—"}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {pendingComm > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                  {fmt(pendingComm)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={rep.status === "ACTIVE" ? "default" : "secondary"}
                                className="text-[11px]"
                              >
                                {rep.status === "ACTIVE"
                                  ? "Activo"
                                  : rep.status === "INACTIVE"
                                    ? "Inactivo"
                                    : "Suspendido"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <form action={toggleStatusAction}>
                                <input type="hidden" name="id" value={rep.id} />
                                <input type="hidden" name="current" value={rep.status} />
                                <Button type="submit" variant="outline" size="sm">
                                  {rep.status === "ACTIVE" ? "Desactivar" : "Activar"}
                                </Button>
                              </form>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </EmpresaShell>
  );
}
