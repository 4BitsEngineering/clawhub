/**
 * Catálogo de comandos remotos que puede ejecutar el headless agent.
 *
 * Cada entrada define el zod schema de sus args y un display label para la
 * UI. El kind es el string que se serializa en DB y se envía al agent.
 *
 * El agent también tiene su propio dispatcher local que valida lo que llega
 * (defensa en profundidad). Si añades un kind aquí, añádelo allí también
 * (clients/headless/clawhub-agent.js → executeCommand).
 */
import { z } from "zod";

export const COMMAND_KINDS = {
  ping: {
    label: "Ping",
    description: "Responde con un timestamp + info básica del agent. Útil para validar que el round-trip funciona.",
    args: z.object({}).optional(),
  },
  reload_skills: {
    label: "Recargar skills",
    description: "Llama a POST /api/skills/sync del bridge local: re-escanea el directorio de skills del overlay y recarga el registry. Útil tras publicar una skill desde AI-Office Center si el agent aún la usa cacheada.",
    args: z.object({}).optional(),
  },
  fetch_logs: {
    label: "Pedir logs",
    description: "Descarga las últimas N líneas del log del bridge para soporte/debug remoto. Default 200 líneas, máximo 2000.",
    args: z.object({
      lines: z.number().int().min(1).max(2000).optional(),
    }).optional(),
  },
  clear_cache: {
    label: "Limpiar caches",
    description: "Re-sincroniza skills + tools en el bridge: invalida caches internas y repula al gateway. Útil tras tocar disco a mano o ver agentes con allowlist desactualizada.",
    args: z.object({}).optional(),
  },
  snapshot_config: {
    label: "Pedir openclaw.json",
    description: "Versión ligera de snapshot_to_baseline: descarga solo el openclaw.json (con tokens redactados) para inspeccionarlo. No genera baseline.",
    args: z.object({}).optional(),
  },
  restart_bridge: {
    label: "Reiniciar bridge",
    description: "Mata el proceso del bridge en el PC del trabajador. Requiere que el bridge corra bajo un supervisor (Electron, systemd, NSSM) que lo respawnee. Sin supervisor, queda offline hasta arranque manual.",
    args: z.object({}).optional(),
  },
  restart_gateway: {
    label: "Reiniciar gateway",
    description: "Intenta apagar el gateway local: primero por RPC system.shutdown si openclaw lo soporta, luego matando el PID del proceso openclaw. Requiere supervisor para revivir.",
    args: z.object({}).optional(),
  },
  push_config_patch: {
    label: "Cambiar configuración",
    description: "Aplica cambios al openclaw.json del worker. Solo paths en allowlist (modelo, thinking, maxConcurrent, logging.level, skills.*.enabled, plugins.*.enabled). Backup automático + rollback si falla.",
    args: z.object({
      changes: z.record(z.string(), z.unknown()),
    }),
  },
  apply_stack_update: {
    label: "Aplicar update del stack",
    description: "Re-evalúa el manifest de la firma, descarga las versiones nuevas de openclaw/bridge/overlay si las hay, y reinicia gateway+bridge para activarlas. Requiere desktop con supervisor; headless reportará 'supervisor required'.",
    args: z.object({}).optional(),
  },
  set_ui_auth_token: {
    label: "Cambiar contraseña de la consola",
    description:
      "Cambia EN REMOTO la contraseña de acceso a los menús de admin del overlay (UI_AUTH_TOKEN). El agente reescribe UI_AUTH_TOKEN (y UI_REQUIRE_LOGIN=true) en el .env.local de la instalación y reinicia la consola para que tome efecto. Requiere que la instancia ejecute el bucle de comandos (heartbeat).",
    args: z.object({
      token: z.string().min(8).max(256),
    }),
  },
  snapshot_to_baseline: {
    label: "Crear baseline desde esta instancia",
    description: "Lee el estado actual del overlay (openclaw.json + workspaces + enterprise + skills) y lo sube a AI-Office Center como nuevo baseline de la firma. NO incluye secrets (.env).",
    args: z.object({
      label: z.string().min(1).max(200),
      description: z.string().max(2000).nullable().optional(),
    }),
  },
  reset_to_baseline: {
    label: "Restaurar a baseline",
    description: "Descarga un baseline de AI-Office Center y lo aplica al overlay local. Hace backup del estado actual antes. Preserva los MEMORY.md de cada agente (aprendizaje del trabajador no se pisa).",
    args: z.object({
      baseline_id: z.string().uuid(),
    }),
  },
  reload_mcp: {
    label: "Recargar MCP servers",
    description: "Pide al bridge local que llame a npm run mcp:config (regenera el config) y reinicie los MCP servers para que recoja cambios. Idempotente. Útil tras editar configuraciones MCP sin tocar el openclaw.json.",
    args: z.object({}).optional(),
  },
  push_mcp_config: {
    label: "Sincronizar config MCP desde AI-Office Center",
    description: "Descarga la lista de MCP servers instalados/activos de esta firma desde AI-Office Center (FirmMcpInstall + McpServerCatalog) y reescribe la sección mcpServers de openclaw.json local. Después corre mcp:config y recarga. NO toca secrets — solo metadata.",
    args: z.object({}).optional(),
  },
  notify_user: {
    label: "Enviar aviso al usuario",
    description:
      "Muestra un mensaje al usuario DENTRO de la instancia (título + cuerpo, con nivel info/warn/success y URL opcional). El agente lo guarda en un fichero de avisos local que la web sondea y muestra como banner/toaster, descartable. Útil para comunicar mantenimientos, novedades o avisos puntuales a una o varias instancias monitoreadas.",
    args: z.object({
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(2000),
      level: z.enum(["info", "warn", "success"]).optional(),
      url: z.string().url().max(500).optional(),
      // id estable opcional para idempotencia (re-encolar no duplica el aviso).
      id: z.string().min(1).max(80).optional(),
    }),
  },
  install_agents: {
    label: "Instalar agentes",
    description:
      "Instala/actualiza el equipo provisionado de la firma en el overlay del PC. El agent corre agent-cli install por cada agente con su identidad (slug/nombre/color/voz), escribiendo agents/workspaces + agent-registry.json + openclaw.json. Idempotente: re-instalar respeta MEMORY.md. PENDIENTE el handler en el dispatcher de clawgents-desktop (se valida en otro equipo).",
    args: z.object({
      // Overlay destino y prefijo del agentId ({prefix}-{slug}-v1). El agent
      // resuelve la ruta del overlay localmente; aquí van como sugerencia.
      overlay: z.string().min(1).max(80).optional(),
      prefix: z.string().min(1).max(40),
      agents: z
        .array(
          z.object({
            agentKey: z.string().min(1).max(80), // rol del catálogo (executive, …)
            slug: z.string().min(1).max(40), // identidad final (elena, …)
            displayName: z.string().min(1).max(120),
            color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
            icon: z.string().max(16).nullable().optional(),
            voiceKind: z.enum(["male", "female", "neutral"]).nullable().optional(),
            elevenlabsId: z.string().max(120).nullable().optional(),
          }),
        )
        .min(1),
    }),
  },
} as const;

