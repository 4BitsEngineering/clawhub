import { requireEmpresa } from "@/lib/session";
import { EmpresaShell } from "@/components/empresa-shell";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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

export default async function EmpresaProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string; status?: string }>;
}) {
  const session = await requireEmpresa();
  const { rep, status } = await searchParams;

  const validStatus =
    status && (VALID_STATUSES as readonly string[]).includes(status)
      ? status
      : undefined;

  const [prospects, salesReps] = await Promise.all([
    db.prospect.findMany({
      where: {
        ...(rep ? { salesRepId: rep } : {}),
        ...(validStatus ? { status: validStatus as (typeof VALID_STATUSES)[number] } : {}),
      },
      include: {
        salesRep: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.salesRep.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const activeFilters = [rep, validStatus].filter(Boolean).length;

  return (
    <EmpresaShell email={session.user.email} isOperator={session.user.role === "OPERATOR"}>
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Todos los prospects
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pipeline completo de todos los comerciales.
            </p>
          </div>
          <div className="text-sm text-muted-foreground self-center">
            {prospects.length} resultado{prospects.length !== 1 ? "s" : ""}
            {activeFilters > 0 && " (filtrado)"}
          </div>
        </div>

        {/* Filtros */}
        <form method="GET" className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Comercial
            </label>
            <select
              name="rep"
              defaultValue={rep ?? ""}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Todos</option>
              {salesReps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.user.name ?? r.user.email}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Estado
            </label>
            <select
              name="status"
              defaultValue={validStatus ?? ""}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Todos</option>
              {VALID_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="h-9 px-4 rounded-lg border border-input bg-background text-sm hover:bg-muted transition-colors"
          >
            Filtrar
          </button>

          {activeFilters > 0 && (
            <a
              href="/empresa/prospects"
              className="h-9 px-4 rounded-lg text-sm text-muted-foreground hover:text-foreground flex items-center transition-colors"
            >
              Limpiar filtros
            </a>
          )}
        </form>

        {/* Tabla */}
        {prospects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {activeFilters > 0
              ? "Ningún prospect coincide con los filtros."
              : "Sin prospects todavía. Los comerciales los añaden desde su panel."}
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
                        "Comercial",
                        "Añadido",
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
                    {prospects.map((p) => (
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
                            variant={STATUS_VARIANT[p.status] ?? "secondary"}
                            className="text-[11px]"
                          >
                            {STATUS_LABELS[p.status] ?? p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.salesRep
                            ? (p.salesRep.user.name ?? p.salesRep.user.email)
                            : <span className="italic">Empresa</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {p.createdAt.toLocaleDateString("es-ES")}
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
