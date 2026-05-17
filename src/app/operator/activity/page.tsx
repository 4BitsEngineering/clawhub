/**
 * /operator/activity — timeline global de auditoría.
 *
 * Filtros via query string:
 *   ?firmId=<uuid>       — solo una firma
 *   ?instanceId=<uuid>   — solo una instancia (paginación se hereda)
 *   ?kind=<prefix>       — filtrar por prefijo de kind ("command." | "baseline." | ...)
 *   ?cursor=<iso>        — paginación cursor-based (older)
 *
 * Operator ve TODAS las firmas. Para auditoría per-firma desde rol firm_admin
 * usar /firm que ya tiene su propio timeline.
 */
import Link from "next/link";
import { requireOperator } from "@/lib/session";
import { db } from "@/lib/db";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActivityTimeline } from "@/components/activity-timeline";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
const KIND_PREFIXES = [
  { value: "", label: "Todos" },
  { value: "pair.", label: "Altas / desemparejos" },
  { value: "command.", label: "Comandos" },
  { value: "baseline.", label: "Baselines" },
  { value: "stack.", label: "Stack manifest" },
  { value: "config.", label: "Configuración" },
  { value: "skill.", label: "Skills" },
];

export default async function OperatorActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    firmId?: string;
    instanceId?: string;
    kind?: string;
    cursor?: string;
  }>;
}) {
  await requireOperator();
  const sp = await searchParams;
  const firmId = sp.firmId || null;
  const instanceId = sp.instanceId || null;
  const kindPrefix = sp.kind || "";
  const cursor = sp.cursor ? new Date(sp.cursor) : null;

  const where: Record<string, unknown> = {};
  if (firmId) where.firmId = firmId;
  if (instanceId) where.instanceId = instanceId;
  if (kindPrefix) where.kind = { startsWith: kindPrefix };
  if (cursor) where.createdAt = { lt: cursor };

  const [activities, firms] = await Promise.all([
    db.activity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    db.firm.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const olderCursor =
    activities.length === PAGE_SIZE
      ? activities[activities.length - 1].createdAt.toISOString()
      : null;

  const baseQuery = new URLSearchParams();
  if (firmId) baseQuery.set("firmId", firmId);
  if (instanceId) baseQuery.set("instanceId", instanceId);
  if (kindPrefix) baseQuery.set("kind", kindPrefix);

  const olderHref = olderCursor
    ? `/operator/activity?${(() => {
        const q = new URLSearchParams(baseQuery);
        q.set("cursor", olderCursor);
        return q.toString();
      })()}`
    : null;

  return (
    <main className="container-page min-h-screen py-8 sm:py-12 space-y-8">
      <AutoRefresh intervalMs={15_000} />

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="eyebrow-chip">operator</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            Actividad global
          </h1>
          <p className="text-sm text-muted-foreground">
            Log universal de auditoría: pair, comandos, baselines, stack
            pinning, cambios de configuración.
          </p>
        </div>
        <Link
          href="/operator"
          className="text-sm underline text-muted-foreground"
        >
          ← Volver a operator
        </Link>
      </header>

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Filtros</CardTitle>
          <CardDescription>
            Acota por firma, instancia o tipo de evento.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form className="flex flex-wrap gap-3 items-end" method="get">
            <div className="space-y-1">
              <label className="eyebrow text-[10px] block">Firma</label>
              <select
                name="firmId"
                defaultValue={firmId ?? ""}
                className="border rounded h-9 px-2 text-sm bg-background"
              >
                <option value="">Todas</option>
                {firms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="eyebrow text-[10px] block">Tipo</label>
              <select
                name="kind"
                defaultValue={kindPrefix}
                className="border rounded h-9 px-2 text-sm bg-background"
              >
                {KIND_PREFIXES.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            {instanceId && (
              <input type="hidden" name="instanceId" value={instanceId} />
            )}
            <button
              type="submit"
              className="h-9 px-4 text-sm rounded border bg-background hover:bg-paper-2"
            >
              Aplicar
            </button>
            {(firmId || instanceId || kindPrefix) && (
              <Link
                href="/operator/activity"
                className="text-xs underline text-muted-foreground self-center"
              >
                limpiar filtros
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            {activities.length} eventos
            {olderHref && ` (de las últimas ${PAGE_SIZE} entradas)`}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <ActivityTimeline
            activities={activities}
            emptyMessage="No hay actividad para los filtros seleccionados."
          />
          {olderHref && (
            <div className="pt-6">
              <Link
                href={olderHref}
                className="text-sm underline text-muted-foreground"
              >
                Cargar eventos más antiguos →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