export type CommandKind = keyof typeof COMMAND_KINDS;

export const COMMAND_KIND_LIST = Object.keys(COMMAND_KINDS) as CommandKind[];

export function isKnownKind(kind: string): kind is CommandKind {
  return kind in COMMAND_KINDS;
}

export function validateArgs(kind: CommandKind, args: unknown): unknown {
  const schema = COMMAND_KINDS[kind].args;
  if (!schema) return args ?? null;
  return schema.parse(args ?? undefined) ?? null;
}

/**
 * TTL default: 1 hora. Si la instancia está offline más tiempo que eso, el
 * comando expira automáticamente. Suficiente margen para que un PC apagado
 * se encienda por la mañana, demasiado corto para que se queden colgados
 * indefinidamente.
 */
export const COMMAND_DEFAULT_TTL_MS = 60 * 60 * 1000;

/**
 * Comandos disponibles para mass action (encolarlos a N PCs de golpe desde
 * /operator/mass-actions). Solo se permiten kinds idempotentes y safe:
 * los que no destruyen estado, no requieren args per-instance y no piden
 * supervisor (restart_* sí lo pide pero se incluye porque es ocasionalmente
 * necesario tras un cambio crítico — lleva doble confirm en UI).
 *
 * EXCLUIDOS deliberadamente:
 *   - push_config_patch: cambio de config debe revisarse per-instance
 *   - snapshot_to_baseline: generaría N baselines redundantes
 *   - reset_to_baseline: peligroso, decisión per-instance
 *   - fetch_logs: spam de payloads grandes
 */
export const MASS_ACTION_KINDS: CommandKind[] = [
  "ping",
  "reload_skills",
  "clear_cache",
  "apply_stack_update",
  "snapshot_config",
  "reload_mcp",
  "push_mcp_config",
  "restart_bridge",
  "restart_gateway",
];

/**
 * Kinds que requieren confirmación extra antes de ejecutar masivamente
 * porque son disruptivos (proceso muere y depende de supervisor).
 */
export const MASS_ACTION_DESTRUCTIVE_KINDS: CommandKind[] = [
  "restart_bridge",
  "restart_gateway",
];
