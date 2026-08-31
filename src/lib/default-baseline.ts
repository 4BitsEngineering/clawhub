// Fuente única del paquete de configuración (baseline) POR DEFECTO de una firma.
//
// Cuando una firma no tiene ningún FirmBaseline promovido (p. ej. creada por
// una compra, sin pasar por el configurator), /api/v0/pair provisiona este
// baseline para que el instalador tenga qué provisionar y el AI-Office arranque
// operativo. El cliente solo introduce el código de pairing; los placeholders
// de install-time (__GATEWAY_TOKEN__, __STACK_ROOT__…) los resuelve el
// instalador/bridge en la máquina. No se pide ninguna clave de IA: el proveedor
// se inyecta al parear (aioffice, plan Todo incluido) o se configura después.
//
// LAYOUT: replica el paquete del openclaw-configurator, porque el instalador
// (pair_with_clawhub) vuelca estos files en C:\4bitsengine\configurator-package
// y provision_from_package/setup-from-config.ps1 exige exactamente:
//   base/openclaw.json            (config completa del gateway)
//   overlay/overlay-config.json   (equipo de agentes para configure-overlay.js)
//   overlay/dispatch.config.json  (concierge: roles → agentIds, lo lee el bridge)
//   .env.example                  (referencia de secretos)
//   instance-manifest.json        (env[] que el wizard pide en el paso Credenciales)
// Sin base/openclaw.json el check-package dice "no" y el instalador cae al
// setup.ps1 clásico, que requiere agents/workspaces (no existe en el bundle
// bootstrapper) y muere con "Error durante setup.ps1 de AI Office".
//
// La plantilla de base/openclaw.json vive en la BD (clawhub."ConfigTemplate",
// fila path='base/openclaw.json', mantenida a mano en Supabase): así se puede
// cambiar sin redesplegar y el siguiente pair la recoge. El JSON del repo
// (default-openclaw.json) queda solo como FALLBACK si la fila falta o no parsea.

import crypto from "node:crypto";
import defaultOpenclaw from "@/lib/default-openclaw.json";
import { AGENT_CATALOG, type AgentCatalogEntry } from "@/lib/agent-catalog";
import {
  resolveCatalogTeam,
  teamEntryFromCatalog,
  type CatalogDefaults,
} from "@/lib/agent-catalog-db";
import { db } from "@/lib/db";
import type { FirmBaselineFileCategory } from "@/generated/prisma/client";

export const DEFAULT_BASELINE_LABEL = "Config AI-Office por defecto";
export const DEFAULT_BASELINE_DESCRIPTION =
  "Paquete de configuración estándar generado automáticamente al instalar sin configurator.";

export type BaselineFile = {
  path: string;
  category: FirmBaselineFileCategory;
  content: string;
  sha256: string;
  sizeBytes: number;
  isBinary: boolean;
};

function textFile(
  path: string,
  category: FirmBaselineFileCategory,
  content: string,
): BaselineFile {
  const sizeBytes = Buffer.byteLength(content, "utf8");
  const sha256 = crypto.createHash("sha256").update(content).digest("hex");
  return { path, category, content, sha256, sizeBytes, isBinary: false };
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ai-office"
  );
}

const ENV_EXAMPLE = `# .env — secretos de esta instancia (si añades alguno, renombra a .env o
# .env.local). Generado por clawhub (baseline por defecto). NO lo subas a git.
#
# No se requiere ninguna clave de IA por defecto. Brave, n8n y ElevenLabs NO
# van aquí: se configuran en la consola tras arrancar (se guardan cifrados en
# el bridge). Google Workspace se conecta por OAuth.
`;

const ENV_EXAMPLE_BUNDLED = `# Generado por clawhub (plan Todo incluido). No necesitas configurar ninguna
# clave de IA: tu acceso viene incluido en la instalación.
#
# Brave, n8n y ElevenLabs se configuran en la consola tras arrancar
# (se guardan cifrados en el bridge). Google Workspace se conecta por OAuth.
`;

// Acceso LLM provisionado por clawhub (litellm-token-provisioning): la virtual
// key del team de la firma, inyectada inline como proveedor openai-compatible.
export type BaselineLlm = {
  baseUrl: string; // p. ej. https://proxyllm.smartbotics.eu
  model: string; // alias público del modelo compartido en el proxy
  apiKey: string; // virtual key sk-... del team de la firma (en claro)
};

// Forma mínima de la plantilla que este módulo necesita mutar.
type OpenclawTemplate = {
  models?: { providers?: Record<string, unknown> };
  agents?: { defaults?: { model?: { primary?: string; fallbacks?: string[] } } };
};

