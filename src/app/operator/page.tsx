import Link from "next/link";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";
import { AutoRefresh } from "@/components/auto-refresh";
import { OperatorShell } from "@/components/operator-shell";
import { SearchInput } from "@/components/search-input";
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
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;
const PAGE_SIZE = 10;

export default async function OperatorPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await requireOperator();
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";
  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where = query
    ? { name: { contains: query, mode: "insensitive" as const } }
    : {};

  const [firms, filteredCount, recentAlerts, globalFirms] = await Promise.all([
    db.firm.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        instances: {
          select: { lastHeartbeatAt: true, disabledAt: true },
        },
        _count: { select: { instances: true, users: true } },
      },
    }),
    db.firm.count({ where }),
    db.activity.findMany({
      where: {
        kind: "instance.offline_alert",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.firm.findMany({
      select: {
        seatsPurchased: true,
        instances: { select: { lastHeartbeatAt: true, disabledAt: true } },
        _count: { select: { instances: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const totalFirms = globalFirms.length;
  const totalInstances = globalFirms.reduce((s, f) => s + f._count.instances, 0);
  const totalSeats = globalFirms.reduce((s, f) => s + f.seatsPurchased, 0);
  const totalOnline = globalFirms.reduce(
    (s, f) =>
      s +
      f.instances.filter(
        (i) =>
          i.lastHeartbeatAt &&
          Date.now() - i.lastHeartbeatAt.getTime() < ONLINE_THRESHOLD_MS &&
          !i.disabledAt,
      ).length,
    0,
  );
  const occupancy =
    totalSeats > 0 ? Math.round((totalInstances / totalSeats) * 100) : 0;

  return (
    <OperatorShell email={session.user.email}>
      <AutoRefresh intervalMs={10_000} />
      <div className="space-y-8">
        {/* ── KPIs ── */}
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Empresas", value: totalFirms },
              {
                label: "PCs registrados",
                value: totalInstances,
                sub: `/ ${totalSeats}`,
              },
              {
                label: "Online ahora",
                value: totalOnline,
                color: "text-green-600 dark:text-green-400",
              },
              { label: "Ocupación", value: `${occupancy}%` },
              {
                label: "Alertas 24h",
                value: recentAlerts.length,
                color:
                  recentAlerts.length > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : undefined,
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="card-paper p-4 sm:p-5 space-y-1.5"
              >
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {kpi.label}
                </div>
                <div
                  className={`text-2xl sm:text-3xl font-semibold tabular-nums leading-none ${kpi.color ?? ""}`}
                >
                  {kpi.value}
                  {kpi.sub && (
                    <span className="text-sm text-muted-foreground font-normal">
                      {" "}
                      {kpi.sub}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Alertas (solo si hay) ── */}
        {recentAlerts.length > 0 && (
          <section>
            <Card className="card-paper border-l-4 border-l-amber-500 p-0">
              <CardContent className="px-6 py-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  <h3 className="text-sm font-semibold">
                    {recentAlerts.length} PC
                    {recentAlerts.length === 1 ? "" : "s"} sin conexión &gt;24 h
                  </h3>
                </div>
                <ul className="space-y-2">
                  {recentAlerts.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start gap-3 text-sm"
                    >
                      <span className="mt-1.5 shrink-0 h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <div className="flex-1 min-w-0">
                        <span>{a.summary}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {a.createdAt.toLocaleString("es-ES")}
                        </span>
                        {a.instanceId && (
                          <Link
                            href={`/firm/instances/${a.instanceId}`}
                            className="text-xs text-brand hover:underline ml-2"
                          >
                            ver PC
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Tabla de empresas ── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Empresas
              </h2>
              {query && (
                <p className="text-xs text-muted-foreground">
                  {filteredCount} resultado{filteredCount !== 1 ? "s" : ""} para
                  &ldquo;{query}&rdquo;
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <SearchInput placeholder="Buscar empresa..." />
              <Link
                href="/operator/firms/new"
                className={
                  buttonVariants({ size: "sm" }) + " h-9 px-4 text-xs shrink-0"
                }
                style={{
                  backgroundColor: "var(--brand)",
                  color: "var(--brand-foreground)",
                }}
              >
                + Nueva
              </Link>
            </div>
          </div>

          <Card className="card-paper p-0 overflow-hidden">
            <CardContent className="p-0">
              {firms.length === 0 ? (
                <p className="text-sm text-muted-foreground px-6 py-12 text-center">
                  {query
                    ? `Sin resultados para "${query}".`
                    : "No hay empresas. Crea la primera con + Nueva empresa."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider pl-6">
                          Empresa
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                          Plan
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                          Estado
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">
                          PCs
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">
                          Online
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">
                          Licencias
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">
                          Admins
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider pr-6">
                          Creada
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {firms.map((f) => {
                        const onlineCount = f.instances.filter(
                          (i) =>
                            i.lastHeartbeatAt &&
                            Date.now() - i.lastHeartbeatAt.getTime() <
                              ONLINE_THRESHOLD_MS &&
                            !i.disabledAt,
                        ).length;
                        const disabledCount = f.instances.filter(
                          (i) => i.disabledAt,
                        ).length;
                        const isSuspended = f.status === "suspended";
                        return (
                          <TableRow
                            key={f.id}
                            className="hover:bg-muted/20 transition-colors"
                          >
                            <TableCell className="font-medium pl-6">
                              <Link
                                href={`/operator/firms/${f.id}`}
                                className="hover:text-brand transition-colors"
                              >
                                {f.name}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className="font-mono text-[11px]"
                              >
                                {f.plan}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isSuspended ? (
                                <Badge variant="destructive" className="text-[11px]">
                                  Suspendida
                                </Badge>
                              ) : disabledCount > 0 ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[11px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                >
                                  {disabledCount} bloqueada
                                  {disabledCount > 1 ? "s" : ""}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="text-[11px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                >
                                  Activa
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {f._count.instances}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              <span
                                className={
                                  onlineCount > 0
                                    ? "text-green-600 dark:text-green-400 font-medium"
                                    : "text-muted-foreground"
                                }
                              >
                                {onlineCount}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {f.seatsPurchased}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {f._count.users}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm pr-6">
                              {f.createdAt.toLocaleDateString("es-ES")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/10">
                  <span className="text-xs text-muted-foreground">
                    Página {currentPage} de {totalPages}
                    <span className="hidden sm:inline">
                      {" "}
                      ({filteredCount} empresa{filteredCount !== 1 ? "s" : ""})
                    </span>
                  </span>
                  <div className="flex gap-1.5">
                    {currentPage > 1 && (
                      <Link
                        href={`/operator?${new URLSearchParams({
                          ...(query ? { q: query } : {}),
                          page: String(currentPage - 1),
                        }).toString()}`}
                        className={
                          buttonVariants({ variant: "outline", size: "sm" }) +
                          " h-8 px-3 text-xs"
                        }
                      >
                        Anterior
                      </Link>
                    )}
                    {currentPage < totalPages && (
                      <Link
                        href={`/operator?${new URLSearchParams({
                          ...(query ? { q: query } : {}),
                          page: String(currentPage + 1),
                        }).toString()}`}
                        className={
                          buttonVariants({ variant: "outline", size: "sm" }) +
                          " h-8 px-3 text-xs"
                        }
                      >
                        Siguiente
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </OperatorShell>
  );
}
