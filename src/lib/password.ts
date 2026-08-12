import crypto from "node:crypto";

// Hash de contraseñas con scrypt nativo de Node (memory-hard, sin
// dependencias). Formato almacenado: "scrypt$<salBase64>$<hashBase64>".
// Usado por el provider Credentials de NextAuth (src/lib/auth.ts).

const KEYLEN = 64;

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, KEYLEN);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "base64");
  const expected = Buffer.from(parts[2], "base64");
  const actual = crypto.scryptSync(plain, salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}
