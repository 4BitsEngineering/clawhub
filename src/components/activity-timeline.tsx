/**
 * activity-timeline.tsx — server-side component que renderiza un listado de
 * Activity con iconos por kind, agrupado por día.
 *
 * Recibe el array de Activity ya queryeado por el server component padre
 * (no hace queries por su cuenta — para que cada página filtre como quiera:
 * firma-wide, instance-wide, global).
 */
import type { Activity } from "@/generated/prisma/client";

type ActivityWithActor = Activity;

function kindEmoji(kind: string): string {
  if (kind.startsWith("pair.")) return "🔌";
  if (kind === "instance.delete") return "🗑";
  if (kind.startsWith("command.create")) return "📤";
  if (kind.startsWith("command.complete")) return "✅";
  if (kind.startsWith("command.fail")) return "⚠️";
  if (kind.startsWith("command.expire")) return "⌛";
  if (kind.startsWith("baseline.create")) return "📸";
  if (kind.startsWith("baseline.apply")) return "♻️";
  if (kind.startsWith("baseline.snapshot_request")) return "📨";
  if (kind.startsWith("stack.")) return "📦";
  if (kind.startsWith("skill.")) return "🛠";
  if (kind.startsWith("config.")) return "🔧";
  if (kind === "auth.signin") return "🔑";
  return "•";
}

function actorLabel(a: ActivityWithActor): string {
  if (a.actorRole === "INSTANCE") return "agent";
  if (a.actorRole === "SYSTEM") return "sistema";
  return a.actorEmail || a.actorId || "—";
}

function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function formatDayHeader(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Hoy";
  if (sameDay(date, yesterday)) return "Ayer";
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export function ActivityTimeline({
  activities,
  emptyMessage = "Sin actividad registrada.",
}: {
  activities: ActivityWithActor[];
  emptyMessage?: string;
}) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        {emptyMessage}
      </p>
    );
  }

  // Group by day
  const groups: { day: string; rows: ActivityWithActor[] }[] = [];
  for (const a of activities) {
    const day = formatDayHeader(a.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(a);
    else groups.push({ day, rows: [a] });
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.day} className="space-y-2">
          <div className="eyebrow text-[10px] text-muted-foreground">
            {g.day}
          </div>
          <ul className="space-y-1">
            {g.rows.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 py-1.5 text-sm leading-snug"
              >
                <span className="mt-0.5 shrink-0 select-none text-base">
                  {kindEmoji(a.kind)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-foreground">{a.summary}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {formatTime(a.createdAt)} · {actorLabel(a)} ·{" "}
                    <code className="font-mono text-[11px]">{a.kind}</code>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
