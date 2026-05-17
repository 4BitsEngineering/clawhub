/**
 * POST /api/v0/commands/[id]/result
 *
 * El headless agent invoca este endpoint cuando termina de ejecutar un
 * comando (sea éxito o fallo). Auth: Bearer instance_token. Verifica que
 * el comando pertenezca a la instancia que se autentica.
 *
 * Body:
 *   {
 *     status: "completed" | "failed",
 *     result?: unknown,
 *     error?: string
 *   }
 *
 * Reglas:
 *   - Solo se acepta si el comando está en DISPATCHED (idempotente: una vez
 *     COMPLETED/FAILED/EXPIRED no se re-procesa).
 *   - status="failed" requiere `error` (string corto). result es opcional.
 *   - status="completed" requiere `result` o vacío (lo persistimos como `null`).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { InstanceCommandStatus, Prisma } from "@/generated/prisma/client";
import { recordActivity, instanceActor } from "@/lib/activity";

const ResultBody = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("completed"),
    result: z.unknown().optional(),
  }),
  z.object({
    status: z.literal("failed"),
    error: z.string().min(1).max(2000),
    result: z.unknown().optional(),
  }),
]);

export async function POST(
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

  let body: z.infer<typeof ResultBody>;
  try {
    body = ResultBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "bad_request", detail: (err as Error).message },
      { status: 400 },
    );
  }

  const command = await db.instanceCommand.findUnique({ where: { id } });
  if (!command) {
    return NextResponse.json({ error: "command_not_found" }, { status: 404 });
  }
  if (command.instanceId !== instance.id) {
    return NextResponse.json({ error: "command_not_for_this_instance" }, { status: 403 });
  }
  if (command.status !== InstanceCommandStatus.DISPATCHED) {
    return NextResponse.json(
      { error: "command_not_dispatched", current_status: command.status },
      { status: 409 },
    );
  }

  await db.instanceCommand.update({
    where: { id: command.id },
    data: {
      status:
        body.status === "completed"
          ? InstanceCommandStatus.COMPLETED
          : InstanceCommandStatus.FAILED,
      result:
        body.result === undefined
          ? Prisma.JsonNull
          : (body.result as Prisma.InputJsonValue),
      errorMessage: body.status === "failed" ? body.error : null,
      completedAt: new Date(),
    },
  });

  await recordActivity({
    kind: body.status === "completed" ? "command.complete" : "command.fail",
    summary:
      body.status === "completed"
        ? `Comando ${command.kind} ejecutado en "${instance.workerLabel}"`
        : `Comando ${command.kind} FALLÓ en "${instance.workerLabel}": ${body.status === "failed" ? body.error : ""}`,
    firmId: instance.firmId,
    instanceId: instance.id,
    actor: instanceActor(instance.id),
    metadata: {
      command_id: command.id,
      command_kind: command.kind,
      error: body.status === "failed" ? body.error : null,
    },
  });

  return NextResponse.json({ ok: true });
}
