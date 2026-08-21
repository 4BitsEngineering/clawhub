import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateInstanceToken } from "@/lib/tokens";
import { recordActivity, systemActor } from "@/lib/activity";
import {
  defaultBaselineFiles,
  DEFAULT_BASELINE_LABEL,
  DEFAULT_BASELINE_DESCRIPTION,
  type BaselineLlm,
} from "@/lib/default-baseline";
import {
  litellmConfigured,
  findTeamByAlias,
  createTeam,
  provisionKey,
  LITELLM_MODEL_ALIAS,
} from "@/lib/litellm";
import { encryptBox, decryptBox } from "@/lib/crypto-box";

// Rate-limiting: ventana de 15 minutos, máximo 10 intentos FALLIDOS por IP.
// Los clientes legítimos aciertan a la primera — no se ven afectados.
const WINDOW_MINUTES = 15;
const MAX_FAILS = 10;

/**
 * SHA-256 hex de la IP REAL del cliente, o null si no se puede determinar de
 * forma fiable. En Vercel, `x-real-ip` y `x-vercel-forwarded-for` los fija la
 * plataforma con el peer IP real y NO son manipulables por el cliente. NO se usa
 * el left-most de `x-forwarded-for`: ese valor lo controla el cliente y permitiría
 * evadir el rate-limit enviando una IP distinta en cada request.
 */
function getClientIpHash(req: NextRequest): string | null {
  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-vercel-forwarded-for") ??
    null;
  if (!ip) return null;
  return createHash("sha256").update(ip.trim()).digest("hex");
}

