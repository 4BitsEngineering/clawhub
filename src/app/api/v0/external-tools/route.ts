/**
 * GET /api/v0/external-tools?nombre=HIMALAYA
 *
 * Devuelve el enlace de descarga de una herramienta externa (tabla
 * ExternalTools) que el instalador de escritorio necesita durante la
 * instalación. El instalador la llama en el paso de Node.js para bajar
 * `himalaya.exe`; así el binario se cambia desde clawhub sin recompilar.
 *
 * Auth: Bearer instance_token (el equipo ya está pareado en el paso 1).
 *
 * Response:
 *   { ok: true, nombre, enlace }                     200
 *   { error: "missing_nombre" }                       400
 *   { error: "invalid_token" }                        401
 *   { error: "not_found" }                            404
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateInstance } from "@/lib/instance-auth";

export async function GET(req: NextRequest) {
  const instance = await authenticateInstance(req);
  if (!instance) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const nombre = req.nextUrl.searchParams.get("nombre")?.trim();
  if (!nombre) {
    return NextResponse.json({ error: "missing_nombre" }, { status: 400 });
  }

  const tool = await db.externalTools.findFirst({
    where: { nombre },
    select: { nombre: true, enlace: true },
  });
  if (!tool || !tool.enlace) {
    return NextResponse.json({ error: "not_found", nombre }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...tool });
}
