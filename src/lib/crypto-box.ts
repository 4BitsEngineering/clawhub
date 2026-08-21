// Cifrado simétrico en reposo para secretos de terceros que necesitamos en
// claro (p. ej. la virtual key de LiteLLM que se inyecta en el baseline —
// litellm-token-provisioning). AES-256-GCM con clave derivada por scrypt de
// LITELLM_KEY_SECRET (secret propio, rotable sin tocar AUTH_SECRET).
//
// Formato almacenado: "v1$<ivBase64>$<cipher+tagBase64>". El webhook Deno
// escribe el mismo formato con Web Crypto (ver stripe-webhook/index.ts).
import crypto from "node:crypto";

const SCRYPT_SALT = "clawhub-litellm-box"; // fijo: la aleatoriedad va en el IV
const KEYLEN = 32;

function deriveKey(): Buffer {
  const secret = process.env.LITELLM_KEY_SECRET;
  if (!secret) throw new Error("LITELLM_KEY_SECRET no configurado");
  return crypto.scryptSync(secret, SCRYPT_SALT, KEYLEN);
}

export function encryptBox(plain: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const withTag = Buffer.concat([enc, cipher.getAuthTag()]);
  return `v1$${iv.toString("base64")}$${withTag.toString("base64")}`;
}

export function decryptBox(stored: string): string {
  const [version, ivB64, dataB64] = stored.split("$");
  if (version !== "v1" || !ivB64 || !dataB64) {
    throw new Error("crypto-box: formato desconocido");
  }
  const key = deriveKey();
  const iv = Buffer.from(ivB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const tag = data.subarray(data.length - 16);
  const enc = data.subarray(0, data.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
