import crypto from "node:crypto";

/**
 * Genera un instance_token de alta entropía (32 bytes base64url) y su hash
 * SHA-256. El plain se devuelve al cliente UNA vez (al parear); el hash se
 * persiste en DB para autenticación posterior.
 */
export function generateInstanceToken(): { plain: string; hash: string } {
  const plain = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(plain).digest("hex");
  return { plain, hash };
}

export function hashToken(plain: string): string {
  return crypto.createHash("sha256").update(plain).digest("hex");
}
