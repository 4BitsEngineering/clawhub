/**
 * GET /api/v0/agents — catálogo público de roles de agente (librería clawcrew).
 *
 * Lectura abierta (sin auth): son datos de catálogo no sensibles —
 * nombres, taglines, retratos, paleta — el "escaparate" que un overlay
 * (ai-office) consume para mostrar qué agentes puede fichar. CORS abierto para
 * que el web del overlay lo lea cross-origin.
 *
 * Query params (todos opcionales):
 *   ?role=executive        filtra por rol funcional
 *   ?category=office        filtra por categoría
 *   ?overlay=ai-office      solo agentes compatibles (compatibleOverlays incluye el valor o "*")
 *   ?dressed=1              solo los que traen bloque presentation
 *   ?full=1                 incluye el manifest completo (pesado); por defecto se omite
 *   ?includeDeprecated=1    incluye los deprecados (por defecto fuera)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const role = sp.get("role");
  const category = sp.get("category");
  const overlay = sp.get("overlay");
  const dressed = sp.get("dressed") === "1";
  const full = sp.get("full") === "1";
  const includeDeprecated = sp.get("includeDeprecated") === "1";

  const entries = await db.agentCatalogEntry.findMany({
    where: {
      ...(includeDeprecated ? {} : { deprecatedAt: null }),
      ...(role ? { role } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: [{ category: "asc" }, { agentKey: "asc" }],
  });

  const agents = entries
    .filter((e) => !dressed || e.presentation !== null)
    .filter((e) => {
      if (!overlay) return true;
      const list = (e.compatibleOverlays as string[] | null) ?? [];
      return list.includes("*") || list.includes(overlay);
    })
    .map((e) => ({
      libraryId: e.libraryId,
      agentKey: e.agentKey,
      version: e.version,
      role: e.role,
      category: e.category,
      description: e.description,
      defaults: e.defaults,
      presentation: e.presentation,
      portraitUrl: e.portraitUrl,
      keywords: e.keywords ?? [],
      compatibleOverlays: e.compatibleOverlays ?? [],
      sourceCommit: e.sourceCommit,
      indexedAt: e.indexedAt.toISOString(),
      ...(full ? { manifest: e.manifest } : {}),
    }));

  return NextResponse.json({ count: agents.length, agents }, { headers: CORS });
}
