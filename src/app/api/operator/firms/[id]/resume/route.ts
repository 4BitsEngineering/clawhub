/**
 * POST /api/operator/firms/[id]/resume — revierte el kill-switch.
 *
 * Marca una firma como activa (status="active") y limpia suspendedAt /
 * suspendedReason. Idempotente: reanudar una firma ya activa es OK.
 *
 * Auth: operator-session (rol OPERATOR). Igual que suspend, responde 401/403
 * explícitos en vez de redirigir.
 *
 * Respuesta: { ok: true, firm: { id, status } }
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
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

  const firm = await db.firm.findUnique({ where: { id } });
  if (!firm) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const updated = await db.firm.update({
    where: { id },
    data: {
      status: "active",
      suspendedAt: null,
      suspendedReason: null,
    },
    select: {
      id: true,
      status: true,
    },
  });

  await recordActivity({
    kind: "firm.resumed",
    summary: `Reactivó la firma ${firm.name}`,
    firmId: firm.id,
    actor: session,
    metadata: null,
  });

  return NextResponse.json({ ok: true, firm: updated });
}
