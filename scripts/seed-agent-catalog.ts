/**
 * seed-agent-catalog.ts — indexa la librería de agentes clawcrew en clawhub.
 *
 * Lee los manifest.json de `../clawcrew/agents/<role>/` (override con
 * CLAWCREW_PATH), copia el retrato de cada agente a clawhub/public/catalog/ y
 * hace upsert idempotente en AgentCatalogEntry. Luego siembra las 6 plantillas
 * de oficina por sector (OfficeTemplate), migradas desde
 * ai-office/web/src/lib/office-templates.ts y traducidas de slugs de ai-office
 * a agentKeys de clawcrew.
 *
 * Por qué seed local y no ingesta por API: clawhub corre en Vercel (FS de solo
 * lectura, sin clawcrew en runtime). Este script se ejecuta en local, donde
 * ambos repos coexisten, y escribe al Postgres remoto vía DIRECT_URL — mismo
 * patrón que seed-mcp-catalog.ts. Los retratos copiados a public/catalog/ se
 * versionan en clawhub y los sirve Vercel estáticamente (sin acoplar a storage,
 * en la línea de release-bundle.ts).
 *
 * Uso (desde la raíz de clawhub):
 *   npx tsx scripts/seed-agent-catalog.ts
 *   CLAWCREW_PATH=/ruta/a/clawcrew npx tsx scripts/seed-agent-catalog.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const LIBRARY_ID = "clawcrew";

// Raíz de clawcrew: env > hermano de clawhub (../clawcrew).
const CLAWCREW_DIR = process.env.CLAWCREW_PATH
  ? path.resolve(process.env.CLAWCREW_PATH)
  : path.resolve(process.cwd(), "..", "clawcrew");

const AGENTS_DIR = path.join(CLAWCREW_DIR, "agents");
// Destino de los retratos servibles por clawhub.
const PUBLIC_CATALOG_DIR = path.join(process.cwd(), "public", "catalog", LIBRARY_ID);

interface Manifest {
  id: string;
  version: string;
  role: string;
  category?: string;
  description?: string;
  defaults: Record<string, unknown>;
  keywords?: string[];
  compatibleOverlays?: string[];
  presentation?: {
    tagline?: string;
    mission?: string[];
    composer?: string;
    approvalNote?: string;
    portrait?: string;
    palette?: Record<string, string>;
  };
  [k: string]: unknown;
}

// slug de ai-office → agentKey (= manifest.id) de clawcrew.
const SLUG_TO_KEY: Record<string, string> = {
  elena: "executive",
  diego: "outbound-sdr",
  sofia: "community",
  mateo: "seo-writer",
  lucia: "legal-light",
};

// Plantillas por sector — fuente: ai-office/web/src/lib/office-templates.ts.
const TEMPLATES: {
  sector: string;
  name: string;
  emoji: string;
  description: string;
  slugs: string[];
  recommended?: boolean;
}[] = [
  { sector: "asesoria", name: "Asesoría o despacho", emoji: "📊", description: "Gestoría, abogados, consultoría", slugs: ["elena", "mateo", "lucia"] },
  { sector: "ecommerce", name: "E-commerce o tienda", emoji: "🛍️", description: "Venta online, retail, marca de producto", slugs: ["elena", "sofia", "mateo"] },
  { sector: "agencia", name: "Agencia o servicios B2B", emoji: "🚀", description: "Marketing, software, consultoría a empresas", slugs: ["elena", "diego", "sofia", "mateo"] },
  { sector: "clinica", name: "Clínica o salud", emoji: "🩺", description: "Dental, fisio, estética, bienestar", slugs: ["elena", "sofia", "mateo"] },
  { sector: "inmobiliaria", name: "Inmobiliaria", emoji: "🏠", description: "Compraventa y alquiler de inmuebles", slugs: ["elena", "diego", "sofia", "lucia"] },
  { sector: "general", name: "Otra cosa / aún no lo sé", emoji: "✨", description: "Empieza con el equipo completo", slugs: ["elena", "diego", "sofia", "mateo", "lucia"], recommended: true },
];

function clawcrewCommit(): string | null {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: CLAWCREW_DIR, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function readManifests(): { agentKey: string; dir: string; manifest: Manifest }[] {
  if (!fs.existsSync(AGENTS_DIR)) {
    throw new Error(`No existe ${AGENTS_DIR}. Pasa CLAWCREW_PATH=/ruta/a/clawcrew.`);
  }
  const out: { agentKey: string; dir: string; manifest: Manifest }[] = [];
  for (const entry of fs.readdirSync(AGENTS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(AGENTS_DIR, entry.name);
    const manifestPath = path.join(dir, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
    out.push({ agentKey: manifest.id ?? entry.name, dir, manifest });
  }
  return out.sort((a, b) => a.agentKey.localeCompare(b.agentKey));
}

/** Copia el retrato a public/catalog/<lib>/<agentKey>/portrait.png. Devuelve la URL servible o null. */
function copyPortrait(agentKey: string, dir: string, manifest: Manifest): string | null {
  const portraitRel = manifest.presentation?.portrait;
  if (!portraitRel) return null;
  const src = path.join(dir, portraitRel);
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠ ${agentKey}: presentation.portrait="${portraitRel}" pero no existe el fichero, omito retrato`);
    return null;
  }
  const destDir = path.join(PUBLIC_CATALOG_DIR, agentKey);
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, "portrait.png");
  fs.copyFileSync(src, dest);
  return `/catalog/${LIBRARY_ID}/${agentKey}/portrait.png`;
}

async function main() {
  const commit = clawcrewCommit();
  console.log(`📦 clawcrew: ${CLAWCREW_DIR}${commit ? ` @ ${commit}` : " (sin git)"}`);

  const manifests = readManifests();
  console.log(`   ${manifests.length} manifiestos encontrados`);

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! }),
  });

  try {
    // --- Catálogo de agentes ---
    let created = 0;
    let updated = 0;
    let withPortrait = 0;
    for (const { agentKey, dir, manifest } of manifests) {
      const portraitUrl = copyPortrait(agentKey, dir, manifest);
      if (portraitUrl) withPortrait++;

      const data = {
        libraryId: LIBRARY_ID,
        agentKey,
        version: manifest.version,
        role: manifest.role,
        category: manifest.category ?? "general",
        description: manifest.description ?? "",
        defaults: manifest.defaults as never,
        presentation: (manifest.presentation ?? null) as never,
        portraitUrl,
        keywords: (manifest.keywords ?? null) as never,
        compatibleOverlays: (manifest.compatibleOverlays ?? null) as never,
        manifest: manifest as never,
        sourceCommit: commit,
        indexedAt: new Date(),
      };

      const existing = await db.agentCatalogEntry.findUnique({
        where: { libraryId_agentKey: { libraryId: LIBRARY_ID, agentKey } },
      });
      if (existing) {
        await db.agentCatalogEntry.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await db.agentCatalogEntry.create({ data });
        created++;
      }
      console.log(`   ✓ ${agentKey} v${manifest.version}${manifest.presentation ? " · vestido" : ""}${portraitUrl ? " 🖼" : ""}`);
    }
    console.log(`✅ catálogo: ${created} nuevos, ${updated} actualizados, ${withPortrait}/${manifests.length} con retrato`);

    // --- Plantillas por sector ---
    const knownKeys = new Set(manifests.map((m) => m.agentKey));
    let tCreated = 0;
    let tUpdated = 0;
    for (let i = 0; i < TEMPLATES.length; i++) {
      const t = TEMPLATES[i];
      const agentKeys = t.slugs.map((s) => {
        const key = SLUG_TO_KEY[s];
        if (!key) throw new Error(`Plantilla ${t.sector}: slug "${s}" sin mapeo en SLUG_TO_KEY`);
        if (!knownKeys.has(key)) console.warn(`  ⚠ plantilla ${t.sector} referencia agentKey "${key}" que no está en el catálogo`);
        return key;
      });
      const data = {
        sector: t.sector,
        name: t.name,
        emoji: t.emoji,
        description: t.description,
        agentKeys: agentKeys as never,
        sortOrder: i,
        recommended: !!t.recommended,
        active: true,
      };
      const existing = await db.officeTemplate.findUnique({ where: { sector: t.sector } });
      if (existing) {
        await db.officeTemplate.update({ where: { id: existing.id }, data });
        tUpdated++;
      } else {
        await db.officeTemplate.create({ data });
        tCreated++;
      }
      console.log(`   ✓ plantilla ${t.sector}: [${agentKeys.join(", ")}]${t.recommended ? " (recomendada)" : ""}`);
    }
    console.log(`✅ plantillas: ${tCreated} nuevas, ${tUpdated} actualizadas, ${TEMPLATES.length} total`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
