/**
 * release-installer.ts — registra un .exe de clawgents-desktop como bundle
 * INSTALLER en clawhub.
 *
 * Igual que release-bundle.ts pero kind fijo=INSTALLER, sin --overlayId, y la
 * "version" del installer suele coincidir con la del package.json del
 * desktop. NO empaqueta (el .exe ya está generado por electron-builder); solo
 * calcula sha256 + tamaño y registra la URL pública.
 *
 * Uso:
 *   npx tsx scripts/release-installer.ts \
 *     --version=0.1.0 \
 *     --exe="C:/.../clawgents-desktop/release/AI Office-Setup-0.1.0.exe" \
 *     --url="https://github.com/4BitsEngineering/clawgents-desktop/releases/download/v0.1.0/AI-Office-Setup-0.1.0.exe" \
 *     [--channel=stable] [--notes="primer build slim sin firma"]
 */
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

type Args = {
  version: string;
  exe: string;
  url?: string;
  channel?: string;
  notes?: string;
};

function parseArgs(): Args {
  const args: Partial<Args> = { channel: "stable" };
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    (args as Record<string, string>)[m[1]] = m[2];
  }
  if (!args.version || !args.exe) {
    console.error(
      "Usage: tsx scripts/release-installer.ts --version=<v> --exe=<path> [--url=<https://...>] [--channel=stable] [--notes=...]",
    );
    process.exit(1);
  }
  return args as Args;
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    const s = fs.createReadStream(filePath);
    s.on("data", (c) => h.update(c));
    s.on("end", () => resolve(h.digest("hex")));
    s.on("error", reject);
  });
}

async function main() {
  const args = parseArgs();
  if (!fs.existsSync(args.exe)) {
    console.error(`exe not found: ${args.exe}`);
    process.exit(1);
  }
  const sha256 = await sha256File(args.exe);
  const sizeBytes = fs.statSync(args.exe).size;
  console.log(`[release-installer] ${args.exe}`);
  console.log(`   sha256: ${sha256}`);
  console.log(`   size:   ${sizeBytes} bytes (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);

  if (!args.url) {
    console.log("");
    console.log("Sube el .exe a tu destino (GitHub Release recomendado) y corre de nuevo con --url=<URL>:");
    console.log(`   npx tsx scripts/release-installer.ts --version=${args.version} --exe=${args.exe} --url=<HTTPS_URL>${args.notes ? ' --notes="' + args.notes + '"' : ""}`);
    process.exit(0);
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
    }),
  });
  try {
    const created = await db.stackBundle.create({
      data: {
        kind: "INSTALLER",
        overlayId: null,
        version: args.version,
        channel: args.channel ?? "stable",
        sha256,
        downloadUrl: args.url,
        sizeBytes,
        releaseNotes: args.notes ?? null,
        publishedBy: process.env.USER || process.env.USERNAME || null,
      },
    });
    console.log("");
    console.log("✅ installer registrado:");
    console.log(`   id:      ${created.id}`);
    console.log(`   version: ${created.version} · channel ${created.channel}`);
    console.log(`   url:     ${created.downloadUrl}`);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("Unique constraint")) {
      console.error(`Ya existe INSTALLER version ${args.version} en canal ${args.channel}. Usa --version distinta.`);
      process.exit(1);
    }
    throw err;
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
