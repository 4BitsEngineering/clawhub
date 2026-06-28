#!/usr/bin/env node
/**
 * clawhub-agent — headless phone-home client.
 *
 * Single file, cero deps externos (solo Node 18+ y fetch global).
 * Pensado para correr alongside un gateway+bridge de autonomous-agents
 * ya levantado en el PC del trabajador, sin necesitar Electron.
 *
 * Lo que hace:
 *   1. Pair (una vez) contra clawhub usando CLAWHUB_PAIRING_CODE.
 *   2. Persiste instance_id + instance_token en config (default
 *      ~/.clawhub-client/config.json, mode 600).
 *   3. Bucle de heartbeat cada CLAWHUB_HEARTBEAT_S segundos (60 por
 *      defecto). Cada heartbeat:
 *        - GET <BRIDGE_URL>/healthz                 → gateway WS state
 *        - GET <BRIDGE_URL>/api/gateway/agents      → lista agentes
 *      Mete el resultado en extras.local_stack del payload.
 *   4. Si heartbeat devuelve 401, borra config local y exit 1 → el
 *      supervisor (systemd / scripts / lo que sea) reinicia y
 *      re-pairea con un code nuevo.
 *
 * Uso:
 *   CLAWHUB_URL=https://clawhub-three.vercel.app \
 *   CLAWHUB_PAIRING_CODE=ABCD-EFGH \
 *   BRIDGE_URL=http://localhost:3700 \
 *   CLAWHUB_WORKER_LABEL="Carlos García" \
 *   node clawhub-agent.js
 *
 * En el segundo arranque (token ya guardado) no necesitas el code:
 *   CLAWHUB_URL=... BRIDGE_URL=... node clawhub-agent.js
 *
 * Para correr como daemon en Linux: systemd unit; en Windows: NSSM o
 * scheduled task. Por ahora se ejecuta foreground, Ctrl+C lo para.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { fetchJson } = require('../shared/http');
const { processCommands } = require('../shared/dispatcher');
const { syncUsage } = require('../shared/usage-sync');

// -------------------------------------------------------------------------
// Config
// -------------------------------------------------------------------------

const CLAWHUB_URL = (process.env.CLAWHUB_URL || 'http://localhost:3000').replace(/\/+$/, '');
const BRIDGE_URL = (process.env.BRIDGE_URL ?? 'http://localhost:3700').replace(/\/+$/, '');
const PAIRING_CODE = process.env.CLAWHUB_PAIRING_CODE || null;
const WORKER_LABEL = process.env.CLAWHUB_WORKER_LABEL || safeUsername() || 'unknown';
const HEARTBEAT_S = parseInt(process.env.CLAWHUB_HEARTBEAT_S || '60', 10) || 60;
const CONFIG_PATH =
  process.env.CONFIG_PATH ||
  path.join(os.homedir(), '.clawhub-client', 'config.json');
const CLIENT_VERSION = process.env.CLAWHUB_CLIENT_VERSION || '0.1.0-headless';

const PAIR_TIMEOUT_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;
const PROBE_TIMEOUT_MS = 3_000;

const startedAt = Date.now();

// -------------------------------------------------------------------------
// Utils
// -------------------------------------------------------------------------

function safeUsername() {
  try { return os.userInfo().username; } catch { return null; }
}

function log(level, ...args) {
  const ts = new Date().toISOString();
  const stream = level === 'error' ? process.stderr : process.stdout;
  stream.write(`[${ts}] [${level}] ${args.map(stringify).join(' ')}\n`);
}
function stringify(v) {
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.instance_id && parsed?.instance_token) return parsed;
  } catch (err) {
    if (err.code !== 'ENOENT') log('error', `loadConfig: ${err.message}`);
  }
  return null;
}

function saveConfig(cfg) {
  ensureDir(CONFIG_PATH);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

function deleteConfig() {
  try { fs.unlinkSync(CONFIG_PATH); } catch {}
}

// -------------------------------------------------------------------------
// Pair
// -------------------------------------------------------------------------

async function pair(code) {
  const url = `${CLAWHUB_URL}/api/v0/pair`;
  log('info', `pair → ${url} (code ${code})`);
  const resp = await fetchJson(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        pairing_code: code,
        worker_label: WORKER_LABEL,
        version: CLIENT_VERSION,
        os: process.platform,
      }),
    },
    PAIR_TIMEOUT_MS,
  );
  if (!resp.ok) {
    throw new Error(`pair failed: ${resp.status} ${resp.raw}`);
  }
  return {
    instance_id: resp.body.instance_id,
    instance_token: resp.body.instance_token,
    firm_id: resp.body.firm_id,
    firm_name: resp.body.firm_name,
    paired_at: new Date().toISOString(),
  };
}

// -------------------------------------------------------------------------
// Probe local bridge
// -------------------------------------------------------------------------

async function probeLocalMcp() {
  if (!BRIDGE_URL) return null;
  const fetchSafe = async (path, timeoutMs = PROBE_TIMEOUT_MS) => {
    try {
      const r = await fetchJson(`${BRIDGE_URL}${path}`, {}, timeoutMs);
      return r;
    } catch {
      return null;
    }
  };
  const [manifestRes, configRes] = await Promise.all([
    fetchSafe('/api/mcp'),
    fetchSafe('/api/mcp/config-applied', 2500),
  ]);

  if (!manifestRes) return null;
  if (!manifestRes.ok) {
    return { available: false, status: manifestRes.status, probed_at: new Date().toISOString() };
  }
  const data = manifestRes.body;
  const servers = Array.isArray(data?.servers)
    ? data.servers.map((s) => ({
        name: s.name ?? s.id ?? null,
        ready: !!(s.ready ?? s.status === 'ready'),
        toolCount: typeof s.toolCount === 'number' ? s.toolCount : (Array.isArray(s.tools) ? s.tools.length : null),
        transport: s.transport ?? null,
        error: s.error ?? null,
      }))
    : null;

  let configApplied = null;
  if (configRes?.ok && configRes.body?.available) {
    configApplied = {
      servers: configRes.body.servers ?? {},
      count: configRes.body.count ?? 0,
    };
  }

  return {
    available: true,
    ready: data?.counts?.ready ?? data?.ready ?? null,
    total: data?.counts?.servers ?? data?.total ?? null,
    servers,
    config_applied: configApplied,
    probed_at: new Date().toISOString(),
  };
}

async function probeLocalStack() {
  if (!BRIDGE_URL) return null;
  const probe = async (path) => {
    try {
      const r = await fetchJson(`${BRIDGE_URL}${path}`, {}, PROBE_TIMEOUT_MS);
      return r.ok ? r.body : null;
    } catch {
      return null;
    }
  };

  // /api/health en el bridge de autonomous-agents (no /healthz).
  const [health, agentsResp] = await Promise.all([
    probe('/api/health'),
    probe('/api/gateway/agents'),
  ]);

  const gatewayConnected =
    health?.gatewayWsConnected ??
    health?.gateway?.connected ??
    health?.gateway_connected ??
    null;

  const rawAgents = Array.isArray(agentsResp)
    ? agentsResp
    : Array.isArray(agentsResp?.agents)
      ? agentsResp.agents
      : null;

  const agents = rawAgents?.map((a) => ({
    id: a.id ?? a.agentId ?? null,
    name: a.name ?? a.displayName ?? a.label ?? null,
    status: a.status ?? a.state ?? null,
    online: a.online ?? null,
  }));

  return {
    bridge_url: BRIDGE_URL,
    reachable: health !== null || rawAgents !== null,
    gateway_connected: gatewayConnected,
    agent_count: agents?.length ?? null,
    agents: agents ?? null,
    probed_at: new Date().toISOString(),
  };
}

// -------------------------------------------------------------------------
// Heartbeat
// -------------------------------------------------------------------------

async function heartbeat(cfg) {
  const url = `${CLAWHUB_URL}/api/v0/heartbeat`;
  const mem = process.memoryUsage();
  const uptimeS = Math.floor((Date.now() - startedAt) / 1000);

  let localStack = null;
  let localMcp = null;
  try {
    [localStack, localMcp] = await Promise.all([
      probeLocalStack(),
      probeLocalMcp(),
    ]);
  } catch (err) {
    log('error', `probe failed: ${err.message}`);
  }

  const extras = {};
  if (localStack) extras.local_stack = localStack;
  if (localMcp) extras.mcp = localMcp;

  const resp = await fetchJson(
    url,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        authorization: `Bearer ${cfg.instance_token}`,
      },
      body: JSON.stringify({
        instance_id: cfg.instance_id,
        version: CLIENT_VERSION,
        uptime_s: uptimeS,
        ram_mb: Math.round(mem.rss / 1024 / 1024),
        extras: Object.keys(extras).length > 0 ? extras : undefined,
      }),
    },
    HEARTBEAT_TIMEOUT_MS,
  );

  if (resp.status === 401) {
    log('error', 'instance_token rechazado — borrando config local y saliendo');
    deleteConfig();
    process.exit(1);
  }
  if (!resp.ok) {
    log('error', `heartbeat ${resp.status}: ${resp.raw}`);
    return;
  }

  // Log compacto: estado del stack local en una línea.
  const stack = localStack;
  if (stack?.reachable) {
    log(
      'info',
      `♥  heartbeat OK · gateway:${stack.gateway_connected ?? '?'} · agents:${stack.agent_count ?? '?'} · uptime ${uptimeS}s`,
    );
  } else {
    log('info', `♥  heartbeat OK · bridge unreachable · uptime ${uptimeS}s`);
  }

  const env = buildEnv(cfg);
  const logger = {
    info: (...a) => log('info', ...a),
    error: (...a) => log('error', ...a),
  };

  // Kill-switch: NO se hace aquí. Lo enforce el command-loop del propio bridge
  // (lee instance_status del heartbeat, con la suspensión de firma cascadeada,
  // y arma el guard 403). La antigua reconcileSuspension pegaba a endpoints
  // inexistentes del bridge (404) → eliminada.

  // Procesa comandos pendientes que el clawhub nos dispatchó en este beat.
  // No bloquea el siguiente heartbeat — si los comandos tardan más que el
  // intervalo, se solapan; cada uno reporta cuando termina.
  if (resp.body?.commands?.length > 0) {
    processCommands(env, resp.body.commands, logger).catch((err) =>
      log('error', `processCommands: ${err.message}`),
    );
  }

  // Forward usage spans del bridge al control plane. Best-effort: si bridge
  // o clawhub no responden, este tick lo deja para el próximo. No bloquea.
  syncUsage(env, cfg, saveConfig, logger)
    .then((r) => {
      if (r?.error) log('error', `usage sync: ${r.error}`);
      else if (r?.accepted || r?.deduped) {
        log('info', `usage: ${r.accepted || 0} new, ${r.deduped || 0} deduped → ${r.lastSeen}`);
      }
    })
    .catch((err) => log('error', `syncUsage threw: ${err.message}`));
}

function buildEnv(cfg) {
  return {
    clawhubUrl: CLAWHUB_URL,
    bridgeUrl: BRIDGE_URL,
    clientVersion: CLIENT_VERSION,
    workerLabel: WORKER_LABEL,
    startedAt,
    instanceToken: cfg.instance_token,
    // El headless puede ejecutar `apply_stack_update` para descargar bundles,
    // pero NO restartea gateway/bridge (no los gestiona). El dispatcher
    // reportará "supervisor required to activate" tras la descarga.
    stackBaseDir: path.join(path.dirname(CONFIG_PATH), 'stack'),
    // restartRuntime intencionalmente omitido — headless no orquesta runtime.
  };
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

async function main() {
  log('info', `clawhub-agent v${CLIENT_VERSION}`);
  log('info', `clawhub_url: ${CLAWHUB_URL}`);
  log('info', `bridge_url:  ${BRIDGE_URL || '(none)'}`);
  log('info', `config_path: ${CONFIG_PATH}`);
  log('info', `worker:      ${WORKER_LABEL}`);

  let config = loadConfig();
  if (!config) {
    if (!PAIRING_CODE) {
      log(
        'error',
        'No hay token guardado y CLAWHUB_PAIRING_CODE no está set. Genera un code en clawhub UI y vuelve a correr.',
      );
      process.exit(1);
    }
    log('info', 'sin token guardado — paireando…');
    config = await pair(PAIRING_CODE);
    saveConfig(config);
    log('info', `pareado a "${config.firm_name}" (instance ${config.instance_id})`);
  } else {
    log('info', `ya pareado a firm_id ${config.firm_id} (instance ${config.instance_id})`);
  }

  // First heartbeat inmediato, después intervalo.
  await heartbeat(config).catch((err) =>
    log('error', `first heartbeat: ${err.message}`),
  );

  log('info', `heartbeat cada ${HEARTBEAT_S}s — Ctrl+C para parar`);

  const timer = setInterval(() => {
    heartbeat(config).catch((err) =>
      log('error', `heartbeat: ${err.message}`),
    );
  }, HEARTBEAT_S * 1000);

  // Shutdown limpio.
  const shutdown = (sig) => {
    log('info', `${sig} received — shutting down`);
    clearInterval(timer);
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  log('error', err.stack || err.message);
  process.exit(1);
});
