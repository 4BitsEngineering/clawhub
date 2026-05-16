/**
 * Crea un PairingToken, lo consume vía API, manda 1 heartbeat. Deja la
 * instancia en estado online para validar UI.
 *
 * Uso: npx tsx scripts/setup-live-demo.ts
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  }),
});
const baseUrl = process.env.CLAWHUB_URL ?? "http://localhost:3000";
const DEMO_FIRM_ID = "00000000-0000-0000-0000-000000000001";

async function main() {
const code = "LIVE-" + Math.random().toString(36).slice(2, 6).toUpperCase();

await db.pairingToken.create({
  data: {
    firmId: DEMO_FIRM_ID,
    code,
    expiresAt: new Date(Date.now() + 5 * 60_000),
  },
});

const pairResp = await fetch(`${baseUrl}/api/v0/pair`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    pairing_code: code,
    worker_label: "María García",
    version: "0.1.0-mock",
    os: "win32",
  }),
});
const pair = (await pairResp.json()) as {
  instance_id: string;
  instance_token: string;
};

// Simulamos un stack local con bridge reachable + gateway conectado + 5 agentes
// (mismo shape que produce src/main/clawhub-client.js#probeLocalStack en
// clawgents-desktop).
const mockLocalStack = {
  bridge_url: "http://localhost:3700",
  reachable: true,
  gateway_connected: true,
  agent_count: 5,
  agents: [
    { id: "office-executive-v1", name: "Elena (Executive)", status: "ready", online: true },
    { id: "office-outbound-v1", name: "Diego (Outbound)", status: "ready", online: true },
    { id: "office-community-v1", name: "Sofía (Community)", status: "idle", online: true },
    { id: "office-seo-v1", name: "Mateo (SEO)", status: "ready", online: true },
    { id: "office-legal-v1", name: "Lucía (Legal)", status: "ready", online: false },
  ],
  probed_at: new Date().toISOString(),
};

const beats = 10;
let lastStatus = 0;
for (let i = 0; i < beats; i++) {
  const r = await fetch(`${baseUrl}/api/v0/heartbeat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${pair.instance_token}`,
    },
    body: JSON.stringify({
      instance_id: pair.instance_id,
      version: "0.1.0-mock",
      uptime_s: i * 5,
      cpu_pct: 8 + Math.random() * 25,
      ram_mb: 400 + Math.floor(Math.random() * 300),
      tokens_consumed_24h: i * 1200 + Math.floor(Math.random() * 500),
      last_error: i === 7 ? "Token quota warning at 80%" : null,
      extras: { local_stack: mockLocalStack },
    }),
  });
  lastStatus = r.status;
  await new Promise((res) => setTimeout(res, 100));
}

console.log(`pair ${pairResp.status}, ${beats} heartbeats (last ${lastStatus})`);
console.log(`instance_id ${pair.instance_id}`);
console.log(`detalle: ${baseUrl}/firm/instances/${pair.instance_id}`);
await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
