import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

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
  });

  if (!instance) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

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
  await db.$transaction([
    db.heartbeat.create({
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
    }),
    db.instance.update({
      where: { id: instance.id },
      data: {
        lastHeartbeatAt: now,
        version: body.version ?? instance.version,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    next_heartbeat_in_s: 60,
    commands: [],
  });
}
