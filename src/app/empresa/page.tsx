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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function EmpresaPage() {
  const session = await requireEmpresa();

  async function invitarComercialAction(formData: FormData) {
    "use server";
    await requireEmpresa();
    const email = ((formData.get("email") as string) ?? "").trim().toLowerCase();
    const name = ((formData.get("name") as string) ?? "").trim() || null;
    const territory = ((formData.get("territory") as string) ?? "").trim() || null;
    const rateRaw = parseFloat((formData.get("commissionRate") as string) ?? "35");
    const commissionRate = isNaN(rateRaw)
      ? 0.35
      : Math.max(0, Math.min(1, rateRaw / 100));

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

  const salesReps = await db.salesRep.findMany({
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { prospects: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalProspects = salesReps.reduce((s, r) => s + r._count.prospects, 0);

  return (
    <EmpresaShell email={session.user.email}>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Panel Empresa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona comerciales, prospects y campañas.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: "Comerciales", value: salesReps.length },
            { label: "Prospects totales", value: totalProspects },
            { label: "Ventas cerradas", value: "—" },
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

        {/* Invitar comercial */}
        <Card className="card-paper">
          <CardHeader>
            <CardTitle>Invitar comercial</CardTitle>
            <CardDescription>
              Crea el acceso de un nuevo comercial externo. Si el email ya
              existe, actualiza sus datos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={invitarComercialAction}
              className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end"
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs">
                  Email *
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="comercial@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs">
                  Nombre
                </Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Nombre completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="territory" className="text-xs">
                  Territorio
                </Label>
                <Input
                  id="territory"
                  name="territory"
                  placeholder="Valencia, Madrid…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commissionRate" className="text-xs">
                  Comisión %
                </Label>
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
                    className="shrink-0"
                    style={{
                      backgroundColor: "var(--brand)",
                      color: "var(--brand-foreground)",
                    }}
                  >
                    + Invitar
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Tabla de comerciales */}
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
                          "Estado",
                          "Acciones",
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
                      {salesReps.map((rep) => (
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
                          <TableCell className="tabular-nums">
                            {rep._count.prospects}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                rep.status === "ACTIVE"
                                  ? "default"
                                  : "secondary"
                              }
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
                              <input
                                type="hidden"
                                name="current"
                                value={rep.status}
                              />
                              <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                              >
                                {rep.status === "ACTIVE"
                                  ? "Desactivar"
                                  : "Activar"}
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
    </EmpresaShell>
  );
}
