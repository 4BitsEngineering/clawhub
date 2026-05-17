/**
 * POST /api/cron/sweep-offline — barrido periódico de instancias que llevan
 * >24h sin heartbeat.
 *
 * Auth: Bearer ${CRON_SECRET}. Vercel Cron envía este header si está
 * configurado en `vercel.json`. En dev se puede invocar manualmente con curl
 * + el mismo secret.
 *
 * Reglas:
 *   - Threshold: 24h sin heartbeat (configurable via ?hours=<n>).
 *   - Dedup: si ya existe una Activity de tipo "instance.offline_alert" para
 *     esa instancia en las últimas 24h, no la duplicamos.
 *   - Sin email provider real todavía → solo loggeamos a Activity. Cuando
 *     llegue Resend/SES, este endpoint añadirá el envío.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordActivity, systemActor } from "@/lib/activity";

export const dynamic = "force-dynamic";

const DEFAULT_HOURS = 24;

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Permitir en dev si no hay secret configurado, log warning
    if (process.env.NODE_ENV !== "production") {
      console.warn("[cron] CRON_SECRET no configurado — permitiendo en dev");
      return true;
    }
    return false;
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runSweep(req);
}

// Vercel Cron invoca GET por defecto; aceptamos ambos para flexibilidad.
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runSweep(req);
}

async function runSweep(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hours = parseInt(searchParams.get("hours") || String(DEFAULT_HOURS), 10);
  if (!Number.isFinite(hours) || hours < 1 || hours > 720) {
    return NextResponse.json({ error: "invalid_hours" }, { status: 400 });
  }
  const offlineSince = new Date(Date.now() - hours * 60 * 60 * 1000);
  const dedupWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Instancias con último heartbeat ANTERIOR al threshold, O sin heartbeat
  // nunca pero creadas hace más del threshold. Excluimos las que nunca han
  // hecho heartbeat Y son recientes (probablemente pareando ahora mismo).
  const candidates = await db.instance.findMany({
    where: {
      OR: [
        { lastHeartbeatAt: { lt: offlineSince } },
        {
          AND: [
            { lastHeartbeatAt: null },
            { createdAt: { lt: offlineSince } },
          ],
        },
      ],
    },
    select: {
      id: true,
      firmId: true,
      workerLabel: true,
      lastHeartbeatAt: true,
      createdAt: true,
      firm: { select: { name: true } },
    },
  });

  // Filtrar las que ya tienen una alerta reciente.
  const alertsRecent = await db.activity.findMany({
    where: {
      kind: "instance.offline_alert",
      createdAt: { gte: dedupWindow },
      instanceId: { in: candidates.map((c) => c.id) },
    },
    select: { instanceId: true },
  });
  const alreadyAlerted = new Set(alertsRecent.map((a) => a.instanceId));

  const newAlerts = candidates.filter((c) => !alreadyAlerted.has(c.id));

  for (const c of newAlerts) {
    const lastSeen = c.lastHeartbeatAt
      ? c.lastHeartbeatAt.toLocaleString("es-ES")
      : "nunca (instancia creada el " +
        c.createdAt.toLocaleString("es-ES") +
        ")";
    await recordActivity({
      kind: "instance.offline_alert",
      summary: `PC "${c.workerLabel}" sin heartbeat desde ${lastSeen}`,
      firmId: c.firmId,
      instanceId: c.id,
      actor: systemActor("offline-sweep"),
      metadata: {
        threshold_hours: hours,
        last_heartbeat_at: c.lastHeartbeatAt?.toISOString() ?? null,
        firm_name: c.firm.name,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    threshold_hours: hours,
    candidates: candidates.length,
    already_alerted: alreadyAlerted.size,
    new_alerts: newAlerts.length,
  });
}
