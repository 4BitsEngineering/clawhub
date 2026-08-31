// Selector de equipo (change agent-selection-before-checkout).
// Server component sin estado: cada agente es una tarjeta-chip clicable con el
// checkbox oculto (sr-only) y el estado pintado por CSS (:has(:checked)):
// apagada sobre el navy cuando está fuera, crema con borde amarillo y tic
// cuando está dentro. Los MANDATORY (planner) van fijos con un hidden (los
// inputs disabled no se envían). El server action lee los campos
// agent_<agentKey> con selectionFromFormDataDb (agent-catalog-db.ts).
//
// El catálogo sale de la BD (AgentCatalogEntry, agentKeys reales de clawcrew)
// vía catalogTeam(): la oferta de la landing y lo que el baseline puede
// materializar son siempre la misma lista.
import { MANDATORY_AGENTS } from "@/lib/agent-catalog";
import { catalogTeam } from "@/lib/agent-catalog-db";

const CREAM = "#f5efe4";
const NAVY_DEEP = "#082130";
const YELLOW = "#f2c94c";

function CheckBubble() {
  return (
    <span
      className="absolute top-2 right-2 hidden h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold group-has-[:checked]:flex"
      style={{ backgroundColor: YELLOW, color: NAVY_DEEP }}
    >
      ✓
    </span>
  );
}

export async function AgentPicker() {
  const catalog = await catalogTeam();
  const mandatory = new Set<string>(MANDATORY_AGENTS);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {catalog.map((a) => {
        const locked = mandatory.has(a.agent);
        if (locked) {
          return (
            <div
              key={a.agent}
              title={a.blurb}
              className="relative rounded-2xl p-4 flex flex-col items-center gap-1.5 text-center shadow-lg"
              style={{ backgroundColor: CREAM, color: NAVY_DEEP, border: `2px solid ${YELLOW}` }}
            >
              <input type="hidden" name={`agent_${a.agent}`} value="1" />
              <span
                className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ backgroundColor: YELLOW, color: NAVY_DEEP }}
              >
                ✓
              </span>
              <span className="text-3xl leading-none">{a.icon}</span>
              <span className="text-sm font-semibold leading-tight">{a.displayName}</span>
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "rgba(8,33,48,0.08)", color: "#6f6a5c" }}
              >
                siempre incluido
              </span>
            </div>
          );
        }
        return (
          <label
            key={a.agent}
            title={a.blurb}
            className="group relative cursor-pointer rounded-2xl p-4 flex flex-col items-center gap-1.5 text-center transition-all duration-150 border-2 border-transparent bg-white/5 text-[color:rgba(245,239,228,0.55)] hover:bg-white/10 has-[:checked]:bg-[#f5efe4] has-[:checked]:text-[#082130] has-[:checked]:border-[#f2c94c] has-[:checked]:shadow-lg"
          >
            <input
              type="checkbox"
              name={`agent_${a.agent}`}
              value="1"
              defaultChecked
              className="sr-only"
            />
            <CheckBubble />
            <span className="text-3xl leading-none transition-transform group-has-[:checked]:scale-105">
              {a.icon}
            </span>
            <span className="text-sm font-semibold leading-tight">{a.displayName}</span>
          </label>
        );
      })}
    </div>
  );
}
