/**
 * GET /api/v0/installer?channel=stable
 *
 * Endpoint público (sin auth). Devuelve un redirect 302 al downloadUrl del
 * bundle INSTALLER más reciente del canal pedido (default: "stable").
 *
 * Diseñado para que el firm_admin pueda pasar al trabajador un link estable
 * tipo "https://clawhub-three.vercel.app/api/v0/installer?pairing=ABCD-EFGH"
 * sin tener que conocer la URL real del .exe (que puede vivir en GitHub
 * Releases, Drive, R2, etc.).
 *
 * Si se pasa ?pairing=<code>, en futuro lo podemos loguear para tracking
 * de "cuántas descargas por código". Hoy solo lo pasa-through al destino.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveDownloadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel") || "stable";
  // pairing es opcional — futuro hook de telemetría/tracking.
  // const pairing = searchParams.get("pairing");

  const bundle = await db.stackBundle.findFirst({
    where: {
      kind: "INSTALLER",
      channel,
      deprecatedAt: null,
    },
    orderBy: { releasedAt: "desc" },
  });
  if (!bundle) {
    return NextResponse.json(
      { error: "no_installer_published", channel },
      { status: 404 },
    );
  }

  // 302 redirect → el browser descarga directamente desde el storage final.
  // No proxy-streaming desde Vercel para no pagar bandwidth ni hit límites
  // de timeout en functions (un .exe de 80MB excede el límite de Vercel
  // serverless edge). Si el downloadUrl es un path de Supabase Storage, lo
  // firmamos a una signed URL caducable; si ya es http(s), pasa-through.
  return NextResponse.redirect(await resolveDownloadUrl(bundle.downloadUrl), 302);
}
