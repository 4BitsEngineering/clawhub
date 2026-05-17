/**
 * /firm/usage — dashboard agregado de consumo de la firma.
 *
 * Agregaciones:
 *   - Total tokens (in/out/cache) y coste $ por rango temporal
 *   - Breakdown por agente (top consumidores)
 *   - Breakdown por instancia (qué PC consume más)
 *   - Daily series últimos 30 días
 *
 * Tiempo: querystring ?range=7d|30d|90d (default 30d). All-time disponible.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireFirmAdmin } from "@/lib/session";
import { AutoRefresh } from "@/components/auto-refresh";
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

const RANGES = [
  { value: "7d", label: "7 días", days: 7 },
  { value: "30d", label: "30 días", days: 30 },
  { value: "90d", label: "90 días", days: 90 },
  { value: "all", label: "Todo", days: null as number | null },
];

function parseRange(raw: string | undefined): (typeof RANGES)[number] {
  return RANGES.find((r) => r.value === raw) ?? RANGES[1];
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1000) return n.toLocaleString("es-ES");
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

function formatCost(usd: number | null | undefined): string {
  if (usd == null || usd === 0) return "$0.00";
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

export default async function FirmUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireFirmAdmin();
  const firmId = session.user.firmId;
  const sp = await searchParams;
  const range = parseRange(sp.range);

  const firm = await db.firm.findUnique({
    where: { id: firmId },
    select: { name: true },
  });
  if (!firm) redirect("/login");

  const since = range.days
    ? new Date(Date.now() - range.days * 24 * 60 * 60 * 1000)
    : null;

  const where: { firmId: string; endTime?: { gte: Date } } = { firmId };
  if (since) where.endTime = { gte: since };

  // Total agregado
  const totals = await db.usageRecord.aggregate({
    where,
    _sum: {
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
      costUsd: true,
      turnCount: true,
    },
    _count: { _all: true },
  });

  // Top agentes
  const byAgent = await db.usageRecord.groupBy({
    by: ["agentId"],
    where,
    _sum: {
      inputTokens: true,
      outputTokens: true,
      costUsd: true,
    },
    _count: { _all: true },
    orderBy: { _sum: { costUsd: "desc" } },
    take: 15,
  });

  // Por instancia
  const byInstance = await db.usageRecord.groupBy({
    by: ["instanceId"],
    where,
    _sum: {
      inputTokens: true,
      outputTokens: true,
      costUsd: true,
    },
    _count: { _all: true },
    orderBy: { _sum: { costUsd: "desc" } },
    take: 30,
  });

  // Resolver workerLabel para cada instanceId del top
  const instanceLabels = await db.instance.findMany({
    where: { id: { in: byInstance.map((i) => i.instanceId) } },
    select: { id: true, workerLabel: true },
  });
  const labelByInstance = new Map(
    instanceLabels.map((i) => [i.id, i.workerLabel]),
  );

  // Serie diaria — agrupamos en TS porque Prisma no soporta date_trunc nativo
  // sin SQL crudo. Para una firma con ~1000 spans/día y 30 días esto son
  // 30k records — OK en memoria.
  const series = await db.usageRecord.findMany({
    where,
    select: {
      endTime: true,
      inputTokens: true,
      outputTokens: true,
      costUsd: true,
    },
    take: 50_000, // hard cap defensivo
  });
  type DayBucket = {
    day: string;
    tokens: number;
    cost: number;
    spans: number;
  };
  const dailyMap = new Map<string, DayBucket>();
  for (const s of series) {
    const day = s.endTime.toISOString().slice(0, 10);
    let b = dailyMap.get(day);
    if (!b) {
      b = { day, tokens: 0, cost: 0, spans: 0 };
      dailyMap.set(day, b);
    }
    b.tokens += (s.inputTokens ?? 0) + (s.outputTokens ?? 0);
    b.cost += s.costUsd ?? 0;
    b.spans += 1;
  }
  const dailyArr = Array.from(dailyMap.values()).sort((a, b) =>
    b.day.localeCompare(a.day),
  );

  const totalTokens =
    (totals._sum.inputTokens ?? 0) +
    (totals._sum.outputTokens ?? 0);
  const cacheTokens =
    (totals._sum.cacheReadTokens ?? 0) +
    (totals._sum.cacheWriteTokens ?? 0);

  // Mini sparkline ascii
  const maxBucketCost = Math.max(...dailyArr.map((d) => d.cost), 0.0001);

  return (
    <main className="container-page min-h-screen py-8 sm:py-12 space-y-8">
      <AutoRefresh intervalMs={30_000} />

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="eyebrow-chip">firm admin · {firm.name}</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            Consumo
          </h1>
          <p className="text-sm text-muted-foreground">
            Tokens y coste agregados de tus PCs. Datos extraídos del log del
            bridge — son las cifras reales del proveedor, no estimaciones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <Link
              key={r.value}
              href={`/firm/usage?range=${r.value}`}
              className={
                "text-sm px-3 h-9 inline-flex items-center rounded border " +
                (range.value === r.value
                  ? "bg-foreground text-background"
                  : "bg-background hover:bg-paper-2")
              }
            >
              {r.label}
            </Link>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">Tokens totales</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatNumber(totalTokens)}
          </div>
          <div className="text-xs text-muted-foreground">
            in: {formatNumber(totals._sum.inputTokens)} · out:{" "}
            {formatNumber(totals._sum.outputTokens)}
          </div>
        </div>
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">Cache</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatNumber(cacheTokens)}
          </div>
          <div className="text-xs text-muted-foreground">
            read+write (sin coste in/out)
          </div>
        </div>
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">Coste estimado</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatCost(totals._sum.costUsd)}
          </div>
          <div className="text-xs text-muted-foreground">
            tarifa mayorista
          </div>
        </div>
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">Turnos de agente</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatNumber(totals._sum.turnCount)}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatNumber(totals._count._all)} spans
          </div>
        </div>
      </div>

      {dailyArr.length > 0 && (
        <Card className="card-paper border-0 shadow-none p-0">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="font-display text-xl">
              Consumo diario
            </CardTitle>
            <CardDescription>
              Coste $ y tokens por día. Última columna = más reciente.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-1.5 max-h-72 overflow-auto">
              {dailyArr.map((d) => {
                const widthPct = (d.cost / maxBucketCost) * 100;
                return (
                  <div
                    key={d.day}
                    className="flex items-center gap-3 text-xs"
                  >
                    <span className="font-mono w-24 shrink-0 text-muted-foreground tabular-nums">
                      {d.day}
                    </span>
                    <div className="flex-1 h-5 bg-paper-2/50 rounded relative overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: "var(--brand)",
                          opacity: 0.5,
                        }}
                      />
                      <span className="absolute inset-0 px-2 flex items-center text-[11px] tabular-nums">
                        {formatCost(d.cost)} · {formatNumber(d.tokens)} tok · {d.spans} spans
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="card-paper border-0 shadow-none p-0">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="font-display text-xl">Top agentes</CardTitle>
            <CardDescription>
              Quién consume más en el rango seleccionado.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-4 pb-4">
            {byAgent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Sin datos en este rango.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="eyebrow text-[10px]">Agente</TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Tokens
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Coste
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byAgent.map((a) => {
                    const tokens =
                      (a._sum.inputTokens ?? 0) +
                      (a._sum.outputTokens ?? 0);
                    return (
                      <TableRow key={a.agentId} className="hover:bg-paper-2/60">
                        <TableCell className="font-mono text-xs">
                          {a.agentId}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatNumber(tokens)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatCost(a._sum.costUsd)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="card-paper border-0 shadow-none p-0">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="font-display text-xl">Por PC</CardTitle>
            <CardDescription>
              Qué trabajador consume más.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-4 pb-4">
            {byInstance.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Sin datos en este rango.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="eyebrow text-[10px]">PC</TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Tokens
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Coste
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byInstance.map((i) => {
                    const tokens =
                      (i._sum.inputTokens ?? 0) +
                      (i._sum.outputTokens ?? 0);
                    const label = labelByInstance.get(i.instanceId);
                    return (
                      <TableRow key={i.instanceId} className="hover:bg-paper-2/60">
                        <TableCell className="font-medium text-sm">
                          <Link
                            href={`/firm/instances/${i.instanceId}`}
                            className="hover:text-brand"
                          >
                            {label ?? i.instanceId.slice(0, 8)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatNumber(tokens)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatCost(i._sum.costUsd)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
