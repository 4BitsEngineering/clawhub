// Cliente mínimo del proxy LiteLLM (litellm-token-provisioning).
// Alta y ciclo de vida de teams/virtual keys por firma. Doc de referencia:
// doc-litellm/ (fuera de git). Todas las llamadas usan la KEY-ADM
// (LITELLM_ADMIN_KEY) y timeouts cortos: los llamantes tratan el fallo como
// no-bloqueante (la compra/pair nunca se caen por el proxy).
//
// Convenciones: TEAM-<firmId8> / KEY-<firmId8>; modelo COMPARTIDO
// (LITELLM_MODEL_ALIAS) referenciado por todos los teams — el gasto se mide
// por team/key, no por modelo.

const TIMEOUT_MS = 15_000;

export const LITELLM_MODEL_ALIAS =
  process.env.LITELLM_MODEL_ALIAS ?? "MODEL-AIOFFICE-MINIMAX";
// Presupuesto mensual por seat. LiteLLM presupuesta en USD: default 16 ≈ 15 €.
export const LITELLM_BUDGET_PER_SEAT = Number(
  process.env.LITELLM_BUDGET_PER_SEAT ?? "16",
);
const TPM = Number(process.env.LITELLM_TPM ?? "100000");
const RPM = Number(process.env.LITELLM_RPM ?? "1000");

function config(): { baseUrl: string; adminKey: string } | null {
  const baseUrl = process.env.LITELLM_BASE_URL;
  const adminKey = process.env.LITELLM_ADMIN_KEY;
  if (!baseUrl || !adminKey) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), adminKey };
}

export function litellmConfigured(): boolean {
  return config() !== null;
}

export function litellmAliasFor(firmId: string): string {
  return firmId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const cfg = config();
  if (!cfg) throw new Error("LiteLLM no configurado (LITELLM_BASE_URL/ADMIN_KEY)");
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.adminKey}`,
      "Content-Type": "application/json",
    },
    body: body != null ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LiteLLM ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** Crea el team de una firma. Devuelve el team_id. */
export async function createTeam(firmId: string, seats: number): Promise<string> {
  const r = await call<{ team_id: string }>("POST", "/team/new", {
    team_alias: `TEAM-${litellmAliasFor(firmId)}`,
    max_budget: LITELLM_BUDGET_PER_SEAT * Math.max(1, seats),
    budget_duration: "30d",
    tpm_limit: TPM,
    rpm_limit: RPM,
    models: [LITELLM_MODEL_ALIAS],
  });
  if (!r.team_id) throw new Error("LiteLLM /team/new sin team_id");
  return r.team_id;
}

/** Busca un team por alias (idempotencia defensiva del alta). */
export async function findTeamByAlias(firmId: string): Promise<string | null> {
  const alias = `TEAM-${litellmAliasFor(firmId)}`;
  const r = await call<{ teams?: Array<{ team_id: string; team_alias: string }> }>(
    "GET",
    `/v2/team/list?team_alias=${encodeURIComponent(alias)}`,
  );
  const hit = (r.teams ?? []).find((t) => t.team_alias === alias);
  return hit?.team_id ?? null;
}

/**
 * Genera la virtual key del team. Devuelve la key en claro (única vez que se
 * ve — el llamante la cifra) y su id/hash (token_id) para block/unblock.
 */
export async function generateKey(
  firmId: string,
  teamId: string,
): Promise<{ key: string; keyId: string }> {
  const r = await call<{ key: string; token_id?: string; token?: string }>(
    "POST",
    "/key/generate",
    {
      key_alias: `KEY-${litellmAliasFor(firmId)}`,
      duration: "360d",
      team_id: teamId,
      models: ["all-team-models"],
      allowed_routes: ["llm_api_routes"],
    },
  );
  if (!r.key) throw new Error("LiteLLM /key/generate sin key");
  const keyId = r.token_id ?? r.token ?? "";
  if (!keyId) throw new Error("LiteLLM /key/generate sin token_id");
  return { key: r.key, keyId };
}

/** Borra la key por alias (para regenerar cuando el alias ya existe). */
export async function deleteKeyByAlias(firmId: string): Promise<void> {
  await call("POST", "/key/delete", {
    key_aliases: [`KEY-${litellmAliasFor(firmId)}`],
  });
}

/**
 * Alta idempotente de la key: los alias son ÚNICOS en todo el proxy, así que
 * si quedó una key huérfana de un intento anterior (generada pero no
 * persistida), se borra y se regenera. La key vieja deja de valer — correcto:
 * nunca llegó a ningún baseline.
 */
export async function provisionKey(
  firmId: string,
  teamId: string,
): Promise<{ key: string; keyId: string }> {
  try {
    return await generateKey(firmId, teamId);
  } catch (err) {
    if (!(err as Error).message.includes("already exists")) throw err;
    await deleteKeyByAlias(firmId);
    return await generateKey(firmId, teamId);
  }
}

/** Actualiza el presupuesto del team (ampliaciones de seats). */
export async function updateTeamBudget(
  teamId: string,
  seats: number,
): Promise<void> {
  await call("POST", "/team/update", {
    team_id: teamId,
    max_budget: LITELLM_BUDGET_PER_SEAT * Math.max(1, seats),
  });
}

/** Kill-switch por impago (y desbloqueo al regularizar). */
export async function blockKey(keyId: string): Promise<void> {
  await call("POST", "/key/block", { key: keyId });
}

export async function unblockKey(keyId: string): Promise<void> {
  await call("POST", "/key/unblock", { key: keyId });
}

/** Info del team (presupuesto/gasto) para el panel del operator. */
export async function teamInfo(teamId: string): Promise<{
  spend: number | null;
  maxBudget: number | null;
}> {
  const r = await call<{
    team_info?: { spend?: number; max_budget?: number };
  }>("GET", `/team/info?team_id=${encodeURIComponent(teamId)}`);
  return {
    spend: r.team_info?.spend ?? null,
    maxBudget: r.team_info?.max_budget ?? null,
  };
}
