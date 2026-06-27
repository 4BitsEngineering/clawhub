import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  COMMAND_DEFAULT_TTL_MS,
  COMMAND_KINDS,
  COMMAND_KIND_LIST,
  isKnownKind,
  validateArgs,
} from "@/lib/commands";
import { InstanceCommandStatus, Prisma } from "@/generated/prisma/client";
import { recordActivity } from "@/lib/activity";
import { ActivityTimeline } from "@/components/activity-timeline";

export const dynamic = "force-dynamic";

function formatUptime(s: number | null | undefined): string {
  if (s == null) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatTokens(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

export default async function InstanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const instance = await db.instance.findUnique({
    where: { id },
    include: {
      firm: true,
      heartbeats: {
        orderBy: { receivedAt: "desc" },
        take: 50,
      },
      commands: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!instance) notFound();
  const inst = instance; // alias non-null para closures dentro del file

  // Resolver manifest pinned para esta firma (lo que DEBERÍA correr) y
  // comparar con lo que la instancia reporta que ESTÁ corriendo. Si el
  // pinned es NULL, leemos el latest del canal.
  type ManifestPin = {
    kind: "openclaw" | "bridge" | "overlay";
    target: string | null;
    running: string | null;
    diff: boolean;
  };
  async function resolveExpected(
    kind: "OPENCLAW" | "BRIDGE" | "OVERLAY",
    pinned: string | null,
    overlayId: string | null,
  ): Promise<string | null> {
    if (pinned) return pinned;
    const b = await db.stackBundle.findFirst({
      where: {
        kind: kind as "OPENCLAW" | "BRIDGE" | "OVERLAY",
        overlayId: kind === "OVERLAY" ? overlayId : null,
        channel: inst.firm.stackChannel,
        deprecatedAt: null,
      },
      orderBy: { releasedAt: "desc" },
    });
    return b?.version ?? null;
  }
  const expectedOpenclaw = await resolveExpected(
    "OPENCLAW",
    instance.firm.openclawVersion,
    null,
  );
  const expectedBridge = await resolveExpected(
    "BRIDGE",
    instance.firm.bridgeVersion,
    null,
  );
  const expectedOverlay = instance.firm.overlayId
    ? await resolveExpected("OVERLAY", instance.firm.overlayVersion, instance.firm.overlayId)
    : null;
  const stackPins: ManifestPin[] = [
    {
      kind: "openclaw",
      target: expectedOpenclaw,
      running: instance.runningOpenclawVersion,
      diff: !!(expectedOpenclaw && expectedOpenclaw !== instance.runningOpenclawVersion),
    },
    {
      kind: "bridge",
      target: expectedBridge,
      running: instance.runningBridgeVersion,
      diff: !!(expectedBridge && expectedBridge !== instance.runningBridgeVersion),
    },
    {
      kind: "overlay",
      target: expectedOverlay,
      running: instance.runningOverlayVersion,
      diff: !!(expectedOverlay && expectedOverlay !== instance.runningOverlayVersion),
    },
  ];
  const stackHasDiff = stackPins.some((p) => p.diff);

  // Baselines de la firma — para el dropdown de "Restaurar a baseline".
  // El promoted (canónico) va primero para que sea el default del select.
  const firmBaselines = await db.firmBaseline.findMany({
    where: { firmId: instance.firmId },
    orderBy: [{ isPromoted: "desc" }, { version: "desc" }],
    select: {
      id: true,
      version: true,
      label: true,
      fileCount: true,
      totalBytes: true,
      createdAt: true,
      isPromoted: true,
    },
    take: 20,
  });

  // Uso reciente (24h) agregado de UsageRecord. Totales globales y un
  // breakdown por agente.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const usage24h = await db.usageRecord.findMany({
    where: { instanceId: instance.id, endTime: { gte: dayAgo } },
    orderBy: { endTime: "desc" },
    select: {
      agentId: true,
      model: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
      costUsd: true,
      tokensSource: true,
      endTime: true,
    },
  });
  type UsageTotals = {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    costUsd: number;
    spanCount: number;
    lastAt: Date | null;
  };
  const emptyTotals: UsageTotals = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
    spanCount: 0,
    lastAt: null,
  };
  const usageTotals = usage24h.reduce<UsageTotals>((acc, r) => {
    acc.inputTokens += r.inputTokens ?? 0;
    acc.outputTokens += r.outputTokens ?? 0;
    acc.cacheReadTokens += r.cacheReadTokens ?? 0;
    acc.cacheWriteTokens += r.cacheWriteTokens ?? 0;
    acc.costUsd += r.costUsd ?? 0;
    acc.spanCount += 1;
    if (!acc.lastAt || r.endTime > acc.lastAt) acc.lastAt = r.endTime;
    return acc;
  }, { ...emptyTotals });
  const usageByAgent = new Map<string, UsageTotals>();
  for (const r of usage24h) {
    const k = r.agentId;
    const cur = usageByAgent.get(k) ?? { ...emptyTotals };
    cur.inputTokens += r.inputTokens ?? 0;
    cur.outputTokens += r.outputTokens ?? 0;
    cur.cacheReadTokens += r.cacheReadTokens ?? 0;
    cur.cacheWriteTokens += r.cacheWriteTokens ?? 0;
    cur.costUsd += r.costUsd ?? 0;
    cur.spanCount += 1;
    if (!cur.lastAt || r.endTime > cur.lastAt) cur.lastAt = r.endTime;
    usageByAgent.set(k, cur);
  }
  const usageRows = Array.from(usageByAgent.entries())
    .sort((a, b) => b[1].costUsd - a[1].costUsd);

  // firm_admin solo puede ver instancias de su firma; operator ve cualquiera.
  if (
    session.user.role === "FIRM_ADMIN" &&
    instance.firmId !== session.user.firmId
  ) {
    notFound();
  }

  async function unpairInstanceAction() {
    "use server";
    const sess = await getSession();
    if (!sess) redirect("/login");
    await recordActivity({
      kind: "instance.delete",
      summary: `Desemparejó el PC "${inst.workerLabel}"`,
      firmId: inst.firmId,
      // instanceId NO se pasa: el onDelete: SetNull lo pondría a null igualmente.
      actor: sess,
      metadata: { worker_label: inst.workerLabel, version: inst.version },
    });
    await db.instance.delete({ where: { id } });
    revalidatePath("/firm");
    revalidatePath(`/operator/firms/${instance!.firmId}`);
    redirect("/firm");
  }

  async function generateRepairTokenAction() {
    "use server";
    const sess = await getSession();
    if (!sess) redirect("/login");
    if (
      sess.user.role === "FIRM_ADMIN" &&
      inst.firmId !== sess.user.firmId
    ) {
      throw new Error("forbidden");
    }
    // Cancelar otros tokens de re-pair pendientes para esta instancia,
    // para evitar múltiples códigos vivos compitiendo por el mismo slot.
    await db.pairingToken.deleteMany({
      where: {
        firmId: inst.firmId,
        existingInstanceId: inst.id,
        usedAt: null,
      },
    });
    // Generar código humano-friendly 8 chars, válido 10 min.
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
      if (i === 3) code += "-";
    }
    await db.pairingToken.create({
      data: {
        firmId: inst.firmId,
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        existingInstanceId: inst.id,
      },
    });
    await recordActivity({
      kind: "instance.re_pair_initiated",
      summary: `Generó código re-pair para "${inst.workerLabel}"`,
      firmId: inst.firmId,
      instanceId: inst.id,
      actor: sess,
      metadata: { code },
    });
    revalidatePath(`/firm/instances/${id}`);
  }

  async function enqueueCommandAction(formData: FormData) {
    "use server";
    const sess = await getSession();
    if (!sess) redirect("/login");
    const kind = String(formData.get("kind") ?? "");
    if (!isKnownKind(kind)) {
      throw new Error(`unknown_kind: ${kind}`);
    }
    if (
      sess.user.role === "FIRM_ADMIN" &&
      instance!.firmId !== sess.user.firmId
    ) {
      throw new Error("forbidden");
    }
    const args = validateArgs(kind, undefined);
    await db.instanceCommand.create({
      data: {
        instanceId: instance!.id,
        kind,
        args:
          args == null
            ? Prisma.JsonNull
            : (args as Prisma.InputJsonValue),
        createdBy: sess.user.id,
        expiresAt: new Date(Date.now() + COMMAND_DEFAULT_TTL_MS),
      },
    });
    await recordActivity({
      kind: "command.create",
      summary: `Encoló ${kind} en "${inst.workerLabel}"`,
      firmId: inst.firmId,
      instanceId: inst.id,
      actor: sess,
      metadata: { command_kind: kind },
    });
    revalidatePath(`/firm/instances/${id}`);
  }

  async function snapshotToBaselineAction(formData: FormData) {
    "use server";
    const sess = await getSession();
    if (!sess) redirect("/login");
    if (
      sess.user.role === "FIRM_ADMIN" &&
      instance!.firmId !== sess.user.firmId
    ) {
      throw new Error("forbidden");
    }
    const label = String(formData.get("label") ?? "").trim();
    const description =
      String(formData.get("description") ?? "").trim() || null;
    if (!label) throw new Error("label_required");
    await db.instanceCommand.create({
      data: {
        instanceId: instance!.id,
        kind: "snapshot_to_baseline",
        args: { label, description } as Prisma.InputJsonValue,
        createdBy: sess.user.id,
        expiresAt: new Date(Date.now() + COMMAND_DEFAULT_TTL_MS),
      },
    });
    await recordActivity({
      kind: "baseline.snapshot_request",
      summary: `Pidió snapshot "${label}" en "${inst.workerLabel}"`,
      firmId: inst.firmId,
      instanceId: inst.id,
      actor: sess,
      metadata: { label, description },
    });
    revalidatePath(`/firm/instances/${id}`);
  }

  async function notifyUserAction(formData: FormData) {
    "use server";
    const sess = await getSession();
    if (!sess) redirect("/login");
    if (
      sess.user.role === "FIRM_ADMIN" &&
      instance!.firmId !== sess.user.firmId
    ) {
      throw new Error("forbidden");
    }
    const title = String(formData.get("title") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();
    const level = String(formData.get("level") ?? "info");
    const url = String(formData.get("url") ?? "").trim() || undefined;
    if (!title || !body) throw new Error("title_and_body_required");
    const args = validateArgs("notify_user", {
      title,
      body,
      level: ["info", "warn", "success"].includes(level) ? level : "info",
      ...(url ? { url } : {}),
    });
    await db.instanceCommand.create({
      data: {
        instanceId: instance!.id,
        kind: "notify_user",
        args: args as Prisma.InputJsonValue,
        createdBy: sess.user.id,
        expiresAt: new Date(Date.now() + COMMAND_DEFAULT_TTL_MS),
      },
    });
    await recordActivity({
      kind: "command.create",
      summary: `Envió aviso "${title}" a "${inst.workerLabel}"`,
      firmId: inst.firmId,
      instanceId: inst.id,
      actor: sess,
      metadata: { command_kind: "notify_user", title },
    });
    revalidatePath(`/firm/instances/${id}`);
  }

  async function pushConfigPatchAction(formData: FormData) {
    "use server";
    const sess = await getSession();
    if (!sess) redirect("/login");
    if (
      sess.user.role === "FIRM_ADMIN" &&
      instance!.firmId !== sess.user.firmId
    ) {
      throw new Error("forbidden");
    }
    const path = String(formData.get("path") ?? "");
    const valueRaw = String(formData.get("value") ?? "");

    // Coerce value type per path. La validación estricta vive en el bridge
    // (allowlist + zod), aquí solo evitamos enviar basura obvia.
    let value: unknown = valueRaw;
    if (path === "agents.defaults.maxConcurrent") {
      const n = parseInt(valueRaw, 10);
      if (!Number.isFinite(n)) throw new Error("maxConcurrent debe ser número");
      value = n;
    } else if (path.endsWith(".enabled")) {
      value = valueRaw === "true";
    }
    if (!path || valueRaw === "") throw new Error("path_and_value_required");

    await db.instanceCommand.create({
      data: {
        instanceId: instance!.id,
        kind: "push_config_patch",
        args: { changes: { [path]: value } } as Prisma.InputJsonValue,
        createdBy: sess.user.id,
        expiresAt: new Date(Date.now() + COMMAND_DEFAULT_TTL_MS),
      },
    });
    await recordActivity({
      kind: "config.patch",
      summary: `Cambió ${path} en "${inst.workerLabel}"`,
      firmId: inst.firmId,
      instanceId: inst.id,
      actor: sess,
      metadata: { path, value: String(value) },
    });
    revalidatePath(`/firm/instances/${id}`);
  }

  async function resetToBaselineAction(formData: FormData) {
    "use server";
    const sess = await getSession();
    if (!sess) redirect("/login");
    if (
      sess.user.role === "FIRM_ADMIN" &&
      instance!.firmId !== sess.user.firmId
    ) {
      throw new Error("forbidden");
    }
    const baseline_id = String(formData.get("baseline_id") ?? "");
    if (!baseline_id) throw new Error("baseline_id_required");
    const baseline = await db.firmBaseline.findUnique({
      where: { id: baseline_id },
      select: { firmId: true },
    });
    if (!baseline || baseline.firmId !== instance!.firmId) {
      throw new Error("baseline_not_in_firm");
    }
    await db.instanceCommand.create({
      data: {
        instanceId: instance!.id,
        kind: "reset_to_baseline",
        args: { baseline_id } as Prisma.InputJsonValue,
        createdBy: sess.user.id,
        expiresAt: new Date(Date.now() + COMMAND_DEFAULT_TTL_MS),
      },
    });
    const baselineRec = await db.firmBaseline.findUnique({
      where: { id: baseline_id },
      select: { version: true, label: true },
    });
    await recordActivity({
      kind: "baseline.apply",
      summary: `Reset a baseline v${baselineRec?.version ?? "?"} (${baselineRec?.label ?? "?"}) en "${inst.workerLabel}"`,
      firmId: inst.firmId,
      instanceId: inst.id,
      actor: sess,
      metadata: {
        baseline_id,
        baseline_version: baselineRec?.version,
        baseline_label: baselineRec?.label,
      },
    });
    revalidatePath(`/firm/instances/${id}`);
  }

  const isOnline =
    instance.lastHeartbeatAt &&
    Date.now() - instance.lastHeartbeatAt.getTime() < 3 * 60 * 1000;

  const lastBeat = instance.heartbeats[0] ?? null;
  const totalBeats = await db.heartbeat.count({
    where: { instanceId: instance.id },
  });

  const recentActivity = await db.activity.findMany({
    where: { instanceId: instance.id },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  // Token de re-pair activo (no usado, no caducado) si existe.
  const activeRepairToken = await db.pairingToken.findFirst({
    where: {
      existingInstanceId: instance.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  // Extraer local_stack del rawPayload del último heartbeat (puede no existir
  // si la instancia es vieja o no pudo contactar su bridge local).
  type LocalStackAgent = {
    id: string | null;
    name: string | null;
    status: string | null;
    online: boolean | null;
  };
  type LocalStack = {
    bridge_url?: string;
    reachable?: boolean;
    gateway_connected?: boolean | null;
    agent_count?: number | null;
    agents?: LocalStackAgent[] | null;
    probed_at?: string;
  };
  type LocalMcpServer = {
    name: string | null;
    ready: boolean;
    toolCount: number | null;
    transport: string | null;
    error: string | null;
  };
  type LocalMcpConfigServer = {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    transport?: string;
    cwd?: string;
  };
  type LocalMcp = {
    available: boolean;
    ready?: number | null;
    total?: number | null;
    servers?: LocalMcpServer[] | null;
    config_applied?: {
      servers: Record<string, LocalMcpConfigServer>;
      count: number;
    } | null;
    probed_at?: string;
    status?: number;
  };
  const rawPayload = lastBeat?.rawPayload as
    | { extras?: { local_stack?: LocalStack; mcp?: LocalMcp } }
    | null
    | undefined;
  const localStack = rawPayload?.extras?.local_stack ?? null;
  const localMcp = rawPayload?.extras?.mcp ?? null;

  return (
    <main className="container-page min-h-screen py-8 sm:py-12 space-y-8">
      <AutoRefresh intervalMs={5_000} />

      <div className="text-sm">
        <Link
          href="/firm"
          className="text-muted-foreground hover:text-foreground"
        >
          ← {instance.firm.name}
        </Link>
      </div>

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="eyebrow-chip flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: isOnline ? "var(--brand)" : "#bbb" }}
            />
            instancia
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            {instance.workerLabel}
          </h1>
          <p className="text-xs text-muted-foreground">
            <code>{instance.id}</code>
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge
            variant={isOnline ? "default" : "secondary"}
            className="text-sm px-3 py-1"
          >
            {isOnline ? "online" : "offline"}
          </Badge>
          <form action={unpairInstanceAction}>
            <Button type="submit" variant="destructive" size="sm">
              Despareja
            </Button>
          </form>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">Versión</div>
          <div className="text-lg font-medium tabular-nums">
            {instance.version}
          </div>
        </div>
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">OS</div>
          <div className="text-lg font-medium">{instance.os ?? "—"}</div>
        </div>
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">Heartbeats totales</div>
          <div className="text-lg font-medium tabular-nums">{totalBeats}</div>
        </div>
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">Uptime actual</div>
          <div className="text-lg font-medium tabular-nums">
            {formatUptime(lastBeat?.uptimeS)}
          </div>
        </div>
      </div>

      {/* Stack local — gateway + agentes que reporta el bridge del PC */}
      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Stack local</CardTitle>
          <CardDescription>
            Estado del bridge + gateway + agentes en el PC del trabajador,
            reportado en el último heartbeat.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {!localStack ? (
            <p className="text-sm text-muted-foreground py-2">
              La instancia aún no reporta su stack local. Necesita actualizar
              a una versión de clawgents-desktop que probe el bridge en cada
              heartbeat.
            </p>
          ) : !localStack.reachable ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: "#e07474" }}
                />
                <span className="text-sm font-medium">
                  Bridge no responde
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                URL sondeada:{" "}
                <code className="text-xs">
                  {localStack.bridge_url ?? "(no disponible)"}
                </code>
                . El proceso desktop está vivo pero su bridge embebido o
                attached no contesta.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="eyebrow text-[10px]">Bridge</div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: "var(--brand)" }}
                    />
                    <span className="text-sm font-medium">reachable</span>
                  </div>
                  {localStack.bridge_url && (
                    <code className="text-xs text-muted-foreground">
                      {localStack.bridge_url}
                    </code>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="eyebrow text-[10px]">Gateway WS</div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          localStack.gateway_connected === true
                            ? "var(--brand)"
                            : localStack.gateway_connected === false
                              ? "#e07474"
                              : "#bbb",
                      }}
                    />
                    <span className="text-sm font-medium">
                      {localStack.gateway_connected === true
                        ? "conectado"
                        : localStack.gateway_connected === false
                          ? "desconectado"
                          : "desconocido"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="eyebrow text-[10px]">Agentes</div>
                  <div className="text-lg font-semibold tabular-nums">
                    {localStack.agent_count ?? "—"}
                  </div>
                </div>
              </div>

              {Array.isArray(localStack.agents) &&
              localStack.agents.length > 0 ? (
                <div className="space-y-2">
                  <div className="eyebrow text-[10px]">Lista</div>
                  <div className="flex flex-wrap gap-2">
                    {localStack.agents.map((a, idx) => (
                      <div
                        key={(a.id ?? "agent-") + idx}
                        className="card-quiet px-3 py-1.5 flex items-center gap-2"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              a.online === true
                                ? "var(--brand)"
                                : a.online === false
                                  ? "#e07474"
                                  : "#bbb",
                          }}
                        />
                        <span className="text-sm font-medium">
                          {a.name ?? a.id ?? "agente"}
                        </span>
                        {a.id && a.name && a.id !== a.name && (
                          <code className="text-[10px] text-muted-foreground">
                            {a.id}
                          </code>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {localStack.probed_at && (
                <p className="text-xs text-muted-foreground">
                  Sondeado:{" "}
                  {new Date(localStack.probed_at).toLocaleString("es-ES")}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MCP servers — reportados por el bridge local en cada heartbeat */}
      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl flex items-center gap-2">
            <span>MCP servers</span>
            {localMcp?.available && (
              <Badge variant="secondary" className="text-xs">
                {localMcp.ready ?? 0}/{localMcp.total ?? 0} ready
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Servidores Model Context Protocol que este PC tiene cargados. El
            agente los usa como tools adicionales (filesystem, github, slack,
            postgres, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {!localMcp ? (
            <p className="text-xs text-muted-foreground py-4">
              Sin datos. El bridge no respondió a <code>/api/mcp</code> en el
              último heartbeat (puede ser una versión antigua del bridge o el
              bridge no está conectado al gateway).
            </p>
          ) : !localMcp.available ? (
            <p className="text-xs text-muted-foreground py-4">
              El bridge respondió pero el endpoint <code>/api/mcp</code>{" "}
              devolvió status {localMcp.status ?? "?"}. Probablemente
              MCP capability layer no está inicializado.
            </p>
          ) : !Array.isArray(localMcp.servers) ||
            localMcp.servers.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">
              No hay MCP servers configurados en este PC. Cuando publiques
              uno desde AI-Office Center, aparecerá aquí.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {localMcp.servers.map((s, idx) => (
                  <div
                    key={(s.name ?? "mcp-") + idx}
                    className="card-quiet px-3 py-1.5 flex items-center gap-2"
                    title={s.error ?? undefined}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: s.ready
                          ? "var(--brand)"
                          : s.error
                            ? "#e07474"
                            : "#bbb",
                      }}
                    />
                    <span className="text-sm font-medium">
                      {s.name ?? "—"}
                    </span>
                    {s.toolCount != null && (
                      <code className="text-[10px] text-muted-foreground tabular-nums">
                        {s.toolCount} tools
                      </code>
                    )}
                    {s.transport && (
                      <code className="text-[10px] text-muted-foreground">
                        {s.transport}
                      </code>
                    )}
                  </div>
                ))}
              </div>
              {localMcp.probed_at && (
                <p className="text-[10px] text-muted-foreground">
                  Sondeo:{" "}
                  {new Date(localMcp.probed_at).toLocaleString("es-ES")}
                </p>
              )}
              {localMcp.config_applied && (
                <details className="mt-3 group">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
                    Ver config aplicada en <code>openclaw.json</code> ·{" "}
                    {localMcp.config_applied.count} server{localMcp.config_applied.count === 1 ? "" : "s"}
                  </summary>
                  <div className="mt-2 card-quiet p-3 max-h-96 overflow-auto">
                    {Object.keys(localMcp.config_applied.servers).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        <code>mcp.servers</code> está vacío. Si esperabas algo
                        aquí, encola <code>push_mcp_config</code> desde{" "}
                        <code>/firm/mcp</code>.
                      </p>
                    ) : (
                      <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">
                        {JSON.stringify(
                          localMcp.config_applied.servers,
                          null,
                          2,
                        )}
                      </pre>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2 italic">
                      Secrets ({`env`}/{`headers`}) redactados:{" "}
                      <code>__SET__</code> = configurado · <code>__EMPTY__</code>{" "}
                      = vacío.
                    </p>
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uso reciente — tokens y coste reportados desde el bridge local */}
      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            Uso reciente (24h)
          </CardTitle>
          <CardDescription>
            Tokens y coste consumidos por esta instancia. Datos autoritativos
            del proveedor leídos desde la sesión de OpenClaw — no estimaciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <div className="eyebrow text-[10px]">Spans</div>
              <div className="text-lg font-medium tabular-nums">
                {usageTotals.spanCount}
              </div>
            </div>
            <div className="space-y-1">
              <div className="eyebrow text-[10px]">Tokens in</div>
              <div className="text-lg font-medium tabular-nums">
                {usageTotals.inputTokens.toLocaleString("es-ES")}
              </div>
            </div>
            <div className="space-y-1">
              <div className="eyebrow text-[10px]">Tokens out</div>
              <div className="text-lg font-medium tabular-nums">
                {usageTotals.outputTokens.toLocaleString("es-ES")}
              </div>
            </div>
            <div className="space-y-1">
              <div className="eyebrow text-[10px]">Cache (r / w)</div>
              <div className="text-sm tabular-nums">
                {usageTotals.cacheReadTokens.toLocaleString("es-ES")} /{" "}
                {usageTotals.cacheWriteTokens.toLocaleString("es-ES")}
              </div>
            </div>
            <div className="space-y-1">
              <div className="eyebrow text-[10px]">Coste</div>
              <div className="text-lg font-medium tabular-nums">
                ${usageTotals.costUsd.toFixed(4)}
              </div>
            </div>
          </div>

          {usageRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Sin actividad en las últimas 24h. Cuando un agente complete un
              turno, el bridge lo registrará y el agent lo sincronizará en su
              próximo heartbeat.
            </p>
          ) : (
            <div>
              <div className="eyebrow text-[10px] mb-2">Por agente</div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="eyebrow text-[10px]">Agente</TableHead>
                      <TableHead className="eyebrow text-[10px] text-right">Spans</TableHead>
                      <TableHead className="eyebrow text-[10px] text-right">In</TableHead>
                      <TableHead className="eyebrow text-[10px] text-right">Out</TableHead>
                      <TableHead className="eyebrow text-[10px] text-right">Cache r/w</TableHead>
                      <TableHead className="eyebrow text-[10px] text-right">Coste</TableHead>
                      <TableHead className="eyebrow text-[10px]">Último</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageRows.map(([agentId, t]) => (
                      <TableRow key={agentId}>
                        <TableCell className="text-sm font-medium">
                          <code className="text-xs">{agentId}</code>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {t.spanCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {t.inputTokens.toLocaleString("es-ES")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {t.outputTokens.toLocaleString("es-ES")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                          {t.cacheReadTokens.toLocaleString("es-ES")} /{" "}
                          {t.cacheWriteTokens.toLocaleString("es-ES")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          ${t.costUsd.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {t.lastAt
                            ? t.lastAt.toLocaleString("es-ES")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Re-emparejar PC: el trabajador reinstaló su PC y necesita rotar el
          instance_token preservando el historial de esta instancia. */}
      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            Re-emparejar este PC
          </CardTitle>
          <CardDescription>
            Usar SOLO si el PC fue reinstalado y perdió su credencial. Se
            genera un código nuevo que el worker mete al reabrir el .exe; el
            historial (uso, baselines, comandos) se preserva.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-3">
          {activeRepairToken ? (
            <div
              className="card-quiet px-4 py-3 flex items-center gap-3"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand-soft) 0%, transparent 100%)",
              }}
            >
              <span className="font-mono text-lg font-semibold tracking-[0.15em]">
                {activeRepairToken.code}
              </span>
              <span className="text-xs text-muted-foreground">
                caduca en{" "}
                {Math.max(
                  0,
                  Math.round(
                    (activeRepairToken.expiresAt.getTime() - Date.now()) /
                      60000,
                  ),
                )}{" "}
                min
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No hay código de re-pair activo. Pulsa el botón para generar
              uno.
            </p>
          )}
          <form action={generateRepairTokenAction}>
            <Button type="submit" variant="outline" size="sm">
              {activeRepairToken ? "Regenerar código" : "Generar código re-pair"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Acciones remotas — encolar commands para que el agent los ejecute */}
      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            Acciones remotas
          </CardTitle>
          <CardDescription>
            Encola un comando para que el agent lo ejecute en su próximo
            heartbeat ({"~"}60s). Si está offline más de una hora, el comando
            expira solo.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-5">
          <form
            action={enqueueCommandAction}
            className="flex flex-col sm:flex-row gap-2 sm:items-end"
          >
            <div className="space-y-1 flex-1 max-w-sm">
              <label
                htmlFor="kind"
                className="eyebrow text-[10px] block"
              >
                Comando
              </label>
              <select
                id="kind"
                name="kind"
                defaultValue="ping"
                className="card-quiet w-full px-3 py-2 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {/* Solo kinds sin args (o con args opcionales) en este
                    dropdown — snapshot_to_baseline, reset_to_baseline y
                    push_config_patch requieren inputs específicos y viven
                    en sus propias cards. */}
                {COMMAND_KIND_LIST.filter(
                  (k) =>
                    k !== "snapshot_to_baseline" &&
                    k !== "reset_to_baseline" &&
                    k !== "push_config_patch",
                ).map((k) => (
                  <option key={k} value={k}>
                    {COMMAND_KINDS[k].label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm">
              Encolar
            </Button>
          </form>

          {instance.commands.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No hay comandos encolados todavía.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="eyebrow text-[10px]">Comando</TableHead>
                    <TableHead className="eyebrow text-[10px]">Estado</TableHead>
                    <TableHead className="eyebrow text-[10px]">Encolado</TableHead>
                    <TableHead className="eyebrow text-[10px]">Completado</TableHead>
                    <TableHead className="eyebrow text-[10px]">Resultado / error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instance.commands.map((c) => {
                    const statusColor =
                      c.status === InstanceCommandStatus.COMPLETED
                        ? "var(--brand)"
                        : c.status === InstanceCommandStatus.FAILED ||
                            c.status === InstanceCommandStatus.EXPIRED
                          ? "#e07474"
                          : c.status === InstanceCommandStatus.DISPATCHED
                            ? "#d4a017"
                            : "#bbb";
                    const summary =
                      c.errorMessage ??
                      (c.result == null
                        ? ""
                        : typeof c.result === "object"
                          ? JSON.stringify(c.result)
                          : String(c.result));
                    const summaryIsLong = summary.length > 200;
                    const pretty = c.result
                      ? JSON.stringify(c.result, null, 2)
                      : "";
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm font-medium">
                          {COMMAND_KINDS[c.kind as keyof typeof COMMAND_KINDS]?.label ?? c.kind}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: statusColor }}
                            />
                            {c.status.toLowerCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {c.createdAt.toLocaleString("es-ES")}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {c.completedAt
                            ? c.completedAt.toLocaleString("es-ES")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs max-w-[28rem]">
                          {summaryIsLong ? (
                            <details className="text-[11px]">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                {summary.slice(0, 80)}… ({summary.length} chars)
                              </summary>
                              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all p-2 rounded-md bg-paper-2/40 text-[10px] leading-relaxed">
                                {pretty || summary}
                              </pre>
                            </details>
                          ) : (
                            <code className="text-[11px] block truncate">
                              {summary || "—"}
                            </code>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stack versions — manifest vs running + apply update */}
      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            Versiones del stack
          </CardTitle>
          <CardDescription>
            Lo que AI-Office Center pidió (manifest) vs lo que esta instancia está
            corriendo. Si hay diff, encola{" "}
            <code>apply_stack_update</code> para que el cliente descargue las
            nuevas versiones y reinicie gateway+bridge.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            {stackPins.map((p) => (
              <div
                key={p.kind}
                className={
                  "card-quiet p-3 space-y-1 " +
                  (p.diff ? "border-l-4" : "")
                }
                style={p.diff ? { borderLeftColor: "#d4a017" } : undefined}
              >
                <div className="eyebrow text-[10px] flex items-center gap-2">
                  {p.kind}
                  {p.diff && (
                    <span
                      className="text-[10px] uppercase font-medium"
                      style={{ color: "#d4a017" }}
                    >
                      update
                    </span>
                  )}
                </div>
                <div className="text-sm tabular-nums">
                  Manifest:{" "}
                  <span className="font-mono">{p.target ?? "—"}</span>
                </div>
                <div className="text-sm tabular-nums">
                  Corre:{" "}
                  <span
                    className="font-mono"
                    style={p.diff ? { color: "#d4a017" } : undefined}
                  >
                    {p.running ?? "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {stackHasDiff ? (
            <form action={enqueueCommandAction}>
              <input type="hidden" name="kind" value="apply_stack_update" />
              <Button type="submit" size="sm">
                Aplicar update del stack
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                El cliente descargará los bundles nuevos y reiniciará
                gateway+bridge. Solo funciona en desktop con supervisor;
                instancias headless reportarán <code>supervisor_required</code>.
              </p>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Stack al día con el manifest de la firma.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cambiar configuración — push_config_patch con allowlist */}
      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            Cambiar configuración
          </CardTitle>
          <CardDescription>
            Aplica cambios al <code>openclaw.json</code> sin reiniciar. Solo
            paths en la allowlist del bridge se aceptan. Backup automático y
            rollback si algo falla.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Thinking default */}
            <form action={pushConfigPatchAction} className="card-quiet p-4 space-y-2">
              <input type="hidden" name="path" value="agents.defaults.thinkingDefault" />
              <div className="eyebrow text-[10px]">Reasoning por defecto</div>
              <p className="text-xs text-muted-foreground">
                <code className="text-[10px]">agents.defaults.thinkingDefault</code>
              </p>
              <select
                name="value"
                defaultValue="off"
                className="card-paper w-full px-3 py-2 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="off">off</option>
                <option value="on">on</option>
              </select>
              <Button type="submit" size="sm">Aplicar</Button>
            </form>

            {/* Max concurrent */}
            <form action={pushConfigPatchAction} className="card-quiet p-4 space-y-2">
              <input type="hidden" name="path" value="agents.defaults.maxConcurrent" />
              <div className="eyebrow text-[10px]">Máximo turnos paralelos</div>
              <p className="text-xs text-muted-foreground">
                <code className="text-[10px]">agents.defaults.maxConcurrent</code>
                {" "}(1-16)
              </p>
              <input
                type="number"
                name="value"
                min={1}
                max={16}
                defaultValue={4}
                className="card-paper w-full px-3 py-2 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button type="submit" size="sm">Aplicar</Button>
            </form>

            {/* Logging level */}
            <form action={pushConfigPatchAction} className="card-quiet p-4 space-y-2">
              <input type="hidden" name="path" value="logging.level" />
              <div className="eyebrow text-[10px]">Nivel de log gateway</div>
              <p className="text-xs text-muted-foreground">
                <code className="text-[10px]">logging.level</code>
              </p>
              <select
                name="value"
                defaultValue="info"
                className="card-paper w-full px-3 py-2 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="trace">trace</option>
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
              <Button type="submit" size="sm">Aplicar</Button>
            </form>

            {/* Skill toggle */}
            <form action={pushConfigPatchAction} className="card-quiet p-4 space-y-2">
              <div className="eyebrow text-[10px]">Skill toggle</div>
              <p className="text-xs text-muted-foreground">
                Path con slug: <code className="text-[10px]">skills.entries.&lt;slug&gt;.enabled</code>
              </p>
              <input
                type="text"
                name="path"
                placeholder="skills.entries.github.enabled"
                required
                className="card-paper w-full px-3 py-2 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
              <select
                name="value"
                defaultValue="true"
                className="card-paper w-full px-3 py-2 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="true">enabled = true</option>
                <option value="false">enabled = false</option>
              </select>
              <Button type="submit" size="sm">Aplicar</Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Aviso al usuario — notify_user: banner dentro de la instancia */}
      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Aviso al usuario</CardTitle>
          <CardDescription>
            Muestra un mensaje DENTRO de la instancia (banner descartable en la
            web del cliente). Útil para comunicar mantenimientos, novedades o
            avisos. Se entrega en el próximo heartbeat.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form action={notifyUserAction} className="card-quiet p-4 space-y-2 max-w-xl">
            <input
              type="text"
              name="title"
              placeholder="Título (p. ej. Mantenimiento programado)"
              required
              maxLength={200}
              className="card-paper w-full px-3 py-2 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <textarea
              name="body"
              placeholder="Mensaje para el usuario"
              required
              maxLength={2000}
              rows={3}
              className="card-paper w-full px-3 py-2 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <select
                name="level"
                defaultValue="info"
                className="card-paper px-3 py-2 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="info">info</option>
                <option value="warn">aviso</option>
                <option value="success">éxito</option>
              </select>
              <input
                type="url"
                name="url"
                placeholder="URL opcional (Más info)"
                maxLength={500}
                className="card-paper flex-1 px-3 py-2 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit" size="sm">Enviar aviso</Button>
          </form>
        </CardContent>
      </Card>

      {/* Baselines — snapshot del estado actual y restore a uno previo */}
      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Baselines</CardTitle>
          <CardDescription>
            Snapshot canónico del overlay de esta firma. Si el trabajador rompe
            su configuración, restauras a un baseline en 30 segundos. No incluye
            secretos. Los <code>MEMORY.md</code> de los agentes (su aprendizaje
            local) NO se sobreescriben.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Crear baseline desde esta instancia */}
            <form action={snapshotToBaselineAction} className="space-y-3">
              <div className="eyebrow text-[10px]">Snapshot desde esta instancia</div>
              <div className="space-y-1">
                <label
                  htmlFor="snapshot-label"
                  className="text-xs text-muted-foreground"
                >
                  Nombre del baseline
                </label>
                <input
                  id="snapshot-label"
                  name="label"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="p.ej. Setup demo asesoría inicial"
                  className="card-quiet w-full px-3 py-2 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="snapshot-desc"
                  className="text-xs text-muted-foreground"
                >
                  Descripción (opcional)
                </label>
                <input
                  id="snapshot-desc"
                  name="description"
                  type="text"
                  maxLength={500}
                  placeholder="Qué incluye, fecha, contexto"
                  className="card-quiet w-full px-3 py-2 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <Button type="submit" size="sm">
                Crear snapshot
              </Button>
            </form>

            {/* Restaurar a baseline existente */}
            <form action={resetToBaselineAction} className="space-y-3">
              <div className="eyebrow text-[10px]">
                Restaurar esta instancia a un baseline
              </div>
              {firmBaselines.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  La firma no tiene baselines todavía. Crea uno con el snapshot
                  de la izquierda.
                </p>
              ) : (
                <>
                  <div className="space-y-1">
                    <label
                      htmlFor="reset-baseline"
                      className="text-xs text-muted-foreground"
                    >
                      Baseline destino
                    </label>
                    <select
                      id="reset-baseline"
                      name="baseline_id"
                      defaultValue={firmBaselines[0]?.id}
                      className="card-quiet w-full px-3 py-2 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {firmBaselines.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.isPromoted ? "⭐ " : ""}v{b.version} · {b.label} · {b.fileCount} archivos
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se hace backup del estado actual en{" "}
                    <code>~/.openclaw/_baseline-backups/&lt;ts&gt;/</code> antes
                    de sobreescribir.
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Button type="submit" size="sm" variant="destructive">
                      Restaurar
                    </Button>
                    {firmBaselines.length > 1 ? (
                      <Link
                        href={`/firm/baselines/${firmBaselines[0].id}?compareTo=${firmBaselines[1].id}`}
                        className="text-xs underline text-muted-foreground"
                      >
                        previsualizar diff vs anterior →
                      </Link>
                    ) : (
                      <Link
                        href={`/firm/baselines/${firmBaselines[0].id}`}
                        className="text-xs underline text-muted-foreground"
                      >
                        ver contenido del baseline →
                      </Link>
                    )}
                  </div>
                </>
              )}
            </form>
          </div>

          {firmBaselines.length > 0 && (
            <div>
              <div className="eyebrow text-[10px] mb-2">
                Baselines de la firma
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="eyebrow text-[10px]">v</TableHead>
                      <TableHead className="eyebrow text-[10px]">Nombre</TableHead>
                      <TableHead className="eyebrow text-[10px] text-right">
                        Archivos
                      </TableHead>
                      <TableHead className="eyebrow text-[10px] text-right">
                        Tamaño
                      </TableHead>
                      <TableHead className="eyebrow text-[10px]">Creado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {firmBaselines.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="tabular-nums text-sm">
                          {b.version}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {b.label}
                        </TableCell>
                        <TableCell className="tabular-nums text-right text-sm">
                          {b.fileCount}
                        </TableCell>
                        <TableCell className="tabular-nums text-right text-sm">
                          {(b.totalBytes / 1024).toFixed(1)} KB
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {b.createdAt.toLocaleString("es-ES")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            Heartbeats recientes
          </CardTitle>
          <CardDescription>
            Últimos {instance.heartbeats.length} pings recibidos.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 pb-4">
          {instance.heartbeats.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-8 text-center">
              No hay heartbeats. ¿La instancia ha enviado alguno?
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="eyebrow text-[10px]">
                      Recibido
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      CPU %
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      RAM MB
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Tokens 24h
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Uptime
                    </TableHead>
                    <TableHead className="eyebrow text-[10px]">Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instance.heartbeats.map((h) => (
                    <TableRow key={h.id} className="hover:bg-paper-2/60">
                      <TableCell className="text-muted-foreground text-sm">
                        {h.receivedAt.toLocaleString("es-ES")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {h.cpuPct?.toFixed(1) ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {h.ramMb ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatTokens(h.tokensConsumed24h)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatUptime(h.uptimeS)}
                      </TableCell>
                      <TableCell className="text-destructive text-xs">
                        {h.lastError ?? ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            Actividad de este PC
          </CardTitle>
          <CardDescription>
            Quién hizo qué en este PC y cuándo. Útil para auditoría LOPD-GDD
            y para depurar incidencias.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <ActivityTimeline
            activities={recentActivity}
            emptyMessage="Aún no hay actividad registrada en este PC."
          />
        </CardContent>
      </Card>
    </main>
  );
}
