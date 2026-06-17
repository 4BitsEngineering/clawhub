import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateInstanceToken } from "@/lib/tokens";
import { recordActivity, systemActor } from "@/lib/activity";

const PairBody = z.object({
  pairing_code: z.string().min(4).max(32),
  worker_label: z.string().min(1).max(120),
  version: z.string().min(1).max(40),
  os: z.string().max(40).optional(),
  // MAC del adaptador con ruta por defecto — identidad de máquina del PC.
  mac: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof PairBody>;
  try {
    body = PairBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "bad_request", detail: (err as Error).message },
      { status: 400 },
    );
  }

  const pairingToken = await db.pairingToken.findUnique({
    where: { code: body.pairing_code },
    include: { firm: true },
  });

  if (!pairingToken) {
    return NextResponse.json({ error: "code_not_found" }, { status: 404 });
  }
  if (pairingToken.usedAt) {
    return NextResponse.json({ error: "code_already_used" }, { status: 410 });
  }
  if (pairingToken.expiresAt < new Date()) {
    return NextResponse.json({ error: "code_expired" }, { status: 410 });
  }

  const isRepair = pairingToken.existingInstanceId != null;

  // Quota enforcement — solo en first-pair (re-pair no consume slot nuevo,
  // mantiene la instance_id). Bloqueamos si la firma ya consumió todos sus
  // seats. Activity logging para que el operator vea el bloqueo.
  if (!isRepair) {
    const instanceCount = await db.instance.count({
      where: { firmId: pairingToken.firmId },
    });
    if (instanceCount >= pairingToken.firm.seatsPurchased) {
      await recordActivity({
        kind: "pair.quota_blocked",
        summary: `Alta bloqueada: ${pairingToken.firm.name} alcanzó el límite de ${pairingToken.firm.seatsPurchased} PCs`,
        firmId: pairingToken.firmId,
        actor: systemActor("pair-endpoint"),
        metadata: {
          seats_purchased: pairingToken.firm.seatsPurchased,
          seats_used: instanceCount,
          attempted_label: body.worker_label,
        },
      });
      return NextResponse.json(
        {
          error: "quota_exceeded",
          seats_purchased: pairingToken.firm.seatsPurchased,
          seats_used: instanceCount,
        },
        { status: 403 },
      );
    }
  }

  const { plain, hash } = generateInstanceToken();

  let instance;
  if (isRepair) {
    // Re-pair: validar que la instance_id objetivo todavía existe y pertenece
    // a la misma firma del token (defensa en profundidad — el token ya está
    // vinculado, pero validamos por si la instance se borró entre la
    // generación del token y el uso).
    const existing = await db.instance.findUnique({
      where: { id: pairingToken.existingInstanceId! },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "target_instance_not_found" },
        { status: 410 },
      );
    }
    if (existing.firmId !== pairingToken.firmId) {
      return NextResponse.json({ error: "cross_firm_repair" }, { status: 403 });
    }

    const [updated] = await db.$transaction([
      db.instance.update({
        where: { id: existing.id },
        data: {
          instanceTokenHash: hash,
          workerLabel: body.worker_label,
          version: body.version,
          os: body.os ?? null,
          mac: body.mac ?? null,
        },
      }),
      db.pairingToken.update({
        where: { id: pairingToken.id },
        data: { usedAt: new Date() },
      }),
    ]);
    instance = updated;

    await recordActivity({
      kind: "instance.re_pair_completed",
      summary: `Re-pair completado en "${updated.workerLabel}" (instance ${updated.id.slice(0, 8)}…)`,
      firmId: pairingToken.firmId,
      instanceId: updated.id,
      actor: systemActor("pair-endpoint"),
      metadata: {
        worker_label: body.worker_label,
        version: body.version,
        os: body.os ?? null,
      },
    });
  } else {
    const [created] = await db.$transaction([
      db.instance.create({
        data: {
          instanceTokenHash: hash,
          firmId: pairingToken.firmId,
          workerLabel: body.worker_label,
          version: body.version,
          os: body.os ?? null,
          mac: body.mac ?? null,
        },
      }),
      db.pairingToken.update({
        where: { id: pairingToken.id },
        data: { usedAt: new Date() },
      }),
    ]);
    instance = created;

    await recordActivity({
      kind: "pair.success",
      summary: `Nuevo PC paireado: ${body.worker_label}`,
      firmId: pairingToken.firmId,
      instanceId: instance.id,
      actor: systemActor("pair-endpoint"),
      metadata: {
        worker_label: body.worker_label,
        version: body.version,
        os: body.os ?? null,
        pairing_code: body.pairing_code,
      },
    });
  }

  // Baseline promovido de la firma (lo dejó el configurator en /api/v0/register
  // o un firm_admin desde la UI). El instalador lo descarga con su nuevo
  // instance_token vía GET /api/v0/baselines/[id] para provisionar el overlay.
  const promoted = await db.firmBaseline.findFirst({
    where: { firmId: pairingToken.firmId, isPromoted: true },
    orderBy: { version: "desc" },
    select: { id: true, version: true },
  });

  return NextResponse.json({
    instance_id: instance.id,
    instance_token: plain,
    firm_id: pairingToken.firm.id,
    firm_name: pairingToken.firm.name,
    promoted_baseline_id: promoted?.id ?? null,
    promoted_baseline_version: promoted?.version ?? null,
  });
}
