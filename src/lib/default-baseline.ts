// Fuente única del paquete de configuración (baseline) POR DEFECTO de una firma.
//
// Cuando una firma no tiene ningún FirmBaseline promovido (p. ej. creada por
// una compra, sin pasar por el configurator), /api/v0/pair provisiona este
// baseline para que el instalador tenga qué provisionar y el AI-Office arranque
// operativo. El cliente solo introduce el código de pairing; el proveedor de IA
// y su clave los resuelve el instalador/bridge en la máquina (placeholders
// intactos: ${MINIMAX_API_KEY}, __GATEWAY_TOKEN__, __STACK_ROOT__…).
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
// De momento se usa la plantilla MiniMax/Ollama (la misma que el configurator).
// Migrar el proveedor por defecto a OpenRouter es una iteración futura: bastaría
// cambiar el JSON importado (o su bloque `models`/`agents.defaults.model`).

import crypto from "node:crypto";
import defaultOpenclaw from "@/lib/default-openclaw.json";
import { resolveTeam } from "@/lib/agent-catalog";
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

const ENV_EXAMPLE = `# .env — secretos de esta instancia. Rellena los valores y renombra a .env
# (o .env.local). Generado por clawhub (baseline por defecto). NO lo subas a git.
#
# Brave, n8n y ElevenLabs NO van aquí: se configuran en la consola tras arrancar
# (se guardan cifrados en el bridge). Google Workspace se conecta por OAuth.

# API key de MiniMax (proveedor de IA por defecto).  ej: <api-key>
MINIMAX_API_KEY=
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

// Archivos del baseline por defecto, parametrizados por el nombre de la firma
// (dispatch.config.json y el manifest llevan nombre/slug de la instancia), por
// la selección de agentes de la compra ([] o ausente = catálogo completo; el
// planner va siempre — ver resolveTeam en agent-catalog.ts) y por el acceso
// LLM provisionado (llm): con él, la config sale con el proveedor "aioffice"
// (proxy LiteLLM + virtual key inline) como primario y el instalador NO pide
// ninguna clave; sin él, plantilla MiniMax actual (EXTERNAL o alta fallida).
export function defaultBaselineFiles(
  firmName = "AI-Office",
  selectedAgents?: string[],
  llm?: BaselineLlm | null,
): BaselineFile[] {
  const slug = slugify(firmName);
  const team = resolveTeam(selectedAgents);

  // Clon profundo de la plantilla: nunca mutamos el import compartido.
  const base = JSON.parse(JSON.stringify(defaultOpenclaw)) as {
    models?: { providers?: Record<string, unknown> };
    agents?: { defaults?: { model?: { primary?: string; fallbacks?: string[] } } };
  };

  if (llm) {
    // Proveedor explícito openai-compatible hacia el proxy (mismo `api` que el
    // provider ollama de la config validada). Nombre "aioffice" para no chocar
    // con el plugin bundled "litellm" del motor.
    base.models = base.models ?? {};
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
            maxTokens: 131072,
          },
        ],
      },
    };
    base.agents = base.agents ?? {};
    base.agents.defaults = base.agents.defaults ?? {};
    base.agents.defaults.model = {
      primary: `aioffice/${llm.model}`,
      fallbacks: ["ollama/gemma4-gpu"],
    };
  }

  const defaultModel =
    base.agents?.defaults?.model?.primary ?? "minimax/MiniMax-M3";

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
    // Con acceso LLM provisionado (Todo incluido) no se pide NADA.
    env: llm
      ? []
      : [
          {
            key: "MINIMAX_API_KEY",
            scope: "base",
            desc: "API key de MiniMax (proveedor de IA por defecto).",
            example: "<api-key>",
            required: true,
          },
        ],
    providers: llm
      ? [{ id: "aioffice", model: llm.model }]
      : [{ id: "minimax", model: "MiniMax-M3" }],
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
