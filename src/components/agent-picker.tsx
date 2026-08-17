// Selector de equipo (change agent-selection-before-checkout).
// Server component sin estado: checkboxes nativos dentro del form de compra.
// Todos marcados por defecto; los MANDATORY (planner) van bloqueados con un
// hidden (los inputs disabled no se envían). El server action lee los campos
// agent_<id> con selectionFromFormData (agent-catalog.ts).
import { AGENT_CATALOG, MANDATORY_AGENTS } from "@/lib/agent-catalog";

export function AgentPicker() {
  const mandatory = new Set<string>(MANDATORY_AGENTS);
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {AGENT_CATALOG.map((a) => {
          const locked = mandatory.has(a.agent);
          return (
            <label
              key={a.agent}
              className={`card-paper rounded-xl p-4 flex items-start gap-3 ${
                locked ? "" : "cursor-pointer"
              } has-[:checked]:ring-2 has-[:checked]:ring-[var(--brand)]/40`}
            >
              {locked ? (
                <>
                  <input type="checkbox" checked disabled className="mt-1 h-4 w-4 accent-[var(--brand)]" />
                  <input type="hidden" name={`agent_${a.agent}`} value="1" />
                </>
              ) : (
                <input
                  type="checkbox"
                  name={`agent_${a.agent}`}
                  value="1"
                  defaultChecked
                  className="mt-1 h-4 w-4 accent-[var(--brand)]"
                />
              )}
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <span>{a.icon}</span> {a.displayName}
                </span>
                <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {locked
                    ? "Incluido siempre — coordina a tu equipo."
                    : a.blurb.split(".")[0] + "."}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
