/**
 * POST /api/v0/usage — el agent reporta una tanda de spans terminados.
 *
 * Auth: Bearer instance_token. Cada record se upsertea por (instanceId, spanId)
 * — idempotente, el agent puede reintentar sin duplicar.
 *
 * Body:
 *   {
 *     records: [
 *       {
 *         spanId: string,
 *         agentId: string,
 *         runId?: string,
 *         taskLabel?: string,
 *         model?: string,
 *         provider?: string,
 *         status?: string,
 *         inputTokens?: number,
 *         outputTokens?: number,
 *         cacheReadTokens?: number,
 *         cacheWriteTokens?: number,
 *         costUsd?: number,
 *         turnCount?: number,
 *         tokensSource?: string,
 *         startTime: iso8601,
 *         endTime: iso8601,
 *         durationMs?: number
 *       },
 *       ...
 *     ]
 *   }
 *
 * Response: { ok, accepted, deduped }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

const Record = z.object({
  spanId: z.string().min(1).max(128),
  agentId: z.string().min(1).max(120),
  runId: z.string().max(128).nullable().optional(),
  taskLabel: z.string().max(60).nullable().optional(),
  model: z.string().max(80).nullable().optional(),
  provider: z.string().max(40).nullable().optional(),
  status: z.string().max(20).nullable().optional(),
  inputTokens: z.number().int().nonnegative().nullable().optional(),
  outputTokens: z.number().int().nonnegative().nullable().optional(),
  cacheReadTokens: z.number().int().nonnegative().nullable().optional(),
  cacheWriteTokens: z.number().int().nonnegative().nullable().optional(),
  costUsd: z.number().nonnegative().nullable().optional(),
  turnCount: z.number().int().nonnegative().nullable().optional(),
  tokensSource: z.string().max(20).nullable().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
});

const Body = z.object({
  records: z.array(Record).min(0).max(1000),
});

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

  if (body.records.length === 0) {
    return NextResponse.json({ ok: true, accepted: 0, deduped: 0 });
  }

  // Upsert por (instanceId, spanId). Prisma no soporta upsertMany nativo, así
  // que iteramos. Para no perder records si uno falla, los procesamos uno por
  // uno fuera de transacción — el upsert es idempotente.
  let accepted = 0;
  let deduped = 0;
  for (const r of body.records) {
    try {
      const result = await db.usageRecord.upsert({
        where: {
          instanceId_spanId: { instanceId: instance.id, spanId: r.spanId },
        },
        update: {
          // Permitimos actualizar campos por si el bridge corrige numbers
          // tarde (e.g. spanUpdate.costUsd llega después que el insert
          // inicial). startTime/endTime no deberían cambiar.
          status: r.status ?? null,
          inputTokens: r.inputTokens ?? null,
          outputTokens: r.outputTokens ?? null,
          cacheReadTokens: r.cacheReadTokens ?? null,
          cacheWriteTokens: r.cacheWriteTokens ?? null,
          costUsd: r.costUsd ?? null,
          turnCount: r.turnCount ?? null,
          tokensSource: r.tokensSource ?? null,
          durationMs: r.durationMs ?? null,
        },
        create: {
          spanId: r.spanId,
          instanceId: instance.id,
          firmId: instance.firmId,
          agentId: r.agentId,
          runId: r.runId ?? null,
          taskLabel: r.taskLabel ?? null,
          model: r.model ?? null,
          provider: r.provider ?? null,
          status: r.status ?? null,
          inputTokens: r.inputTokens ?? null,
          outputTokens: r.outputTokens ?? null,
          cacheReadTokens: r.cacheReadTokens ?? null,
          cacheWriteTokens: r.cacheWriteTokens ?? null,
          costUsd: r.costUsd ?? null,
          turnCount: r.turnCount ?? null,
          tokensSource: r.tokensSource ?? null,
          startTime: new Date(r.startTime),
          endTime: new Date(r.endTime),
          durationMs: r.durationMs ?? null,
        },
      });
      if (result.createdAt.getTime() < Date.now() - 1000) deduped++;
      else accepted++;
    } catch (err) {
      // Logged but we keep going — partial success is better than 500 for
      // a batch where one record is malformed.
      console.error("[usage upsert]", r.spanId, (err as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    accepted,
    deduped,
    total: body.records.length,
  });
}
