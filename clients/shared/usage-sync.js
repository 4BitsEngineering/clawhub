// Usage sync compartido: pulla spans del bridge local y los publica a
// clawhub para token attribution. Persiste un high-water-mark en el config
// del cliente para no re-mandar spans ya vistos.

'use strict';

const { fetchJson } = require('./http');

/**
 * syncUsage(env, cfg, saveConfig, logger)
 *
 * env:        { clawhubUrl, bridgeUrl, instanceToken }
 * cfg:        objeto config en memoria del cliente (mutado: actualiza
 *             cfg.usage_high_water_mark)
 * saveConfig: function(cfg) → persiste a disco. Se llama tras avanzar HWM.
 * logger:     opcional, { info, error }
 *
 * Devuelve { accepted, deduped, total, lastSeen, truncated } o
 * { error, skipped? }. Nunca throwea.
 */
async function syncUsage(env, cfg, saveConfig, logger) {
  if (!env.bridgeUrl) return { skipped: 'no_bridge' };
  const since = cfg.usage_high_water_mark || '1970-01-01T00:00:00.000Z';

  let bridgeResp;
  try {
    bridgeResp = await fetchJson(
      `${env.bridgeUrl}/api/usage/spans?since=${encodeURIComponent(since)}&limit=500`,
      { method: 'GET' },
      15_000,
    );
  } catch (err) {
    return { error: `bridge_unreachable: ${err.message}` };
  }
  if (!bridgeResp.ok) return { error: `bridge_${bridgeResp.status}` };

  const spans = bridgeResp.body?.spans || [];
  if (spans.length === 0) return { accepted: 0, lastSeen: since };

  const records = spans.map((s) => ({
    spanId: s.id,
    agentId: s.agent,
    runId: s.runId ?? null,
    taskLabel: s.taskLabel ?? null,
    model: s.model ?? null,
    provider: s.provider ?? null,
    status: s.status ?? null,
    inputTokens: s.inputTokens ?? null,
    outputTokens: s.outputTokens ?? null,
    cacheReadTokens: s.cacheReadTokens ?? null,
    cacheWriteTokens: s.cacheWriteTokens ?? null,
    costUsd: s.costUsd ?? null,
    turnCount: s.turnCount ?? null,
    tokensSource: s.tokensSource ?? null,
    startTime: s.startTime,
    endTime: s.endTime,
    durationMs: s.durationMs ?? null,
  }));

  let clawhubResp;
  try {
    clawhubResp = await fetchJson(
      `${env.clawhubUrl}/api/v0/usage`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          authorization: `Bearer ${env.instanceToken}`,
        },
        body: JSON.stringify({ records }),
      },
      30_000,
    );
  } catch (err) {
    return { error: `clawhub_unreachable: ${err.message}` };
  }
  if (!clawhubResp.ok) return { error: `clawhub_${clawhubResp.status}` };

  // Avanza HWM SOLO si todo OK — reintenta desde el mismo punto en caso
  // contrario. lastSeen es el endTime del último span devuelto, así si el
  // bridge truncó por limit el siguiente tick recoge los pendientes.
  const lastSeen = spans[spans.length - 1].endTime;
  cfg.usage_high_water_mark = lastSeen;
  try { saveConfig(cfg); } catch (e) { logger?.error?.(`[usage-sync] save HWM: ${e.message}`); }

  return {
    accepted: clawhubResp.body?.accepted ?? 0,
    deduped: clawhubResp.body?.deduped ?? 0,
    total: records.length,
    lastSeen,
    truncated: bridgeResp.body?.truncated === true,
  };
}

module.exports = { syncUsage };
