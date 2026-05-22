/**
 * install-plan.ts — traduce un equipo provisionado (FirmAgentInstall) al plan
 * de instalación: (a) comandos `openclaw-agent install` listos para pegar en el
 * equipo destino y (b) los args del comando remoto `install_agents`.
 *
 * Lógica pura, sin Prisma ni IO — testeable aislada. La EJECUCIÓN (correr el
 * CLI en el PC del trabajador) es la pieza pendiente que se valida en otro
 * equipo; clawhub solo PREPARA este plan.
 */

export interface ProvisionedAgent {
  agentKey: string;
  slug: string;
  displayName: string;
  color?: string | null;
  icon?: string | null;
  voiceKind?: string | null;
  elevenlabsId?: string | null;
}

/** Prefijo del agentId ({prefix}-{slug}-v1) por overlay conocido. */
const PREFIX_BY_OVERLAY: Record<string, string> = {
  "ai-office": "office",
  asesoria: "ase",
  marketing: "mkt",
  "content-generation": "content",
};

export function prefixForOverlay(overlayId: string | null | undefined): string {
  if (!overlayId) return "office";
  return PREFIX_BY_OVERLAY[overlayId] ?? (overlayId.replace(/[^a-z0-9]+/gi, "").slice(0, 12) || "office");
}

/** Placeholders que el operador sustituye en el equipo destino. */
export const LIBRARY_PLACEHOLDER = "<RUTA_CLAWCREW>";
export const OVERLAY_PLACEHOLDER = "<RUTA_OVERLAY>";

/** Escapa un valor para usarlo entre comillas dobles en una shell. */
function q(value: string): string {
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

/** Args del comando remoto install_agents (lo que se serializa en InstanceCommand). */
export function buildInstallCommandArgs(
  agents: ProvisionedAgent[],
  prefix: string,
  overlay?: string | null,
) {
  return {
    ...(overlay ? { overlay } : {}),
    prefix,
    agents: agents.map((a) => ({
      agentKey: a.agentKey,
      slug: a.slug,
      displayName: a.displayName,
      color: a.color ?? null,
      icon: a.icon ?? null,
      voiceKind: (a.voiceKind as "male" | "female" | "neutral" | null) ?? null,
      elevenlabsId: a.elevenlabsId ?? null,
    })),
  };
}

/** Un comando `openclaw-agent install` por agente, listo para pegar. */
export function buildAgentCliCommands(
  agents: ProvisionedAgent[],
  prefix: string,
  opts?: { libraryPath?: string; overlayPath?: string },
): string[] {
  const lib = opts?.libraryPath ?? LIBRARY_PLACEHOLDER;
  const overlay = opts?.overlayPath ?? OVERLAY_PLACEHOLDER;
  return agents.map((a) => {
    const parts = [
      "openclaw-agent install",
      a.agentKey,
      `--library ${lib}`,
      `--overlay ${overlay}`,
      `--prefix ${prefix}`,
      `--slug ${a.slug}`,
      `--display-name ${q(a.displayName)}`,
    ];
    if (a.color) parts.push(`--color ${q(a.color)}`);
    if (a.icon) parts.push(`--icon ${q(a.icon)}`);
    if (a.voiceKind) parts.push(`--voice-kind ${a.voiceKind}`);
    if (a.elevenlabsId) parts.push(`--elevenlabs-id ${a.elevenlabsId}`);
    return parts.join(" \\\n  ");
  });
}

/** Plan completo: script shell pegable + args del comando remoto. */
export function buildInstallPlan(
  agents: ProvisionedAgent[],
  prefix: string,
  overlay?: string | null,
) {
  const commands = buildAgentCliCommands(agents, prefix);
  return {
    prefix,
    overlay: overlay ?? null,
    agentCount: agents.length,
    script: commands.join("\n\n"),
    commands,
    commandArgs: buildInstallCommandArgs(agents, prefix, overlay),
  };
}
