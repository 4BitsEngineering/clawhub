/**
 * GET /api/v0/installer?channel=stable
 *
 * Endpoint público (sin auth). Devuelve un redirect 302 al downloadUrl del
 * bundle INSTALLER más reciente del canal pedido (default: "stable").
 *
 * Diseñado para que el firm_admin pueda pasar al trabajador un link estable
 * tipo "https://ia-suite-chi.vercel.app/api/v0/installer?pairing=ABCD-EFGH"
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

// SO destino del instalador. Prioridad: query `?platform=` explícito (lo pasa el
// configurator) → detección por user-agent → "windows" por defecto.
function resolvePlatform(req: NextRequest, explicit: string | null): string {
  if (explicit === "windows" || explicit === "darwin" || explicit === "linux") {
    return explicit;
  }
  const ua = req.headers.get("user-agent") || "";
  if (/Macintosh|Mac OS/i.test(ua)) return "darwin";
  if (/Windows/i.test(ua)) return "windows";
  if (/Linux/i.test(ua)) return "linux";
  return "windows";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel") || "stable";
  const platform = resolvePlatform(req, searchParams.get("platform"));
  // pairing es opcional — futuro hook de telemetría/tracking.
  // const pairing = searchParams.get("pairing");

  const bundle = await db.stackBundle.findFirst({
    where: {
      kind: "INSTALLER",
      channel,
      platform,
      deprecatedAt: null,
    },
    orderBy: { releasedAt: "desc" },
  });
  if (!bundle) {
    return NextResponse.json(
      { error: "no_installer_published", channel, platform },
      { status: 404 },
    );
  }

  // 302 redirect → el browser descarga directamente desde el storage final.
  // No proxy-streaming desde Vercel para no pagar bandwidth ni hit límites
  // de timeout en functions (un .exe de 80MB excede el límite de Vercel
  // serverless edge). Si el downloadUrl es un path de Supabase Storage, lo
  // firmamos a una signed URL caducable; si ya es http(s), pasa-through.
  const resolved = await resolveDownloadUrl(bundle.downloadUrl);

  // Si la firma no fue posible (faltan SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
  // en el entorno), resolved es un path relativo y redirect() lanzaría un 500
  // opaco. Mejor un error claro y accionable.
  if (!/^https?:\/\//i.test(resolved)) {
    console.error(
      "[installer] No se pudo firmar la URL de descarga — ¿faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno?",
    );
    return NextResponse.json(
      { error: "download_unavailable", detail: "storage_signing_failed" },
      { status: 503 },
    );
  }

  return NextResponse.redirect(resolved, 302);
}
