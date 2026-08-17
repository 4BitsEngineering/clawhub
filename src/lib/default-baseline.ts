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

// Equipo AI-Office por defecto: el catálogo COMPLETO de clawcrew (14 agentes),
// con los defaults exactos de cada manifest.json de la biblioteca (ids/slugs
// actuales, sin previousIds). El shape de agents[*] es 1:1 con lo que espera
// configure-overlay.js. runtime id = office-<slug>-v1 — debe cuadrar con los
// agentId de dispatch.config.json.
const DEFAULT_TEAM = [
  { agent: "planner", slug: "planner", displayName: "Planificador", shortName: "Planificador", icon: "🗂️", color: "#5B6470", workingVerb: "planificando el proyecto", voice: { kind: "neutral" },
    blurb: "Orquestador interno: descompone peticiones complejas en fases, coordina al equipo vía sessions_spawn y gestiona los proyectos por fases. En PLAN_MODE propone un plan y espera aprobación." },
  { agent: "assistant", slug: "assistant", displayName: "Asistente Personal", shortName: "Asistente", icon: "🪄", color: "#3B6FE0", workingVerb: "investigando", voice: { kind: "neutral" },
    blurb: "Asistente personal versátil tipo openclaw pero acotado: investiga en la web (Brave + browser headless), navega URLs, compara productos y precios, calcula cantidades/presupuestos y redacta respuestas prácticas. El agente 'para todo lo demás' que no encaja en un especialista." },
  { agent: "automation", slug: "automation", displayName: "Automatizaciones", shortName: "Automatizaciones", icon: "🤖", color: "#65A30D", workingVerb: "conectando piezas", voice: { kind: "male" },
    blurb: "Ingeniero/a de automatización. Diseña, valida y opera workflows en n8n. Cada workflow nace inactivo y solo se activa con aprobación humana." },
  { agent: "community", slug: "community", displayName: "Redes Sociales", shortName: "Redes", icon: "✨", color: "#8A6BAE", workingVerb: "creando contenido", voice: { kind: "female" },
    blurb: "Community manager. Genera imágenes y creatividades para redes y posts (fotos, visuales). Ideas de contenido, posts para IG/LinkedIn/X y calendario editorial; atención de comunidad: respuestas a comentarios y DMs, moderación y escucha/sentiment. Nunca publica ni responde en público sin aprobación." },
  { agent: "copywriter", slug: "copywriter", displayName: "Redacción", shortName: "Redacción", icon: "✍️", color: "#8B5A8C", workingVerb: "escribiendo copy", voice: { kind: "female" },
    blurb: "Redactor. Captions IG, posts LinkedIn, hashtags, hooks, guiones de reels/shorts, blog, newsletter y artículos SEO con optimización on-page (títulos, meta, encabezados, enlazado). Texto en voz de marca." },
  { agent: "developer", slug: "developer", displayName: "Desarrollo de Software", shortName: "Dev", icon: "💻", color: "#475569", workingVerb: "programando", voice: { kind: "neutral" },
    blurb: "Desarrollador de software del cliente. Convierte un encargo en lenguaje natural en una pequeña especificación y construye scripts y apps pequeñas usando un CLI de codificación (incluido siempre en la instalación) conducido por el propio modelo del cliente. Trabaja en un workspace aislado y entrega el resultado para revisión; nunca aplica cambios en producción sin aprobación." },
  { agent: "documents", slug: "documents", displayName: "Gestor documental", shortName: "Documentos", icon: "📊", color: "#3F7D58", workingVerb: "preparando el documento", voice: { kind: "neutral" },
    blurb: "Convierte datos, ficheros y temas en entregables presentables —informes, presentaciones y hojas de cálculo— como ficheros reales (.docx, .pptx, .xlsx, PDF) con el formato y la voz del cliente. Siempre entrega borrador para revisión; nunca envía ni publica." },
  { agent: "employment", slug: "employment", displayName: "Asesoría Laboral", shortName: "Laboral", icon: "👥", color: "#4A6C8C", workingVerb: "revisando la plantilla", voice: { kind: "male" },
    blurb: "Asesoría laboral española: prepara los trámites de Seguridad Social del despacho antes de que se comuniquen por el Sistema RED. En su v1 clasifica la plantilla en códigos de ocupación CNO para la campaña que el RD 643/2026 obliga a cerrar. Nunca comunica nada a la Seguridad Social ni usa el certificado digital; todo entregable es un borrador técnico que requiere revisión del profesional." },
  { agent: "executive", slug: "executive", displayName: "Agenda y Correo", shortName: "Agenda", icon: "📋", color: "#4F6D9E", workingVerb: "ordenando tu día", voice: { kind: "female" },
    blurb: "Asistente ejecutiva del cliente. Triaje de Gmail, agenda de Google Calendar, notas y borradores vía el wrapper gws-bridge (OAuth), y gestión con aprobación del Google conectado: papelera de correos, edición/cancelación de eventos, orden de Drive y filas en Sheets. Fallback himalaya para cuentas IMAP/Outlook. Nunca ejecuta nada externo sin aprobación." },
  { agent: "founder", slug: "founder", displayName: "Dirección", shortName: "Dirección", icon: "🧭", color: "#7A6A53", workingVerb: "afinando tu contexto", voice: { kind: "neutral" },
    blurb: "Aliado estratégico del cliente: mantiene vivos la misión, los valores, la audiencia y la voz del negocio en los docs enterprise/ para que el resto del equipo suene al cliente y no a un agente genérico. No actúa sobre el mundo externo: escucha, sintetiza y persiste el contexto." },
  { agent: "legal", slug: "legal", displayName: "Asesoría Jurídica", shortName: "Jurídica", icon: "⚖️", color: "#5B4B8A", workingVerb: "revisando contrato", voice: { kind: "female" },
    blurb: "Suite legal completa: revisión de contratos contra playbook, triaje de NDAs, compliance RGPD, evaluación de riesgos, respuestas desde plantilla y preparación de reuniones. Orientativo, no sustituye a un abogado colegiado." },
  { agent: "marketing", slug: "marketing", displayName: "Marketing", shortName: "Marketing", icon: "🧭", color: "#2E5C7E", workingVerb: "diseñando estrategia", voice: { kind: "female" },
    blurb: "Estratega de marketing integral. Plan trimestral, posicionamiento, GTM, buyer persona, allocation cross-channel y KPIs; además estrategia SEO (keyword research, audit técnica, briefs de contenido, calendario editorial) y criterio de paid y analítica para orientar al equipo. Define el rumbo y los briefs; no redacta el copy final ni opera campañas." },
  { agent: "tax", slug: "tax", displayName: "Asesoría Fiscal", shortName: "Fiscal", icon: "🧾", color: "#A6752B", workingVerb: "encuadrando tu consulta fiscal", voice: { kind: "female" },
    blurb: "Asesoría fiscal y gestoría española: encuadra cada consulta en su ejercicio y normativa antes de calcular, prepara borradores técnicos de IVA, IRPF e Impuesto sobre Sociedades, gestiona censos/altas y vigila el calendario de obligaciones. Nunca presenta ante la AEAT; todo entregable es un borrador técnico que requiere revisión del profesional." },
  { agent: "webops", slug: "webops", displayName: "Web y Publicación", shortName: "Web", icon: "🌐", color: "#3A6E8F", workingVerb: "operando en la web", voice: { kind: "neutral" },
    blurb: "Operador web: conduce un navegador real sobre portales y herramientas de terceros sin API (extranets de proveedores, paneles B2B, backoffices). Consulta y descarga directo, y deja cualquier cambio preparado pendiente de aprobación." },
] as const;

