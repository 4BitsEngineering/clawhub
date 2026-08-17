// Catálogo vendible de agentes AI-Office (change agent-selection-before-checkout).
//
// Fuente única para: la selección de equipo en las landings de venta, el
// checkout (validación de la selección) y el baseline por defecto que genera
// clawhub al parear (default-baseline.ts). Los datos son los defaults exactos
// de cada manifest.json de la biblioteca clawcrew que viaja en el bundle
// OVERLAY (ids/slugs actuales, sin previousIds) — debe mantenerse en lockstep
// con esa biblioteca, por eso vive en código y no en DB.
//
// runtime agentId = office-<slug>-v1 (configure-overlay.js).

export type AgentCatalogEntry = {
  agent: string;
  slug: string;
  displayName: string;
  shortName: string;
  icon: string;
  color: string;
  workingVerb: string;
  voice: { kind: string };
  blurb: string;
};

// Agentes que toda instalación lleva siempre (el planner orquesta al equipo).
export const MANDATORY_AGENTS = ["planner"] as const;

export const AGENT_CATALOG: readonly AgentCatalogEntry[] = [
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

const CATALOG_IDS = new Set(AGENT_CATALOG.map((a) => a.agent));

// Normaliza una selección del comprador: descarta ids desconocidos, añade los
// obligatorios y devuelve [] si el resultado equivale al catálogo completo
// ([] = "todos" en todo el sistema: metadata, Purchase y baseline).
export function sanitizeSelection(ids: string[]): string[] {
  const valid = ids.filter((id) => CATALOG_IDS.has(id));
  if (valid.length === 0) return [];
  const withMandatory = [
    ...new Set([...MANDATORY_AGENTS, ...valid]),
  ];
  if (withMandatory.length >= AGENT_CATALOG.length) return [];
  // Orden estable: el del catálogo
  return AGENT_CATALOG.filter((a) => withMandatory.includes(a.agent)).map((a) => a.agent);
}

// Lee la selección de los checkboxes agent_<id> del form de compra y la sanea.
export function selectionFromFormData(formData: FormData): string[] {
  const ids = AGENT_CATALOG.filter(
    (a) => formData.get(`agent_${a.agent}`) != null,
  ).map((a) => a.agent);
  return sanitizeSelection(ids);
}

// Resuelve una selección persistida ([] = todos) al subconjunto del catálogo.
export function resolveTeam(selectedAgents: string[] | null | undefined): readonly AgentCatalogEntry[] {
  if (!selectedAgents || selectedAgents.length === 0) return AGENT_CATALOG;
  const wanted = new Set([...MANDATORY_AGENTS, ...selectedAgents]);
  const team = AGENT_CATALOG.filter((a) => wanted.has(a.agent));
  return team.length > 0 ? team : AGENT_CATALOG;
}
