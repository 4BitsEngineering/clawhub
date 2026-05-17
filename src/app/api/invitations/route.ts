/**
 * POST /api/invitations — crear nueva invitación.
 *
 * Auth: cookie de sesión (operator o firm_admin).
 *
 * Body: { email, firmId?, role? }
 *   - OPERATOR: puede crear cualquier invite (incl. role=OPERATOR, firmId=null).
 *   - FIRM_ADMIN: solo puede invitar FIRM_ADMINs a su propia firma. Los otros
 *     params son ignorados (se fijan a su firmId/role).
 *
 * Respuesta:
 *   { id, email, role, firmId, token, expiresAt, inviteUrl }
 *
 * El frontend muestra `inviteUrl` para que el invitador lo copie y lo
 * comparta por su canal habitual (Slack, WhatsApp, etc.).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { recordActivity } from "@/lib/activity";

const Body = z.object({
  email: z.string().email().toLowerCase(),
  firmId: z.string().uuid().nullable().optional(),
  role: z.enum(["OPERATOR", "FIRM_ADMIN"]).optional(),
});

const TOKEN_BYTES = 24; // 32 chars base64url
const EXPIRES_DAYS = 7;

function generateToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

function baseUrl(req: NextRequest): string {
  // En Vercel preferimos VERCEL_URL si está, si no usamos el host del request.
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  let targetFirmId: string | null = null;
  let targetRole: "OPERATOR" | "FIRM_ADMIN" = "FIRM_ADMIN";

  if (session.user.role === "OPERATOR") {
    targetFirmId = body.firmId ?? null;
    targetRole = body.role ?? "FIRM_ADMIN";
    // role=OPERATOR no debe tener firmId
    if (targetRole === "OPERATOR") targetFirmId = null;
    // role=FIRM_ADMIN debe tener firmId
    if (targetRole === "FIRM_ADMIN" && !targetFirmId) {
      return NextResponse.json(
        { error: "firmId_required_for_firm_admin" },
        { status: 400 },
      );
    }
  } else if (session.user.role === "FIRM_ADMIN") {
    if (!session.user.firmId) {
      return NextResponse.json({ error: "no_firm_on_session" }, { status: 403 });
    }
    targetFirmId = session.user.firmId;
    targetRole = "FIRM_ADMIN"; // FIRM_ADMIN no puede crear OPERATORs
  } else {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Si el firmId apunta a una firma inexistente → 400
  if (targetFirmId) {
    const exists = await db.firm.findUnique({
      where: { id: targetFirmId },
      select: { id: true, name: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "firm_not_found" }, { status: 400 });
    }
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await db.invitation.create({
    data: {
      email: body.email,
      firmId: targetFirmId,
      role: targetRole,
      token,
      expiresAt,
      createdById: session.user.id,
    },
  });

  await recordActivity({
    kind: "user.invite",
    summary: `Invitó a ${body.email} como ${targetRole}`,
    firmId: targetFirmId,
    actor: session,
    metadata: {
      invitation_id: invitation.id,
      email: body.email,
      role: targetRole,
    },
  });

  const inviteUrl = `${baseUrl(req)}/invite/${token}`;

  return NextResponse.json({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    firmId: invitation.firmId,
    token: invitation.token,
    expiresAt: invitation.expiresAt,
    inviteUrl,
  });
}
