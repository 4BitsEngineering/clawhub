/**
 * release-bundle.ts — empaqueta + registra una versión nueva de openclaw,
 * bridge u overlay en clawhub. NO sube a storage; sube tú el .tar.gz al
 * destino que prefieras (GitHub Release, Drive, R2…) y pega la URL pública.
 *
 * Uso:
 *   npx tsx scripts/release-bundle.ts \
 *     --kind=OVERLAY \
 *     --overlayId=asesoria \
 *     --version=2026.5.16 \
 *     --source="C:/Users/Nitropc/Desktop/OPENCLAW/asesoria" \
 *     --channel=stable \
 *     --url="https://github.com/4BitsEngineering/asesoria/releases/download/v2026.5.16/asesoria-2026.5.16.tar.gz" \
 *     --notes="Email himalaya en 4 agentes"
 *
 * Si pasas --url, registra directamente con esa URL (asume que ya subiste el
 * archivo). Si NO pasas --url, comprime el source y deja el .tar.gz local;
 * imprime el sha256 + tamaño para que subas a mano y luego corras de nuevo
 * con --url.
 *
 * Reusable para OPENCLAW (source = el repo openclaw) y BRIDGE (source = el
 * repo autonomous-agents).
 */
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { PrismaClient, StackBundleKind } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

type Args = {
  kind: string;
  overlayId?: string;
  version: string;
  source?: string;
  channel: string;
  url?: string;
  notes?: string;
  outDir?: string;
};

function parseArgs(): Args {
  const args: Partial<Args> = { channel: "stable" };
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    (args as Record<string, string>)[m[1]] = m[2];
  }
  if (!args.kind || !args.version) {
    console.error("Usage: tsx scripts/release-bundle.ts --kind=<OPENCLAW|BRIDGE|OVERLAY> --version=<v> [--overlayId=<id>] [--source=<dir>] [--url=<https://...>] [--channel=stable] [--notes=...] [--outDir=./dist]");
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

function packTarGz(sourceDir: string, outPath: string): Promise<void> {
  // Usa tar binario del sistema (presente en Windows 10+ y todos los Unix).
  // Excluye node_modules y .git por ahorrar peso.
  return new Promise((resolve, reject) => {
    const args = [
      "--exclude=node_modules",
      "--exclude=.git",
      "--exclude=.next",
      "--exclude=dist",
      "--exclude=.turbo",
      "-czf",
      outPath,
      "-C",
      path.dirname(sourceDir),
      path.basename(sourceDir),
    ];
    const p = spawn("tar", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (c) => { stderr += c.toString(); });
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tar exit ${code}: ${stderr}`));
    });
  });
}

async function main() {
  const args = parseArgs();
  const kind = args.kind as StackBundleKind;
  if (!["OPENCLAW", "BRIDGE", "OVERLAY"].includes(kind)) {
    throw new Error(`Invalid --kind: ${kind}`);
  }
  if (kind === "OVERLAY" && !args.overlayId) {
    throw new Error("--overlayId required for OVERLAY (e.g. asesoria, ai-office)");
  }

  let downloadUrl = args.url ?? null;
  let sha256 = "";
  let sizeBytes = 0;

  if (downloadUrl) {
    // Modo "ya subiste, registra". Asume que validaste sha256 al subir.
    if (!args.source) {
      console.warn("[release-bundle] --url sin --source: registrando sin verificar sha256");
      sha256 = process.env.RELEASE_SHA256 || "";
      sizeBytes = parseInt(process.env.RELEASE_SIZE || "0", 10);
      if (!sha256 || !sizeBytes) {
        throw new Error("sin --source, pasa RELEASE_SHA256 y RELEASE_SIZE env vars");
      }
    } else {
      // Empaqueta para verificar, luego registra
      const outDir = args.outDir || "./dist";
      fs.mkdirSync(outDir, { recursive: true });
      const tarPath = path.join(outDir, `${kind.toLowerCase()}-${args.overlayId ? args.overlayId + "-" : ""}${args.version}.tar.gz`);
      console.log(`[release-bundle] packing ${args.source} → ${tarPath}`);
      await packTarGz(path.resolve(args.source), tarPath);
      sha256 = await sha256File(tarPath);
      sizeBytes = fs.statSync(tarPath).size;
      console.log(`[release-bundle] sha256: ${sha256} · size: ${sizeBytes} bytes`);
      console.log(`[release-bundle] verifica que el archivo en --url tenga el mismo sha256.`);
    }
  } else {
    // Modo "empaqueta + dame los datos para subir"
    if (!args.source) throw new Error("--source required when --url not provided");
    const outDir = args.outDir || "./dist";
    fs.mkdirSync(outDir, { recursive: true });
    const tarPath = path.join(outDir, `${kind.toLowerCase()}-${args.overlayId ? args.overlayId + "-" : ""}${args.version}.tar.gz`);
    console.log(`[release-bundle] packing ${args.source} → ${tarPath}`);
    await packTarGz(path.resolve(args.source), tarPath);
    sha256 = await sha256File(tarPath);
    sizeBytes = fs.statSync(tarPath).size;
    console.log("");
    console.log("✅ bundle creado:");
    console.log(`   path:   ${path.resolve(tarPath)}`);
    console.log(`   sha256: ${sha256}`);
    console.log(`   size:   ${sizeBytes} bytes (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
    console.log("");
    console.log("Sube este archivo a tu destino (GitHub release, Drive…) y vuelve a correr con --url=<url>:");
    console.log(`   npx tsx scripts/release-bundle.ts --kind=${kind} ${args.overlayId ? "--overlayId=" + args.overlayId + " " : ""}--version=${args.version} --url=<HTTPS_URL> --source=${args.source}${args.notes ? ' --notes="' + args.notes + '"' : ""}`);
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
        kind,
        overlayId: kind === "OVERLAY" ? args.overlayId : null,
        version: args.version,
        channel: args.channel,
        sha256,
        downloadUrl,
        sizeBytes,
        releaseNotes: args.notes ?? null,
        publishedBy: process.env.USER || process.env.USERNAME || null,
      },
    });
    console.log("");
    console.log("✅ registrado en clawhub:");
    console.log(`   id:      ${created.id}`);
    console.log(`   kind:    ${created.kind}${created.overlayId ? " (" + created.overlayId + ")" : ""}`);
    console.log(`   version: ${created.version} · channel ${created.channel}`);
    console.log(`   url:     ${created.downloadUrl}`);
    console.log("");
    console.log("Para pinear esta versión a una firma:");
    console.log(`   npx tsx scripts/pin-firm-stack.ts --firmId=<UUID> --${kind.toLowerCase()}=${args.version}${args.overlayId ? " --overlayId=" + args.overlayId : ""}`);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("Unique constraint")) {
      console.error(`ya existe un bundle ${kind} version ${args.version} en canal ${args.channel}. Usa --version distinta o --channel beta.`);
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
