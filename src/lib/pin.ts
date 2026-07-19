import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SCRYPT_KEYLEN = 64;

export function hashPin(pin: string, salt?: string) {
  const usedSalt = salt || randomBytes(16).toString("hex");
  const hash = scryptSync(pin, usedSalt, SCRYPT_KEYLEN).toString("hex");
  return `${usedSalt}:${hash}`;
}

export function verifyPin(pin: string, stored: string) {
  // Support legacy plain env comparison when stored is not a hash
  if (!stored.includes(":")) {
    const a = createHash("sha256").update(pin).digest();
    const b = createHash("sha256").update(stored).digest();
    return a.length === b.length && timingSafeEqual(a, b);
  }

  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const next = scryptSync(pin, salt, SCRYPT_KEYLEN);
  const prev = Buffer.from(hash, "hex");
  return prev.length === next.length && timingSafeEqual(prev, next);
}

export function getDefaultAdminPin() {
  return process.env.ADMIN_PIN || "swaneet10";
}