// Plantilla de base/openclaw.json: la fila path='base/openclaw.json' de
// clawhub."ConfigTemplate" (tabla mantenida a mano en Supabase, fuera del
// schema de Prisma — de ahí el $queryRaw con el schema cualificado; el
// adapter-pg solo cualifica las queries generadas, no las raw). Si la fila
// falta, no parsea o la BD falla, cae al JSON del repo para no romper el pair.
export async function loadDefaultOpenclawTemplate(): Promise<OpenclawTemplate> {
  try {
    const rows = await db.$queryRaw<{ content: string | null }[]>`
      SELECT content FROM clawhub."ConfigTemplate"
       WHERE path = 'base/openclaw.json'
       LIMIT 1`;
    const content = rows[0]?.content;
    if (content) return JSON.parse(content) as OpenclawTemplate;
    // eslint-disable-next-line no-console
    console.error(
      "[default-baseline] ConfigTemplate sin fila base/openclaw.json; usando plantilla del repo",
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[default-baseline] Error leyendo ConfigTemplate; usando plantilla del repo:",
      err,
    );
  }
  // Clon profundo del fallback: nunca mutamos el import compartido.
  return JSON.parse(JSON.stringify(defaultOpenclaw)) as OpenclawTemplate;
}

// Equipo provisionado por el OPERATOR en la pestaña Equipo de la firma
// (FirmAgentInstall + AgentCatalogEntry de la BD). Si la firma lo tiene, MANDA
// sobre la selección de agentes de la compra: es la composición explícita del
// equipo, con identidad de instalación (slug/displayName/voz propios). null si
// la firma no tiene equipo provisionado (se cae a resolveCatalogTeam).
// El planner (orquestador) entra siempre.
export async function resolveProvisionedTeam(
  firmId: string,
): Promise<readonly AgentCatalogEntry[] | null> {
  const rows = await db.firmAgentInstall.findMany({
    where: { firmId, enabled: true },
    include: { catalog: { select: { defaults: true, description: true } } },
    orderBy: { sortOrder: "asc" },
  });
  if (rows.length === 0) return null;
  const team: AgentCatalogEntry[] = rows.map((r) => {
    const d = (r.catalog.defaults ?? {}) as CatalogDefaults;
    return {
      agent: r.agentKey,
      slug: r.slug,
      displayName: r.displayName,
      shortName: d.shortName ?? r.displayName,
      icon: r.icon ?? d.icon ?? "🤖",
      color: r.color ?? d.color ?? "#5B6470",
      workingVerb: d.workingVerb ?? "trabajando",
      voice: { kind: r.voiceKind ?? d.voice?.kind ?? "neutral" },
      blurb: r.catalog.description,
    };
  });
  if (!team.some((a) => a.agent === "planner")) {
    const plannerRow = await db.agentCatalogEntry.findFirst({
      where: { agentKey: "planner", deprecatedAt: null },
      select: { agentKey: true, description: true, defaults: true },
    });
    const planner = plannerRow
      ? teamEntryFromCatalog(plannerRow)
      : AGENT_CATALOG.find((a) => a.agent === "planner");
    if (planner) team.unshift(planner);
  }
  return team;
}

