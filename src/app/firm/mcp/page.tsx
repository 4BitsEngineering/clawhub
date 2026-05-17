/**
 * /firm/mcp — firm_admin gestiona qué MCP servers están instalados en su
 * firma. La instalación es metadata en clawhub; el push real a los PCs se
 * hace con el comando `push_mcp_config` (encolado tras toggle).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireFirmAdmin } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
import { Prisma } from "@/generated/prisma/client";
import { COMMAND_DEFAULT_TTL_MS } from "@/lib/commands";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "fs", label: "Sistema de archivos" },
  { value: "vcs", label: "Control de versiones" },
  { value: "messaging", label: "Mensajería" },
  { value: "db", label: "Bases de datos" },
  { value: "search", label: "Búsqueda web" },
  { value: "browser", label: "Browser/scraping" },
  { value: "ai", label: "IA / memoria" },
  { value: "other", label: "Otros" },
];

const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

export default async function FirmMcpPage({
  searchParams,
}: {
  searchParams?: Promise<{ pushed?: string; reloaded?: string }>;
}) {
  const session = await requireFirmAdmin();
  const firmId = session.user.firmId;
  const sp = searchParams ? await searchParams : {};
  const pushedCount = sp.pushed ? parseInt(sp.pushed, 10) : null;
  const reloadedCount = sp.reloaded ? parseInt(sp.reloaded, 10) : null;

  const [firm, catalog, installs, instances] = await Promise.all([
    db.firm.findUnique({
      where: { id: firmId },
      select: { name: true },
    }),
    db.mcpServerCatalog.findMany({
      where: { deprecatedAt: null },
      orderBy: [{ isOfficial: "desc" }, { category: "asc" }, { displayName: "asc" }],
    }),
    db.firmMcpInstall.findMany({
      where: { firmId },
      include: { catalog: true },
    }),
    db.instance.findMany({
      where: { firmId },
      select: {
        id: true,
        workerLabel: true,
        lastHeartbeatAt: true,
      },
      orderBy: { workerLabel: "asc" },
    }),
  ]);
  const onlineInstances = instances.filter(
    (i) =>
      i.lastHeartbeatAt &&
      Date.now() - i.lastHeartbeatAt.getTime() < ONLINE_THRESHOLD_MS,
  );

  // Reconciliation: traer el último heartbeat por instancia para cruzar
  // qué MCP servers reporta cada PC vs qué tiene instalado la firma en
  // clawhub. Si una firma instala "filesystem" pero el PC del trabajador
  // no lo reporta en extras.mcp.servers, eso es desync (todavía no se
  // ha hecho push, falló mcp:config, o el bridge no reconoce el shape).
  const instanceIds = instances.map((i) => i.id);
  const latestHeartbeats =
    instanceIds.length > 0
      ? await db.heartbeat.findMany({
          where: { instanceId: { in: instanceIds } },
          orderBy: { receivedAt: "desc" },
          distinct: ["instanceId"],
          select: { instanceId: true, rawPayload: true, receivedAt: true },
        })
      : [];

  // Último comando MCP por instancia (push_mcp_config | reload_mcp), cualquier
  // estado. Sirve para mostrar "última sync: hace 30s — completed" o
  // "fallida — error xyz" en la tabla por PC.
  const latestMcpCommands =
    instanceIds.length > 0
      ? await db.instanceCommand.findMany({
          where: {
            instanceId: { in: instanceIds },
            kind: { in: ["push_mcp_config", "reload_mcp"] },
          },
          orderBy: { createdAt: "desc" },
          distinct: ["instanceId"],
          select: {
            instanceId: true,
            kind: true,
            status: true,
            createdAt: true,
            completedAt: true,
            errorMessage: true,
          },
        })
      : [];
  const lastCmdByInstance = new Map(
    latestMcpCommands.map((c) => [c.instanceId, c]),
  );
  type McpServerProbe = { name: string | null; ready: boolean };
  // Map<instanceId, Set<slug-reportado>>
  const reportedByInstance = new Map<string, Set<string>>();
  for (const hb of latestHeartbeats) {
    const payload = hb.rawPayload as
      | { extras?: { mcp?: { servers?: McpServerProbe[] | null } } }
      | null;
    const servers = payload?.extras?.mcp?.servers;
    const set = new Set<string>();
    if (Array.isArray(servers)) {
      for (const s of servers) {
        if (s?.name) set.add(s.name);
      }
    }
    reportedByInstance.set(hb.instanceId, set);
  }

  // Por install (catalog.slug), cuántos PCs lo reportan
  function pcCountForSlug(slug: string): { reporting: number; total: number } {
    let reporting = 0;
    for (const i of instances) {
      const set = reportedByInstance.get(i.id);
      if (set?.has(slug)) reporting++;
    }
    return { reporting, total: instances.length };
  }
  if (!firm) redirect("/login");

  const installedByCatalog = new Map(installs.map((i) => [i.catalogId, i]));

  // Group catalog by category
  const byCategory: Map<string, typeof catalog> = new Map();
  for (const c of catalog) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, []);
    byCategory.get(c.category)!.push(c);
  }

  async function installAction(formData: FormData) {
    "use server";
    const sess = await requireFirmAdmin();
    const catalogId = String(formData.get("catalogId") ?? "");
    if (!catalogId) throw new Error("catalogId_required");
    const entry = await db.mcpServerCatalog.findUnique({
      where: { id: catalogId },
    });
    if (!entry) throw new Error("catalog_not_found");

    // Recoger configurableArgs del form. Cada arg viene como `arg.<key>`.
    type CfgArg = {
      key: string;
      label: string;
      type: "string" | "number" | "boolean";
      defaultValue?: unknown;
      required?: boolean;
    };
    const cfgArgs = (entry.configurableArgs as CfgArg[] | null) ?? [];
    const configArgs: Record<string, unknown> = {};
    for (const arg of cfgArgs) {
      const raw = formData.get(`arg.${arg.key}`);
      if (raw == null) continue;
      const str = String(raw).trim();
      if (str === "") {
        if (arg.required) throw new Error(`arg_required:${arg.key}`);
        continue;
      }
      if (arg.type === "number") {
        const n = Number(str);
        if (!Number.isFinite(n)) throw new Error(`arg_invalid_number:${arg.key}`);
        configArgs[arg.key] = n;
      } else if (arg.type === "boolean") {
        configArgs[arg.key] = str === "true" || str === "on" || str === "1";
      } else {
        configArgs[arg.key] = str;
      }
    }

    const configArgsValue = Object.keys(configArgs).length > 0
      ? (configArgs as Prisma.InputJsonValue)
      : undefined;
    await db.firmMcpInstall.upsert({
      where: {
        firmId_catalogId: { firmId: sess.user.firmId, catalogId },
      },
      create: {
        firmId: sess.user.firmId,
        catalogId,
        enabled: true,
        installedBy: sess.user.id,
        configArgs: configArgsValue,
      },
      update: {
        enabled: true,
        configArgs: configArgsValue,
      },
    });
    await recordActivity({
      kind: "mcp.install",
      summary: `Instaló MCP "${entry.displayName}" en la firma`,
      firmId: sess.user.firmId,
      actor: sess,
      metadata: {
        slug: entry.slug,
        displayName: entry.displayName,
        configArgs: Object.keys(configArgs).length > 0 ? configArgs : null,
      },
    });
    revalidatePath("/firm/mcp");
  }

  async function pushToAllAction() {
    "use server";
    const sess = await requireFirmAdmin();
    const targets = await db.instance.findMany({
      where: { firmId: sess.user.firmId },
      select: { id: true },
    });
    if (targets.length === 0) {
      redirect("/firm/mcp?pushed=0");
    }
    const expiresAt = new Date(Date.now() + COMMAND_DEFAULT_TTL_MS);
    await db.instanceCommand.createMany({
      data: targets.map((t) => ({
        instanceId: t.id,
        kind: "push_mcp_config",
        args: Prisma.JsonNull,
        createdBy: sess.user.id,
        expiresAt,
      })),
    });
    await recordActivity({
      kind: "mcp.push_all",
      summary: `Encoló push_mcp_config a ${targets.length} PCs`,
      firmId: sess.user.firmId,
      actor: sess,
      metadata: { instance_count: targets.length },
    });
    revalidatePath("/firm/mcp");
    redirect(`/firm/mcp?pushed=${targets.length}`);
  }

  async function reloadAllAction() {
    "use server";
    const sess = await requireFirmAdmin();
    const targets = await db.instance.findMany({
      where: { firmId: sess.user.firmId },
      select: { id: true },
    });
    if (targets.length === 0) {
      redirect("/firm/mcp?reloaded=0");
    }
    const expiresAt = new Date(Date.now() + COMMAND_DEFAULT_TTL_MS);
    await db.instanceCommand.createMany({
      data: targets.map((t) => ({
        instanceId: t.id,
        kind: "reload_mcp",
        args: Prisma.JsonNull,
        createdBy: sess.user.id,
        expiresAt,
      })),
    });
    await recordActivity({
      kind: "mcp.reload_all",
      summary: `Encoló reload_mcp a ${targets.length} PCs`,
      firmId: sess.user.firmId,
      actor: sess,
      metadata: { instance_count: targets.length },
    });
    revalidatePath("/firm/mcp");
    redirect(`/firm/mcp?reloaded=${targets.length}`);
  }

  async function reconfigureAction(formData: FormData) {
    "use server";
    const sess = await requireFirmAdmin();
    const installId = String(formData.get("installId") ?? "");
    const inst = await db.firmMcpInstall.findUnique({
      where: { id: installId },
      include: { catalog: true },
    });
    if (!inst || inst.firmId !== sess.user.firmId) throw new Error("forbidden");
    type CfgArg = {
      key: string;
      label: string;
      type: "string" | "number" | "boolean";
      defaultValue?: unknown;
      required?: boolean;
    };
    const cfgArgs = (inst.catalog.configurableArgs as CfgArg[] | null) ?? [];
    const configArgs: Record<string, unknown> = {};
    for (const arg of cfgArgs) {
      const raw = formData.get(`arg.${arg.key}`);
      if (raw == null) continue;
      const str = String(raw).trim();
      if (str === "") continue;
      if (arg.type === "number") {
        const n = Number(str);
        if (Number.isFinite(n)) configArgs[arg.key] = n;
      } else if (arg.type === "boolean") {
        configArgs[arg.key] = str === "true" || str === "on" || str === "1";
      } else {
        configArgs[arg.key] = str;
      }
    }
    await db.firmMcpInstall.update({
      where: { id: inst.id },
      data: {
        configArgs:
          Object.keys(configArgs).length > 0
            ? (configArgs as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });
    await recordActivity({
      kind: "mcp.reconfigure",
      summary: `Reconfiguró MCP "${inst.catalog.displayName}"`,
      firmId: sess.user.firmId,
      actor: sess,
      metadata: { slug: inst.catalog.slug, configArgs },
    });
    revalidatePath("/firm/mcp");
  }

  async function toggleAction(formData: FormData) {
    "use server";
    const sess = await requireFirmAdmin();
    const installId = String(formData.get("installId") ?? "");
    const inst = await db.firmMcpInstall.findUnique({
      where: { id: installId },
      include: { catalog: true },
    });
    if (!inst || inst.firmId !== sess.user.firmId) throw new Error("forbidden");
    await db.firmMcpInstall.update({
      where: { id: inst.id },
      data: { enabled: !inst.enabled },
    });
    await recordActivity({
      kind: inst.enabled ? "mcp.disable" : "mcp.enable",
      summary: `${inst.enabled ? "Desactivó" : "Activó"} MCP "${inst.catalog.displayName}"`,
      firmId: sess.user.firmId,
      actor: sess,
      metadata: { slug: inst.catalog.slug },
    });
    revalidatePath("/firm/mcp");
  }

  async function uninstallAction(formData: FormData) {
    "use server";
    const sess = await requireFirmAdmin();
    const installId = String(formData.get("installId") ?? "");
    const inst = await db.firmMcpInstall.findUnique({
      where: { id: installId },
      include: { catalog: true },
    });
    if (!inst || inst.firmId !== sess.user.firmId) throw new Error("forbidden");
    await db.firmMcpInstall.delete({ where: { id: inst.id } });
    await recordActivity({
      kind: "mcp.uninstall",
      summary: `Desinstaló MCP "${inst.catalog.displayName}" de la firma`,
      firmId: sess.user.firmId,
      actor: sess,
      metadata: { slug: inst.catalog.slug },
    });
    revalidatePath("/firm/mcp");
  }

  const enabledCount = installs.filter((i) => i.enabled).length;

  return (
    <main className="container-page min-h-screen py-8 sm:py-12 space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="eyebrow-chip">firm admin · {firm.name}</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            MCP servers
          </h1>
          <p className="text-sm text-muted-foreground">
            Model Context Protocol — extiende los copilotos con tools de
            terceros (filesystem, github, slack, db, search…). Lo que
            actives aquí se sincroniza con los PCs de tu firma en el
            próximo heartbeat.
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>{enabledCount}</strong> activos ·{" "}
            <strong>{installs.length}</strong> instalados ·{" "}
            <strong>{catalog.length}</strong> disponibles en el catálogo.
          </p>
        </div>
        <Link href="/firm" className="text-sm underline text-muted-foreground">
          ← Volver
        </Link>
      </header>

      {pushedCount != null && (
        <div className="card-quiet p-3 border-l-4 border-green-500 text-sm">
          {pushedCount > 0
            ? `✅ Encolado push_mcp_config en ${pushedCount} PC${pushedCount === 1 ? "" : "s"}. Cada uno lo procesará en su próximo heartbeat (~60s).`
            : `⚠️ Esta firma no tiene PCs registrados. Da de alta uno desde /firm primero.`}
        </div>
      )}

      {reloadedCount != null && reloadedCount > 0 && (
        <div className="card-quiet p-3 border-l-4 border-blue-500 text-sm">
          🔄 Encolado reload_mcp en {reloadedCount} PC{reloadedCount === 1 ? "" : "s"}.
          Refresca caché de tools MCP sin reescribir openclaw.json.
        </div>
      )}

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            Sincronización
          </CardTitle>
          <CardDescription>
            <strong>Sincronizar</strong> reescribe el <code>openclaw.json</code>{" "}
            de cada PC con la lista de MCP de esta firma (preserva secrets).{" "}
            <strong>Recargar</strong> solo refresca la caché del bridge — usar
            si el config ya está bien pero el manifest se ve desactualizado.
            Comandos llegan en el próximo heartbeat (~60s).
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <form action={pushToAllAction}>
              <Button
                type="submit"
                disabled={instances.length === 0}
                style={
                  instances.length === 0
                    ? undefined
                    : {
                        backgroundColor: "var(--brand)",
                        color: "var(--brand-foreground)",
                      }
                }
              >
                {instances.length === 0
                  ? "No hay PCs"
                  : `Sincronizar a ${instances.length} PC${instances.length === 1 ? "" : "s"}`}
              </Button>
            </form>
            <form action={reloadAllAction}>
              <Button
                type="submit"
                variant="outline"
                disabled={instances.length === 0}
              >
                🔄 Recargar
              </Button>
            </form>
            <div className="text-xs text-muted-foreground">
              {onlineInstances.length} online ·{" "}
              {instances.length - onlineInstances.length} offline (los
              offline reciben el comando cuando vuelvan)
            </div>
          </div>
        </CardContent>
      </Card>

      {installs.length > 0 && (
        <Card className="card-paper border-0 shadow-none p-0">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="font-display text-xl">
              Instalados ({installs.length})
            </CardTitle>
            <CardDescription>
              Configurados para esta firma. Toggle on/off sin desinstalar.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-2">
            {installs.map((inst) => {
              type CfgArg = {
                key: string;
                label: string;
                type: "string" | "number" | "boolean";
                defaultValue?: unknown;
                required?: boolean;
                helpText?: string;
              };
              const cfgArgs = (inst.catalog.configurableArgs as CfgArg[] | null) ?? [];
              const currentArgs = (inst.configArgs as Record<string, unknown> | null) ?? {};
              return (
                <div
                  key={inst.id}
                  className="card-quiet p-3 space-y-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{inst.catalog.iconEmoji ?? "🔌"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-sm">{inst.catalog.displayName}</strong>
                        <Badge variant={inst.enabled ? "default" : "secondary"} className="text-[10px]">
                          {inst.enabled ? "activo" : "inactivo"}
                        </Badge>
                        {Array.isArray(inst.catalog.requiredEnvVars) &&
                          (inst.catalog.requiredEnvVars as string[]).length > 0 && (
                            <Badge variant="outline" className="text-[10px]" title="Requiere secrets en el PC del worker">
                              🔐 secrets
                            </Badge>
                          )}
                        {(() => {
                          if (instances.length === 0) return null;
                          const { reporting, total } = pcCountForSlug(inst.catalog.slug);
                          const synced = reporting === total;
                          return (
                            <Badge
                              variant={synced ? "secondary" : "outline"}
                              className="text-[10px]"
                              title={
                                synced
                                  ? "Todos los PCs reportan este MCP en su último heartbeat"
                                  : `${reporting} PCs lo reportan; ${total - reporting} pendientes — pulsa "Sincronizar" arriba`
                              }
                              style={
                                synced
                                  ? undefined
                                  : { borderColor: "#e0a86c", color: "#a86c1f" }
                              }
                            >
                              {synced ? "✓" : "⏳"} {reporting}/{total} PCs
                            </Badge>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {inst.catalog.description}
                      </div>
                    </div>
                    <form action={toggleAction}>
                      <input type="hidden" name="installId" value={inst.id} />
                      <Button type="submit" variant="outline" size="sm">
                        {inst.enabled ? "Desactivar" : "Activar"}
                      </Button>
                    </form>
                    <form action={uninstallAction}>
                      <input type="hidden" name="installId" value={inst.id} />
                      <button
                        type="submit"
                        className="text-xs underline text-muted-foreground hover:text-destructive"
                      >
                        desinstalar
                      </button>
                    </form>
                  </div>
                  {cfgArgs.length > 0 && (
                    <form
                      action={reconfigureAction}
                      className="border-t border-border/40 pt-2 space-y-2"
                    >
                      <input type="hidden" name="installId" value={inst.id} />
                      <div className="eyebrow text-[10px] text-muted-foreground">
                        Configuración
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {cfgArgs.map((arg) => {
                          const current = currentArgs[arg.key];
                          return (
                            <div key={arg.key} className="space-y-0.5">
                              <label
                                htmlFor={`re-${inst.id}-${arg.key}`}
                                className="text-[10px] text-muted-foreground"
                              >
                                {arg.label}
                              </label>
                              <input
                                id={`re-${inst.id}-${arg.key}`}
                                name={`arg.${arg.key}`}
                                type={arg.type === "number" ? "number" : "text"}
                                defaultValue={
                                  current != null
                                    ? String(current)
                                    : arg.defaultValue != null
                                      ? String(arg.defaultValue)
                                      : ""
                                }
                                className="w-full px-2 h-7 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-ring"
                              />
                            </div>
                          );
                        })}
                      </div>
                      <Button type="submit" size="sm" variant="outline" className="h-7 text-xs">
                        Guardar configuración
                      </Button>
                    </form>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            Catálogo disponible
          </CardTitle>
          <CardDescription>
            Servidores MCP oficiales mantenidos por la comunidad
            modelcontextprotocol.io.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-6">
          {CATEGORIES.map((cat) => {
            const entries = byCategory.get(cat.value);
            if (!entries || entries.length === 0) return null;
            return (
              <div key={cat.value} className="space-y-2">
                <div className="eyebrow text-[10px]">{cat.label}</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {entries.map((c) => {
                    const installed = installedByCatalog.get(c.id);
                    const reqEnvs = (c.requiredEnvVars as string[] | null) ?? [];
                    type CfgArg = {
                      key: string;
                      label: string;
                      type: "string" | "number" | "boolean";
                      defaultValue?: unknown;
                      required?: boolean;
                      helpText?: string;
                    };
                    const cfgArgs = (c.configurableArgs as CfgArg[] | null) ?? [];
                    return (
                      <div key={c.id} className="card-quiet p-3 flex items-start gap-3">
                        <span className="text-xl shrink-0">{c.iconEmoji ?? "🔌"}</span>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-sm">{c.displayName}</strong>
                            {c.isOfficial && (
                              <Badge variant="secondary" className="text-[10px]">
                                oficial
                              </Badge>
                            )}
                            {reqEnvs.length > 0 && (
                              <Badge
                                variant="outline"
                                className="text-[10px]"
                                title={`Requiere: ${reqEnvs.join(", ")}`}
                              >
                                🔐 {reqEnvs.length} secret{reqEnvs.length === 1 ? "" : "s"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {c.description}
                          </p>
                          {!installed ? (
                            <form action={installAction} className="space-y-2 pt-1">
                              <input type="hidden" name="catalogId" value={c.id} />
                              {cfgArgs.length > 0 && (
                                <div className="space-y-1.5 pt-1 border-t border-border/40">
                                  {cfgArgs.map((arg) => (
                                    <div key={arg.key} className="space-y-0.5">
                                      <label
                                        htmlFor={`arg-${c.id}-${arg.key}`}
                                        className="text-[10px] text-muted-foreground"
                                      >
                                        {arg.label}
                                        {arg.required && (
                                          <span className="text-red-600 ml-1">*</span>
                                        )}
                                      </label>
                                      <input
                                        id={`arg-${c.id}-${arg.key}`}
                                        name={`arg.${arg.key}`}
                                        type={arg.type === "number" ? "number" : "text"}
                                        defaultValue={
                                          arg.defaultValue != null
                                            ? String(arg.defaultValue)
                                            : ""
                                        }
                                        required={arg.required}
                                        placeholder={
                                          arg.defaultValue != null
                                            ? String(arg.defaultValue)
                                            : undefined
                                        }
                                        className="w-full px-2 h-7 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-ring"
                                      />
                                      {arg.helpText && (
                                        <div className="text-[10px] text-muted-foreground">
                                          {arg.helpText}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                >
                                  Instalar
                                </Button>
                                {c.docsUrl && (
                                  <a
                                    href={c.docsUrl}
                                    target="_blank"
                                    rel="noopener"
                                    className="text-[10px] underline text-muted-foreground"
                                  >
                                    docs ↗
                                  </a>
                                )}
                              </div>
                            </form>
                          ) : (
                            <div className="flex items-center gap-2 pt-1">
                              <Badge variant="default" className="text-[10px]">
                                ✓ instalado
                              </Badge>
                              {c.docsUrl && (
                                <a
                                  href={c.docsUrl}
                                  target="_blank"
                                  rel="noopener"
                                  className="text-[10px] underline text-muted-foreground"
                                >
                                  docs ↗
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {instances.length > 0 && installs.length > 0 && (
        <Card className="card-paper border-0 shadow-none p-0">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="font-display text-xl">
              Estado por PC
            </CardTitle>
            <CardDescription>
              Cruz: filas = PCs de la firma, columnas = MCP servers
              instalados. ✓ verde = el PC reporta tenerlo cargado en su
              último heartbeat. ⏳ naranja = instalado en clawhub pero
              todavía no en el PC (sincroniza arriba).
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-4 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2 px-2 eyebrow text-[10px]">
                      PC
                    </th>
                    <th className="text-left py-2 px-2 eyebrow text-[10px]">
                      Última sync
                    </th>
                    {installs.map((inst) => (
                      <th
                        key={inst.id}
                        className="py-2 px-2 eyebrow text-[10px]"
                        title={inst.catalog.displayName}
                      >
                        {inst.catalog.iconEmoji ?? "🔌"}{" "}
                        <span className="hidden sm:inline">
                          {inst.catalog.slug}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {instances.map((i) => {
                    const reported = reportedByInstance.get(i.id) ?? new Set<string>();
                    const isOnline =
                      i.lastHeartbeatAt &&
                      Date.now() - i.lastHeartbeatAt.getTime() < ONLINE_THRESHOLD_MS;
                    const lastCmd = lastCmdByInstance.get(i.id);
                    return (
                      <tr key={i.id} className="border-b border-border/20 hover:bg-paper-2/40">
                        <td className="py-1.5 px-2">
                          <Link
                            href={`/firm/instances/${i.id}`}
                            className="flex items-center gap-2 hover:text-brand"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: isOnline ? "var(--brand)" : "#bbb",
                              }}
                            />
                            <span className="text-sm">{i.workerLabel}</span>
                          </Link>
                        </td>
                        <td className="py-1.5 px-2 text-xs">
                          {lastCmd ? (
                            <span
                              title={
                                lastCmd.errorMessage ??
                                `${lastCmd.kind} · ${lastCmd.status} · creado ${lastCmd.createdAt.toLocaleString("es-ES")}`
                              }
                            >
                              <span
                                style={{
                                  color:
                                    lastCmd.status === "COMPLETED"
                                      ? "var(--brand)"
                                      : lastCmd.status === "FAILED"
                                        ? "#c14242"
                                        : lastCmd.status === "EXPIRED"
                                          ? "#999"
                                          : "#e0a86c",
                                  fontWeight: 600,
                                }}
                              >
                                {lastCmd.status === "COMPLETED" && "✓"}
                                {lastCmd.status === "FAILED" && "✗"}
                                {lastCmd.status === "EXPIRED" && "⌛"}
                                {(lastCmd.status === "PENDING" ||
                                  lastCmd.status === "DISPATCHED") &&
                                  "⏳"}
                              </span>{" "}
                              <span className="text-muted-foreground">
                                {lastCmd.kind === "push_mcp_config" ? "push" : "reload"}{" "}
                                {(lastCmd.completedAt ?? lastCmd.createdAt).toLocaleString("es-ES", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">
                              nunca
                            </span>
                          )}
                        </td>
                        {installs.map((inst) => {
                          const has = reported.has(inst.catalog.slug);
                          return (
                            <td
                              key={inst.id}
                              className="py-1.5 px-2 text-center"
                              title={
                                has
                                  ? `${inst.catalog.slug}: reportado en último heartbeat`
                                  : `${inst.catalog.slug}: pendiente (no aparece en último heartbeat)`
                              }
                            >
                              <span
                                style={{
                                  color: has ? "var(--brand)" : "#e0a86c",
                                  fontWeight: 600,
                                }}
                              >
                                {has ? "✓" : "⏳"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {latestHeartbeats.length === 0 && (
              <p className="text-xs text-muted-foreground mt-3 italic">
                Ningún PC ha mandado heartbeat aún — la columna de reportes
                queda toda en ⏳ hasta que el primer agent se conecte.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            ¿Cómo llegan al PC?
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 text-sm text-muted-foreground space-y-2">
          <p>
            Cuando activas un MCP aquí, en el próximo heartbeat (~60s) clawhub
            encola un comando <code>push_mcp_config</code> a tus PCs. El agent
            local edita <code>openclaw.json</code>, ejecuta{" "}
            <code>npm run mcp:config</code> y reinicia el bridge.
          </p>
          <p>
            <strong>Para los MCP que requieren secrets</strong> (🔐) — el worker
            tiene que configurarlos UNA VEZ desde el AI Office local. clawhub
            nunca guarda tokens ni passwords (los datos no salen del PC).
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
