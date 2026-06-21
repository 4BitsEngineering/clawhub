/**
 * POST /api/operator/instances/[id]/disable — kill-switch POR INSTANCIA.
 *
 * Activa o desactiva una instancia individual (distinto de suspender la firma
 * entera). Cuando disabled=true, el heartbeat devuelve instance_status:
 * "disabled" y el bridge del cliente BLOQUEA el acceso al software
 * ("contacta con tu proveedor"). Idempotente.
 *
 * Auth: operator-session (rol OPERATOR).
 * Body (JSON): { disabled: boolean, reason?: string }
 * Respuesta: { ok: true, instance: { id, disabledAt, disabledReason } }
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "OPERATOR") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let disabled = true;
  let reason: string | undefined;
  try {
    const body = (await req.json()) as { disabled?: unknown; reason?: unknown } | null;
    if (body && typeof body.disabled === "boolean") disabled = body.disabled;
    if (body && typeof body.reason === "string" && body.reason.trim()) {
      reason = body.reason.trim();
    }
  } catch {
    // Sin body → por defecto disabled=true, reason="manual".
  }

  const instance = await db.instance.findUnique({
    where: { id },
    include: { firm: true },
  });
  if (!instance) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const updated = await db.instance.update({
    where: { id },
    data: disabled
      ? { disabledAt: new Date(), disabledReason: reason ?? "manual" }
      : { disabledAt: null, disabledReason: null },
    select: { id: true, disabledAt: true, disabledReason: true },
  });

  await recordActivity({
    kind: disabled ? "instance.disabled" : "instance.enabled",
    summary: `${disabled ? "Desactivó" : "Reactivó"} la instancia ${instance.workerLabel} de ${instance.firm.name}`
      + (disabled && reason ? ` (${reason})` : ""),
    firmId: instance.firmId,
    actor: session,
    metadata: { instanceId: instance.id, reason: reason ?? "manual" },
  });

  return NextResponse.json({ ok: true, instance: updated });
}
