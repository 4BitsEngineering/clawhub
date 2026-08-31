import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireEmpresa, requireOperator } from "@/lib/session";
import { EmpresaShell } from "@/components/empresa-shell";
import { db } from "@/lib/db";
import { catalogTeam, resolveTeamAgainst } from "@/lib/agent-catalog-db";
import type { CommissionStatus } from "@/generated/prisma/client";
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

const STATUS_LABEL: Record<CommissionStatus, string> = {
  PENDING: "Pendiente",
  TRANSFERRED: "Transferida",
  INCIDENT: "Incidencia",
};

function fmt(cents: number) {
  return (cents / 100).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

export default async function EmpresaCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const session = await requireEmpresa();
  const { estado } = await searchParams;
  const statusFilter: CommissionStatus | null =
    estado === "PENDING" || estado === "TRANSFERRED" || estado === "INCIDENT"
      ? estado
      : null;

  // ── Transiciones del ciclo de pago (transferencia bancaria manual) ────────
  // Cada action revalida rol y valida la transición desde el estado actual.

  async function markTransferredAction(formData: FormData) {
    "use server";
    await requireEmpresa();
    const id = ((formData.get("id") as string) ?? "").trim();
    const ref = ((formData.get("ref") as string) ?? "").trim() || null;
    if (!id) return;
    // Permitido desde PENDING (pago normal) e INCIDENT (resuelta con pago)
    await db.commission.updateMany({
      where: { id, status: { in: ["PENDING", "INCIDENT"] } },
      data: { status: "TRANSFERRED", paidAt: new Date(), paymentRef: ref },
    });
    revalidatePath("/empresa/commissions");
  }

  async function markIncidentAction(formData: FormData) {
    "use server";
    await requireEmpresa();
    const id = ((formData.get("id") as string) ?? "").trim();
    const note = ((formData.get("note") as string) ?? "").trim();
    if (!id || !note) return; // nota obligatoria
    // Permitido desde PENDING (no se pudo pagar) y TRANSFERRED (devolución)
    await db.commission.updateMany({
      where: { id, status: { in: ["PENDING", "TRANSFERRED"] } },
      data: { status: "INCIDENT", paymentNote: note },
    });
    revalidatePath("/empresa/commissions");
  }

  async function backToPendingAction(formData: FormData) {
    "use server";
    await requireEmpresa();
    const id = ((formData.get("id") as string) ?? "").trim();
    if (!id) return;
    // Reintento tras incidencia o deshacer un marcado erróneo. La nota se
    // conserva como historial.
    await db.commission.updateMany({
      where: { id, status: { in: ["INCIDENT", "TRANSFERRED"] } },
      data: { status: "PENDING", paidAt: null },
    });
    revalidatePath("/empresa/commissions");
  }

  async function markAllTransferredAction() {
    "use server";
    await requireEmpresa();
    await db.commission.updateMany({
      where: { status: "PENDING" },
      data: { status: "TRANSFERRED", paidAt: new Date() },
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
          seats: true,
          status: true,
          commission: { select: { id: true } },
        },
      }),
      db.salesRep.findUnique({
        where: { id: salesRepId },
        select: { id: true, commissionRate: true },
      }),
    ]);

    if (!purchase || !rep) return;
    if (purchase.status !== "COMPLETED") return;
    if (purchase.commission) return;

    // Base de comisión = fee (excluye tokens) × seats — el fee de metadata es
    // unitario (multi-seat-purchases). Fallback a amountCents para compras
    // antiguas anteriores al desglose fee/tokens (seats=1 en esas).
    const feeBase =
      purchase.feeAmountCents != null
        ? purchase.feeAmountCents * purchase.seats
        : purchase.amountCents;

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
      const msg = (err as Error).message ?? "";
      if (!msg.includes("Unique constraint")) throw err;
    }
    revalidatePath("/empresa/commissions");
  }

  // Reverso de una atribución manual: solo mientras esté PENDING.
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
    where: statusFilter ? { status: statusFilter } : undefined,
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

  // KPIs sobre el total (sin filtro), para que no cambien al filtrar
  const all = statusFilter
    ? await db.commission.findMany({ select: { status: true, amountCents: true } })
    : commissions.map((c) => ({ status: c.status, amountCents: c.amountCents }));

  const sumBy = (s: CommissionStatus) =>
    all.filter((c) => c.status === s).reduce((t, c) => t + c.amountCents, 0);
  const countBy = (s: CommissionStatus) =>
    all.filter((c) => c.status === s).length;

  const pendingCents = sumBy("PENDING");
  const transferredCents = sumBy("TRANSFERRED");
  const incidentCents = sumBy("INCIDENT");
  const pendingCount = countBy("PENDING");

  // Atribución manual (solo OPERATOR)
  const [unattributed, activeReps] = isOperator
    ? await Promise.all([
        db.purchase.findMany({
          // Las ventas de la casa (houseSale) no se atribuyen a comerciales.
          where: { status: "COMPLETED", commission: { is: null }, houseSale: false },
          select: {
            id: true,
            amountCents: true,
            feeAmountCents: true,
            completedAt: true,
            buyerName: true,
            buyerEmail: true,
            selectedAgents: true,
            seats: true,
            buyerTaxId: true,
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

  // Catálogo vivo (BD) cargado una vez; las compras se resuelven en síncrono.
  const agentCatalog = await catalogTeam();

  const filterChip = (value: string | null, label: string, count?: number) => {
    const active = statusFilter === value || (!statusFilter && value === null);
    const href = value ? `/empresa/commissions?estado=${value}` : "/empresa/commissions";
    return (
      <Link
        key={label}
        href={href}
        className={
          active
            ? "px-3 py-1 rounded-full text-xs font-semibold bg-violet-600 text-white"
            : "px-3 py-1 rounded-full text-xs border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
        }
      >
        {label}
        {count !== undefined ? ` (${count})` : ""}
      </Link>
    );
  };

  return (
    <EmpresaShell email={session.user.email} isOperator={isOperator}>
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Pagos de comisiones
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Transferencias bancarias a tus comerciales: qué está pendiente, a
              qué cuenta, y su estado.
            </p>
          </div>
          {pendingCount > 0 && (
            <form action={markAllTransferredAction}>
              <Button type="submit" variant="outline" size="sm">
                Marcar transferidas ({pendingCount})
              </Button>
            </form>
          )}
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Pendiente de transferir",
              value: fmt(pendingCents),
              color:
                pendingCents > 0 ? "text-amber-600 dark:text-amber-400" : undefined,
            },
            {
              label: "Transferido",
              value: fmt(transferredCents),
              color:
                transferredCents > 0
                  ? "text-green-600 dark:text-green-400"
                  : undefined,
            },
            {
              label: "En incidencia",
              value: fmt(incidentCents),
              color:
                incidentCents > 0 ? "text-red-600 dark:text-red-400" : undefined,
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
                      <TableRow key={p.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell>
                          <div className="font-medium">{p.buyerName ?? "—"}</div>
                          {p.buyerEmail && (
                            <div className="text-xs text-muted-foreground">
                              {p.buyerEmail}
                            </div>
                          )}
                          <div className="text-[11px] text-muted-foreground">
                            {p.seats > 1 ? `${p.seats} equipos` : "1 equipo"}
                            {p.buyerTaxId ? ` · ${p.buyerTaxId}` : ""}
                          </div>
                          <div
                            className="text-[11px] text-muted-foreground mt-0.5"
                            title={resolveTeamAgainst(agentCatalog, p.selectedAgents)
                              .map((a) => a.displayName)
                              .join(", ")}
                          >
                            {p.selectedAgents.length === 0
                              ? "Equipo completo"
                              : `Equipo: ${resolveTeamAgainst(agentCatalog, p.selectedAgents)
                                  .map((a) => a.icon)
                                  .join(" ")}`}
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums font-medium">
                          {fmt(
                            p.feeAmountCents != null
                              ? p.feeAmountCents * p.seats
                              : p.amountCents,
                          )}
                          {p.feeAmountCents != null &&
                            p.feeAmountCents * p.seats !== p.amountCents && (
                              <div className="text-[11px] text-muted-foreground">
                                fee (total {fmt(p.amountCents)})
                              </div>
                            )}
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

        {/* Filtro por estado */}
        <div className="flex items-center gap-2 flex-wrap">
          {filterChip(null, "Todas", all.length)}
          {filterChip("PENDING", "Pendientes", countBy("PENDING"))}
          {filterChip("TRANSFERRED", "Transferidas", countBy("TRANSFERRED"))}
          {filterChip("INCIDENT", "Incidencias", countBy("INCIDENT"))}
        </div>

        {/* Tabla */}
        {commissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {statusFilter
              ? `Sin comisiones en estado "${STATUS_LABEL[statusFilter]}".`
              : "Sin comisiones todavía. Se generan automáticamente al completarse un pago con atribución a un comercial."}
          </p>
        ) : (
          <Card className="card-paper p-0 overflow-hidden">
            <CardHeader className="px-6 py-4 border-b">
              <CardTitle className="text-base">
                {statusFilter ? STATUS_LABEL[statusFilter] : "Historial"} (
                {commissions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      {[
                        "Comercial / IBAN",
                        "Comprador",
                        "Comisión",
                        "Estado",
                        "Transferida",
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
                    {commissions.map((c) => (
                      <TableRow key={c.id} className="hover:bg-muted/20 transition-colors align-top">
                        <TableCell>
                          <div className="font-medium">
                            {c.salesRep.user.name ?? c.salesRep.user.email}
                          </div>
                          {c.salesRep.iban ? (
                            <>
                              <div className="text-xs font-mono text-muted-foreground select-all">
                                {c.salesRep.iban}
                              </div>
                              {c.salesRep.ibanHolder && (
                                <div className="text-[11px] text-muted-foreground">
                                  Titular: {c.salesRep.ibanHolder}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-xs text-red-500/80">
                              sin IBAN
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {c.purchase.buyerName ?? c.purchase.buyerEmail ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            venta {fmt(c.purchase.amountCents)} ·{" "}
                            {c.purchase.completedAt
                              ? c.purchase.completedAt.toLocaleDateString("es-ES")
                              : "—"}
                          </div>
                        </TableCell>
                        <TableCell
                          className={`tabular-nums font-semibold ${
                            c.status === "TRANSFERRED"
                              ? "text-green-600 dark:text-green-400"
                              : c.status === "INCIDENT"
                                ? "text-red-600 dark:text-red-400"
                                : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {fmt(c.amountCents)}
                          <div className="text-[11px] font-normal text-muted-foreground">
                            {Math.round(c.rate * 100)}%
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.status === "TRANSFERRED"
                                ? "default"
                                : c.status === "INCIDENT"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-[11px]"
                          >
                            {STATUS_LABEL[c.status]}
                          </Badge>
                          {c.paymentNote && (
                            <div className="text-[11px] text-red-500/90 mt-1 max-w-[180px]">
                              {c.paymentNote}
                            </div>
                          )}
                          {c.notes?.startsWith(MANUAL_TAG) && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              atribución manual
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {c.paidAt ? c.paidAt.toLocaleDateString("es-ES") : "—"}
                          {c.paymentRef && (
                            <div className="text-[11px] font-mono">
                              ref: {c.paymentRef}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5 min-w-[220px]">
                            {c.status === "PENDING" && (
                              <>
                                <form
                                  action={markTransferredAction}
                                  className="flex items-center gap-1.5"
                                >
                                  <input type="hidden" name="id" value={c.id} />
                                  <input
                                    name="ref"
                                    placeholder="Ref. (opcional)"
                                    className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs"
                                  />
                                  <Button type="submit" size="sm" variant="outline">
                                    ✓ Transferida
                                  </Button>
                                </form>
                                <div className="flex items-center gap-1.5">
                                  <form
                                    action={markIncidentAction}
                                    className="flex items-center gap-1.5"
                                  >
                                    <input type="hidden" name="id" value={c.id} />
                                    <input
                                      name="note"
                                      required
                                      placeholder="Motivo incidencia…"
                                      className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs"
                                    />
                                    <Button
                                      type="submit"
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-500"
                                    >
                                      ⚠ Incidencia
                                    </Button>
                                  </form>
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
                              </>
                            )}
                            {c.status === "INCIDENT" && (
                              <>
                                <form
                                  action={markTransferredAction}
                                  className="flex items-center gap-1.5"
                                >
                                  <input type="hidden" name="id" value={c.id} />
                                  <input
                                    name="ref"
                                    placeholder="Ref. (opcional)"
                                    className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs"
                                  />
                                  <Button type="submit" size="sm" variant="outline">
                                    ✓ Transferida
                                  </Button>
                                </form>
                                <form action={backToPendingAction}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <Button
                                    type="submit"
                                    size="sm"
                                    variant="ghost"
                                    className="text-muted-foreground"
                                  >
                                    ↩ Volver a pendiente
                                  </Button>
                                </form>
                              </>
                            )}
                            {c.status === "TRANSFERRED" && (
                              <>
                                <form
                                  action={markIncidentAction}
                                  className="flex items-center gap-1.5"
                                >
                                  <input type="hidden" name="id" value={c.id} />
                                  <input
                                    name="note"
                                    required
                                    placeholder="Motivo (devolución…)"
                                    className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs"
                                  />
                                  <Button
                                    type="submit"
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-500"
                                  >
                                    ⚠ Incidencia
                                  </Button>
                                </form>
                                <form action={backToPendingAction}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <Button
                                    type="submit"
                                    size="sm"
                                    variant="ghost"
                                    className="text-muted-foreground"
                                  >
                                    ↩ Volver a pendiente
                                  </Button>
                                </form>
                              </>
                            )}
                          </div>
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
