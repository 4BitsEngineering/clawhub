import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

/**
 * Autentica una request a un endpoint /api/v0/* via Bearer instance_token.
 * Devuelve la Instance (con firmId) si OK, o null.
 */
export async function authenticateInstance(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const instance = await db.instance.findUnique({
    where: { instanceTokenHash: tokenHash },
  });
  return instance ?? null;
}