// Archivos del baseline por defecto, parametrizados por el nombre de la firma
// (dispatch.config.json y el manifest llevan nombre/slug de la instancia), por
// el EQUIPO de la firma — prioridad: (1) equipo provisionado por el operator
// en la pestaña Equipo (FirmAgentInstall, vía firmId), (2) selección de
// agentes de la compra resuelta contra el catálogo de la BD ([] o ausente =
// catálogo completo); el planner va siempre — y por el acceso LLM provisionado
// (llm): con él, la config sale
// con el proveedor "aioffice" (proxy LiteLLM + virtual key inline) como
// primario; sin él (EXTERNAL o alta fallida), la plantilla sale tal cual —
// sin proveedores ni modelo por defecto: el proveedor de IA se configura a
// posteriori. En ningún caso el instalador pide claves (env: [] en manifest).
export async function defaultBaselineFiles(
  firmId: string | null,
  firmName = "AI-Office",
  selectedAgents?: string[],
  llm?: BaselineLlm | null,
): Promise<BaselineFile[]> {
  const slug = slugify(firmName);
  const team =
    (firmId ? await resolveProvisionedTeam(firmId) : null) ??
    (await resolveCatalogTeam(selectedAgents));

  const base = await loadDefaultOpenclawTemplate();

  if (llm) {
    // Proveedor explícito openai-compatible hacia el proxy. Nombre "aioffice"
    // para no chocar con el plugin bundled "litellm" del motor.
    //
    // Defensivo: si la plantilla volviera a traer un proveedor minimax, fuera —
    // su apiKey "${MINIMAX_API_KEY}" es un secret-ref que el motor exige en el
    // arranque y mataría el gateway sin esa variable ("required secrets are
    // unavailable"). La plantilla actual ya viene con models.providers = {}.
    base.models = base.models ?? {};
    if (base.models.providers) delete base.models.providers.minimax;
    const plugins = (base as { plugins?: { entries?: Record<string, unknown> } }).plugins;
    if (plugins?.entries?.minimax) plugins.entries.minimax = { enabled: false };
    base.models.providers = {
      ...base.models.providers,
      aioffice: {
        baseUrl: `${llm.baseUrl.replace(/\/$/, "")}/v1`,
        apiKey: llm.apiKey,
        api: "openai-completions",
        models: [
          {
            id: llm.model,
            name: "AI-Office LLM",
            reasoning: true,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 1000000,
            // LiteLLM pre-valida prompt+maxTokens contra el TPM del team: con
            // 131072 el pre-check rechazaba SIEMPRE con 429. 32k de salida
            // sobra y deja margen de TPM para agentes en paralelo.
            maxTokens: 32768,
          },
        ],
      },
    };
    base.agents = base.agents ?? {};
    base.agents.defaults = base.agents.defaults ?? {};
    // Sin fallback: la plantilla del DB trae models.providers = {} a propósito
    // (los proveedores se inyectan aquí al parear), así que un fallback a
    // ollama/gemma4-gpu apuntaría a un proveedor inexistente en la config.
    base.agents.defaults.model = {
      primary: `aioffice/${llm.model}`,
      fallbacks: [],
    };
  }

  // Sin acceso LLM provisionado la plantilla no trae primary: no hay modelo
  // por defecto (el proveedor de IA se configura a posteriori).
  const defaultModel = base.agents?.defaults?.model?.primary ?? null;

  const openclawJson = JSON.stringify(base, null, 2);

  const overlayConfig = {
    $comment: "overlay-config.json — baseline por defecto generado por clawhub",
    overlay: { path: `./overlays/${slug}`, prefix: "office", name: firmName },
    library: { path: "./clawcrew" },
    openclawConfig: "./openclaw.json",
    defaultModel,
    agents: team.map(({ blurb: _blurb, ...agent }) => agent),
    planMode: {
      enabled: false,
      uiVisible: false,
      autoSuggest: false,
      plannerAgentId: "office-planner-v1",
      fallbackPlanFirst: true,
    },
    settingsSeed: {
      AUTONOMY_LEVEL: "n1",
      GUARDCLAW_ENABLED: true,
      GUARDCLAW_OUTPUT_REDACT: true,
      WEB_EGRESS_ENABLED: true,
      AGENTS_DEFAULT_LANGUAGE: "es-ES",
      AGENT_TIMEOUT: 1800,
      CONVERSATIONS_IDLE_DAYS: 30,
    },
    integrations: {
      googleworkspace: { enabled: false },
      n8n: { enabled: false },
      brave: { enabled: false },
      elevenlabs: { enabled: false },
    },
    knowledge: { ragEnabled: false, embeddingsProvider: null },
  };

  const dispatchConfig = {
    brand: "AI Office",
    firmName,
    roles: team.map((a) => ({
      id: a.agent,
      label: a.displayName,
      blurb: a.blurb,
      agentId: `office-${a.slug}-v1`,
    })),
    infrastructure: [],
    namePool: Object.fromEntries(team.map((a) => [a.agent, [a.displayName]])),
    composer: { suggestions: [] },
    sampleTasks: {},
    sampleSteps: {},
    recurring: [],
  };

  const instanceManifest = {
    instance: { slug, name: firmName, prefix: "office" },
    compat: {
      configSchemaVersion: "1.0",
      generatedBy: "clawhub-default-baseline@1",
      targetStack: {
        openclaw: ">=2026.5",
        aiOffice: null,
        autonomousAgents: null,
        clawcrewCatalogCommit: null,
      },
    },
    artifacts: { base: "base/openclaw.json", overlay: "overlay/overlay-config.json" },
    // El wizard del instalador (paso Credenciales) pide exactamente estas env.
    // Nunca se pide ninguna clave de IA: con acceso LLM provisionado (Todo
    // incluido) va inline en la config; sin él, el proveedor se configura a
    // posteriori (la plantilla sale sin proveedores).
    env: [],
    providers: llm ? [{ id: "aioffice", model: llm.model }] : [],
    channels: [],
    registration: { target: "clawhub", plan: "STARTER", features: [], mode: "install-time" },
  };

  return [
    textFile("base/openclaw.json", "OPENCLAW_CONFIG", openclawJson),
    textFile("overlay/overlay-config.json", "OTHER", JSON.stringify(overlayConfig, null, 2)),
    textFile("overlay/dispatch.config.json", "OTHER", JSON.stringify(dispatchConfig, null, 2)),
    textFile(".env.example", "OTHER", llm ? ENV_EXAMPLE_BUNDLED : ENV_EXAMPLE),
    textFile("instance-manifest.json", "OTHER", JSON.stringify(instanceManifest, null, 2)),
  ];
}
