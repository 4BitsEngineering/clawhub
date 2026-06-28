import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
import { Prisma } from "@/generated/prisma/client";
import { COMMAND_DEFAULT_TTL_MS, validateArgs } from "@/lib/commands";
import {
  buildInstallPlan,
  prefixForOverlay,
  type ProvisionedAgent,
} from "@/lib/install-plan";
import { OperatorShell } from "@/components/operator-shell";
import { FirmSubnav } from "@/components/firm-subnav";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// Lectura tipada de AgentCatalogEntry.defaults (Json del manifest clawcrew).
type CatalogDefaults = {
  slug?: string;
  displayName?: string;
  shortName?: string;
  icon?: string;
  color?: string;
  voice?: { kind?: string; elevenlabsId?: string | null };
  workingVerb?: string;
};
function readDefaults(j: unknown): CatalogDefaults {
  return (j ?? {}) as CatalogDefaults;
}

// Lectura tipada de AgentCatalogEntry.presentation (bloque "vestido" de clawcrew).
type CatalogPresentation = {
  tagline?: string;
  mission?: string[];
  portrait?: string;
};
function readPresentation(j: unknown): CatalogPresentation {
  return (j ?? {}) as CatalogPresentation;
}

const VOICE_KINDS = ["", "male", "female", "neutral"] as const;

