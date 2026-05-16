/**
 * Mock bridge — emula los endpoints que clawhub-agent sondea.
 * Sólo para validar el flow E2E sin levantar autonomous-agents real.
 *
 * Uso:  PORT=3700 node _mock-bridge.js
 */

'use strict';

const http = require('node:http');
const port = parseInt(process.env.PORT || '3700', 10);

const HEALTH = {
  ok: true,
  gatewayWsConnected: true,
  uptimeSec: 1234,
  version: 'mock-bridge-0.1',
};

const AGENTS = {
  agents: [
    {
      id: 'office-executive-v1',
      name: 'Elena',
      displayName: 'Elena (Executive)',
      role: 'executive',
      status: 'ready',
      online: true,
      tools: ['exec', 'email', 'calendar'],
    },
    {
      id: 'office-outbound-v1',
      name: 'Diego',
      displayName: 'Diego (Outbound)',
      role: 'outbound',
      status: 'ready',
      online: true,
    },
    {
      id: 'office-community-v1',
      name: 'Sofía',
      displayName: 'Sofía (Community)',
      role: 'community',
      status: 'idle',
      online: true,
    },
    {
      id: 'office-seo-v1',
      name: 'Mateo',
      displayName: 'Mateo (SEO)',
      role: 'seo',
      status: 'ready',
      online: true,
    },
    {
      id: 'office-legal-v1',
      name: 'Lucía',
      displayName: 'Lucía (Legal)',
      role: 'legal',
      status: 'ready',
      online: false,
    },
  ],
};

function respond(res, code, body) {
  res.writeHead(code, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const t = new Date().toISOString();
  if (req.url === '/healthz') {
    console.log(`[${t}] GET /healthz`);
    return respond(res, 200, HEALTH);
  }
  if (req.url === '/api/gateway/agents') {
    console.log(`[${t}] GET /api/gateway/agents`);
    return respond(res, 200, AGENTS);
  }
  console.log(`[${t}] ${req.method} ${req.url} → 404`);
  respond(res, 404, { error: 'not_found' });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[mock-bridge] listening on http://127.0.0.1:${port}`);
  console.log(`              GET /healthz`);
  console.log(`              GET /api/gateway/agents`);
});

process.on('SIGINT', () => {
  console.log('\n[mock-bridge] bye');
  server.close(() => process.exit(0));
});
