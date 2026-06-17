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

/**
 * Genera un pairing code humano-friendly (formato XXXX-XXXX, 8 chars) sin
 * caracteres confusos (0/O/1/I/L). Es el código que el firm_admin (o el
 * configurator vía /api/v0/register) entrega al instalador para parear un PC.
 * Usa crypto.randomInt (sin sesgo de módulo) en lugar de Math.random.
 */
export function generatePairingCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I/L
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[crypto.randomInt(alphabet.length)];
    if (i === 3) code += "-";
  }
  return code;
}
