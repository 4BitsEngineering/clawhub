/**
 * POST /api/operator/firms/[id]/suspend — kill-switch trigger.
 *
 * Marca una firma como suspendida (status="suspended"). Idempotente: suspender
 * una firma ya suspendida es OK (no es error).
 *
 * Auth: operator-session (rol OPERATOR). A diferencia de las server actions de
 * páginas (que usan requireOperator() → redirect), un route handler JSON
 * responde 401/403 explícitos.
 *
 * Body (JSON, opcional): { reason?: string }
 * Respuesta: { ok: true, firm: { id, status, suspendedAt, suspendedReason } }
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

  // Body opcional; tolerar cuerpo vacío o JSON inválido.
  let reason: string | undefined;
  try {
    const body = (await req.json()) as { reason?: unknown } | null;
    if (body && typeof body.reason === "string" && body.reason.trim()) {
      reason = body.reason.trim();
    }
  } catch {
    // Sin body o body no-JSON → reason por defecto.
  }

  const firm = await db.firm.findUnique({ where: { id } });
  if (!firm) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const suspendedReason = reason ?? "manual";
  const updated = await db.firm.update({
    where: { id },
    data: {
      status: "suspended",
      suspendedAt: new Date(),
      suspendedReason,
    },
    select: {
      id: true,
      status: true,
      suspendedAt: true,
      suspendedReason: true,
    },
  });

  await recordActivity({
    kind: "firm.suspended",
    summary: `Suspendió la firma ${firm.name} (${suspendedReason})`,
    firmId: firm.id,
    actor: session,
    metadata: { reason: suspendedReason },
  });

  return NextResponse.json({ ok: true, firm: updated });
}