export default async function FirmTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireOperator();
  const { id } = await params;

  const firm = await db.firm.findUnique({
    where: { id },
    include: {
      instances: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!firm) notFound();

  const [team, catalog, templates] = await Promise.all([
    db.firmAgentInstall.findMany({
      where: { firmId: id },
      include: { catalog: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.agentCatalogEntry.findMany({
      where: { deprecatedAt: null },
      orderBy: [{ category: "asc" }, { agentKey: "asc" }],
    }),
    db.officeTemplate.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const prefix = prefixForOverlay(firm.overlayId);

  // ─── Server actions ──────────────────────────────────────────────────────

  async function applyTemplateAction(formData: FormData) {
    "use server";
    const sess = await requireOperator();
    const sector = String(formData.get("sector") ?? "").trim();
    if (!sector) return;
    const tpl = await db.officeTemplate.findUnique({ where: { sector } });
    if (!tpl) return;
    const keys = (tpl.agentKeys as string[] | null) ?? [];
    const entries = await db.agentCatalogEntry.findMany({
      where: { agentKey: { in: keys } },
    });
    const byKey = new Map(entries.map((e) => [e.agentKey, e]));

    // "Cargar plantilla" REEMPLAZA el equipo actual.
    const rows: Prisma.FirmAgentInstallCreateManyInput[] = [];
    const usedSlugs = new Set<string>();
    keys.forEach((key, i) => {
      const e = byKey.get(key);
      if (!e) return;
      const d = readDefaults(e.defaults);
      let slug = (d.slug || key).toLowerCase();
      while (usedSlugs.has(slug)) slug = `${slug}-2`;
      usedSlugs.add(slug);
      rows.push({
        firmId: id,
        catalogId: e.id,
        agentKey: e.agentKey,
        slug,
        displayName: d.displayName || e.agentKey,
        color: d.color ?? null,
        icon: d.icon ?? null,
        voiceKind: d.voice?.kind ?? null,
        elevenlabsId: d.voice?.elevenlabsId ?? null,
        sortOrder: i,
        installedBy: sess.user.id,
      });
    });

    await db.$transaction([
      db.firmAgentInstall.deleteMany({ where: { firmId: id } }),
      db.firmAgentInstall.createMany({ data: rows }),
    ]);
    await recordActivity({
      kind: "agents.template_applied",
      summary: `Cargó plantilla "${tpl.name}" (${rows.length} agentes) en ${firm!.name}`,
      firmId: id,
      actor: sess,
      metadata: { sector, agentKeys: keys },
    });
    revalidatePath(`/operator/firms/${id}/team`);
  }

  async function addAgentAction(formData: FormData) {
    "use server";
    const sess = await requireOperator();
    const catalogId = String(formData.get("catalogId") ?? "").trim();
    if (!catalogId) return;
    const e = await db.agentCatalogEntry.findUnique({ where: { id: catalogId } });
    if (!e) return;
    const d = readDefaults(e.defaults);

    const existing = await db.firmAgentInstall.findMany({
      where: { firmId: id },
      select: { slug: true, sortOrder: true },
    });
    const used = new Set(existing.map((x) => x.slug));
    let slug = (d.slug || e.agentKey).toLowerCase();
    while (used.has(slug)) slug = `${slug}-2`;
    const nextOrder = existing.reduce((m, x) => Math.max(m, x.sortOrder), -1) + 1;

    await db.firmAgentInstall.create({
      data: {
        firmId: id,
        catalogId: e.id,
        agentKey: e.agentKey,
        slug,
        displayName: d.displayName || e.agentKey,
        color: d.color ?? null,
        icon: d.icon ?? null,
        voiceKind: d.voice?.kind ?? null,
        elevenlabsId: d.voice?.elevenlabsId ?? null,
        sortOrder: nextOrder,
        installedBy: sess.user.id,
      },
    });
    await recordActivity({
      kind: "agents.add",
      summary: `Añadió ${e.agentKey} (${slug}) al equipo de ${firm!.name}`,
      firmId: id,
      actor: sess,
      metadata: { agentKey: e.agentKey, slug },
    });
    revalidatePath(`/operator/firms/${id}/team`);
  }

  async function updateAgentAction(formData: FormData) {
    "use server";
    const sess = await requireOperator();
    const installId = String(formData.get("installId") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
    const displayName = String(formData.get("displayName") ?? "").trim();
    const colorRaw = String(formData.get("color") ?? "").trim();
    const iconRaw = String(formData.get("icon") ?? "").trim();
    const voiceRaw = String(formData.get("voiceKind") ?? "").trim();
    const elevenRaw = String(formData.get("elevenlabsId") ?? "").trim();
    if (!installId || !slug || !displayName) return;

    const row = await db.firmAgentInstall.findUnique({ where: { id: installId } });
    if (!row || row.firmId !== id) return;
    const color = /^#[0-9a-fA-F]{6}$/.test(colorRaw) ? colorRaw : null;
    const voiceKind = ["male", "female", "neutral"].includes(voiceRaw) ? voiceRaw : null;

    await db.firmAgentInstall.update({
      where: { id: installId },
      data: {
        slug,
        displayName,
        color,
        icon: iconRaw || null,
        voiceKind,
        elevenlabsId: elevenRaw || null,
      },
    });
    await recordActivity({
      kind: "agents.update",
      summary: `Editó ${row.agentKey} (${slug}) en ${firm!.name}`,
      firmId: id,
      actor: sess,
      metadata: { installId, slug },
    });
    revalidatePath(`/operator/firms/${id}/team`);
  }

  async function removeAgentAction(formData: FormData) {
    "use server";
    const sess = await requireOperator();
    const installId = String(formData.get("installId") ?? "").trim();
    if (!installId) return;
    const row = await db.firmAgentInstall.findUnique({ where: { id: installId } });
    if (!row || row.firmId !== id) return;
    await db.firmAgentInstall.delete({ where: { id: installId } });
    await recordActivity({
      kind: "agents.remove",
      summary: `Quitó ${row.agentKey} (${row.slug}) del equipo de ${firm!.name}`,
      firmId: id,
      actor: sess,
      metadata: { agentKey: row.agentKey, slug: row.slug },
    });
    revalidatePath(`/operator/firms/${id}/team`);
  }

  async function enqueueInstallAction(formData: FormData) {
    "use server";
    const sess = await requireOperator();
    const instanceId = String(formData.get("instanceId") ?? "").trim();
    if (!instanceId) return;
    const instance = await db.instance.findUnique({ where: { id: instanceId } });
    if (!instance || instance.firmId !== id) return;

    const rows = await db.firmAgentInstall.findMany({
      where: { firmId: id, enabled: true },
      orderBy: { sortOrder: "asc" },
    });
    if (rows.length === 0) return;

    const agents: ProvisionedAgent[] = rows.map((r) => ({
      agentKey: r.agentKey,
      slug: r.slug,
      displayName: r.displayName,
      color: r.color,
      icon: r.icon,
      voiceKind: r.voiceKind,
      elevenlabsId: r.elevenlabsId,
    }));
    const plan = buildInstallPlan(agents, prefixForOverlay(firm!.overlayId), firm!.overlayId);
    const args = validateArgs("install_agents", plan.commandArgs);

    await db.instanceCommand.create({
      data: {
        instanceId: instance.id,
        kind: "install_agents",
        args: args as Prisma.InputJsonValue,
        createdBy: sess.user.id,
        expiresAt: new Date(Date.now() + COMMAND_DEFAULT_TTL_MS),
      },
    });
    await recordActivity({
      kind: "agents.install_enqueued",
      summary: `Encoló install_agents (${agents.length} agentes) en "${instance.workerLabel}"`,
      firmId: id,
      instanceId: instance.id,
      actor: sess,
      metadata: { agentCount: agents.length, prefix: plan.prefix },
    });
    revalidatePath(`/operator/firms/${id}/team`);
  }

  // ─── Plan de instalación (para mostrar) ────────────────────────────────────
  const provisioned: ProvisionedAgent[] = team
    .filter((t) => t.enabled)
    .map((t) => ({
      agentKey: t.agentKey,
      slug: t.slug,
      displayName: t.displayName,
      color: t.color,
      icon: t.icon,
      voiceKind: t.voiceKind,
      elevenlabsId: t.elevenlabsId,
    }));
  const plan = provisioned.length > 0 ? buildInstallPlan(provisioned, prefix, firm.overlayId) : null;

  // agentKeys ya en el equipo, para marcar las tarjetas del catálogo.
  const inTeam = new Set(team.map((t) => t.agentKey));

  return (
    <OperatorShell email={session.user.email} flush>
      <FirmSubnav firmId={firm.id} firmName={firm.name} />
      <div className="container-page py-8 space-y-8">

      {/* Plantilla de sector (alta en un clic) */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Cargar plantilla de sector</CardTitle>
          <CardDescription>
            Empieza con el equipo recomendado del sector en un clic. Reemplaza el
            equipo actual; luego ajustas desde el catálogo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={applyTemplateAction} className="flex gap-2 max-w-md">
            <select
              name="sector"
              className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Elegir sector…
              </option>
              {templates.map((t) => (
                <option key={t.sector} value={t.sector}>
                  {t.emoji ? `${t.emoji} ` : ""}
                  {t.name} ({((t.agentKeys as string[] | null) ?? []).length})
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Cargar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Catálogo visual de agentes vestidos */}
      <Card>
        <CardHeader>
          <CardTitle>Catálogo de agentes ({catalog.length})</CardTitle>
          <CardDescription>
            Roles del catálogo, listos para fichar. Cada uno llega «vestido»
            (retrato, presentación y misión). Pulsa «Añadir» para sumarlo al
            equipo del cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              El catálogo está vacío. Siémbralo con{" "}
              <code className="text-xs">scripts/seed-agent-catalog.ts</code>.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.map((c) => {
                const d = readDefaults(c.defaults);
                const p = readPresentation(c.presentation);
                const already = inTeam.has(c.agentKey);
                return (
                  <div key={c.id} className="flex flex-col gap-2 rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      {c.portraitUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.portraitUrl}
                          alt={d.displayName ?? c.agentKey}
                          width={40}
                          height={40}
                          className="h-10 w-10 shrink-0 rounded-md border bg-white object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-lg"
                          style={{ background: d.color ?? "transparent" }}
                        >
                          {d.icon ?? "🤖"}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {d.displayName ?? c.agentKey}
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {c.category}
                        </Badge>
                      </div>
                    </div>

                    {p.tagline && (
                      <p className="text-xs text-muted-foreground">{p.tagline}</p>
                    )}
                    {p.mission && p.mission.length > 0 && (
                      <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                        {p.mission.slice(0, 3).map((m, i) => (
                          <li key={i} className="flex gap-1">
                            <span aria-hidden>·</span>
                            <span className="truncate">{m}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-auto pt-1">
                      {already ? (
                        <span className="text-[11px] text-muted-foreground">
                          ✓ En el equipo
                        </span>
                      ) : (
                        <form action={addAgentAction}>
                          <input type="hidden" name="catalogId" value={c.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            className="h-7 w-full text-xs"
                          >
                            + Añadir al equipo
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Equipo */}
      <Card>
        <CardHeader>
          <CardTitle>Agentes del equipo ({team.length})</CardTitle>
          <CardDescription>
            La identidad (slug, nombre, color, voz) es lo que verá el cliente.
            El rol del catálogo (agentKey) define el comportamiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {team.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Equipo vacío. Carga una plantilla o añade roles arriba.
            </p>
          ) : (
            team.map((t) => (
              <div key={t.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-3 w-3 rounded-full border"
                      style={{ background: t.color ?? "transparent" }}
                    />
                    <span className="font-medium">{t.displayName}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {t.agentKey}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      → <code>{prefix}-{t.slug}-v1</code>
                    </span>
                  </div>
                  <form action={removeAgentAction}>
                    <input type="hidden" name="installId" value={t.id} />
                    <button
                      type="submit"
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Quitar
                    </button>
                  </form>
                </div>

                <form action={updateAgentAction} className="grid grid-cols-2 gap-3 sm:grid-cols-6 sm:items-end">
                  <input type="hidden" name="installId" value={t.id} />
                  <div className="space-y-1">
                    <Label className="text-[10px]">Slug</Label>
                    <Input name="slug" defaultValue={t.slug} required className="h-8 font-mono text-xs" maxLength={40} />
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-2">
                    <Label className="text-[10px]">Nombre</Label>
                    <Input name="displayName" defaultValue={t.displayName} required className="h-8 text-xs" maxLength={120} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Color</Label>
                    <Input name="color" defaultValue={t.color ?? ""} placeholder="#4F6D9E" className="h-8 font-mono text-xs" maxLength={7} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Icono</Label>
                    <Input name="icon" defaultValue={t.icon ?? ""} placeholder="📋" className="h-8 text-xs" maxLength={16} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Voz</Label>
                    <select
                      name="voiceKind"
                      defaultValue={t.voiceKind ?? ""}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {VOICE_KINDS.map((v) => (
                        <option key={v} value={v}>
                          {v || "—"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-5">
                    <Label className="text-[10px]">
                      ElevenLabs ID{" "}
                      <span className="normal-case text-muted-foreground">(opcional)</span>
                    </Label>
                    <Input name="elevenlabsId" defaultValue={t.elevenlabsId ?? ""} className="h-8 font-mono text-xs" maxLength={120} />
                  </div>
                  <Button type="submit" size="sm" variant="outline" className="h-8">
                    Guardar
                  </Button>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Plan de instalación */}
      {plan && (
        <Card>
          <CardHeader>
            <CardTitle>Plan de instalación</CardTitle>
            <CardDescription>
              Comandos para fichar estos agentes de clawcrew en el overlay del
              equipo destino. Sustituye{" "}
              <code className="text-xs">&lt;RUTA_CLAWCREW&gt;</code> y{" "}
              <code className="text-xs">&lt;RUTA_OVERLAY&gt;</code> en el PC.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="eyebrow text-[10px] mb-1">openclaw-agent (pegar en el PC)</div>
              <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre">
                {plan.script}
              </pre>
            </div>
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Ver args del comando remoto install_agents (JSON)
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs whitespace-pre">
                {JSON.stringify(plan.commandArgs, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}

      {/* Encolar en un PC */}
      <Card>
        <CardHeader>
          <CardTitle>Encolar instalación en un PC</CardTitle>
          <CardDescription>
            Encola el comando <code>install_agents</code> a una instancia. La
            EJECUCIÓN ocurre en el PC del trabajador (handler del dispatcher
            pendiente — se valida en otro equipo). Aquí solo se deja en cola.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {firm.instances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Esta firma no tiene instancias pareadas todavía.
            </p>
          ) : provisioned.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Añade agentes al equipo antes de encolar la instalación.
            </p>
          ) : (
            <form action={enqueueInstallAction} className="flex gap-2">
              <select
                name="instanceId"
                className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Elegir instancia…
                </option>
                {firm.instances.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.workerLabel} ({i.os ?? "?"})
                  </option>
                ))}
              </select>
              <Button type="submit">Encolar install</Button>
            </form>
          )}
        </CardContent>
      </Card>
      </div>
    </OperatorShell>
  );
}
