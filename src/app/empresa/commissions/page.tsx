import { revalidatePath } from "next/cache";
import { requireEmpresa } from "@/lib/session";
import { EmpresaShell } from "@/components/empresa-shell";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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

export default async function EmpresaCommissionsPage() {
  const session = await requireEmpresa();

  async function markPaidAction(formData: FormData) {
    "use server";
    await requireEmpresa();
    const id = ((formData.get("id") as string) ?? "").trim();
    if (!id) return;
    await db.commission.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
    });
    revalidatePath("/empresa/commissions");
  }

  async function markAllPaidAction() {
    "use server";
    await requireEmpresa();
    await db.commission.updateMany({
      where: { status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });
    revalidatePath("/empresa/commissions");
  }

  const commissions = await db.commission.findMany({
    include: {
      salesRep: {
        include: { user: { select: { name: true, email: true } } },
      },
      purchase: {
        select: {
          amountCents: true,
          currency: true,
          completedAt: true,
          buyerName: true,
          buyerEmail: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const pendingCents = commissions
    .filter((c) => c.status === "PENDING")
    .reduce((s, c) => s + c.amountCents, 0);
  const paidCents = commissions
    .filter((c) => c.status === "PAID")
    .reduce((s, c) => s + c.amountCents, 0);
  const pendingCount = commissions.filter((c) => c.status === "PENDING").length;

  return (
    <EmpresaShell email={session.user.email}>
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Comisiones
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestiona y liquida las comisiones de tus comerciales.
            </p>
          </div>
          {pendingCount > 0 && (
            <form action={markAllPaidAction}>
              <Button type="submit" variant="outline" size="sm">
                Marcar todas como pagadas ({pendingCount})
              </Button>
            </form>
          )}
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Comisiones pendientes",
              value: fmt(pendingCents),
              color: pendingCents > 0 ? "text-amber-600 dark:text-amber-400" : undefined,
            },
            {
              label: "Comisiones pagadas",
              value: fmt(paidCents),
              color: paidCents > 0 ? "text-green-600 dark:text-green-400" : undefined,
            },
            { label: "Total comisiones", value: commissions.length.toString() },
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

        {/* Tabla */}
        {commissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin comisiones todavía. Se generan automáticamente al completarse
            un pago con atribución a un comercial.
          </p>
        ) : (
          <Card className="card-paper p-0 overflow-hidden">
            <CardHeader className="px-6 py-4 border-b">
              <CardTitle className="text-base">Historial</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      {[
                        "Comercial",
                        "Comprador",
                        "Venta",
                        "Comisión",
                        "%",
                        "Estado",
                        "Fecha venta",
                        "Pagada el",
                        "Acción",
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
                    {commissions.map((c) => (
                      <TableRow
                        key={c.id}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <TableCell>
                          <div className="font-medium">
                            {c.salesRep.user.name ?? c.salesRep.user.email}
                          </div>
                          {c.salesRep.user.name && (
                            <div className="text-xs text-muted-foreground">
                              {c.salesRep.user.email}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {c.purchase.buyerName ?? "—"}
                          </div>
                          {c.purchase.buyerEmail && (
                            <div className="text-xs text-muted-foreground">
                              {c.purchase.buyerEmail}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums font-medium">
                          {fmt(c.purchase.amountCents)}
                        </TableCell>
                        <TableCell
                          className={`tabular-nums font-semibold ${
                            c.status === "PENDING"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-green-600 dark:text-green-400"
                          }`}
                        >
                          {fmt(c.amountCents)}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {Math.round(c.rate * 100)}%
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.status === "PAID" ? "default" : "secondary"
                            }
                            className="text-[11px]"
                          >
                            {c.status === "PAID" ? "Pagada" : "Pendiente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {c.purchase.completedAt
                            ? c.purchase.completedAt.toLocaleDateString("es-ES")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {c.paidAt ? c.paidAt.toLocaleDateString("es-ES") : "—"}
                        </TableCell>
                        <TableCell>
                          {c.status === "PENDING" ? (
                            <form action={markPaidAction}>
                              <input type="hidden" name="id" value={c.id} />
                              <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                              >
                                Marcar pagada
                              </Button>
                            </form>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              ✓
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </EmpresaShell>
  );
}
