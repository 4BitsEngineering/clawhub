/**
 * GET /api/v0/office-templates — plantillas de oficina por sector.
 *
 * Cada plantilla mapea un sector a una lista ordenada de agentKeys del
 * catálogo. El conserje de activación de ai-office recomienda una según el
 * sector que elige el cliente. Lectura pública + CORS abierto (igual que
 * /api/v0/agents): no es dato sensible, lo consume el web del overlay.
 *
 * Query params:
 *   ?sector=asesoria       devuelve solo esa plantilla
 *   ?includeInactive=1     incluye las desactivadas (por defecto fuera)
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
  const sector = sp.get("sector");
  const includeInactive = sp.get("includeInactive") === "1";

  const rows = await db.officeTemplate.findMany({
    where: {
      ...(includeInactive ? {} : { active: true }),
      ...(sector ? { sector } : {}),
    },
    orderBy: { sortOrder: "asc" },
  });

  const templates = rows.map((t) => ({
    sector: t.sector,
    name: t.name,
    emoji: t.emoji,
    description: t.description,
    agentKeys: (t.agentKeys as string[] | null) ?? [],
    recommended: t.recommended,
    sortOrder: t.sortOrder,
  }));

  return NextResponse.json({ count: templates.length, templates }, { headers: CORS });
}
