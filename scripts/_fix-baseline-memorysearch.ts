// Corrige el memorySearch fosilizado (ollama de dev en 127.0.0.1:11434) de los
// baselines YA publicados: lo reemplaza por { enabled: true, provider: "none" }
// (keyword-only FTS5, cero dependencias — verificado en openclaw 2026.6.11;
// mismo fix que openclaw-configurator dbe062c aplica a los baselines nuevos).
//
// Dry-run por defecto (lista lo que cambiaría). Aplicar de verdad:
//   npx tsx scripts/_fix-baseline-memorysearch.ts --apply
//
// Actualiza content + sha256 + sizeBytes del FirmBaselineFile afectado y deja
// el contenido previo en ./_baseline-backups/. SQL crudo cualificado
// (clawhub."...") porque el cliente Prisma generado no resuelve el schema.
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const APPLY = process.argv.includes("--apply");

type Row = {
  fileId: string; path: string; content: string;
  baselineId: string; version: number; isPromoted: boolean; label: string | null;
  firmName: string; firmStatus: string;
};

function fixMemorySearch(content: string): string | null {
  // Solo actuamos sobre el fósil exacto (provider ollama en agents.defaults).
  // Un baseline con otro proveedor elegido a conciencia no se toca.
  let parsed: any;
  try { parsed = JSON.parse(content); } catch { return null; }
  const ms = parsed?.agents?.defaults?.memorySearch;
  if (!ms || ms.provider !== "ollama") return null;
  parsed.agents.defaults.memorySearch = { enabled: true, provider: "none" };
  return JSON.stringify(parsed, null, 2);
}

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
    }),
  });
  const rows = await db.$queryRawUnsafe<Row[]>(`
    select f."id" as "fileId", f."path", f."content",
           b."id" as "baselineId", b."version", b."isPromoted", b."label",
           fi."name" as "firmName", fi."status" as "firmStatus"
    from clawhub."FirmBaselineFile" f
    join clawhub."FirmBaseline" b on b."id" = f."baselineId"
    join clawhub."Firm" fi on fi."id" = b."firmId"
    where f."content" like '%"memorySearch"%'
    order by fi."name", b."version"
  `);
  console.log(`Ficheros de baseline con memorySearch: ${rows.length}`);
  let changed = 0;
  for (const r of rows) {
    const fixed = fixMemorySearch(r.content);
    const tag = `${r.firmName} [${r.firmStatus}] · baseline v${r.version}${r.isPromoted ? " (PROMOTED)" : ""} · ${r.path}`;
    if (!fixed) { console.log(`  = sin fósil ollama: ${tag}`); continue; }
    changed++;
    if (!APPLY) { console.log(`  ~ CAMBIARÍA: ${tag}`); continue; }
    const backupDir = path.join(process.cwd(), "_baseline-backups");
    fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `${r.fileId}.openclaw.json.bak`);
    fs.writeFileSync(backupFile, r.content, "utf-8");
    const sha256 = crypto.createHash("sha256").update(fixed, "utf8").digest("hex");
    const sizeBytes = Buffer.byteLength(fixed, "utf8");
    await db.$executeRawUnsafe(
      `update clawhub."FirmBaselineFile" set "content" = $1, "sha256" = $2, "sizeBytes" = $3 where "id" = $4`,
      fixed, sha256, sizeBytes, r.fileId,
    );
    console.log(`  ✔ CORREGIDO: ${tag} (backup: ${backupFile})`);
  }
  console.log(APPLY ? `Aplicado a ${changed} fichero(s).` : `Dry-run: ${changed} fichero(s) por corregir. Añade --apply.`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
