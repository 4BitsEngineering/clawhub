import { requireSalesRep } from "@/lib/session";
import { SalesShell } from "@/components/sales-shell";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
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

export default async function SalesCommissionsPage() {
  const session = await requireSalesRep();

  const salesRep = await db.salesRep.findUnique({
    where: { userId: session.user.id },
    include: {
      commissions: {
        include: {
          purchase: {
            select: {
              amountCents: true,
              completedAt: true,
              buyerName: true,
              buyerEmail: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!salesRep) {
    return (
      <SalesShell email={session.user.email}>
        <p className="text-sm text-muted-foreground">
          Tu cuenta de comercial está siendo configurada.
        </p>
      </SalesShell>
    );
  }

  const commissions = salesRep.commissions;
  const pendingCents = commissions
    .filter((c) => c.status === "PENDING")
    .reduce((s, c) => s + c.amountCents, 0);
  const paidCents = commissions
    .filter((c) => c.status === "PAID")
    .reduce((s, c) => s + c.amountCents, 0);
  const totalCents = pendingCents + paidCents;

  return (
    <SalesShell email={session.user.email}>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Mis comisiones
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Histórico de comisiones generadas por tus ventas.
          </p>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Pendiente de cobro",
              value: fmt(pendingCents),
              color:
                pendingCents > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : undefined,
            },
            {
              label: "Ya cobrado",
              value: fmt(paidCents),
              color:
                paidCents > 0
                  ? "text-green-600 dark:text-green-400"
                  : undefined,
            },
            { label: "Total acumulado", value: fmt(totalCents) },
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
            Sin comisiones todavía. Se generan cada vez que uno de tus
            prospects completa una compra con tu atribución.
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
                        "Comprador",
                        "Venta",
                        "Tu comisión",
                        "%",
                        "Estado",
                        "Fecha venta",
                        "Pagada el",
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
                          {c.paidAt
                            ? c.paidAt.toLocaleDateString("es-ES")
                            : "—"}
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
    </SalesShell>
  );
}
