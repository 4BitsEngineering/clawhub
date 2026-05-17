/**
 * POST /api/v0/bundles/register — registro automático de bundles desde CI/CD.
 *
 * Auth: `Authorization: Bearer ${OPERATOR_API_KEY}` (env var en clawhub +
 * secret de GitHub Actions en cada repo de bundles).
 *
 * Body:
 *   {
 *     kind: "OPENCLAW" | "BRIDGE" | "OVERLAY" | "INSTALLER",
 *     overlayId?: string,        // requerido si kind=OVERLAY
 *     version: string,
 *     channel?: string,          // default "stable"
 *     sha256: string,
 *     downloadUrl: string,
 *     sizeBytes: number,
 *     sourceCommit?: string,     // git SHA
 *     releaseNotes?: string,
 *     publishedBy?: string,      // identificador del workflow ("github-actions")
 *   }
 *
 * Idempotente: si ya existe (kind, overlayId, version, channel) devuelve
 * 409 con el bundle existente. Esto permite re-runs del workflow sin
 * duplicar.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { recordActivity, systemActor } from "@/lib/activity";

export const dynamic = "force-dynamic";

const Body = z.object({
  kind: z.enum(["OPENCLAW", "BRIDGE", "OVERLAY", "INSTALLER"]),
  overlayId: z.string().min(1).max(80).nullable().optional(),
  version: z.string().min(1).max(40),
  channel: z.string().min(1).max(40).optional(),
  sha256: z.string().length(64),
  downloadUrl: z.string().url(),
  sizeBytes: z.number().int().positive(),
  sourceCommit: z.string().min(7).max(64).optional(),
  releaseNotes: z.string().max(8000).optional(),
  publishedBy: z.string().min(1).max(120).optional(),
});

function checkAuth(req: NextRequest): boolean {
  const expected = process.env.OPERATOR_API_KEY;
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  // Constant-time compare-ish: zonas iguales, no necesitamos timing attack
  // resistance perfecta porque la key tiene 32+ bytes de entropía.
  return auth.slice("Bearer ".length).trim() === expected;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "bad_request", detail: (err as Error).message },
      { status: 400 },
    );
  }

  // OVERLAY requiere overlayId; otros NO deben tenerlo.
  if (body.kind === "OVERLAY" && !body.overlayId) {
    return NextResponse.json(
      { error: "overlayId_required_for_overlay_kind" },
      { status: 400 },
    );
  }
  if (body.kind !== "OVERLAY" && body.overlayId) {
    return NextResponse.json(
      { error: "overlayId_not_allowed_for_kind", kind: body.kind },
      { status: 400 },
    );
  }

  const channel = body.channel ?? "stable";

  try {
    const created = await db.stackBundle.create({
      data: {
        kind: body.kind,
        overlayId: body.kind === "OVERLAY" ? body.overlayId! : null,
        version: body.version,
        channel,
        sha256: body.sha256,
        downloadUrl: body.downloadUrl,
        sizeBytes: body.sizeBytes,
        releaseNotes: body.releaseNotes ?? null,
        sourceCommit: body.sourceCommit ?? null,
        publishedBy: body.publishedBy ?? "ci",
      },
    });

    await recordActivity({
      kind: "stack.bundle_publish",
      summary: `Registró ${body.kind}${body.overlayId ? `(${body.overlayId})` : ""} v${body.version} (${channel})`,
      actor: systemActor(body.publishedBy ?? "ci"),
      metadata: {
        bundle_id: created.id,
        kind: body.kind,
        overlayId: body.overlayId ?? null,
        version: body.version,
        channel,
        sha256: body.sha256,
        sizeBytes: body.sizeBytes,
        sourceCommit: body.sourceCommit ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      id: created.id,
      kind: created.kind,
      overlayId: created.overlayId,
      version: created.version,
      channel: created.channel,
    });
  } catch (err) {
    const msg = (err as Error).message ?? "";
    if (msg.includes("Unique constraint")) {
      // Ya existe — buscar el existente y devolverlo con 409
      const existing = await db.stackBundle.findFirst({
        where: {
          kind: body.kind,
          overlayId: body.kind === "OVERLAY" ? body.overlayId! : null,
          version: body.version,
          channel,
        },
      });
      return NextResponse.json(
        {
          error: "bundle_already_exists",
          existing,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "register_failed", detail: msg },
      { status: 500 },
    );
  }
}
