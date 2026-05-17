/**
 * GET /api/v0/baselines/[id] — descarga el baseline completo (manifest +
 * todos los files con su contenido). Auth: Bearer instance_token. Solo
 * accesible si el baseline pertenece a la firma de la instancia.
 *
 * Response:
 *   {
 *     baseline: { id, firmId, version, label, description, fileCount, totalBytes,
 *                 createdAt, sourceInstanceId },
 *     files: [{ path, category, content, sha256, sizeBytes, isBinary }, ...]
 *   }
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  const baseline = await db.firmBaseline.findUnique({
    where: { id },
    include: {
      files: {
        orderBy: { path: "asc" },
      },
    },
  });
  if (!baseline) {
    return NextResponse.json({ error: "baseline_not_found" }, { status: 404 });
  }
  if (baseline.firmId !== instance.firmId) {
    return NextResponse.json(
      { error: "baseline_not_in_firm" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    baseline: {
      id: baseline.id,
      firm_id: baseline.firmId,
      version: baseline.version,
      label: baseline.label,
      description: baseline.description,
      file_count: baseline.fileCount,
      total_bytes: baseline.totalBytes,
      created_at: baseline.createdAt.toISOString(),
      source_instance_id: baseline.sourceInstanceId,
    },
    files: baseline.files.map((f) => ({
      path: f.path,
      category: f.category,
      content: f.content,
      sha256: f.sha256,
      sizeBytes: f.sizeBytes,
      isBinary: f.isBinary,
    })),
  });
}
