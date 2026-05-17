/**
 * GET /api/v0/mcp-config
 *
 * El cliente desktop / headless lo llama cuando ejecuta el comando
 * `push_mcp_config`. Devuelve la lista de MCP servers que esta firma tiene
 * INSTALADOS+ACTIVOS, en formato directamente aplicable al openclaw.json
 * del worker.
 *
 * Auth: Bearer instance_token.
 *
 * Response:
 *   {
 *     ok: true,
 *     servers: [
 *       {
 *         slug,                    // identificador estable, para keying en openclaw.json
 *         displayName,
 *         transport,               // stdio|http|sse
 *         launchCommand,           // "npx" / "uvx"
 *         launchArgs,              // ["-y", "@modelcontextprotocol/server-foo"]
 *         npmPackage,              // si transport=stdio + npm-based
 *         requiredEnvVars,         // [] de nombres de vars que el worker debe tener
 *         configArgs               // valores firma-wide para argumentos custom
 *       }, ...
 *     ]
 *   }
 *
 * El agent fusiona esto con la sección `mcpServers` del openclaw.json local
 * preservando los secrets (env vars) que el worker haya configurado a mano.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 401 });
  }

  const instance = await db.instance.findUnique({
    where: { instanceTokenHash: hashToken(token) },
  });
  if (!instance) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const installs = await db.firmMcpInstall.findMany({
    where: {
      firmId: instance.firmId,
      enabled: true,
      catalog: { deprecatedAt: null },
    },
    include: { catalog: true },
  });

  const servers = installs.map((i) => ({
    slug: i.catalog.slug,
    displayName: i.catalog.displayName,
    transport: i.catalog.transport,
    launchCommand: i.catalog.launchCommand,
    launchArgs: i.catalog.launchArgs ?? null,
    npmPackage: i.catalog.npmPackage,
    requiredEnvVars: i.catalog.requiredEnvVars ?? null,
    configArgs: i.configArgs ?? null,
  }));

  return NextResponse.json({
    ok: true,
    firmId: instance.firmId,
    servers,
    count: servers.length,
  });
}
