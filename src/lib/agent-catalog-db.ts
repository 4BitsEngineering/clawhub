// Catálogo de agentes VIVO — la tabla AgentCatalogEntry de la BD (agentKeys
// reales de clawcrew, sembradas desde los manifests), no el catálogo
// hardcodeado de agent-catalog.ts. Fuente única para: el AgentPicker de las
// landings, el saneado de la selección en el checkout, el baseline por defecto
// (default-baseline.ts) y las vistas de "equipo contratado".
//
// El catálogo hardcodeado (agent-catalog.ts) queda solo como último recurso
// si la tabla estuviera vacía, y como origen de MANDATORY_AGENTS y del tipo
// AgentCatalogEntry. Este módulo importa `db`: solo server-side.

import { db } from "@/lib/db";
import {
  AGENT_CATALOG,
  MANDATORY_AGENTS,
  type AgentCatalogEntry,
} from "@/lib/agent-catalog";

// Lectura tipada de AgentCatalogEntry.defaults (Json del manifest clawcrew).
export type CatalogDefaults = {
  slug?: string;
  displayName?: string;
  shortName?: string;
  icon?: string;
  color?: string;
  voice?: { kind?: string };
  workingVerb?: string;
};

// Ids del catálogo hardcodeado antiguo (guardados en Purchase.selectedAgents
// de compras previas a la migración) → agentKey real de clawcrew en la BD.
// Los que no tienen equivalente (tax, employment) no se resuelven y quedan
// fuera del equipo hasta que se siembren en AgentCatalogEntry.
export const LEGACY_AGENT_ALIASES: Record<string, string> = {
  assistant: "personal-assistant",
  automation: "automation-engineer",
  developer: "software-developer",
  legal: "legal-suite",
  marketing: "marketing-strategist",
};

// Entrada de equipo desde una fila del catálogo de la BD: identidad de los
// defaults del manifest clawcrew + blurb de la description.
export function teamEntryFromCatalog(e: {
  agentKey: string;
  description: string;
  defaults: unknown;
}): AgentCatalogEntry {
  const d = (e.defaults ?? {}) as CatalogDefaults;
  return {
    agent: e.agentKey,
    slug: d.slug ?? e.agentKey,
    displayName: d.displayName ?? e.agentKey,
    shortName: d.shortName ?? d.displayName ?? e.agentKey,
    icon: d.icon ?? "🤖",
    color: d.color ?? "#5B6470",
    workingVerb: d.workingVerb ?? "trabajando",
    voice: { kind: d.voice?.kind ?? "neutral" },
    blurb: e.description,
  };
}

// Catálogo completo vivo (entradas no deprecadas), con el planner
// (orquestador) encabezando. Si la tabla está vacía, cae al hardcodeado.
export async function catalogTeam(): Promise<readonly AgentCatalogEntry[]> {
  const entries = await db.agentCatalogEntry.findMany({
    where: { deprecatedAt: null },
    orderBy: [{ category: "asc" }, { agentKey: "asc" }],
    select: { agentKey: true, description: true, defaults: true },
  });
  if (entries.length === 0) return AGENT_CATALOG;
  const all = entries.map(teamEntryFromCatalog);
  all.sort((a, b) =>
    a.agent === "planner" ? -1 : b.agent === "planner" ? 1 : 0,
  );
  return all;
}

// Resolución SÍNCRONA de una selección persistida ([] = todos) contra un
// catálogo ya cargado (para listas: cargar catalogTeam() una vez y resolver
// N compras sin N queries). Acepta agentKeys de la BD e ids legacy (alias).
export function resolveTeamAgainst(
  catalog: readonly AgentCatalogEntry[],
  selectedAgents: string[] | null | undefined,
): readonly AgentCatalogEntry[] {
  if (!selectedAgents || selectedAgents.length === 0) return catalog;
  const keys = new Set(catalog.map((a) => a.agent));
  const wanted = new Set([
    ...MANDATORY_AGENTS,
    ...selectedAgents.map((id) =>
      keys.has(id) ? id : (LEGACY_AGENT_ALIASES[id] ?? id),
    ),
  ]);
  const team = catalog.filter((a) => wanted.has(a.agent));
  return team.length > 0 ? team : catalog;
}

// Resuelve una selección persistida contra el catálogo vivo de la BD.
export async function resolveCatalogTeam(
  selectedAgents?: string[] | null,
): Promise<readonly AgentCatalogEntry[]> {
  return resolveTeamAgainst(await catalogTeam(), selectedAgents);
}

// Normaliza una selección del comprador contra el catálogo vivo: traduce ids
// legacy, descarta desconocidos, añade los obligatorios y devuelve [] si el
// resultado equivale al catálogo completo ([] = "todos" en todo el sistema).
export async function sanitizeSelectionDb(ids: string[]): Promise<string[]> {
  const catalog = await catalogTeam();
  const keys = new Set(catalog.map((a) => a.agent));
  const valid = ids
    .map((id) => (keys.has(id) ? id : (LEGACY_AGENT_ALIASES[id] ?? id)))
    .filter((id) => keys.has(id));
  if (valid.length === 0) return [];
  const withMandatory = [
    ...new Set([...MANDATORY_AGENTS.filter((m) => keys.has(m)), ...valid]),
  ];
  if (withMandatory.length >= catalog.length) return [];
  // Orden estable: el del catálogo
  return catalog
    .filter((a) => withMandatory.includes(a.agent))
    .map((a) => a.agent);
}

// Lee la selección de los checkboxes agent_<agentKey> del form de compra
// (renderizados por AgentPicker desde el catálogo vivo) y la sanea.
export async function selectionFromFormDataDb(
  formData: FormData,
): Promise<string[]> {
  const catalog = await catalogTeam();
  const ids = catalog
    .filter((a) => formData.get(`agent_${a.agent}`) != null)
    .map((a) => a.agent);
  return sanitizeSelectionDb(ids);
}
