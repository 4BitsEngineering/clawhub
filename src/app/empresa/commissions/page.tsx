import { revalidatePath } from "next/cache";
import { requireEmpresa, requireOperator } from "@/lib/session";
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

// Prefijo en Commission.notes que marca una comisión creada por atribución
// manual (permite distinguirlas de las automáticas y habilitar el reverso).
const MANUAL_TAG = "Atribución manual";

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

  // Atribución manual (solo OPERATOR): asignar una compra existente a un
  // comercial creando su comisión. Misma fórmula que el webhook de Stripe
  // (supabase/functions/stripe-webhook/index.ts) — si cambia, actualizar ambos.
  async function attributePurchaseAction(formData: FormData) {
    "use server";
    const op = await requireOperator();
    const purchaseId = ((formData.get("purchaseId") as string) ?? "").trim();
    const salesRepId = ((formData.get("salesRepId") as string) ?? "").trim();
    if (!purchaseId || !salesRepId) return;

    const [purchase, rep] = await Promise.all([
      db.purchase.findUnique({
        where: { id: purchaseId },
        select: {
          id: true,
          amountCents: true,
          feeAmountCents: true,
          status: true,
          commission: { select: { id: true } },
        },
      }),
      db.salesRep.findUnique({
        where: { id: salesRepId },
        select: { id: true, commissionRate: true },
      }),
    ]);

    // Guardas: compra completada, sin comisión previa, comercial válido.
    if (!purchase || !rep) return;
    if (purchase.status !== "COMPLETED") return;
    if (purchase.commission) return;

    // Base de comisión = fee (excluye tokens). Fallback a amountCents para
    // compras antiguas anteriores al desglose fee/tokens.
    const feeBase = purchase.feeAmountCents ?? purchase.amountCents;

    try {
      await db.commission.create({
        data: {
          purchaseId: purchase.id,
          salesRepId: rep.id,
          rate: rep.commissionRate,
          amountCents: Math.round(feeBase * rep.commissionRate),
          status: "PENDING",
          notes: `${MANUAL_TAG} · ${op.user.email} · ${new Date().toISOString()}`,
        },
      });
    } catch (err) {
      // Colisión con el @unique de purchaseId (doble submit / carrera) → no-op.
      const msg = (err as Error).message ?? "";
      if (!msg.includes("Unique constraint")) throw err;
    }
    revalidatePath("/empresa/commissions");
  }

  // Reverso de una atribución manual mientras esté PENDING. Nunca borra
  // comisiones automáticas ni comisiones ya pagadas.
  async function undoAttributionAction(formData: FormData) {
    "use server";
    await requireOperator();
    const commissionId = ((formData.get("commissionId") as string) ?? "").trim();
    if (!commissionId) return;

    const comm = await db.commission.findUnique({
      where: { id: commissionId },
      select: { id: true, status: true, notes: true },
    });
    if (!comm) return;
    if (comm.status !== "PENDING") return;
    if (!comm.notes?.startsWith(MANUAL_TAG)) return;

    await db.commission.delete({ where: { id: comm.id } });
    revalidatePath("/empresa/commissions");
  }

  const isOperator = session.user.role === "OPERATOR";

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
  // La consulta incluye `notes` por defecto (no hay select), así que basta con
  // leerlo para saber si una comisión es de origen manual.

  // Atribución manual (solo OPERATOR): compras completadas sin comisión + los
  // comerciales activos a los que asignarlas. Solo se consulta si es operador.
  const [unattributed, activeReps] = isOperator
    ? await Promise.all([
        db.purchase.findMany({
          where: { status: "COMPLETED", commission: { is: null } },
          select: {
            id: true,
            amountCents: true,
            completedAt: true,
            buyerName: true,
            buyerEmail: true,
          },
          orderBy: { completedAt: "desc" },
        }),
        db.salesRep.findMany({
          where: { status: "ACTIVE" },
          select: {
            id: true,
            commissionRate: true,
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        }),
      ])
    : [[], []];

  const pendingCents = commissions
    .filter((c) => c.status === "PENDING")
    .reduce((s, c) => s + c.amountCents, 0);
  const paidCents = commissions
    .filter((c) => c.status === "PAID")
    .reduce((s, c) => s + c.amountCents, 0);
  const pendingCount = commissions.filter((c) => c.status === "PENDING").length;

  return (
    <EmpresaShell email={session.user.email} isOperator={session.user.role === "OPERATOR"}>
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

        {/* Atribución manual — solo OPERATOR */}
        {isOperator && unattributed.length > 0 && (
          <Card className="card-paper p-0 overflow-hidden border-amber-500/30">
            <CardHeader className="px-6 py-4 border-b">
              <CardTitle className="text-base">
                Compras sin atribuir ({unattributed.length})
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Compras completadas sin comercial asociado. Asígnalas para
                generar su comisión con la tarifa vigente del comercial.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      {["Comprador", "Venta", "Fecha", "Atribuir a"].map((h) => (
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
                    {unattributed.map((p) => (
                      <TableRow
                        key={p.id}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <TableCell>
                          <div className="font-medium">{p.buyerName ?? "—"}</div>
                          {p.buyerEmail && (
                            <div className="text-xs text-muted-foreground">
                              {p.buyerEmail}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums font-medium">
                          {fmt(p.amountCents)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {p.completedAt
                            ? p.completedAt.toLocaleDateString("es-ES")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {activeReps.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              Sin comerciales activos
                            </span>
                          ) : (
                            <form
                              action={attributePurchaseAction}
                              className="flex items-center gap-2"
                            >
                              <input type="hidden" name="purchaseId" value={p.id} />
                              <select
                                name="salesRepId"
                                required
                                defaultValue=""
                                className="h-9 rounded-md border border-border bg-background px-2 text-sm max-w-[180px]"
                              >
                                <option value="" disabled>
                                  Elegir comercial…
                                </option>
                                {activeReps.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {(r.user.name ?? r.user.email) +
                                      ` · ${Math.round(r.commissionRate * 100)}%`}
                                  </option>
                                ))}
                              </select>
                              <Button type="submit" size="sm">
                                Atribuir
                              </Button>
                            </form>
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
                            <div className="flex items-center gap-2">
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
                              {/* Deshacer solo atribuciones manuales (OPERATOR) */}
                              {isOperator && c.notes?.startsWith(MANUAL_TAG) && (
                                <form action={undoAttributionAction}>
                                  <input
                                    type="hidden"
                                    name="commissionId"
                                    value={c.id}
                                  />
                                  <Button
                                    type="submit"
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground"
                                  >
                                    Deshacer
                                  </Button>
                                </form>
                              )}
                            </div>
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
