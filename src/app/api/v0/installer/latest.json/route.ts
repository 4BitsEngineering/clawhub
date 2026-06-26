/**
 * GET /api/v0/installer/latest.json
 *
 * Endpoint público (sin auth). Sirve el manifiesto de auto-update del INSTALADOR
 * en el formato que espera el plugin-updater de Tauri:
 *
 *   { version, pub_date, platforms: { "windows-x86_64": { signature, url } } }
 *
 * El manifiesto NO se construye aquí: la CI lo genera (con la firma del .exe y la
 * `url` apuntando a /api/v0/installer) y lo sube a Supabase como objeto fijo
 * `bundles/installer-ai-office-windows-latest.json`. Aquí solo lo firmamos a una
 * signed URL caducable y redirigimos 302 — igual que /api/v0/installer hace con el
 * propio .exe. El updater (reqwest) sigue el redirect y lee el JSON.
 *
 * Se mantiene privado el bucket: la signed URL evita exponer el storage.
 */
import { NextResponse } from "next/server";
import { resolveDownloadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Objeto fijo del manifiesto en Supabase (canal stable, windows). La CI lo
// sobrescribe (x-upsert) en cada release.
const MANIFEST_OBJECT = "bundles/installer-ai-office-windows-latest.json";

export async function GET() {
  const url = await resolveDownloadUrl(MANIFEST_OBJECT);
  // Si resolveDownloadUrl no pudo firmar (faltan envs) devuelve el path tal cual:
  // en ese caso no hay nada público que servir → 404 claro en vez de un redirect roto.
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { error: "manifest_unavailable" },
      { status: 404 },
    );
  }
  return NextResponse.redirect(url, 302);
}
