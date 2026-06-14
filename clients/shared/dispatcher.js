// Command dispatcher compartido para clientes clawhub (headless + electron).
//
// Recibe `env` con la config del cliente y `cmd` con el comando dispatchado,
// devuelve { ok, result?, error? }. Best-effort: nunca throwea, los errores
// se devuelven como ok:false + mensaje. Catalogo alineado con
// clawhub/src/lib/commands.ts y autonomous-agents bridge endpoints.

'use strict';

const { fetchJson } = require('./http');
const { ensureStack } = require('./stack-bootstrap');

/**
 * env shape (proporcionado por el cliente):
 *   {
 *     clawhubUrl:    'https://clawhub-three.vercel.app',
 *     bridgeUrl:     'http://localhost:3700' | null,
 *     clientVersion: '0.1.0-headless' | '0.1.0-desktop',
 *     workerLabel:   'Carlos García',
 *     startedAt:     Date.now() (ms timestamp del arranque del cliente),
 *     instanceToken: '<bearer token>',
 *   }
 */
async function executeCommand(env, cmd) {
  switch (cmd.kind) {
    case 'ping':
      return {
        ok: true,
        result: {
          pong_at: new Date().toISOString(),
          uptime_s: Math.floor((Date.now() - env.startedAt) / 1000),
          client_version: env.clientVersion,
          platform: process.platform,
          worker_label: env.workerLabel,
          bridge_url: env.bridgeUrl,
        },
      };

    case 'snapshot_to_baseline': {
      if (!env.bridgeUrl) return { ok: false, error: 'no_bridge_url_configured' };
      const args = cmd.args || {};
      if (!args.label) return { ok: false, error: 'label_required' };

      const t0 = Date.now();
      let snap;
      try {
        const r = await fetchJson(`${env.bridgeUrl}/api/baseline/snapshot`, { method: 'GET' }, 60_000);
        if (!r.ok) return { ok: false, error: `bridge_${r.status}: ${(r.raw || '').slice(0, 200)}` };
        snap = r.body;
      } catch (err) {
        return { ok: false, error: `bridge_unreachable: ${err.message}` };
      }
      const tSnap = Date.now() - t0;

      try {
        const u = await fetchJson(
          `${env.clawhubUrl}/api/v0/baselines`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json; charset=utf-8',
              authorization: `Bearer ${env.instanceToken}`,
            },
            body: JSON.stringify({
              label: args.label,
              description: args.description ?? null,
              files: snap.files,
            }),
          },
          60_000,
        );
        if (!u.ok) return { ok: false, error: `clawhub_${u.status}: ${(u.raw || '').slice(0, 200)}` };
        return {
          ok: true,
          result: {
            baseline_id: u.body.baseline_id,
            version: u.body.version,
            file_count: u.body.file_count,
            total_bytes: u.body.total_bytes,
            snapshot_took_ms: tSnap,
            total_took_ms: Date.now() - t0,
          },
        };
      } catch (err) {
        return { ok: false, error: `upload_failed: ${err.message}` };
      }
    }

    case 'reset_to_baseline': {
      if (!env.bridgeUrl) return { ok: false, error: 'no_bridge_url_configured' };
      const args = cmd.args || {};
      if (!args.baseline_id) return { ok: false, error: 'baseline_id_required' };

      const t0 = Date.now();
      let baseline;
      try {
        const r = await fetchJson(
          `${env.clawhubUrl}/api/v0/baselines/${encodeURIComponent(args.baseline_id)}`,
          { method: 'GET', headers: { authorization: `Bearer ${env.instanceToken}` } },
          60_000,
        );
        if (!r.ok) return { ok: false, error: `clawhub_${r.status}: ${(r.raw || '').slice(0, 200)}` };
        baseline = r.body;
      } catch (err) {
        return { ok: false, error: `clawhub_unreachable: ${err.message}` };
      }
      const tFetch = Date.now() - t0;

      try {
        const a = await fetchJson(
          `${env.bridgeUrl}/api/baseline/apply`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ files: baseline.files }),
          },
          120_000,
        );
        if (a.status !== 200 && a.status !== 207) {
          return { ok: false, error: `bridge_${a.status}: ${(a.raw || '').slice(0, 200)}` };
        }
        return {
          ok: a.body?.ok === true,
          result: {
            baseline_id: args.baseline_id,
            baseline_version: baseline.baseline?.version,
            baseline_label: baseline.baseline?.label,
            files_written: a.body?.filesWritten ?? null,
            files_preserved: a.body?.filesPreserved ?? null,
            files_compacted: a.body?.filesCompacted ?? null,
            errors_count: Array.isArray(a.body?.errors) ? a.body.errors.length : 0,
            errors: Array.isArray(a.body?.errors) ? a.body.errors.slice(0, 10) : [],
            backup_dir: a.body?.backupDir ?? null,
            reloaded_skills: a.body?.reloadedSkills ?? null,
            fetch_took_ms: tFetch,
            total_took_ms: Date.now() - t0,
          },
        };
      } catch (err) {
        return { ok: false, error: `bridge_unreachable: ${err.message}` };
      }
    }

    case 'reload_skills': {
      if (!env.bridgeUrl) return { ok: false, error: 'no_bridge_url_configured' };
      const t0 = Date.now();
      try {
        const r = await fetchJson(
          `${env.bridgeUrl}/api/skills/sync`,
          { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' } },
          15_000,
        );
        if (!r.ok) return { ok: false, error: `bridge_${r.status}: ${(r.raw || '').slice(0, 200)}` };
        return {
          ok: true,
          result: { took_ms: Date.now() - t0, skill_count: r.body?.count ?? null, bridge_url: env.bridgeUrl },
        };
      } catch (err) {
        return { ok: false, error: `bridge_unreachable: ${err.message}` };
      }
    }

    case 'reload_mcp': {
      if (!env.bridgeUrl) return { ok: false, error: 'no_bridge_url_configured' };
      const t0 = Date.now();
      try {
        const r = await fetchJson(
          `${env.bridgeUrl}/api/mcp/reload`,
          { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' } },
          15_000,
        );
        if (!r.ok) return { ok: false, error: `bridge_${r.status}: ${(r.raw || '').slice(0, 200)}` };
        return {
          ok: true,
          result: {
            took_ms: Date.now() - t0,
            ready: r.body?.ready ?? null,
            total: r.body?.total ?? null,
          },
        };
      } catch (err) {
        return { ok: false, error: `bridge_unreachable: ${err.message}` };
      }
    }

    case 'push_mcp_config': {
      if (!env.bridgeUrl) return { ok: false, error: 'no_bridge_url_configured' };
      const t0 = Date.now();
      // 1. Bajar la lista de MCP servers activos de esta firma desde clawhub.
      let cloudList;
      try {
        const r = await fetchJson(
          `${env.clawhubUrl}/api/v0/mcp-config`,
          { method: 'GET', headers: { authorization: `Bearer ${env.instanceToken}` } },
          15_000,
        );
        if (!r.ok) return { ok: false, error: `clawhub_${r.status}: ${(r.raw || '').slice(0, 200)}` };
        cloudList = r.body;
      } catch (err) {
        return { ok: false, error: `clawhub_unreachable: ${err.message}` };
      }
      const servers = Array.isArray(cloudList?.servers) ? cloudList.servers : [];

      // 2. Pedir al bridge que reescriba el openclaw.json (preservando env
      // vars). Si la lista está vacía, vaciamos mcpServers explícitamente.
      try {
        const r = await fetchJson(
          `${env.bridgeUrl}/api/mcp/sync`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ servers }),
          },
          30_000,
        );
        if (!r.ok) return { ok: false, error: `bridge_${r.status}: ${(r.raw || '').slice(0, 200)}` };
        return {
          ok: true,
          result: {
            took_ms: Date.now() - t0,
            servers_received: servers.length,
            servers_written: r.body?.servers_written ?? null,
            servers_skipped: r.body?.servers_skipped ?? null,
            openclaw_config_path: r.body?.path ?? null,
          },
        };
      } catch (err) {
        return { ok: false, error: `bridge_unreachable: ${err.message}` };
      }
    }

    case 'fetch_logs': {
      if (!env.bridgeUrl) return { ok: false, error: 'no_bridge_url_configured' };
      const lines = Math.max(1, Math.min(parseInt((cmd.args || {}).lines, 10) || 200, 2000));
      try {
        const r = await fetchJson(`${env.bridgeUrl}/api/logs/tail?lines=${lines}`, { method: 'GET' }, 15_000);
        if (!r.ok) return { ok: false, error: `bridge_${r.status}` };
        return {
          ok: true,
          result: {
            count: r.body?.count ?? 0,
            bridge_buffer_size: r.body?.bufferSize ?? 0,
            truncated: r.body?.truncated === true,
            lines: (r.body?.lines || []).map((e) => {
              const ts = e.ts || '';
              const lvl = (e.level || '').toUpperCase().padEnd(5);
              const ctx = e.ctx ? ' [' + Object.values(e.ctx).filter(Boolean).join(' ') + ']' : '';
              const data = e.data ? ' ' + JSON.stringify(e.data) : '';
              return `${ts} ${lvl}${ctx} ${e.msg}${data}`;
            }),
          },
        };
      } catch (err) {
        return { ok: false, error: `bridge_unreachable: ${err.message}` };
      }
    }

    case 'clear_cache': {
      if (!env.bridgeUrl) return { ok: false, error: 'no_bridge_url_configured' };
      const allScopes = ['skills', 'tools'];
      const scopes = Array.isArray(cmd.args?.scopes) && cmd.args.scopes.length > 0
        ? cmd.args.scopes.filter((s) => allScopes.includes(s))
        : allScopes;
      const out = { scopes_run: [], errors: [] };
      const t0 = Date.now();
      for (const scope of scopes) {
        try {
          const r = await fetchJson(
            `${env.bridgeUrl}/api/${scope}/sync`,
            { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' } },
            30_000,
          );
          if (!r.ok) { out.errors.push({ scope, error: `bridge_${r.status}` }); continue; }
          out.scopes_run.push({ scope, count: r.body?.count ?? null });
        } catch (err) {
          out.errors.push({ scope, error: err.message });
        }
      }
      return { ok: out.errors.length === 0, result: { ...out, took_ms: Date.now() - t0 } };
    }

    case 'snapshot_config': {
      if (!env.bridgeUrl) return { ok: false, error: 'no_bridge_url_configured' };
      try {
        const r = await fetchJson(`${env.bridgeUrl}/api/baseline/snapshot`, { method: 'GET' }, 30_000);
        if (!r.ok) return { ok: false, error: `bridge_${r.status}` };
        const configFile = (r.body?.files || []).find((f) => f.category === 'OPENCLAW_CONFIG');
        if (!configFile) return { ok: false, error: 'config_not_found_in_snapshot' };
        return {
          ok: true,
          result: {
            path: configFile.path,
            sha256: configFile.sha256,
            size_bytes: configFile.sizeBytes,
            redacted_fields: configFile.redactedFields || [],
            content: configFile.content.length > 16384
              ? configFile.content.slice(0, 16384) + '\n... [TRUNCATED]'
              : configFile.content,
            content_truncated: configFile.content.length > 16384,
          },
        };
      } catch (err) {
        return { ok: false, error: `bridge_unreachable: ${err.message}` };
      }
    }

    case 'push_config_patch': {
      if (!env.bridgeUrl) return { ok: false, error: 'no_bridge_url_configured' };
      const changes = (cmd.args || {}).changes;
      if (!changes || typeof changes !== 'object') return { ok: false, error: 'changes_object_required' };
      try {
        const r = await fetchJson(
          `${env.bridgeUrl}/api/config/patch`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ changes }),
          },
          30_000,
        );
        if (!r.ok) return { ok: false, error: `bridge_${r.status}`, result: r.body ?? null };
        return {
          ok: true,
          result: {
            paths_applied: r.body?.paths_applied ?? [],
            changes_count: r.body?.changes_count ?? 0,
            backup: r.body?.backup ?? null,
            gateway_reload: r.body?.gateway_reload ?? null,
          },
        };
      } catch (err) {
        return { ok: false, error: `bridge_unreachable: ${err.message}` };
      }
    }

    case 'restart_bridge': {
      if (!env.bridgeUrl) return { ok: false, error: 'no_bridge_url_configured' };
      try {
        const r = await fetchJson(
          `${env.bridgeUrl}/api/admin/restart-bridge`,
          {
            method: 'POST',
            // The bridge gates destructive endpoints (HTTP-9): without an
            // explicit confirmation it returns 428. Send the body so the
            // restart actually fires (the helper sets Content-Length from the
            // body string itself).
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'x-confirm-destructive': 'yes',
            },
            body: JSON.stringify({ confirm: true }),
          },
          10_000,
        );
        if (!r.ok) return { ok: false, error: `bridge_${r.status}` };
        return {
          ok: true,
          result: {
            bridge_pid: r.body?.pid ?? null,
            will_exit_in_ms: r.body?.will_exit_in_ms ?? null,
            note: 'supervisor required to respawn bridge after exit',
          },
        };
      } catch (err) {
        // Si el bridge muere antes de responder, lo consideramos éxito.
        return {
          ok: true,
          result: {
            note: 'bridge connection dropped before reply (likely already exited)',
            partial_error: err.message,
          },
        };
      }
    }

    case 'apply_stack_update': {
      // Re-evalúa el manifest y descarga diffs. Si el caller pasó env.
      // restartRuntime, intenta reiniciar gateway+bridge para que apliquen
      // las nuevas versiones. Sin restartRuntime (headless puro), reporta
      // ok pero deja claro que requiere supervisor para activar.
      if (!env.stackBaseDir) {
        return { ok: false, error: 'no_stack_base_dir_configured' };
      }
      const t0 = Date.now();
      let result;
      try {
        result = await ensureStack(
          { clawhubUrl: env.clawhubUrl, instanceToken: env.instanceToken },
          env.stackBaseDir,
          undefined,
        );
      } catch (err) {
        return { ok: false, error: `ensure_stack_failed: ${err.message}` };
      }
      const summary = {
        openclaw: result.openclaw ? { version: result.openclaw.version, downloaded: result.openclaw.downloaded } : null,
        bridge: result.bridge ? { version: result.bridge.version, downloaded: result.bridge.downloaded } : null,
        overlay: result.overlay ? { overlayId: result.overlay.overlayId, version: result.overlay.version, downloaded: result.overlay.downloaded } : null,
        errors: result.errors,
        ensure_took_ms: Date.now() - t0,
      };
      if (typeof env.restartRuntime !== 'function') {
        return {
          ok: result.errors.length === 0,
          result: {
            ...summary,
            runtime_restarted: false,
            note: 'stack updated on disk; supervisor must restart gateway+bridge to activate',
          },
        };
      }
      try {
        await env.restartRuntime();
        return {
          ok: result.errors.length === 0,
          result: { ...summary, runtime_restarted: true, total_took_ms: Date.now() - t0 },
        };
      } catch (err) {
        return {
          ok: false,
          error: `restart_runtime_failed: ${err.message}`,
          result: summary,
        };
      }
    }

    case 'restart_gateway': {
      if (!env.bridgeUrl) return { ok: false, error: 'no_bridge_url_configured' };
      try {
        const r = await fetchJson(
          `${env.bridgeUrl}/api/admin/restart-gateway`,
          {
            method: 'POST',
            // The bridge gates destructive endpoints (HTTP-9): without an
            // explicit confirmation it returns 428. Send the body so the
            // restart actually fires (the helper sets Content-Length from the
            // body string itself).
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'x-confirm-destructive': 'yes',
            },
            body: JSON.stringify({ confirm: true }),
          },
          30_000,
        );
        if (!r.ok) return { ok: false, error: `bridge_${r.status}` };
        return {
          ok: r.body?.ok === true,
          result: {
            rpc: r.body?.rpc ?? null,
            pids_found: r.body?.pids_found ?? [],
            killed: r.body?.killed ?? [],
            supervisor_required: r.body?.supervisor_required === true,
            note: r.body?.note ?? null,
          },
        };
      } catch (err) {
        return { ok: false, error: `bridge_unreachable: ${err.message}` };
      }
    }

    default:
      return { ok: false, error: `unknown_kind: ${cmd.kind}` };
  }
}

