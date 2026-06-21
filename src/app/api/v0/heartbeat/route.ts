import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { InstanceCommandStatus } from "@/generated/prisma/client";

const HeartbeatBody = z.object({
  instance_id: z.string().uuid(),
  version: z.string().optional(),
  uptime_s: z.number().int().nonnegative().optional(),
  cpu_pct: z.number().min(0).max(100).optional(),
  ram_mb: z.number().int().nonnegative().optional(),
  tokens_consumed_24h: z.number().int().nonnegative().optional(),
  last_error: z.string().nullable().optional(),
  extras: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 401 });
  }

  const tokenHash = hashToken(token);
  const instance = await db.instance.findUnique({
    where: { instanceTokenHash: tokenHash },
    include: { firm: true },
  });

  if (!instance) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const firm = instance.firm;
  // Firma suspendida (impago, baja, etc.) → seguimos monitorizando la
  // instancia (200 + heartbeat normal) pero NO le despachamos comandos.
  const firmActive = firm.status === "active";

  let body: z.infer<typeof HeartbeatBody>;
  try {
    body = HeartbeatBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "bad_request", detail: (err as Error).message },
      { status: 400 },
    );
  }

  if (body.instance_id !== instance.id) {
    return NextResponse.json({ error: "instance_id_mismatch" }, { status: 401 });
  }

  const now = new Date();

  // Heartbeat + Instance update + sweep de comandos expirados + fetch +
  // dispatch atómico de los pendientes en una sola transacción.
  const commandsToDispatch = await db.$transaction(async (tx) => {
    await tx.heartbeat.create({
      data: {
        instanceId: instance.id,
        receivedAt: now,
        cpuPct: body.cpu_pct ?? null,
        ramMb: body.ram_mb ?? null,
        tokensConsumed24h: body.tokens_consumed_24h ?? null,
        uptimeS: body.uptime_s ?? null,
        lastError: body.last_error ?? null,
        rawPayload: body as unknown as object,
      },
    });
    // Si el cliente reporta stack_versions, los denormalizamos en Instance
    // para que la UI haga diff rápido vs el manifest pinneado. Aceptamos
    // missing fields (null) — significa que el cliente todavía no ha
    // bootstrappeado esa capa.
    const stackVersions =
      (body.extras as { stack_versions?: {
        openclaw?: string | null;
        bridge?: string | null;
        overlay?: { overlayId?: string | null; version?: string | null } | null;
      } } | undefined)?.stack_versions;

    const instanceUpdate: Record<string, unknown> = {
      lastHeartbeatAt: now,
      version: body.version ?? instance.version,
    };
    if (stackVersions !== undefined) {
      instanceUpdate.runningOpenclawVersion = stackVersions.openclaw ?? null;
      instanceUpdate.runningBridgeVersion = stackVersions.bridge ?? null;
      instanceUpdate.runningOverlayId = stackVersions.overlay?.overlayId ?? null;
      instanceUpdate.runningOverlayVersion = stackVersions.overlay?.version ?? null;
    }

    await tx.instance.update({
      where: { id: instance.id },
      data: instanceUpdate,
    });

    // Sweep lazy: cualquier PENDING / DISPATCHED cuyo expiresAt ya pasó.
    await tx.instanceCommand.updateMany({
      where: {
        instanceId: instance.id,
        status: { in: [InstanceCommandStatus.PENDING, InstanceCommandStatus.DISPATCHED] },
        expiresAt: { lt: now },
      },
      data: { status: InstanceCommandStatus.EXPIRED, completedAt: now },
    });

    // Firma suspendida → no se despachan comandos remotos. Seguimos
    // registrando el heartbeat (arriba) pero devolvemos commands: [].
    if (!firmActive) {
      return [];
    }

    // Fetch PENDING vivos.
    const pending = await tx.instanceCommand.findMany({
      where: {
        instanceId: instance.id,
        status: InstanceCommandStatus.PENDING,
        expiresAt: { gte: now },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    if (pending.length > 0) {
      await tx.instanceCommand.updateMany({
        where: { id: { in: pending.map((c) => c.id) } },
        data: { status: InstanceCommandStatus.DISPATCHED, dispatchedAt: now },
      });
    }

    return pending;
  });

  return NextResponse.json({
    ok: true,
    next_heartbeat_in_s: 60,
    firm_status: firm.status,
    suspended_reason: firm.suspendedReason ?? undefined,
    // Kill-switch por instancia: el bridge bloquea el acceso si "disabled".
    instance_status: instance.disabledAt ? "disabled" : "active",
    disabled_reason: instance.disabledReason ?? undefined,
    commands: commandsToDispatch.map((c) => ({
      id: c.id,
      kind: c.kind,
      args: c.args ?? null,
      expires_at: c.expiresAt.toISOString(),
    })),
  });
}
