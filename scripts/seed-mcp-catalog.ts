/**
 * seed-mcp-catalog.ts — upserts el catálogo oficial de Model Context Protocol
 * servers en clawhub. Idempotente: re-correr lo actualiza pero no duplica.
 *
 * Los packages npm referenciados aquí son los oficiales mantenidos por la
 * comunidad MCP (modelcontextprotocol.io). Si Anthropic publica versiones
 * nuevas o un server se mueve, actualiza este archivo y vuelve a correrlo.
 *
 * Uso:
 *   npx tsx scripts/seed-mcp-catalog.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

type CatalogEntry = {
  slug: string;
  displayName: string;
  description: string;
  category: "fs" | "vcs" | "messaging" | "db" | "search" | "browser" | "ai" | "other";
  transport: "stdio" | "http" | "sse";
  launchCommand: string;
  launchArgs?: string[];
  npmPackage?: string;
  requiredEnvVars?: string[];
  configurableArgs?: {
    key: string;
    label: string;
    type: "string" | "number" | "boolean";
    defaultValue?: unknown;
    required?: boolean;
    helpText?: string;
  }[];
  docsUrl?: string;
  iconEmoji?: string;
  isOfficial?: boolean;
};

const CATALOG: CatalogEntry[] = [
  {
    slug: "filesystem",
    displayName: "Filesystem",
    description:
      "Acceso de lectura/escritura a directorios concretos del PC. Útil para que el agente lea documentos del trabajador o guarde resultados.",
    category: "fs",
    transport: "stdio",
    launchCommand: "npx",
    launchArgs: ["-y", "@modelcontextprotocol/server-filesystem"],
    npmPackage: "@modelcontextprotocol/server-filesystem",
    configurableArgs: [
      {
        key: "rootPath",
        label: "Ruta raíz permitida",
        type: "string",
        defaultValue: "C:/Users/Public/Documents",
        required: true,
        helpText: "El agente solo podrá leer/escribir dentro de esta ruta.",
      },
    ],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
    iconEmoji: "📁",
    isOfficial: true,
  },
  {
    slug: "github",
    displayName: "GitHub",
    description:
      "Acceso a repositorios GitHub: leer issues, PRs, commits, crear ramas. Requiere personal access token.",
    category: "vcs",
    transport: "stdio",
    launchCommand: "npx",
    launchArgs: ["-y", "@modelcontextprotocol/server-github"],
    npmPackage: "@modelcontextprotocol/server-github",
    requiredEnvVars: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
    iconEmoji: "🐙",
    isOfficial: true,
  },
  {
    slug: "slack",
    displayName: "Slack",
    description:
      "Lee canales, envía mensajes, gestiona usuarios. Necesita bot token de Slack y app token con scopes apropiados.",
    category: "messaging",
    transport: "stdio",
    launchCommand: "npx",
    launchArgs: ["-y", "@modelcontextprotocol/server-slack"],
    npmPackage: "@modelcontextprotocol/server-slack",
    requiredEnvVars: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
    iconEmoji: "💬",
    isOfficial: true,
  },
  {
    slug: "postgres",
    displayName: "PostgreSQL",
    description:
      "Consultas SQL de solo lectura sobre una base PostgreSQL. El agente puede explorar el esquema y obtener datos.",
    category: "db",
    transport: "stdio",
    launchCommand: "npx",
    launchArgs: ["-y", "@modelcontextprotocol/server-postgres"],
    npmPackage: "@modelcontextprotocol/server-postgres",
    configurableArgs: [
      {
        key: "connectionString",
        label: "Connection string",
        type: "string",
        required: true,
        helpText: "postgresql://user:pass@host:5432/dbname (solo lectura recomendado)",
      },
    ],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
    iconEmoji: "🐘",
    isOfficial: true,
  },
  {
    slug: "sqlite",
    displayName: "SQLite",
    description:
      "Acceso a una base SQLite local. Útil para datos del trabajador que viven en un archivo .db.",
    category: "db",
    transport: "stdio",
    launchCommand: "uvx",
    launchArgs: ["mcp-server-sqlite"],
    npmPackage: null as unknown as string,
    configurableArgs: [
      {
        key: "dbPath",
        label: "Ruta al archivo .db",
        type: "string",
        required: true,
        helpText: "C:/Users/.../data.db",
      },
    ],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite",
    iconEmoji: "🗄",
    isOfficial: true,
  },
  {
    slug: "brave-search",
    displayName: "Brave Search",
    description:
      "Búsqueda web vía Brave Search API. Free tier 2000 queries/mes — útil para investigación del agente sin coste extra.",
    category: "search",
    transport: "stdio",
    launchCommand: "npx",
    launchArgs: ["-y", "@modelcontextprotocol/server-brave-search"],
    npmPackage: "@modelcontextprotocol/server-brave-search",
    requiredEnvVars: ["BRAVE_API_KEY"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
    iconEmoji: "🦁",
    isOfficial: true,
  },
  {
    slug: "puppeteer",
    displayName: "Puppeteer (browser)",
    description:
      "Automatización de navegador headless: scraping, screenshots, fill forms. NO necesita API key — usa Chromium local.",
    category: "browser",
    transport: "stdio",
    launchCommand: "npx",
    launchArgs: ["-y", "@modelcontextprotocol/server-puppeteer"],
    npmPackage: "@modelcontextprotocol/server-puppeteer",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer",
    iconEmoji: "🤖",
    isOfficial: true,
  },
  {
    slug: "fetch",
    displayName: "Fetch (HTTP)",
    description:
      "Fetch HTTP genérico para que el agente lea URLs públicas. Más simple que Puppeteer si no necesitas browser real.",
    category: "search",
    transport: "stdio",
    launchCommand: "uvx",
    launchArgs: ["mcp-server-fetch"],
    npmPackage: null as unknown as string,
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
    iconEmoji: "🌐",
    isOfficial: true,
  },
  {
    slug: "google-drive",
    displayName: "Google Drive",
    description:
      "Lee/lista archivos del Drive del worker. Requiere OAuth setup local primero.",
    category: "fs",
    transport: "stdio",
    launchCommand: "npx",
    launchArgs: ["-y", "@modelcontextprotocol/server-gdrive"],
    npmPackage: "@modelcontextprotocol/server-gdrive",
    requiredEnvVars: ["GDRIVE_CREDENTIALS_PATH"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive",
    iconEmoji: "📂",
    isOfficial: true,
  },
  {
    slug: "memory",
    displayName: "Memory (knowledge graph)",
    description:
      "Persistencia simple tipo knowledge-graph para que el agente recuerde entidades y relaciones entre sesiones.",
    category: "ai",
    transport: "stdio",
    launchCommand: "npx",
    launchArgs: ["-y", "@modelcontextprotocol/server-memory"],
    npmPackage: "@modelcontextprotocol/server-memory",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
    iconEmoji: "🧠",
    isOfficial: true,
  },
];

async function main() {
  // Mismo schema dedicado que src/lib/db.ts: sin él, el adapter apunta a
  // `public` y las tablas de clawhub no existen ahí.
  const db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! },
      { schema: "clawhub" },
    ),
  });
  try {
    let created = 0;
    let updated = 0;
    for (const entry of CATALOG) {
      const data = {
        slug: entry.slug,
        displayName: entry.displayName,
        description: entry.description,
        category: entry.category,
        transport: entry.transport,
        launchCommand: entry.launchCommand,
        launchArgs: (entry.launchArgs ?? null) as never,
        npmPackage: entry.npmPackage ?? null,
        requiredEnvVars: (entry.requiredEnvVars ?? null) as never,
        configurableArgs: (entry.configurableArgs ?? null) as never,
        docsUrl: entry.docsUrl ?? null,
        iconEmoji: entry.iconEmoji ?? null,
        isOfficial: entry.isOfficial ?? false,
      };
      const existing = await db.mcpServerCatalog.findUnique({
        where: { slug: entry.slug },
      });
      if (existing) {
        await db.mcpServerCatalog.update({
          where: { id: existing.id },
          data,
        });
        updated++;
      } else {
        await db.mcpServerCatalog.create({ data });
        created++;
      }
    }
    console.log(`✅ MCP catalog seed: ${created} new, ${updated} updated, ${CATALOG.length} total`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