const PairBody = z.object({
  pairing_code: z.string().min(4).max(32),
  worker_label: z.string().min(1).max(120),
  version: z.string().min(1).max(40),
  os: z.string().max(40).optional(),
  // MAC del adaptador con ruta por defecto — identidad de máquina del PC.
  mac: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof PairBody>;
  try {
    body = PairBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "bad_request", detail: (err as Error).message },
      { status: 400 },
    );
  }

  // ── Rate-limit gate ──────────────────────────────────────────────────────
  // Contar intentos FALLIDOS de esta IP en la ventana. Si se supera el límite,
  // rechazar antes de tocar la base de datos de tokens (evita timing oracle).
  // Solo aplicamos rate-limit cuando podemos determinar la IP de forma fiable
  // (en Vercel siempre). Si no, no agrupamos en un bucket compartido.
  const ipHash = getClientIpHash(req);
  if (ipHash) {
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000);
    const failCount = await db.pairAttempt.count({
      where: { ipHash, createdAt: { gte: windowStart } },
    });
    if (failCount >= MAX_FAILS) {
      return NextResponse.json(
        { error: "too_many_attempts", retry_after_minutes: WINDOW_MINUTES },
        { status: 429, headers: { "Retry-After": String(WINDOW_MINUTES * 60) } },
      );
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const pairingToken = await db.pairingToken.findUnique({
    where: { code: body.pairing_code },
    include: { firm: true },
  });

  if (!pairingToken) {
    if (ipHash) await db.pairAttempt.create({ data: { ipHash } });
    return NextResponse.json({ error: "code_not_found" }, { status: 404 });
  }
  if (pairingToken.usedAt) {
    if (ipHash) await db.pairAttempt.create({ data: { ipHash } });
    return NextResponse.json({ error: "code_already_used" }, { status: 410 });
  }
  if (pairingToken.expiresAt < new Date()) {
    if (ipHash) await db.pairAttempt.create({ data: { ipHash } });
    return NextResponse.json({ error: "code_expired" }, { status: 410 });
  }

  const isRepair = pairingToken.existingInstanceId != null;

  // Quota enforcement — solo en first-pair (re-pair no consume slot nuevo,
  // mantiene la instance_id). Bloqueamos si la firma ya consumió todos sus
  // seats. Activity logging para que el operator vea el bloqueo.
  if (!isRepair) {
    const instanceCount = await db.instance.count({
      where: { firmId: pairingToken.firmId },
    });
    if (instanceCount >= pairingToken.firm.seatsPurchased) {
      await recordActivity({
        kind: "pair.quota_blocked",
        summary: `Alta bloqueada: ${pairingToken.firm.name} alcanzó el límite de ${pairingToken.firm.seatsPurchased} PCs`,
        firmId: pairingToken.firmId,
        actor: systemActor("pair-endpoint"),
        metadata: {
          seats_purchased: pairingToken.firm.seatsPurchased,
          seats_used: instanceCount,
          attempted_label: body.worker_label,
        },
      });
      return NextResponse.json(
        {
          error: "quota_exceeded",
          seats_purchased: pairingToken.firm.seatsPurchased,
          seats_used: instanceCount,
        },
        { status: 403 },
      );
    }
  }

  const { plain, hash } = generateInstanceToken();

  let instance;
  if (isRepair) {
    // Re-pair: validar que la instance_id objetivo todavía existe y pertenece
    // a la misma firma del token (defensa en profundidad — el token ya está
    // vinculado, pero validamos por si la instance se borró entre la
    // generación del token y el uso).
    const existing = await db.instance.findUnique({
      where: { id: pairingToken.existingInstanceId! },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "target_instance_not_found" },
        { status: 410 },
      );
    }
    if (existing.firmId !== pairingToken.firmId) {
      return NextResponse.json({ error: "cross_firm_repair" }, { status: 403 });
    }

    const [updated] = await db.$transaction([
      db.instance.update({
        where: { id: existing.id },
        data: {
          instanceTokenHash: hash,
          workerLabel: body.worker_label,
          version: body.version,
          os: body.os ?? null,
          mac: body.mac ?? null,
        },
      }),
      db.pairingToken.update({
        where: { id: pairingToken.id },
        data: { usedAt: new Date() },
      }),
    ]);
    instance = updated;

    await recordActivity({
      kind: "instance.re_pair_completed",
      summary: `Re-pair completado en "${updated.workerLabel}" (instance ${updated.id.slice(0, 8)}…)`,
      firmId: pairingToken.firmId,
      instanceId: updated.id,
      actor: systemActor("pair-endpoint"),
      metadata: {
        worker_label: body.worker_label,
        version: body.version,
        os: body.os ?? null,
      },
    });
  } else {
    const [created] = await db.$transaction([
      db.instance.create({
        data: {
          instanceTokenHash: hash,
          firmId: pairingToken.firmId,
          workerLabel: body.worker_label,
          version: body.version,
          os: body.os ?? null,
          mac: body.mac ?? null,
        },
      }),
      db.pairingToken.update({
        where: { id: pairingToken.id },
        data: { usedAt: new Date() },
      }),
    ]);
    instance = created;

    await recordActivity({
      kind: "pair.success",
      summary: `Nuevo PC paireado: ${body.worker_label}`,
      firmId: pairingToken.firmId,
      instanceId: instance.id,
      actor: systemActor("pair-endpoint"),
      metadata: {
        worker_label: body.worker_label,
        version: body.version,
        os: body.os ?? null,
        pairing_code: body.pairing_code,
      },
    });
  }

  // Baseline promovido de la firma (lo dejó el configurator en /api/v0/register
  // o un firm_admin desde la UI). El instalador lo descarga con su nuevo
  // instance_token vía GET /api/v0/baselines/[id] para provisionar el overlay.
  let promoted = await db.firmBaseline.findFirst({
    where: { firmId: pairingToken.firmId, isPromoted: true },
    orderBy: { version: "desc" },
    select: { id: true, version: true, createdBy: true },
  });

  // Firmas creadas por compra (sin configurator) no tienen baseline. Provisionar
  // el baseline por defecto para que el instalador tenga qué provisionar. Solo
  // si no hay ninguno promovido — el del configurator/firm_admin tiene prioridad.
  // No bloqueante: si falla, devolvemos promoted=null y el pairing (identidad
  // del PC) no se pierde; se puede promover un baseline y reintentar la descarga.
  if (!promoted) {
    try {
      const created = await provisionDefaultBaseline(
        pairingToken.firmId,
        pairingToken.firm.name,
      );
      promoted = created ? { ...created, createdBy: "system-default" } : null;
      await recordActivity({
        kind: "baseline.default_provisioned",
        summary: `Baseline por defecto generado para "${pairingToken.firm.name}" al parear sin configurator`,
        firmId: pairingToken.firmId,
        instanceId: instance.id,
        actor: systemActor("pair-endpoint"),
        metadata: { baseline_id: promoted?.id ?? null },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[pair] Error provisionando baseline por defecto:", err);
    }
  } else if (promoted.createdBy === "system-default") {
    // El baseline por defecto es DERIVADO (plantilla + selección de agentes +
    // acceso LLM): en cada pair se refresca en sitio para que recoja cambios
    // posteriores a su creación (p. ej. la provisión de tokens de
    // litellm-token-provisioning llegó después de la compra original). Los
    // baselines del configurator/firm_admin NO se tocan. No bloqueante: si
    // falla el refresco, se sirve tal cual estaba.
    try {
      await refreshDefaultBaseline(
        promoted.id,
        pairingToken.firmId,
        pairingToken.firm.name,
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[pair] Error refrescando baseline por defecto:", err);
    }
  }

  return NextResponse.json({
    instance_id: instance.id,
    instance_token: plain,
    firm_id: pairingToken.firm.id,
    firm_name: pairingToken.firm.name,
    promoted_baseline_id: promoted?.id ?? null,
    promoted_baseline_version: promoted?.version ?? null,
  });
}

// Crea un FirmBaseline por defecto promovido para una firma que no tiene ninguno.
// Replica el patrón de /api/v0/register: versión monotónica por firma, desmarcar
// el promovido anterior (no habrá, pero por robustez) y crear files, todo en una
// transacción; retry ante colisión de @@unique([firmId, version]) por si dos PCs
// parean la misma firma a la vez.
// Acceso LLM de la firma (litellm-token-provisioning). El ALTA vive aquí (no
// en el webhook): el pair es el único momento donde la key hace falta en claro
// para inyectarla en el baseline, y así el cifrado existe solo en Node. Los
// reintentos son idempotentes (team por alias; key regenerada si quedó
// huérfana). Falla en silencio → baseline MiniMax (comportamiento previo).
async function resolveFirmLlm(
  firmId: string,
  tokenProvision: string | null,
): Promise<BaselineLlm | null> {
  if (tokenProvision !== "BUNDLED" || !litellmConfigured()) return null;
  const baseUrl = process.env.LITELLM_BASE_URL!;
  try {
    const firm = await db.firm.findUnique({
      where: { id: firmId },
      select: {
        litellmTeamId: true,
        litellmKeyEncrypted: true,
        seatsPurchased: true,
      },
    });
    if (!firm) return null;

    if (firm.litellmKeyEncrypted) {
      return {
        baseUrl,
        model: LITELLM_MODEL_ALIAS,
        apiKey: decryptBox(firm.litellmKeyEncrypted),
      };
    }

    // Alta (o reanudación de un alta a medias)
    const teamId =
      firm.litellmTeamId ??
      (await findTeamByAlias(firmId)) ??
      (await createTeam(firmId, firm.seatsPurchased));
    const { key, keyId } = await provisionKey(firmId, teamId);
    await db.firm.update({
      where: { id: firmId },
      data: {
        litellmTeamId: teamId,
        litellmKeyId: keyId,
        litellmKeyEncrypted: encryptBox(key),
        tokensBlocked: false,
      },
    });
    await recordActivity({
      kind: "tokens.provisioned",
      summary: `Acceso LLM provisionado (team + key en el proxy) al parear`,
      firmId,
      actor: systemActor("pair-endpoint"),
      metadata: { team_id: teamId },
    });
    return { baseUrl, model: LITELLM_MODEL_ALIAS, apiKey: key };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[pair] Error provisionando acceso LLM:", err);
    await recordActivity({
      kind: "tokens.provision_failed",
      summary: `Fallo provisionando acceso LLM al parear — baseline sin key (revisar proxy)`,
      firmId,
      actor: systemActor("pair-endpoint"),
      metadata: { error: String((err as Error).message).slice(0, 300) },
    }).catch(() => {});
    return null;
  }
}

// Regenera los files de un baseline system-default existente con el estado
// actual (plantilla, selección de agentes de la última compra y acceso LLM).
async function refreshDefaultBaseline(
  baselineId: string,
  firmId: string,
  firmName: string,
): Promise<void> {
  const lastPurchase = await db.purchase.findFirst({
    where: { firmId },
    orderBy: { createdAt: "desc" },
    select: { selectedAgents: true, tokenProvision: true },
  });
  const llm = await resolveFirmLlm(firmId, lastPurchase?.tokenProvision ?? null);
  const files = defaultBaselineFiles(firmName, lastPurchase?.selectedAgents, llm);
  const totalBytes = files.reduce((s, f) => s + f.sizeBytes, 0);
  await db.$transaction(async (tx) => {
    await tx.firmBaselineFile.deleteMany({ where: { baselineId } });
    await tx.firmBaselineFile.createMany({
      data: files.map((f) => ({
        baselineId,
        path: f.path,
        category: f.category,
        content: f.content,
        sha256: f.sha256,
        sizeBytes: f.sizeBytes,
        isBinary: f.isBinary,
      })),
    });
    await tx.firmBaseline.update({
      where: { id: baselineId },
      data: { fileCount: files.length, totalBytes },
    });
  });
}

async function provisionDefaultBaseline(
  firmId: string,
  firmName: string,
): Promise<{ id: string; version: number } | null> {
  // Equipo elegido en la compra (agent-selection-before-checkout): la última
  // compra de la firma manda; [] o sin compra = catálogo completo.
  const lastPurchase = await db.purchase.findFirst({
    where: { firmId },
    orderBy: { createdAt: "desc" },
    select: { selectedAgents: true, tokenProvision: true },
  });
  const llm = await resolveFirmLlm(
    firmId,
    lastPurchase?.tokenProvision ?? null,
  );
  const files = defaultBaselineFiles(
    firmName,
    lastPurchase?.selectedAgents,
    llm,
  );
  const totalBytes = files.reduce((s, f) => s + f.sizeBytes, 0);

  for (let attempt = 0; attempt < 3; attempt++) {
    // Reconsultar dentro del loop: si otro pair concurrente ya creó uno, salir.
    const existing = await db.firmBaseline.findFirst({
      where: { firmId, isPromoted: true },
      orderBy: { version: "desc" },
      select: { id: true, version: true },
    });
    if (existing) return existing;

    const max = await db.firmBaseline.findFirst({
      where: { firmId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (max?.version ?? 0) + 1;

    try {
      return await db.$transaction(async (tx) => {
        await tx.firmBaseline.updateMany({
          where: { firmId, isPromoted: true },
          data: { isPromoted: false, promotedAt: null, promotedBy: null },
        });
        const created = await tx.firmBaseline.create({
          data: {
            firmId,
            version: nextVersion,
            label: DEFAULT_BASELINE_LABEL,
            description: DEFAULT_BASELINE_DESCRIPTION,
            fileCount: files.length,
            totalBytes,
            createdBy: "system-default",
            isPromoted: true,
            promotedAt: new Date(),
            promotedBy: "system-default",
          },
          select: { id: true, version: true },
        });
        await tx.firmBaselineFile.createMany({
          data: files.map((f) => ({
            baselineId: created.id,
            path: f.path,
            category: f.category,
            content: f.content,
            sha256: f.sha256,
            sizeBytes: f.sizeBytes,
            isBinary: f.isBinary,
          })),
        });
        return created;
      });
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("Unique constraint") && msg.includes("firmId_version")) {
        continue; // carrera de versión — reintentar
      }
      throw err;
    }
  }
  return null;
}
