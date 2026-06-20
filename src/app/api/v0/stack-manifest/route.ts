/**
 * GET /api/v0/stack-manifest
 *
 * El cliente desktop lo llama tras pairing y en cada heartbeat para saber qué
 * versiones de openclaw / bridge / overlay debe correr esta firma. Compara
 * con sus versions locales y descarga lo que falte.
 *
 * Auth: Bearer instance_token.
 *
 * Response:
 *   {
 *     ok: true,
 *     manifest: {
 *       openclaw: { version, sha256, downloadUrl, sizeBytes, releaseNotes? } | null,
 *       bridge:   { version, sha256, downloadUrl, sizeBytes, releaseNotes? } | null,
 *       overlay:  { overlayId, version, sha256, downloadUrl, sizeBytes, releaseNotes? } | null,
 *     },
 *     channel: "stable" | "beta",
 *     autoUpdate: bool,
 *   }
 *
 * Si la firma tiene NULL en alguna version, devolvemos el StackBundle más
 * reciente del canal en `Firm.stackChannel`. Si tiene una version pinned,
 * devolvemos ese bundle exacto (o null si ya no existe / está deprecado).
 *
 * El cliente puede mostrar al usuario "no hay bundle para tu overlay" si
 * `null` en algún campo — eso significa que el operator todavía no ha subido
 * ningún release.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { resolveDownloadUrl } from "@/lib/storage";
import { StackBundleKind } from "@/generated/prisma/client";

type ManifestEntry = {
  version: string;
  sha256: string;
  downloadUrl: string;
  sizeBytes: number;
  releaseNotes: string | null;
} | null;

async function resolveBundle(
  kind: StackBundleKind,
  overlayId: string | null,
  pinnedVersion: string | null,
  channel: string,
): Promise<ManifestEntry> {
  if (pinnedVersion) {
    const b = await db.stackBundle.findFirst({
      where: {
        kind,
        overlayId: kind === StackBundleKind.OVERLAY ? overlayId : null,
        version: pinnedVersion,
        channel,
        deprecatedAt: null,
      },
    });
    if (!b) return null;
    return {
      version: b.version,
      sha256: b.sha256,
      downloadUrl: await resolveDownloadUrl(b.downloadUrl),
      sizeBytes: b.sizeBytes,
      releaseNotes: b.releaseNotes,
    };
  }
  // NULL pinned → latest del canal
  const b = await db.stackBundle.findFirst({
    where: {
      kind,
      overlayId: kind === StackBundleKind.OVERLAY ? overlayId : null,
      channel,
      deprecatedAt: null,
    },
    orderBy: { releasedAt: "desc" },
  });
  if (!b) return null;
  return {
    version: b.version,
    sha256: b.sha256,
    downloadUrl: b.downloadUrl,
    sizeBytes: b.sizeBytes,
    releaseNotes: b.releaseNotes,
  };
}

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
    include: { firm: true },
  });
  if (!instance) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const firm = instance.firm;
  const channel = firm.stackChannel || "stable";

  const [openclaw, bridge, overlay] = await Promise.all([
    resolveBundle(StackBundleKind.OPENCLAW, null, firm.openclawVersion, channel),
    resolveBundle(StackBundleKind.BRIDGE, null, firm.bridgeVersion, channel),
    firm.overlayId
      ? resolveBundle(StackBundleKind.OVERLAY, firm.overlayId, firm.overlayVersion, channel)
      : null,
  ]);

  return NextResponse.json({
    ok: true,
    channel,
    autoUpdate: firm.stackAutoUpdate,
    overlayId: firm.overlayId,
    manifest: {
      openclaw,
      bridge,
      overlay: overlay
        ? { ...overlay, overlayId: firm.overlayId }
        : null,
    },
  });
}
