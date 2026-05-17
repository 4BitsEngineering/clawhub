/**
 * /operator/mass-actions — encolar un comando a N instancias de golpe.
 *
 * Flujo:
 *   1. Operator escoge scope (firma, online-only, etc.) y kind (de la lista
 *      MASS_ACTION_KINDS).
 *   2. Server muestra preview de cuántas instancias matchean.
 *   3. Operator confirma → se crea un InstanceCommand por instancia en una
 *      sola transacción. Cada instancia recibe el comando en su próximo
 *      heartbeat.
 *
 * Solo OPERATOR puede usar esta página. Kinds restringidos a los safe.
 */
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
import { AutoRefresh } from "@/components/auto-refresh";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  COMMAND_KINDS,
  COMMAND_DEFAULT_TTL_MS,
  MASS_ACTION_KINDS,
  MASS_ACTION_DESTRUCTIVE_KINDS,
  type CommandKind,
} from "@/lib/commands";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

type ScopeInput = "all" | "firm" | "online";

function parseScope(raw: string | null): ScopeInput {
  if (raw === "firm" || raw === "online") return raw;
  return "all";
}

function isMassKind(k: string): k is CommandKind {
  return (MASS_ACTION_KINDS as string[]).includes(k);
}

async function resolveTargets(
  scope: ScopeInput,
  firmId: string | null,
  onlineOnly: boolean,
) {
  const where: Prisma.InstanceWhereInput = {};
  if (scope === "firm" && firmId) where.firmId = firmId;
  if (scope === "online" || onlineOnly) {
    where.lastHeartbeatAt = {
      gt: new Date(Date.now() - ONLINE_THRESHOLD_MS),
    };
  }
  return db.instance.findMany({
    where,
    select: {
      id: true,
      workerLabel: true,
      firmId: true,
      lastHeartbeatAt: true,
      firm: { select: { name: true } },
    },
    orderBy: [{ firm: { name: "asc" } }, { workerLabel: "asc" }],
  });
}