const ENV_EXAMPLE = `# .env — secretos de esta instancia. Rellena los valores y renombra a .env
# (o .env.local). Generado por clawhub (baseline por defecto). NO lo subas a git.
#
# Brave, n8n y ElevenLabs NO van aquí: se configuran en la consola tras arrancar
# (se guardan cifrados en el bridge). Google Workspace se conecta por OAuth.

# API key de MiniMax (proveedor de IA por defecto).  ej: <api-key>
MINIMAX_API_KEY=
`;

// Archivos del baseline por defecto, parametrizados por el nombre de la firma
// (dispatch.config.json y el manifest llevan nombre/slug de la instancia).
export function defaultBaselineFiles(firmName = "AI-Office"): BaselineFile[] {
  const slug = slugify(firmName);
  const defaults = (defaultOpenclaw as {
    agents?: { defaults?: { model?: { primary?: string } } };
  }).agents?.defaults?.model;
  const defaultModel = defaults?.primary ?? "minimax/MiniMax-M3";

  const openclawJson = JSON.stringify(defaultOpenclaw, null, 2);

  const overlayConfig = {
    $comment: "overlay-config.json — baseline por defecto generado por clawhub",
    overlay: { path: `./overlays/${slug}`, prefix: "office", name: firmName },
    library: { path: "./clawcrew" },
    openclawConfig: "./openclaw.json",
    defaultModel,
    agents: DEFAULT_TEAM.map(({ blurb: _blurb, ...agent }) => agent),
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
    roles: DEFAULT_TEAM.map((a) => ({
      id: a.agent,
      label: a.displayName,
      blurb: a.blurb,
      agentId: `office-${a.slug}-v1`,
    })),
    infrastructure: [],
    namePool: Object.fromEntries(DEFAULT_TEAM.map((a) => [a.agent, [a.displayName]])),
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
    env: [
      {
        key: "MINIMAX_API_KEY",
        scope: "base",
        desc: "API key de MiniMax (proveedor de IA por defecto).",
        example: "<api-key>",
        required: true,
      },
    ],
    providers: [{ id: "minimax", model: "MiniMax-M3" }],
    channels: [],
    registration: { target: "clawhub", plan: "STARTER", features: [], mode: "install-time" },
  };

  return [
    textFile("base/openclaw.json", "OPENCLAW_CONFIG", openclawJson),
    textFile("overlay/overlay-config.json", "OTHER", JSON.stringify(overlayConfig, null, 2)),
    textFile("overlay/dispatch.config.json", "OTHER", JSON.stringify(dispatchConfig, null, 2)),
    textFile(".env.example", "OTHER", ENV_EXAMPLE),
    textFile("instance-manifest.json", "OTHER", JSON.stringify(instanceManifest, null, 2)),
  ];
}