/**
 * Reporta el resultado de un comando al control plane. Best-effort:
 * loguea pero no throwea — un fallo aquí no debe romper el cliente.
 */
async function reportCommandResult(env, cmd, outcome, logger) {
  const url = `${env.clawhubUrl}/api/v0/commands/${cmd.id}/result`;
  const body = outcome.ok === true
    ? { status: 'completed', result: outcome.result ?? null }
    : { status: 'failed', error: outcome.error ?? 'unknown_error' };
  try {
    const resp = await fetchJson(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          authorization: `Bearer ${env.instanceToken}`,
        },
        body: JSON.stringify(body),
      },
      10_000,
    );
    if (!resp.ok) {
      logger?.error?.(`[dispatcher] report ${cmd.id} → ${resp.status}: ${resp.raw}`);
    }
  } catch (err) {
    logger?.error?.(`[dispatcher] report ${cmd.id} failed: ${err.message}`);
  }
}

// -------------------------------------------------------------------------
// Kill-switch: reconciliación de suspensión por suscripción.
//
// El heartbeat de clawhub devuelve `firm_status` ('active' | 'suspended').
// Traducimos ese estado a los endpoints admin del bridge (POST
// /api/admin/suspend | /api/admin/resume) reutilizando el mismo patrón de
// llamada que el resto de comandos admin (fetchJson + Bearer instanceToken).
//
// Estado local de módulo: persiste entre heartbeats dentro del mismo proceso
// cliente. Solo cambia tras una llamada al bridge con éxito → si el bridge
// falla de forma transitoria, lo reintentamos en el siguiente heartbeat.
// -------------------------------------------------------------------------

