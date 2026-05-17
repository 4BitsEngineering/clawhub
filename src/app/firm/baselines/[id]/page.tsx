/**
 * /firm/baselines/[id] — detalle de un baseline + diff opcional contra otro.
 *
 * Query params:
 *   ?compareTo=<baseline_id>   — diff vs ese baseline (recomendado: el último
 *                                snapshot de la instancia donde quieres aplicar)
 *
 * Permisos: firm_admin solo ve baselines de su firma; operator ve todos.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { diffBaselines, type DiffEntry } from "@/lib/baseline-diff";

export const dynamic = "force-dynamic";

function statusLabel(s: DiffEntry["status"]): {
  text: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  switch (s) {
    case "added":
      return { text: "+ nuevo", variant: "default" };
    case "modified":
      return { text: "~ cambia", variant: "outline" };
    case "removed":
      return { text: "- borrado", variant: "destructive" };
    case "preserved":
      return { text: "preservado", variant: "secondary" };
    case "unchanged":
      return { text: "igual", variant: "secondary" };
  }
}

export default async function BaselineDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ compareTo?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const { compareTo } = await searchParams;

  const baseline = await db.firmBaseline.findUnique({
    where: { id },
    include: {
      files: { orderBy: { path: "asc" } },
      firm: { select: { id: true, name: true } },
    },
  });
  if (!baseline) notFound();

  if (
    session.user.role === "FIRM_ADMIN" &&
    baseline.firmId !== session.user.firmId
  ) {
    notFound();
  }

  // Si compareTo, cargamos el otro baseline (debe ser de la misma firma)
  let other: typeof baseline | null = null;
  if (compareTo && compareTo !== id) {
    other = await db.firmBaseline.findUnique({
      where: { id: compareTo },
      include: {
        files: { orderBy: { path: "asc" } },
        firm: { select: { id: true, name: true } },
      },
    });
    if (!other || other.firmId !== baseline.firmId) {
      other = null;
    }
  }

  // Lista de baselines hermanos para el selector compareTo
  const siblingBaselines = await db.firmBaseline.findMany({
    where: { firmId: baseline.firmId, id: { not: id } },
    orderBy: { version: "desc" },
    select: { id: true, version: true, label: true },
    take: 30,
  });

  const diff = other
    ? diffBaselines(other.files, baseline.files)
    : null;

  async function promoteBaselineAction() {
    "use server";
    const sess = await getSession();
    if (!sess) redirect("/login");
    if (
      sess.user.role === "FIRM_ADMIN" &&
      baseline!.firmId !== sess.user.firmId
    ) {
      throw new Error("forbidden");
    }
    // Solo un baseline puede ser promoted por firma. Demote others atómicamente.
    await db.$transaction([
      db.firmBaseline.updateMany({
        where: { firmId: baseline!.firmId, isPromoted: true },
        data: { isPromoted: false, promotedAt: null, promotedBy: null },
      }),
      db.firmBaseline.update({
        where: { id: baseline!.id },
        data: {
          isPromoted: true,
          promotedAt: new Date(),
          promotedBy: sess.user.id,
        },
      }),
    ]);
    await recordActivity({
      kind: "baseline.promote",
      summary: `Promovió baseline v${baseline!.version} "${baseline!.label}" como canónico`,
      firmId: baseline!.firmId,
      actor: sess,
      metadata: {
        baseline_id: baseline!.id,
        version: baseline!.version,
        label: baseline!.label,
      },
    });
    revalidatePath(`/firm/baselines/${baseline!.id}`);
    revalidatePath("/firm");
  }

  async function demoteBaselineAction() {
    "use server";
    const sess = await getSession();
    if (!sess) redirect("/login");
    if (
      sess.user.role === "FIRM_ADMIN" &&
      baseline!.firmId !== sess.user.firmId
    ) {
      throw new Error("forbidden");
    }
    await db.firmBaseline.update({
      where: { id: baseline!.id },
      data: { isPromoted: false, promotedAt: null, promotedBy: null },
    });
    await recordActivity({
      kind: "baseline.demote",
      summary: `Quitó canónico al baseline v${baseline!.version}`,
      firmId: baseline!.firmId,
      actor: sess,
      metadata: { baseline_id: baseline!.id, version: baseline!.version },
    });
    revalidatePath(`/firm/baselines/${baseline!.id}`);
  }

  return (
    <main className="container-page min-h-screen py-8 sm:py-12 space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="eyebrow-chip">
            {baseline.firm.name} · baseline v{baseline.version}
            {baseline.isPromoted && " · ⭐ CANÓNICO"}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            {baseline.label}
          </h1>
          <p className="text-sm text-muted-foreground">
            {baseline.fileCount} archivos · {(baseline.totalBytes / 1024).toFixed(1)}{" "}
            KB · creado {baseline.createdAt.toLocaleString("es-ES")}
            {baseline.description && ` · ${baseline.description}`}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {baseline.isPromoted ? (
            <form action={demoteBaselineAction}>
              <Button type="submit" variant="outline" size="sm">
                Quitar canónico
              </Button>
            </form>
          ) : (
            <form action={promoteBaselineAction}>
              <Button
                type="submit"
                size="sm"
                style={{
                  backgroundColor: "var(--brand)",
                  color: "var(--brand-foreground)",
                }}
              >
                ⭐ Marcar como canónico
              </Button>
            </form>
          )}
          <Link
            href={
              session.user.role === "FIRM_ADMIN"
                ? "/firm"
                : `/operator/firms/${baseline.firmId}`
            }
            className="text-sm underline text-muted-foreground"
          >
            ← Volver
          </Link>
        </div>
      </header>

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            Comparar con otro baseline
          </CardTitle>
          <CardDescription>
            Útil antes de un reset: elige el snapshot más reciente de la
            instancia destino para ver qué cambiará.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form method="get" className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="eyebrow text-[10px] block">Baseline base</label>
              <select
                name="compareTo"
                defaultValue={compareTo ?? ""}
                className="border rounded h-9 px-2 text-sm bg-background"
              >
                <option value="">— sin comparación —</option>
                {siblingBaselines.map((b) => (
                  <option key={b.id} value={b.id}>
                    v{b.version} · {b.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="h-9 px-4 text-sm rounded border bg-background hover:bg-paper-2"
            >
              Comparar
            </button>
          </form>
        </CardContent>
      </Card>

      {diff && other ? (
        <Card className="card-paper border-0 shadow-none p-0">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="font-display text-xl">
              Diff: v{other.version} → v{baseline.version}
            </CardTitle>
            <CardDescription className="space-x-3">
              <span>
                <strong className="text-green-700 dark:text-green-400">
                  +{diff.counts.added}
                </strong>{" "}
                nuevos
              </span>
              <span>
                <strong className="text-amber-700 dark:text-amber-400">
                  ~{diff.counts.modified}
                </strong>{" "}
                modificados
              </span>
              <span>
                <strong className="text-red-700 dark:text-red-400">
                  −{diff.counts.removed}
                </strong>{" "}
                borrados
              </span>
              <span className="text-muted-foreground">
                {diff.counts.preserved} preservados · {diff.counts.unchanged}{" "}
                sin cambios
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-1 max-h-[480px] overflow-auto">
              {diff.entries.map((e) => {
                const lbl = statusLabel(e.status);
                return (
                  <div
                    key={e.path}
                    className="flex items-center gap-3 py-1 text-sm"
                  >
                    <Badge variant={lbl.variant} className="shrink-0 min-w-[88px] justify-center">
                      {lbl.text}
                    </Badge>
                    <span className="font-mono text-xs flex-1 truncate">
                      {e.path}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {e.category}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              <strong>preservado</strong> = MEMORY.md y memoria de agentes.
              El agent NO sobreescribe estos archivos durante reset, da
              igual qué traiga el baseline.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="card-paper border-0 shadow-none p-0">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="font-display text-xl">
              Archivos del baseline ({baseline.fileCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-1 max-h-[480px] overflow-auto">
              {baseline.files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 py-1 text-sm"
                >
                  <span className="font-mono text-xs flex-1 truncate">
                    {f.path}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {f.category}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {(f.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
