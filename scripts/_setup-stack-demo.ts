/**
 * One-off para crear una instancia demo con extras.local_stack
 * apuntando al deploy Vercel — para ver la card "Stack local" sin
 * tocar clawgents-desktop.
 */

async function main() {
  const baseUrl = process.env.CLAWHUB_URL ?? "https://clawhub-three.vercel.app";
  const code = process.argv[2] ?? "STACK-DEMO";

  const pairResp = await fetch(`${baseUrl}/api/v0/pair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pairing_code: code,
      worker_label: "Demo Worker (stack)",
      version: "0.1.0-mock",
      os: "win32",
    }),
  });
  const pair = (await pairResp.json()) as {
    instance_id: string;
    instance_token: string;
  };
  console.log("pair", pairResp.status, "instance", pair.instance_id);

  const stack = {
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

  const hb = await fetch(`${baseUrl}/api/v0/heartbeat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${pair.instance_token}`,
    },
    body: JSON.stringify({
      instance_id: pair.instance_id,
      version: "0.1.0-mock",
      uptime_s: 42,
      cpu_pct: 14.3,
      ram_mb: 562,
      tokens_consumed_24h: 12340,
      extras: { local_stack: stack },
    }),
  });
  console.log("heartbeat", hb.status);
  console.log(`detalle: ${baseUrl}/firm/instances/${pair.instance_id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