let suspendedLocally = false;

/**
 * Reconcilia el estado de suspensión de la firma con el bridge local.
 * Llamar una vez por heartbeat, pasándole el body de la respuesta del
 * heartbeat. Best-effort: nunca throwea (un fallo del bridge no debe romper
 * el loop de heartbeat). Defensivo si `firm_status` está ausente (clawhub
 * antiguo) → no hace nada.
 */
async function reconcileSuspension(env, heartbeatResp, logger) {
  const firmStatus = heartbeatResp?.firm_status;
  // clawhub antiguo no manda firm_status → no tocar el bridge.
  if (firmStatus !== 'suspended' && firmStatus !== 'active') return;
  if (!env.bridgeUrl) return;

  const headers = {
    'content-type': 'application/json; charset=utf-8',
    authorization: `Bearer ${env.instanceToken}`,
  };

  if (firmStatus === 'suspended' && !suspendedLocally) {
    const reason = heartbeatResp.suspended_reason || 'subscription';
    try {
      const r = await fetchJson(
        `${env.bridgeUrl}/api/admin/suspend`,
        { method: 'POST', headers, body: JSON.stringify({ reason }) },
        10_000,
      );
      if (!r.ok) {
        logger?.error?.(`[dispatcher] suspend → bridge_${r.status}: ${(r.raw || '').slice(0, 200)}`);
        return; // sin éxito → no flip; reintenta el próximo heartbeat
      }
      suspendedLocally = true;
      logger?.info?.(`[dispatcher] firm suspended → bridge service cut (reason: ${reason})`);
    } catch (err) {
      logger?.error?.(`[dispatcher] suspend failed: ${err.message}`);
    }
    return;
  }

  if (firmStatus === 'active' && suspendedLocally) {
    try {
      const r = await fetchJson(
        `${env.bridgeUrl}/api/admin/resume`,
        { method: 'POST', headers, body: JSON.stringify({}) },
        10_000,
      );
      if (!r.ok) {
        logger?.error?.(`[dispatcher] resume → bridge_${r.status}: ${(r.raw || '').slice(0, 200)}`);
        return; // sin éxito → seguimos marcados como suspendidos; reintenta
      }
      suspendedLocally = false;
      logger?.info?.('[dispatcher] firm active → bridge service resumed');
    } catch (err) {
      logger?.error?.(`[dispatcher] resume failed: ${err.message}`);
    }
  }
}

/**
 * Procesa una tanda de comandos en serie. No bloquea ni espera entre ellos
 * — el caller decide si lanzarlo en background. logger es opcional, debe
 * exponer info/error si se pasa.
 */
async function processCommands(env, commands, logger) {
  if (!Array.isArray(commands) || commands.length === 0) return;
  logger?.info?.(`[dispatcher] ${commands.length} comando${commands.length === 1 ? '' : 's'} recibido${commands.length === 1 ? '' : 's'}`);
  for (const cmd of commands) {
    logger?.info?.(`[dispatcher]   → ${cmd.kind} (${cmd.id})`);
    let outcome;
    try {
      outcome = await executeCommand(env, cmd);
    } catch (err) {
      outcome = { ok: false, error: err?.message || String(err) };
    }
    await reportCommandResult(env, cmd, outcome, logger);
    logger?.info?.(`[dispatcher]     ${outcome.ok ? '✔' : '✘'} ${outcome.ok ? 'completed' : `failed: ${outcome.error}`}`);
  }
}

module.exports = { executeCommand, reportCommandResult, processCommands, reconcileSuspension };
