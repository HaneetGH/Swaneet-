import { cookies } from "next/headers";
import { getDefaultAdminPin, verifyPin } from "@/lib/pin";

export const ADMIN_COOKIE = "swaneet_admin";
const TOKEN = "authenticated";

export async function getStoredPinHash() {
  // Lazy import avoids circular dependency with store/auth
  const { readStore } = await import("@/lib/store");
  const store = await readStore();
  return store.adminPinHash || null;
}

export async function verifyAdminPin(pin: string) {
  const storedHash = await getStoredPinHash();
  if (storedHash) {
    return verifyPin(pin, storedHash);
  }
  return pin === getDefaultAdminPin();
}

export async function isAuthenticated() {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === TOKEN;
}

export function authCookieValue() {
  return TOKEN;
}