export default async function MassActionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    scope?: string;
    firmId?: string;
    onlineOnly?: string;
    kind?: string;
  }>;
}) {
  await requireOperator();
  const sp = await searchParams;
  const scope = parseScope(sp.scope ?? null);
  const firmId = sp.firmId || null;
  const onlineOnly = sp.onlineOnly === "true";
  const selectedKind: string =
    sp.kind && isMassKind(sp.kind) ? sp.kind : "ping";

  const [firms, targets] = await Promise.all([
    db.firm.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { instances: true } } },
    }),
    resolveTargets(scope, firmId, onlineOnly),
  ]);

  async function enqueueMassAction(formData: FormData) {
    "use server";
    const sess = await requireOperator();
    const formScope = parseScope(String(formData.get("scope") ?? ""));
    const formFirmId = String(formData.get("firmId") ?? "") || null;
    const formOnlineOnly = formData.get("onlineOnly") === "on";
    const kindRaw = String(formData.get("kind") ?? "");
    if (!isMassKind(kindRaw)) {
      throw new Error(`kind_not_allowed_for_mass: ${kindRaw}`);
    }
    const kind = kindRaw;
    const confirmDestructive = formData.get("confirmDestructive") === "on";
    if (
      (MASS_ACTION_DESTRUCTIVE_KINDS as string[]).includes(kind) &&
      !confirmDestructive
    ) {
      throw new Error("destructive_confirm_required");
    }

    const matched = await resolveTargets(formScope, formFirmId, formOnlineOnly);
    if (matched.length === 0) throw new Error("no_instances_matched");

    const expiresAt = new Date(Date.now() + COMMAND_DEFAULT_TTL_MS);
    await db.instanceCommand.createMany({
      data: matched.map((inst) => ({
        instanceId: inst.id,
        kind,
        args: Prisma.JsonNull,
        createdBy: sess.user.id,
        expiresAt,
      })),
    });

    // Una sola entrada de Activity describiendo la operación masiva (no N).
    await recordActivity({
      kind: "command.mass_create",
      summary: `Mass action ${kind}: ${matched.length} PCs`,
      actor: sess,
      metadata: {
        command_kind: kind,
        scope: formScope,
        firmId: formFirmId,
        onlineOnly: formOnlineOnly,
        instance_count: matched.length,
        instance_ids: matched.map((i) => i.id),
      },
    });

    // También una entrada por firma afectada (para que aparezca en el
    // timeline de cada firma sin tener que filtrar por instance_ids).
    const byFirm = new Map<string, number>();
    for (const m of matched) {
      byFirm.set(m.firmId, (byFirm.get(m.firmId) ?? 0) + 1);
    }
    for (const [fId, count] of byFirm) {
      await recordActivity({
        kind: "command.mass_create",
        summary: `Mass action ${kind} en ${count} PCs de la firma`,
        firmId: fId,
        actor: sess,
        metadata: { command_kind: kind, instance_count: count },
      });
    }

    revalidatePath("/operator/mass-actions");
    redirect(`/operator/mass-actions?scope=${formScope}&kind=${kind}&done=${matched.length}`);
  }

  const isDestructive = (MASS_ACTION_DESTRUCTIVE_KINDS as string[]).includes(
    selectedKind,
  );

  return (
    <main className="container-page min-h-screen py-8 sm:py-12 space-y-8">
      <AutoRefresh intervalMs={20_000} />

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="eyebrow-chip">operator</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            Acciones masivas
          </h1>
          <p className="text-sm text-muted-foreground">
            Encola un comando seguro en N instancias de golpe. Cada instancia
            lo recibirá en su próximo heartbeat.
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
          <CardTitle className="font-display text-xl">
            Configurar mass action
          </CardTitle>
          <CardDescription>
            El scope determina a qué PCs llega el comando. Solo se pueden
            encolar comandos idempotentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form action={enqueueMassAction} className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="eyebrow text-[10px] mb-2">1. Scope</legend>
              <div className="flex flex-wrap gap-3 items-end">
                <select
                  name="scope"
                  defaultValue={scope}
                  className="border rounded h-9 px-2 text-sm bg-background"
                  form="filter-form"
                >
                  <option value="all">Todas las firmas</option>
                  <option value="firm">Una firma específica</option>
                  <option value="online">
                    Solo instancias online (heartbeat &lt;3min)
                  </option>
                </select>
                {scope === "firm" && (
                  <select
                    name="firmId"
                    defaultValue={firmId ?? ""}
                    className="border rounded h-9 px-2 text-sm bg-background"
                    form="filter-form"
                  >
                    <option value="">— elige firma —</option>
                    {firms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f._count.instances} PCs)
                      </option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="onlineOnly"
                    defaultChecked={onlineOnly}
                    form="filter-form"
                  />{" "}
                  solo online
                </label>
                <button
                  type="submit"
                  formAction="/operator/mass-actions"
                  className="text-xs underline text-muted-foreground"
                  form="filter-form"
                >
                  recalcular preview
                </button>
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="eyebrow text-[10px] mb-2">2. Comando</legend>
              <select
                name="kind"
                defaultValue={selectedKind}
                className="border rounded h-9 px-2 text-sm bg-background w-full max-w-md"
              >
                {MASS_ACTION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {COMMAND_KINDS[k].label}
                    {(MASS_ACTION_DESTRUCTIVE_KINDS as string[]).includes(k)
                      ? " ⚠️"
                      : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {COMMAND_KINDS[selectedKind as CommandKind].description}
              </p>
            </fieldset>

            <div className="card-quiet p-4 space-y-2">
              <div className="eyebrow text-[10px]">3. Preview</div>
              <div className="text-sm">
                Coincidencias:{" "}
                <span className="tabular-nums font-semibold">
                  {targets.length}
                </span>{" "}
                instancia(s)
              </div>
              {targets.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-0.5 max-h-40 overflow-auto">
                  {targets.slice(0, 25).map((t) => {
                    const online =
                      t.lastHeartbeatAt &&
                      Date.now() - t.lastHeartbeatAt.getTime() <
                        ONLINE_THRESHOLD_MS;
                    return (
                      <li key={t.id} className="flex items-center gap-2">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: online
                              ? "var(--brand)"
                              : "#bbb",
                          }}
                        />
                        <span>
                          {t.firm.name} · {t.workerLabel}
                        </span>
                      </li>
                    );
                  })}
                  {targets.length > 25 && (
                    <li className="italic">
                      …y {targets.length - 25} más
                    </li>
                  )}
                </ul>
              )}
            </div>

            {isDestructive && (
              <div className="card-quiet p-4 border-l-4 border-red-500 space-y-2">
                <div className="text-sm font-semibold">⚠️ Acción disruptiva</div>
                <p className="text-xs text-muted-foreground">
                  Este comando reinicia procesos. Las instancias sin
                  supervisor (NSSM, systemd, Electron) quedarán offline hasta
                  arranque manual.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="confirmDestructive" />{" "}
                  Confirmo que las {targets.length} instancias tienen
                  supervisor
                </label>
              </div>
            )}

            <Button
              type="submit"
              disabled={targets.length === 0}
              style={{
                backgroundColor: "var(--brand)",
                color: "var(--brand-foreground)",
              }}
            >
              Encolar en {targets.length} PCs
            </Button>
          </form>

          {/* Form separado para los filtros (no enqueue) — método GET, mismo path */}
          <form id="filter-form" method="get" action="/operator/mass-actions" />
        </CardContent>
      </Card>
    </main>
  );
}
