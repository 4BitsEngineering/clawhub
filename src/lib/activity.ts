/**
 * activity.ts — helper para escribir entradas del audit log universal.
 *
 * Diseño:
 *   - Una sola función `recordActivity(...)` desde server actions / route
 *     handlers. NUNCA throwea: si falla la escritura del audit, no debería
 *     hacer caer la operación principal — log a console y sigue.
 *   - `actor` se acepta como objeto explícito o se infiere de la session.
 *   - `kind` es libre formato "<dominio>.<verbo>" — ver doc de Activity en
 *     schema.prisma para vocabulario sugerido.
 *
 * Para queries usar Prisma directamente con `db.activity.findMany({...})`.
 */
import { db } from "@/lib/db";
import type { Session, SessionUser } from "@/lib/session";

export type ActorRole = "OPERATOR" | "FIRM_ADMIN" | "SYSTEM" | "INSTANCE";

export type ActivityActor =
  | { role: "OPERATOR" | "FIRM_ADMIN"; id: string; email: string }
  | { role: "SYSTEM"; label?: string }
  | { role: "INSTANCE"; instanceId: string };

export type RecordActivityInput = {
  /** Vocabulario libre: "command.create" | "baseline.apply" | … */
  kind: string;
  /** Texto humano para mostrar en timeline. */
  summary: string;
  /** Si la actividad pertenece a una firma concreta (la mayoría). */
  firmId?: string | null;
  /** Si la actividad afecta a una instancia concreta. */
  instanceId?: string | null;
  /** Quién provocó la acción. Si se pasa una Session se infiere. */
  actor: ActivityActor | Session;
  /** Detalles estructurados para hint visual / debugging. */
  metadata?: Record<string, unknown> | null;
};

function inferActor(
  raw: ActivityActor | Session,
): { actorId: string | null; actorEmail: string | null; actorRole: ActorRole } {
  // Si nos pasaron una Session entera, sacamos el user.
  if ("user" in raw) {
    const u = (raw as Session).user as SessionUser;
    return {
      actorId: u.id,
      actorEmail: u.email,
      actorRole: u.role as ActorRole,
    };
  }
  const a = raw;
  if (a.role === "OPERATOR" || a.role === "FIRM_ADMIN") {
    return { actorId: a.id, actorEmail: a.email, actorRole: a.role };
  }
  if (a.role === "INSTANCE") {
    return { actorId: a.instanceId, actorEmail: null, actorRole: "INSTANCE" };
  }
  // SYSTEM
  return { actorId: null, actorEmail: null, actorRole: "SYSTEM" };
}

export async function recordActivity(input: RecordActivityInput): Promise<void> {
  try {
    const { actorId, actorEmail, actorRole } = inferActor(input.actor);
    await db.activity.create({
      data: {
        firmId: input.firmId ?? null,
        instanceId: input.instanceId ?? null,
        actorId,
        actorEmail,
        actorRole,
        kind: input.kind,
        summary: input.summary,
        metadata: (input.metadata ?? null) as never,
      },
    });
  } catch (err) {
    // Audit log NUNCA debe cascar la operación principal.
    // eslint-disable-next-line no-console
    console.error(
      `[activity] recordActivity failed (kind=${input.kind}): ${(err as Error).message}`,
    );
  }
}

/**
 * Atajo para system events sin actor concreto.
 */
export function systemActor(label?: string): ActivityActor {
  return { role: "SYSTEM", label };
}

/**
 * Atajo para events del agent reportando estado.
 */
export function instanceActor(instanceId: string): ActivityActor {
  return { role: "INSTANCE", instanceId };
}
