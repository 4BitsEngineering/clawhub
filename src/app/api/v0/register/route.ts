/**
 * POST /api/v0/register — registro de una instancia desde el CONFIGURATOR.
 *
 * Lo llama el SERVIDOR del configurator (no el navegador) cuando el cliente
 * termina el wizard en el step "Registro". En una sola llamada:
 *   1. Resuelve la firma: por `firm.id` (debe existir y estar `active`) o, si
 *      no se pasa id, la CREA por `firm.name` (alta de venta desde el wizard).
 *   2. Sube el paquete del wizard como un `FirmBaseline` PROMOVIDO de esa firma
 *      (base/openclaw.json, workspaces, skills, overlay-config… → categorías).
 *   3. Emite un `PairingToken.code` que el cliente lleva al instalador.
 *
 * El instalador luego hace `/api/v0/pair` con ese code → crea la `Instance`
 * (consume seat + registra la MAC) y descarga su baseline promovido para
 * provisionar. Reusa el flujo de pair existente sin tocarlo.
 *
 * Auth: `Authorization: Bearer ${OPERATOR_API_KEY}` (M2M — la misma key que
 * usa /api/v0/bundles/register; el configurator la guarda como secret de
 * servidor, NUNCA viaja al navegador).
 *
 * Body:
 *   {
 *     firm: { id?: string, name?: string, plan?: FirmPlan, seatsPurchased?: number },
 *     label: string,                 // etiqueta del baseline ("Wizard 17-jun")
 *     description?: string,
 *     files: [{ path, category, content, sha256, sizeBytes, isBinary }],
 *     pairing?: { expiresInMinutes?: number }   // default 7 días
 *   }
 *
 * Response 200:
 *   { ok, firm_id, firm_name, firm_created, pairing_code, expires_at,
 *     baseline_id, baseline_version, file_count, total_bytes }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generatePairingCode } from "@/lib/tokens";
import { FirmBaselineFileCategory } from "@/generated/prisma/client";
import { recordActivity, systemActor } from "@/lib/activity";

export const dynamic = "force-dynamic";

// Mismo tope que /api/v0/baselines: 20 MB por paquete (suma de sizeBytes).
const TOTAL_SIZE_CAP = 20 * 1024 * 1024;
// Código de instalación de larga vida: el cliente descarga el .exe y lo corre
// más tarde, así que 10 min (como el alta manual de trabajador) no sirve.
const DEFAULT_PAIRING_MINUTES = 7 * 24 * 60; // 7 días
const MAX_PAIRING_MINUTES = 30 * 24 * 60; // tope 30 días

const FileBody = z.object({
  path: z.string().min(1).max(500),
  category: z.enum(["OPENCLAW_CONFIG", "SKILL", "WORKSPACE", "ENTERPRISE", "OTHER"]),
  content: z.string(),
  sha256: z.string().length(64),
  sizeBytes: z.number().int().nonnegative(),
  isBinary: z.boolean().default(false),
});

const Body = z.object({
  firm: z
    .object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(200).optional(),
      plan: z.enum(["STARTER", "PRO", "BUSINESS", "ENTERPRISE"]).optional(),
      seatsPurchased: z.number().int().positive().max(10000).optional(),
      // Producto/overlay del que la firma recibe el stack. El bootstrapper lo
      // necesita: stack-manifest devuelve el bundle OVERLAY filtrado por
      // Firm.overlayId. Default "ai-office" (este control plane sirve ai-office).
      overlayId: z.string().min(1).max(80).optional(),
    })
    .refine((f) => f.id || f.name, {
      message: "firm.id o firm.name es obligatorio",
    }),
  label: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  files: z.array(FileBody).min(1).max(2000),
  pairing: z
    .object({ expiresInMinutes: z.number().int().positive().max(MAX_PAIRING_MINUTES).optional() })
    .optional(),
});

function checkAuth(req: NextRequest): boolean {
  const expected = process.env.OPERATOR_API_KEY;
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
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

  const totalBytes = body.files.reduce((s, f) => s + f.sizeBytes, 0);
  if (totalBytes > TOTAL_SIZE_CAP) {
    return NextResponse.json(
      { error: "package_too_large", totalBytes, cap: TOTAL_SIZE_CAP },
      { status: 413 },
    );
  }

  // 1) Resolver la firma — existente (debe estar active) o crear nueva.
  let firmCreated = false;
  let firm: { id: string; name: string };
  if (body.firm.id) {
    const existing = await db.firm.findUnique({
      where: { id: body.firm.id },
      select: { id: true, name: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "firm_not_found" }, { status: 404 });
    }
    if (existing.status !== "active") {
      return NextResponse.json(
        { error: "firm_not_active", status: existing.status },
        { status: 403 },
      );
    }
    firm = { id: existing.id, name: existing.name };
  } else {
    const created = await db.firm.create({
      data: {
        name: body.firm.name!,
        plan: body.firm.plan ?? undefined,
        seatsPurchased: body.firm.seatsPurchased ?? undefined,
        // Sin overlayId, stack-manifest devolvería overlay:null y el bootstrapper
        // no encontraría el bundle. Default al producto de este control plane.
        overlayId: body.firm.overlayId ?? "ai-office",
        status: "active",
      },
      select: { id: true, name: true },
    });
    firm = { id: created.id, name: created.name };
    firmCreated = true;
    await recordActivity({
      kind: "firm.create",
      summary: `Firma creada desde el configurator: ${created.name}`,
      firmId: created.id,
      actor: systemActor("configurator"),
      metadata: { plan: body.firm.plan ?? "STARTER", seats: body.firm.seatsPurchased ?? 5 },
    });
  }

  // 2) Subir el paquete como baseline PROMOVIDO. Versión monotónica por firma;
  // el @@unique([firmId, version]) protege contra carreras → reintento.
  let baseline: { id: string; version: number } | null = null;
  for (let attempt = 0; attempt < 3 && !baseline; attempt++) {
    const max = await db.firmBaseline.findFirst({
      where: { firmId: firm.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (max?.version ?? 0) + 1;
    try {
      baseline = await db.$transaction(async (tx) => {
        // Solo un baseline promovido por firma — desmarcar el anterior.
        await tx.firmBaseline.updateMany({
          where: { firmId: firm.id, isPromoted: true },
          data: { isPromoted: false, promotedAt: null, promotedBy: null },
        });
        const created = await tx.firmBaseline.create({
          data: {
            firmId: firm.id,
            version: nextVersion,
            label: body.label,
            description: body.description ?? null,
            fileCount: body.files.length,
            totalBytes,
            createdBy: "configurator",
            isPromoted: true,
            promotedAt: new Date(),
            promotedBy: "configurator",
          },
          select: { id: true, version: true },
        });
        await tx.firmBaselineFile.createMany({
          data: body.files.map((f) => ({
            baselineId: created.id,
            path: f.path,
            category: f.category as FirmBaselineFileCategory,
            content: f.content,
            sha256: f.sha256,
            sizeBytes: f.sizeBytes,
            isBinary: f.isBinary,
          })),
        });
        return created;
      });
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("Unique constraint") && msg.includes("firmId_version")) {
        continue; // carrera de versión — reintentar con la siguiente
      }
      return NextResponse.json(
        { error: "baseline_create_failed", detail: msg },
        { status: 500 },
      );
    }
  }
  if (!baseline) {
    return NextResponse.json({ error: "version_race_exhausted" }, { status: 503 });
  }

  // 3) Emitir el pairing code (first-pair: existingInstanceId = null → el pair
  // crea la Instance y consume seat). code es @unique → reintento ante colisión.
  const expiresInMinutes = body.pairing?.expiresInMinutes ?? DEFAULT_PAIRING_MINUTES;
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  let code: string | null = null;
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const candidate = generatePairingCode();
    try {
      await db.pairingToken.create({
        data: { firmId: firm.id, code: candidate, expiresAt },
      });
      code = candidate;
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("Unique constraint")) continue; // colisión rarísima
      return NextResponse.json(
        { error: "pairing_create_failed", detail: msg },
        { status: 500 },
      );
    }
  }
  if (!code) {
    return NextResponse.json({ error: "code_generation_failed" }, { status: 503 });
  }

  await recordActivity({
    kind: "register.configurator",
    summary: `Registro de ${firm.name} desde el configurator — baseline v${baseline.version} (${body.files.length} archivos), código emitido`,
    firmId: firm.id,
    actor: systemActor("configurator"),
    metadata: {
      firm_created: firmCreated,
      baseline_id: baseline.id,
      baseline_version: baseline.version,
      file_count: body.files.length,
      total_bytes: totalBytes,
      pairing_code: code,
      expires_at: expiresAt.toISOString(),
    },
  });

  return NextResponse.json({
    ok: true,
    firm_id: firm.id,
    firm_name: firm.name,
    firm_created: firmCreated,
    pairing_code: code,
    expires_at: expiresAt.toISOString(),
    baseline_id: baseline.id,
    baseline_version: baseline.version,
    file_count: body.files.length,
    total_bytes: totalBytes,
  });
}
