// Zero-deps fetch helper compartido por clientes clawhub (headless + electron
// desktop). Usa el global fetch de Node 18+/Electron — sin dependencias npm.

'use strict';

/**
 * fetchJson(url, opts, timeoutMs) → { ok, status, body, raw }
 *
 * - body es null si el response no era JSON.
 * - raw es siempre string para debug.
 * - timeoutMs aborta la request si excede el plazo.
 */
async function fetchJson(url, opts, timeoutMs) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ac.signal });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    return { ok: res.ok, status: res.status, body, raw: text };
  } finally {
    clearTimeout(t);
  }
}

module.exports = { fetchJson };
