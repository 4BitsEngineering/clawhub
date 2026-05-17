/**
 * POST /api/v0/baselines — sube un snapshot completo de la firma como nuevo
 * baseline. Auth: Bearer instance_token (agent autenticado). El baseline se
 * asocia a la firma de la instancia y su versión se incrementa
 * monotónicamente por firma.
 *
 * Body:
 *   {
 *     label: string,
 *     description?: string,
 *     files: [
 *       {
 *         path: string,           // ruta relativa al raíz del overlay
 *         category: FirmBaselineFileCategory,
 *         content: string,        // utf8 o base64 según isBinary
 *         sha256: string,
 *         sizeBytes: number,
 *         isBinary: boolean
 *       }
 *     ]
 *   }
 *
 * El insert se hace en una transacción: si algún FirmBaselineFile falla,
 * el FirmBaseline entero se desecha.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { FirmBaselineFileCategory } from "@/generated/prisma/client";
import { recordActivity, instanceActor } from "@/lib/activity";

const FileBody = z.object({
  path: z.string().min(1).max(500),
  category: z.enum([
    "OPENCLAW_CONFIG",
    "SKILL",
    "WORKSPACE",
    "ENTERPRISE",
    "OTHER",
  ]),
  content: z.string(),
  sha256: z.string().length(64),
  sizeBytes: z.number().int().nonnegative(),
  isBinary: z.boolean().default(false),
});

const Body = z.object({
  label: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  files: z.array(FileBody).min(1).max(2000),
});

// Tope blando por baseline (suma de sizeBytes). 20 MB cubre overlays grandes
// sin abrir la puerta a un upload accidental que llene Supabase.
const TOTAL_SIZE_CAP = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
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

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "bad_request", detail: (err as Error).message },
      { status: 400 },
    );
  }

  const totalBytes = body.files.reduce((s, f) => s + f.sizeBytes, 0);
  if (totalBytes > TOTAL_SIZE_CAP) {
    return NextResponse.json(
      { error: "baseline_too_large", totalBytes, cap: TOTAL_SIZE_CAP },
      { status: 413 },
    );
  }

  // Calculate next version for this firm — atomic against concurrent uploads
  // requires either a SERIALIZABLE tx or a unique constraint retry. Prisma
  // doesn't expose row locking trivially with @prisma/adapter-pg, so we use
  // the unique (firmId, version) constraint as the safety net: if two uploads
  // race, the second hits a 409 and retries.
  for (let attempt = 0; attempt < 3; attempt++) {
    const max = await db.firmBaseline.findFirst({
      where: { firmId: instance.firmId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (max?.version ?? 0) + 1;

    try {
      const created = await db.$transaction(async (tx) => {
        const baseline = await tx.firmBaseline.create({
          data: {
            firmId: instance.firmId,
            version: nextVersion,
            label: body.label,
            description: body.description ?? null,
            fileCount: body.files.length,
            totalBytes,
            sourceInstanceId: instance.id,
          },
        });
        // Bulk insert files — Prisma createMany doesn't error on dup so we
        // rely on the @@unique([baselineId, path]) constraint at the row
        // level. Duplicate paths in the input get caught here.
        await tx.firmBaselineFile.createMany({
          data: body.files.map((f) => ({
            baselineId: baseline.id,
            path: f.path,
            category: f.category as FirmBaselineFileCategory,
            content: f.content,
            sha256: f.sha256,
            sizeBytes: f.sizeBytes,
            isBinary: f.isBinary,
          })),
        });
        return baseline;
      });
      await recordActivity({
        kind: "baseline.create",
        summary: `Baseline v${created.version} "${created.label}" creado desde "${instance.workerLabel}" (${created.fileCount} archivos)`,
        firmId: instance.firmId,
        instanceId: instance.id,
        actor: instanceActor(instance.id),
        metadata: {
          baseline_id: created.id,
          version: created.version,
          label: created.label,
          file_count: created.fileCount,
          total_bytes: created.totalBytes,
        },
      });
      return NextResponse.json({
        ok: true,
        baseline_id: created.id,
        version: created.version,
        file_count: created.fileCount,
        total_bytes: created.totalBytes,
      });
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("Unique constraint") && msg.includes("firmId_version")) {
        // Race vs concurrent upload — retry with the next version number.
        continue;
      }
      return NextResponse.json(
        { error: "baseline_create_failed", detail: msg },
        { status: 500 },
      );
    }
  }
  return NextResponse.json(
    { error: "version_race_exhausted" },
    { status: 503 },
  );
}
