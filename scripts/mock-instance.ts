/**
 * Mock de clawgents-desktop:
 *   1. Pairea contra clawhub usando un pairing_code.
 *   2. Manda heartbeats cada N segundos hasta Ctrl+C.
 *
 * Uso:
 *   npx tsx scripts/mock-instance.ts <PAIRING_CODE> [--label "María"] [--interval 5]
 *
 * Variables opcionales:
 *   CLAWHUB_URL  (default http://localhost:3000)
 */

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error(
    "Uso: npx tsx scripts/mock-instance.ts <PAIRING_CODE> [--label NAME] [--interval SECONDS]",
  );
  process.exit(1);
}

const code = args[0];
const labelIdx = args.indexOf("--label");
const intervalIdx = args.indexOf("--interval");
const workerLabel =
  labelIdx >= 0 && args[labelIdx + 1] ? args[labelIdx + 1] : "Mock Worker";
const intervalSec =
  intervalIdx >= 0 && args[intervalIdx + 1]
    ? Number(args[intervalIdx + 1])
    : 5;

const baseUrl = process.env.CLAWHUB_URL ?? "http://localhost:3000";

async function pair(): Promise<{
  instanceId: string;
  instanceToken: string;
  firmName: string;
}> {
  const res = await fetch(`${baseUrl}/api/v0/pair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pairing_code: code,
      worker_label: workerLabel,
      version: "0.1.0-mock",
      os: process.platform,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`pair failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as {
    instance_id: string;
    instance_token: string;
    firm_id: string;
    firm_name: string;
  };
  return {
    instanceId: json.instance_id,
    instanceToken: json.instance_token,
    firmName: json.firm_name,
  };
}

async function heartbeat(
  instanceId: string,
  token: string,
  uptimeS: number,
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/v0/heartbeat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      instance_id: instanceId,
      version: "0.1.0-mock",
      uptime_s: uptimeS,
      cpu_pct: Math.round(Math.random() * 25 * 10) / 10,
      ram_mb: 400 + Math.floor(Math.random() * 200),
      tokens_consumed_24h: Math.floor(uptimeS * 12), // ~12 tok/s rate
      last_error: null,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`heartbeat failed (${res.status}): ${text}`);
  }
}

async function main() {
  console.log(`\n→ Pairing con ${baseUrl} usando code ${code}…`);
  const { instanceId, instanceToken, firmName } = await pair();
  console.log(`✔ Pareado a "${firmName}". instance_id=${instanceId}`);
  console.log(
    `→ Heartbeats cada ${intervalSec}s. Abre ${baseUrl}/firm para verlo.\n  Ctrl+C para parar.\n`,
  );

  const startedAt = Date.now();
  let beats = 0;
  const tick = async () => {
    const uptimeS = Math.floor((Date.now() - startedAt) / 1000);
    try {
      await heartbeat(instanceId, instanceToken, uptimeS);
      beats += 1;
      process.stdout.write(
        `  ♥ ${new Date().toLocaleTimeString()}  beat #${beats}  uptime ${uptimeS}s\n`,
      );
    } catch (err) {
      console.error(`  ✗ ${(err as Error).message}`);
    }
  };

  await tick();
  setInterval(tick, intervalSec * 1000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
