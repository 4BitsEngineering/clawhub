/**
 * pin-firm-stack.ts — fija las versiones del stack que una firma debe correr.
 *
 * Uso:
 *   npx tsx scripts/pin-firm-stack.ts \
 *     --firmId=<UUID> \
 *     --openclaw=1.41.5 \
 *     --bridge=0.9.2 \
 *     --overlayId=asesoria \
 *     --overlay=2026.5.16 \
 *     [--autoUpdate=true|false] \
 *     [--channel=stable|beta]
 *
 * Cualquier flag omitido NO se toca (mantiene el valor actual de la firma).
 * Pasa `--openclaw=null` (literal "null") para des-pinearlo (cliente irá
 * a "latest del canal").
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

type Args = {
  firmId: string;
  openclaw?: string;
  bridge?: string;
  overlayId?: string;
  overlay?: string;
  autoUpdate?: string;
  channel?: string;
};

function parseArgs(): Args {
  const args: Partial<Args> = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    (args as Record<string, string>)[m[1]] = m[2];
  }
  if (!args.firmId) {
    console.error("Usage: tsx scripts/pin-firm-stack.ts --firmId=<UUID> [--openclaw=v] [--bridge=v] [--overlayId=id] [--overlay=v] [--autoUpdate=true] [--channel=stable]");
    process.exit(1);
  }
  return args as Args;
}

function nullable(v: string | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === "null") return null;
  return v;
}

async function main() {
  const args = parseArgs();
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
    }),
  });

  const data: Record<string, unknown> = {};
  if (args.openclaw !== undefined) data.openclawVersion = nullable(args.openclaw);
  if (args.bridge !== undefined) data.bridgeVersion = nullable(args.bridge);
  if (args.overlayId !== undefined) data.overlayId = nullable(args.overlayId);
  if (args.overlay !== undefined) data.overlayVersion = nullable(args.overlay);
  if (args.autoUpdate !== undefined) data.stackAutoUpdate = args.autoUpdate === "true";
  if (args.channel !== undefined) data.stackChannel = args.channel;

  if (Object.keys(data).length === 0) {
    console.error("Nada que actualizar. Pasa al menos un flag.");
    process.exit(1);
  }

  const firm = await db.firm.update({ where: { id: args.firmId }, data });
  console.log(`✅ firm ${firm.name} (${firm.id}) actualizada:`);
  console.log(`   openclaw:   ${firm.openclawVersion ?? "(latest)"}`);
  console.log(`   bridge:     ${firm.bridgeVersion ?? "(latest)"}`);
  console.log(`   overlay:    ${firm.overlayId ?? "(none)"} @ ${firm.overlayVersion ?? "(latest)"}`);
  console.log(`   channel:    ${firm.stackChannel}`);
  console.log(`   autoUpdate: ${firm.stackAutoUpdate}`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
