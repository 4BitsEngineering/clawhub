/**
 * Test E2E backend: crea pairing token via Prisma, pairea via API,
 * manda heartbeats, verifica persistencia.
 *
 * Uso: npx tsx scripts/test-e2e.ts
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const baseUrl = process.env.CLAWHUB_URL ?? "http://localhost:3000";
const DEMO_FIRM_ID = "00000000-0000-0000-0000-000000000001";

async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  process.stdout.write(`\n→ ${label}\n`);
  const t0 = Date.now();
  const result = await fn();
  const ms = Date.now() - t0;
  process.stdout.write(`  ✔ ok (${ms}ms)\n`);
  return result;
}

async function main() {
  // 1. Crear pairing token directamente en DB
  const code = "TEST-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const token = await step("Crear PairingToken", () =>
    db.pairingToken.create({
      data: {
        firmId: DEMO_FIRM_ID,
        code,
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    }),
  );
  console.log(`  code: ${token.code}`);

  // 2. Pair endpoint
  type PairResp = {
    instance_id: string;
    instance_token: string;
    firm_id: string;
    firm_name: string;
  };
  const pair: PairResp = await step("POST /api/v0/pair", async () => {
    const r = await fetch(`${baseUrl}/api/v0/pair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pairing_code: code,
        worker_label: "E2E Tester",
        version: "0.1.0-test",
        os: "test",
      }),
    });
    if (!r.ok) throw new Error(`pair ${r.status}: ${await r.text()}`);
    return (await r.json()) as PairResp;
  });
  console.log(`  instance_id: ${pair.instance_id}`);
  console.log(`  firm: ${pair.firm_name}`);
  console.log(`  token (first 16): ${pair.instance_token.slice(0, 16)}…`);

  // 3. Pair token marcado como usado
  await step("Verificar PairingToken usedAt", async () => {
    const t = await db.pairingToken.findUnique({ where: { id: token.id } });
    if (!t?.usedAt) throw new Error("usedAt no se marcó");
  });

  // 4. Re-usar el mismo code → 410
  await step("POST /api/v0/pair con code reusado → 410", async () => {
    const r = await fetch(`${baseUrl}/api/v0/pair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pairing_code: code,
        worker_label: "should fail",
        version: "0.1.0-test",
      }),
    });
    if (r.status !== 410)
      throw new Error(`esperaba 410, recibí ${r.status}: ${await r.text()}`);
  });

  // 5. Heartbeats x3
  for (let i = 1; i <= 3; i++) {
    await step(`POST /api/v0/heartbeat #${i}`, async () => {
      const r = await fetch(`${baseUrl}/api/v0/heartbeat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${pair.instance_token}`,
        },
        body: JSON.stringify({
          instance_id: pair.instance_id,
          version: "0.1.0-test",
          uptime_s: i * 5,
          cpu_pct: 10 + i,
          ram_mb: 500 + i * 10,
          tokens_consumed_24h: i * 100,
        }),
      });
      if (!r.ok) throw new Error(`heartbeat ${r.status}: ${await r.text()}`);
    });
    await new Promise((res) => setTimeout(res, 200));
  }

  // 6. Heartbeat con token inválido → 401
  await step("POST /api/v0/heartbeat con token malo → 401", async () => {
    const r = await fetch(`${baseUrl}/api/v0/heartbeat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer fake-token-123",
      },
      body: JSON.stringify({
        instance_id: pair.instance_id,
        uptime_s: 1,
      }),
    });
    if (r.status !== 401)
      throw new Error(`esperaba 401, recibí ${r.status}`);
  });

  // 7. Verificar persistencia
  await step("Leer Instance + Heartbeats de DB", async () => {
    const inst = await db.instance.findUnique({
      where: { id: pair.instance_id },
      include: { heartbeats: { orderBy: { receivedAt: "desc" } } },
    });
    if (!inst) throw new Error("Instance no encontrada");
    if (inst.heartbeats.length !== 3)
      throw new Error(`esperaba 3 heartbeats, hay ${inst.heartbeats.length}`);
    if (!inst.lastHeartbeatAt) throw new Error("lastHeartbeatAt no se actualizó");
    const last = inst.heartbeats[0];
    console.log(`  heartbeats: ${inst.heartbeats.length}`);
    console.log(`  lastHeartbeatAt: ${inst.lastHeartbeatAt.toISOString()}`);
    console.log(`  último: cpu ${last.cpuPct}% ram ${last.ramMb}MB uptime ${last.uptimeS}s`);
  });

  // 8. Limpiar: borrar la instancia y el token (idempotente al re-ejecutar)
  await step("Cleanup", async () => {
    await db.instance.delete({ where: { id: pair.instance_id } });
  });

  console.log("\n✅  Todos los pasos OK\n");
}

main()
  .catch((e) => {
    console.error("\n❌  FALLO:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
